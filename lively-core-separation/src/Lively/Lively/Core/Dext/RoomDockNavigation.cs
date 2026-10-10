using System;
using System.Linq;
using System.Text.Json;

namespace Dext.Core.Rooms;

// Core-owned navigation state; never constructed from a page request.
internal sealed record RoomDockNavigation(Guid SessionId, string CurrentName, string? PendingName,
    string[] DeskIds, int NavigationIndex, bool CanNavigate)
{
    public string? Target(int direction) => CanNavigate && direction is -1 or 1
        ? DeskIds[(NavigationIndex + direction + DeskIds.Length) % DeskIds.Length] : null;

    public static RoomDockNavigation Create(RoomSessionSnapshot snapshot, JsonElement manifest)
    {
        var desks = manifest.GetProperty("desks").EnumerateArray().ToArray();
        var ids = desks.Select(d => d.GetProperty("id").GetString()!).ToArray();
        string Name(string id)
        {
            var index = Array.IndexOf(ids, id);
            return index >= 0 && desks[index].TryGetProperty("name", out var name)
                ? name.GetString() ?? id : id;
        }
        var target = snapshot.TargetDeskId ?? snapshot.CurrentDeskId;
        var position = Array.IndexOf(ids, target);
        return new(snapshot.SessionId, Name(snapshot.CurrentDeskId),
            snapshot.TargetDeskId is { } pending ? Name(pending) : null,
            ids, position, snapshot.IsActive && !snapshot.Lifecycle.Locked &&
            snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop && position >= 0 && ids.Length > 1);
    }
}
