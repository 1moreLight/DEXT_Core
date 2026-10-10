using System;
using System.Collections.Generic;
using System.Linq;

namespace Lively.Services.ApplicationDock;

// Dispatcher-owned display adapter. No launch paths leave this object.
internal sealed class DockTaskDisplay(Func<string, byte[]> readIcon)
{
    private readonly DockTaskProjection projection = new();
    private readonly Dictionary<string, string> icons = new(StringComparer.Ordinal);
    public DockTaskViewSnapshot Update(string context, IReadOnlyList<DockGroup> groups, long foreground)
    {
        var snapshot = projection.Update(context, groups, foreground);
        var targets = groups.Select(g => g.Pin?.Target ?? g.Windows.FirstOrDefault()?.Target).ToArray();
        var retained = targets.Where(t => t != null).Select(DockModel.Identity).ToHashSet(StringComparer.Ordinal);
        foreach (var key in icons.Keys.Where(k => !retained.Contains(k)).ToArray()) icons.Remove(key);
        var budget = 512 * 1024;
        var items = snapshot.Items.Select((item, index) =>
        {
            var target = targets[index];
            string png = null;
            if (target != null)
            {
                var key = DockModel.Identity(target);
                if (!icons.TryGetValue(key, out png))
                {
                    try
                    {
                        var bytes = readIcon(target);
                        if (bytes is { Length: >= 8 and <= 65536 } &&
                            bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}))
                            png = Convert.ToBase64String(bytes);
                    }
                    catch { /* Missing icons use the visible initial fallback. */ }
                    icons[key] = png;
                }
            }
            if (png != null && png.Length <= budget) budget -= png.Length;
            else png = null;
            return item with { IconPng = png };
        }).ToArray();
        return snapshot with { Items = Array.AsReadOnly(items) };
    }
    public bool TryResolve(string context, string item, string window, out DockGroup group, out DockTask task) =>
        projection.TryResolve(context, item, window, out group, out task);
    public void Clear() { projection.Clear(); icons.Clear(); }
}
