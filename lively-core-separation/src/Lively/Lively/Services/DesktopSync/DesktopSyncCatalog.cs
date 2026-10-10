using System;
using System.Collections.Generic;
using System.Linq;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopSyncScope(Guid Session, string RoomId, string InstallationStamp, string DeskId);
internal sealed record DesktopSyncViewItem(string Id, string Name, string Kind, int Slot, string? IconPng);
internal sealed record DesktopSyncView(string ContextId, string DeskId, IReadOnlyList<DesktopSyncViewItem> Items, int IssueCount, bool Truncated);

// The official host receives a view; actual paths remain in this Core-only map.
// A caller must still validate a native user gesture before resolving/opening an item.
internal sealed class DesktopSyncCatalog
{
    private readonly object gate = new();
    private DesktopSyncScope? scope;
    private Guid ticket;
    private DesktopSyncView? view;
    private Dictionary<string, DesktopFileItem> files = new(StringComparer.Ordinal);
    internal Guid Begin(DesktopSyncScope next)
    {
        lock (gate)
        {
            // A refresh of the same desktop keeps its last confirmed presentation.
            // Changing session/installation/Desk immediately revokes the old paths.
            if (scope != next) { view = null; files.Clear(); }
            scope = next;
            ticket = Guid.NewGuid();
            return ticket;
        }
    }
    internal bool Publish(Guid expected, DesktopScanResult scan, IReadOnlyList<DesktopShellItem> metadata, IReadOnlyDictionary<string, int> slots)
    {
        DesktopSyncScope current;
        lock (gate)
        {
            if (expected == Guid.Empty || expected != ticket || scope is null) return false;
            current = scope;
        }
        var icons = metadata.ToDictionary(item => item.Id, StringComparer.Ordinal);
        var nextFiles = scan.Items.ToDictionary(item => item.Id, StringComparer.Ordinal);
        var items = scan.Items.Select(item =>
        {
            if (!slots.TryGetValue(item.Id, out var slot) || slot < 0 || slot >= 4096)
                throw new InvalidOperationException("Desktop item has no confirmed layout slot.");
            icons.TryGetValue(item.Id, out var icon);
            return new DesktopSyncViewItem(item.Id, icon?.Name ?? item.Name, item.Kind, slot, icon?.IconPng);
        }).OrderBy(item => item.Slot).ToArray();
        var next = new DesktopSyncView(expected.ToString("N"), current.DeskId, Array.AsReadOnly(items), scan.Issues.Count, scan.Truncated);
        lock (gate)
        {
            if (expected != ticket || current != scope) return false;
            // Health scans with identical content must not reset pagination or invalidate
            // an in-flight native click. Still replace the private file snapshot.
            if (view is not null && view.IssueCount == next.IssueCount &&
                view.Truncated == next.Truncated && view.Items.SequenceEqual(next.Items) &&
                files.Count == nextFiles.Count && nextFiles.All(pair =>
                    files.TryGetValue(pair.Key, out var old) &&
                    string.Equals(old.FullPath, pair.Value.FullPath, StringComparison.OrdinalIgnoreCase)))
                next = next with { ContextId = view.ContextId };
            files = nextFiles; view = next; return true;
        }
    }
    internal DesktopSyncView? Read(DesktopSyncScope current) { lock (gate) return current == scope ? view : null; }
    internal bool TryResolve(DesktopSyncScope current, string contextId, string id, out DesktopFileItem? file)
    {
        lock (gate)
        {
            file = null;
            return current == scope && view?.ContextId == contextId && files.TryGetValue(id, out file);
        }
    }
    internal void Clear() { lock (gate) { ticket = Guid.Empty; scope = null; view = null; files.Clear(); } }
}
