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

    // Missing and empty addition lists both follow the global list. A stored []
    // after migration or after the last Desk addition is removed is not a local list.
    public static bool FollowsGlobal(int? additionCount) => additionCount is null or 0;

    // Right-click pin/unpin uses the same rule as PinScope. An explicit Desk-scope
    // edit from the settings page can still create the first addition.
    public static string RightClickScope(bool hasNavigation, int? additionCount) =>
        hasNavigation && !FollowsGlobal(additionCount) ? "desk" : "global";

    public static string RightClickEffect(bool hasNavigation, int? additionCount, bool pinned, bool targetIsDeskAddition)
    {
        if (RightClickScope(hasNavigation, additionCount) == "global")
            return pinned ? "unpin-global" : "pin-global";
        if (pinned && !targetIsDeskAddition) return "reject-global-unpin";
        return pinned ? "unpin-desk" : "pin-desk";
    }
}
