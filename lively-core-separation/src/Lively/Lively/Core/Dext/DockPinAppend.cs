using System;
using System.Collections.Generic;
using System.Linq;

namespace Dext.Core.Rooms;

// Effective pins are global pins plus per-Desk additions. An empty addition
// list means "no additions" (effective = global only). There is no independent
// empty mode: [] is not a whole-list override.
//
// Legacy personal dockPins stored a whole-list override. One-time migration
// keeps every pin that was visible and may restore global pins the override
// had hidden, because append cannot express removal:
//   additions = legacy pins whose target is not in the current global list
//   effective = global ∪ additions
internal static class DockPinAppend
{
    public static string Identity(string? target) => (target ?? "").Trim().Replace('/', '\\').ToUpperInvariant();

    public static T[] Effective<T>(IReadOnlyList<T> global, IReadOnlyList<T>? additions, Func<T, string> target)
    {
        if (additions is null || additions.Count == 0) return global.ToArray();
        var seen = new HashSet<string>(global.Select(item => Identity(target(item))), StringComparer.Ordinal);
        var list = new List<T>(global);
        foreach (var item in additions)
            if (seen.Add(Identity(target(item)))) list.Add(item);
        return list.ToArray();
    }

    public static T[] LegacyAdditions<T>(IReadOnlyList<T> legacy, IReadOnlyCollection<string> globalTargets, Func<T, string> target)
    {
        var global = new HashSet<string>(globalTargets.Select(Identity), StringComparer.Ordinal);
        return legacy.Where(item => !global.Contains(Identity(target(item)))).ToArray();
    }
}
