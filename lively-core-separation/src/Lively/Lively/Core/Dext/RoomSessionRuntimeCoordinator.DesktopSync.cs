using System;
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
    private bool desktopScanStopped;

    private void QueueDesktopScan()
    {
        lock (desktopScanGate)
        {
            if (desktopScanStopped) return;
            desktopScanCancellation?.Cancel();
            desktopCatalog.Clear();
            actions.ClearDesktopPresentation();
            var cancellation = new CancellationTokenSource();
            desktopScanCancellation = cancellation;
            _ = Task.Run(() => ScanDesktopAsync(cancellation));
        }
    }

    private async Task ScanDesktopAsync(CancellationTokenSource cancellation)
    {
        var token = cancellation.Token;
        DesktopSyncScope? scope = null;
        try
        {
            token.ThrowIfCancellationRequested();
            var snapshot = CurrentSnapshot;
            if (snapshot is null) return;
            var editor = GetRoomPersonalEditor(snapshot.RoomId, snapshot.InstallationStamp);
            if (editor.Status != "accepted" || editor.Editor?.DesktopSync is not { Enabled: true } setting) return;
            scope = new DesktopSyncScope(snapshot.SessionId, snapshot.RoomId, snapshot.InstallationStamp, setting.DeskId);
            Guid ticket;
            lock (desktopScanGate)
            {
                token.ThrowIfCancellationRequested();
                ticket = desktopCatalog.Begin(scope);
                actions.SetDesktopProgress(scope.RoomId,scope.DeskId,"scanning");
            }
            var scan = DesktopDirectoryScanner.Scan(DesktopDirectoryScanner.SystemFolders(), token);
            var metadata = await DesktopShellMetadata.ReadAsync(scan.Items, token).ConfigureAwait(false);
            lock (desktopScanGate)
            {
                token.ThrowIfCancellationRequested();
                var confirmed = WithCoordinatorSession(scope.RoomId, scope.InstallationStamp, () => (RoomDesktopSync?)null,
                    (connection, peer, session) => session != scope.Session ? null : actions.CommitDesktopScan(connection, peer, session,
                        scope.RoomId, scope.InstallationStamp, editor.Editor.Revision, scope.DeskId,
                        scan.Items.Select(item => item.Id).ToArray(), scan.Issues.Count == 0 && !scan.Truncated));
                if (confirmed is null) { actions.SetDesktopProgress(scope.RoomId,scope.DeskId,"retry"); return; }
                if (desktopCatalog.Publish(ticket, scan, metadata, confirmed.Slots) && desktopCatalog.Read(scope) is { } view)
                    actions.PublishDesktopPresentation(scope.Session,scope.RoomId,scope.InstallationStamp,
                        new(view.ContextId,view.DeskId,view.Items.Select(item=>new RoomDesktopViewItem(item.Id,item.Name,item.Kind,item.Slot,item.IconPng)).ToArray(),view.IssueCount,view.Truncated),scan.Items.ToDictionary(item=>item.Id,item=>new PersonalTarget(item.Name,"file",item.FullPath),StringComparer.Ordinal));
                actions.SetDesktopProgress(scope.RoomId,scope.DeskId,"ready",scan.Issues.Count+(scan.Truncated?1:0));
                Logger.Info($"v3 desktop sync scanned | items={scan.Items.Count} | issues={scan.Issues.Count} | truncated={scan.Truncated}");
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { }
        catch (Exception error) {
            lock(desktopScanGate)if(scope is not null&&ReferenceEquals(desktopScanCancellation,cancellation)&&!token.IsCancellationRequested)
                actions.SetDesktopProgress(scope.RoomId,scope.DeskId,"error");
            Logger.Error(error, "v3 desktop scan failed; refresh to retry");
        }
        finally
        {
            lock (desktopScanGate)
            {
                if (ReferenceEquals(desktopScanCancellation, cancellation)) desktopScanCancellation = null;
                cancellation.Dispose();
            }
        }
    }

    private void StopDesktopScan()
    {
        lock (desktopScanGate)
        {
            desktopScanStopped = true;
            desktopScanCancellation?.Cancel();
            desktopCatalog.Clear();
            actions.ClearDesktopPresentation();
        }
    }
}
