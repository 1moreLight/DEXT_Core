using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Lively.Services.DesktopSync;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private readonly object desktopScanGate = new();
    private readonly DesktopSyncCatalog desktopCatalog = new();
    private CancellationTokenSource? desktopScanCancellation;
    private bool desktopScanStopped, desktopScanRunning, desktopScanPending;
    private DesktopSyncScope? desktopScope;
    private DesktopMetadataCache desktopMetadata = new();
    private DesktopDirectoryWatcher? desktopWatcher;
    private object? desktopWatchGeneration;
    private readonly HashSet<string> desktopChangedPaths = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> desktopRenames = new(StringComparer.OrdinalIgnoreCase);

    // Lifecycle/settings changes revoke immediately. Ordinary refreshes preserve
    // the confirmed view and queue behind the active scan instead of starving it.
    private void QueueDesktopScan(bool reset = true)
    {
        lock (desktopScanGate)
        {
            if (desktopScanStopped) return;
            if (reset)
            {
                desktopScanCancellation?.Cancel();
                ResetDesktopWatchLocked();
            }
            ScheduleDesktopScanLocked();
        }
    }
    private void ScheduleDesktopScanLocked()
    {
        desktopScanPending = true;
        if (desktopScanRunning) return;
        desktopScanRunning = true;
        _ = Task.Run(RunDesktopScansAsync);
    }
    private void QueueDesktopWatch(object generation, DesktopWatchBatch batch)
    {
        lock (desktopScanGate)
        {
            if (desktopScanStopped || !ReferenceEquals(generation, desktopWatchGeneration)) return;
            foreach (var path in batch.Paths) desktopChangedPaths.Add(path);
            foreach (var rename in batch.Renames) desktopRenames[rename.OldPath] = rename.NewPath;
            // Full enumeration is performed for every batch, including overflow.
            if (desktopChangedPaths.Count > 4096 || desktopRenames.Count > 4096)
            { desktopChangedPaths.Clear(); desktopRenames.Clear(); desktopMetadata = new(); }
            ScheduleDesktopScanLocked();
        }
    }
    private async Task RunDesktopScansAsync()
    {
        while (true)
        {
            CancellationTokenSource cancellation;
            string[] changedPaths;
            Dictionary<string, string> renames;
            lock (desktopScanGate)
            {
                if (desktopScanStopped || !desktopScanPending) { desktopScanRunning = false; return; }
                desktopScanPending = false;
                changedPaths = desktopChangedPaths.ToArray(); desktopChangedPaths.Clear();
                renames = new(desktopRenames, StringComparer.OrdinalIgnoreCase); desktopRenames.Clear();
                cancellation = new(); desktopScanCancellation = cancellation;
            }
            try { await ScanDesktopAsync(cancellation, changedPaths, renames).ConfigureAwait(false); }
            finally
            {
                lock (desktopScanGate)
                {
                    if (ReferenceEquals(desktopScanCancellation, cancellation)) desktopScanCancellation = null;
                    cancellation.Dispose();
                }
            }
        }
    }
    private async Task ScanDesktopAsync(CancellationTokenSource cancellation, string[] changedPaths,
        IReadOnlyDictionary<string, string> renames)
    {
        var token = cancellation.Token;
        DesktopSyncScope? scope = null;
        try
        {
            token.ThrowIfCancellationRequested();
            var snapshot = CurrentSnapshot;
            var editor = snapshot is null ? null : GetRoomPersonalEditor(snapshot.RoomId, snapshot.InstallationStamp);
            if (snapshot is null || editor?.Status != "accepted" || editor.Editor?.DesktopSync is not { Enabled: true } setting)
            {
                lock (desktopScanGate) { token.ThrowIfCancellationRequested(); ResetDesktopWatchLocked(); }
                return;
            }
            scope = new(snapshot.SessionId, snapshot.RoomId, snapshot.InstallationStamp, setting.DeskId);
            Guid ticket;
            DesktopMetadataCache metadataCache;
            lock (desktopScanGate)
            {
                token.ThrowIfCancellationRequested();
                if (scope != desktopScope)
                {
                    ResetDesktopWatchLocked();
                    desktopScope = scope;
                    var generation = new object(); desktopWatchGeneration = generation;
                    desktopWatcher = new(DesktopDirectoryScanner.SystemFolders,
                        batch => QueueDesktopWatch(generation, batch),
                        error => Logger.Warn(error, "v3 desktop watcher will retry on health check"));
                }
                metadataCache = desktopMetadata;
                ticket = desktopCatalog.Begin(scope);
                actions.SetDesktopProgress(scope.RoomId, scope.DeskId, "scanning");
            }
            var scan = DesktopDirectoryScanner.Scan(DesktopDirectoryScanner.SystemFolders(), token);
            lock (desktopScanGate)
            {
                token.ThrowIfCancellationRequested();
                scan = desktopCatalog.MergeScan(ticket, scan);
            }
            var metadata = await metadataCache.ReadAsync(scan.Items, changedPaths, token).ConfigureAwait(false);
            var renameIds = renames.ToDictionary(pair => DesktopDirectoryScanner.IdentityForPath(pair.Key),
                pair => DesktopDirectoryScanner.IdentityForPath(pair.Value), StringComparer.Ordinal);
            lock (desktopScanGate)
            {
                token.ThrowIfCancellationRequested();
                RoomDesktopSync? confirmed = null;
                // Unrelated personal edits may advance the shared store revision.
                // Re-read once; Commit still verifies the exact active selection.
                for (var attempt = 0; attempt < 2 && confirmed is null; attempt++)
                {
                    if (attempt != 0) editor = GetRoomPersonalEditor(scope.RoomId, scope.InstallationStamp);
                    if (editor.Status != "accepted" || editor.Editor?.DesktopSync is not { Enabled: true } current || current.DeskId != scope.DeskId) break;
                    confirmed = WithCoordinatorSession(scope.RoomId, scope.InstallationStamp, () => (RoomDesktopSync?)null,
                        (connection, peer, session) => session != scope.Session ? null : actions.CommitDesktopScan(connection, peer, session,
                            scope.RoomId, scope.InstallationStamp, editor.Editor.Revision, scope.DeskId,
                            scan.Items.Select(item => item.Id).ToArray(), scan.Issues.Count == 0 && !scan.Truncated, renameIds));
                }
                if (confirmed is null) { actions.SetDesktopProgress(scope.RoomId, scope.DeskId, "retry"); return; }
                if (desktopCatalog.Publish(ticket, scan, metadata, confirmed.Slots) && desktopCatalog.Read(scope) is { } view)
                    actions.PublishDesktopPresentation(scope.Session, scope.RoomId, scope.InstallationStamp,
                        new(view.ContextId, view.DeskId, view.Items.Select(item => new RoomDesktopViewItem(item.Id, item.Name, item.Kind, item.Slot, item.IconPng)).ToArray(), view.IssueCount, view.Truncated),
                        scan.Items.ToDictionary(item => item.Id, item => new PersonalTarget(item.Name, "file", item.FullPath), StringComparer.Ordinal));
                actions.SetDesktopProgress(scope.RoomId, scope.DeskId, "ready", scan.Issues.Count + (scan.Truncated ? 1 : 0));
                Logger.Info($"v3 desktop sync scanned | items={scan.Items.Count} | issues={scan.Issues.Count} | truncated={scan.Truncated}");
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { }
        catch (Exception error)
        {
            lock (desktopScanGate)
                if (scope is not null && ReferenceEquals(desktopScanCancellation, cancellation) && !token.IsCancellationRequested)
                    actions.SetDesktopProgress(scope.RoomId, scope.DeskId, "error");
            Logger.Error(error, "v3 desktop scan failed; watcher health check will retry");
        }
    }
    private void ResetDesktopWatchLocked()
    {
        desktopWatchGeneration = null;
        desktopWatcher?.Dispose(); desktopWatcher = null;
        desktopScope = null; desktopMetadata = new();
        desktopChangedPaths.Clear(); desktopRenames.Clear();
        desktopCatalog.Clear(); actions.ClearDesktopPresentation();
    }
    private void StopDesktopScan()
    {
        lock (desktopScanGate)
        {
            desktopScanStopped = true;
            desktopScanPending = false;
            desktopScanCancellation?.Cancel();
            ResetDesktopWatchLocked();
        }
    }
}