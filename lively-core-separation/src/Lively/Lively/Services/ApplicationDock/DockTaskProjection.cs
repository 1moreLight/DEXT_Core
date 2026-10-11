using System;
using System.Collections.Generic;
using System.Linq;

namespace Lively.Services.ApplicationDock;

// Display-only records: source paths, launch settings and native handles stay in Core.
internal sealed record DockTaskViewWindow(string Id, string Title, bool Active);
internal sealed record DockTaskViewItem(string Id, string Name, bool Pinned, bool Active, IReadOnlyList<DockTaskViewWindow> Windows) { public string IconPng { get; init; } }
internal sealed record DockTaskViewSnapshot(string ContextId, long Sequence, IReadOnlyList<DockTaskViewItem> Items);

// Owned by the Core dispatcher. Does not execute actions or attest user input.
internal sealed class DockTaskProjection
{
    private sealed record WindowKey(long Handle, int ProcessId, string Target);
    private sealed record WindowEntry(string Id, DockTask Task);
    private sealed record Entry(string Id, DockGroup Group, Dictionary<WindowKey, WindowEntry> Windows);
    private string contextKey, contextId;
    private long sequence;
    private Dictionary<string, Entry> entries = new(StringComparer.Ordinal);

    private static string NewId() => Guid.NewGuid().ToString("N");
    private static WindowKey Identity(DockTask task) => new(task.Handle, task.ProcessId, DockModel.Identity(task.Target));

    public DockTaskViewSnapshot Update(string nextContextKey, IReadOnlyList<DockGroup> groups, long foreground)
    {
        if (string.IsNullOrWhiteSpace(nextContextKey)) throw new ArgumentException("A context is required.", nameof(nextContextKey));
        if (groups is null) throw new ArgumentNullException(nameof(groups));
        var nextEntries = new Dictionary<string, Entry>(StringComparer.Ordinal);
        var seenHandles = new HashSet<long>();
        var items = new List<DockTaskViewItem>(groups.Count);
        var sameContext = contextKey == nextContextKey;
        var nextContextId = sameContext ? contextId : NewId();
        var nextSequence = checked(sequence + 1);
        foreach (var group in groups)
        {
            if (group is null || string.IsNullOrWhiteSpace(group.Key) || string.IsNullOrWhiteSpace(group.Name) || group.Windows is null || nextEntries.ContainsKey(group.Key))
                throw new ArgumentException("Groups must have unique identities and valid display data.", nameof(groups));
            Entry previous = null;
            if (sameContext) entries.TryGetValue(group.Key, out previous);
            var id = previous?.Id ?? NewId();
            var windows = new Dictionary<WindowKey, WindowEntry>();
            var windowViews = new List<DockTaskViewWindow>(group.Windows.Count);
            var tasks = new List<DockTask>(group.Windows.Count);
            foreach (var task in group.Windows)
            {
                if (task is null || task.Handle == 0 || task.ProcessId <= 0 || string.IsNullOrWhiteSpace(task.Target) || task.Title is null || !seenHandles.Add(task.Handle))
                    throw new ArgumentException("Window identities must be valid and unique.", nameof(groups));
                var key = Identity(task);
                WindowEntry previousWindow = null;
                previous?.Windows.TryGetValue(key, out previousWindow);
                var windowId = previousWindow?.Id ?? NewId();
                windows.Add(key, new(windowId, task));
                tasks.Add(task);
                windowViews.Add(new(windowId, task.Title, task.Handle == foreground));
            }
            var copy = group with { Windows = tasks.AsReadOnly() };
            nextEntries.Add(group.Key, new(id, copy, windows));
            items.Add(new(id, group.Name, group.Pin is not null, tasks.Any(task => task.Handle == foreground), windowViews.AsReadOnly()));
        }
        var snapshot = new DockTaskViewSnapshot(nextContextId, nextSequence, items.AsReadOnly());
        // Publish only after validation and complete construction. Failed updates retain the old map.
        entries = nextEntries;
        contextKey = nextContextKey;
        contextId = nextContextId;
        sequence = nextSequence;
        return snapshot;
    }
    public bool TryResolve(string suppliedContext, string itemId, string windowId, out DockGroup group, out DockTask window)
    {
        group = null;
        window = null;
        if (contextId is null || suppliedContext != contextId || string.IsNullOrEmpty(itemId)) return false;
        var entry = entries.Values.FirstOrDefault(value => value.Id == itemId);
        if (entry is null) return false;
        if (windowId is not null)
        {
            var selected = entry.Windows.Values.FirstOrDefault(value => value.Id == windowId);
            if (selected is null) return false;
            window = selected.Task;
        }
        group = entry.Group;
        return true;
    }

    public void Clear()
    {
        contextKey = null;
        contextId = null;
        entries.Clear();
    }
}
