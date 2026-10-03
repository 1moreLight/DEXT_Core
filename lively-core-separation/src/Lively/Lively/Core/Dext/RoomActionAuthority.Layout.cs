using System;
using System.Linq;
using System.Threading;

namespace Dext.Core.Rooms;

internal sealed record RoomLayoutReply(RoomActionStatus Status, RoomPersonalLayout? Layout = null);

internal sealed partial class RoomActionAuthority
{
    // Only the private official DesktopPlayer connection can read this layout.
    // It contains no bindings, targets, grants or authored consumer storage.
    internal RoomLayoutReply ReadLayout(Guid connection, RoomSessionPeer peer, Guid session, long revision)
    {
        var initial = gateway.ReadActionContext(connection, peer, session, out var early);
        if (initial != RoomProtocolStatus.Accepted) return new(Status(initial));
        var eligibility = LayoutEligibility(early!, revision, false);
        if (eligibility != RoomActionStatus.Accepted) return new(eligibility);
        try
        {
            var spin = new SpinWait();
            while (true)
            {
                var result = store.ReadForDispatch(state =>
                {
                    var completed = gateway.TryWithActionContext(connection, peer, session, (admitted, context) =>
                    {
                        if (admitted != RoomProtocolStatus.Accepted) return new RoomLayoutReply(Status(admitted));
                        var status = LayoutEligibility(context!, revision, false);
                        if (status != RoomActionStatus.Accepted) return new(status);
                        var saved = state.Rooms.TryGetValue(context!.Installation.RoomId, out var room) ? room.Layout : new RoomPersonalLayout();
                        return new(RoomActionStatus.Accepted, RoomPersonalLayout.Project(saved, context.Installation.RuntimeContext!.Manifest));
                    }, out RoomLayoutReply reply);
                    return (completed, reply);
                });
                if (result.completed) return result.reply;
                spin.SpinOnce();
            }
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    internal RoomLayoutReply SaveLayout(Guid connection, RoomSessionPeer peer, Guid session, long revision, long expectedLayoutRevision, RoomLayoutChange change)
    {
        if (expectedLayoutRevision < 0 || change is null) return new(RoomActionStatus.Denied);
        var initial = gateway.ReadActionContext(connection, peer, session, out var early);
        if (initial != RoomProtocolStatus.Accepted) return new(Status(initial));
        var eligibility = LayoutEligibility(early!, revision, true);
        if (eligibility != RoomActionStatus.Accepted) return new(eligibility);
        if (!LayoutItem(early!, change)) return new(RoomActionStatus.Denied);
        try
        {
            var spin = new SpinWait();
            while (true)
            {
                var result = store.UpdateForDispatch(state =>
                {
                    var publish = false;
                    var completed = gateway.TryWithActionContext(connection, peer, session, (admitted, context) =>
                    {
                        if (admitted != RoomProtocolStatus.Accepted) return new RoomLayoutReply(Status(admitted));
                        var status = LayoutEligibility(context!, revision, true);
                        if (status != RoomActionStatus.Accepted) return new(status);
                        if (!LayoutItem(context!, change)) return new(RoomActionStatus.Denied);
                        var roomId = context!.Installation.RoomId;
                        var room = state.Rooms.TryGetValue(roomId, out var saved) ? saved : new RoomPersonalData();
                        var layout = room.Layout;
                        if (layout.Revision != expectedLayoutRevision) return new(RoomActionStatus.StaleInput);
                        var changed = false;
                        if (change.Kind == "icon")
                        {
                            var position = new RoomLayoutPosition(change.X, change.Y);
                            if (!layout.Icons.TryGetValue(change.DeskId!, out var icons))
                            { icons = new(StringComparer.Ordinal); layout.Icons[change.DeskId!] = icons; }
                            changed = !icons.TryGetValue(change.Id, out var old) || old != position;
                            if (changed) icons[change.Id] = position;
                        }
                        else
                        {
                            var rect = new RoomLayoutRectangle(change.X, change.Y, change.Width!.Value, change.Height!.Value);
                            changed = !layout.Components.TryGetValue(change.Id, out var old) || old != rect;
                            if (changed) layout.Components[change.Id] = rect;
                        }
                        if (changed)
                        {
                            if (layout.Revision >= 9007199254740991) return new(RoomActionStatus.Denied);
                            layout.Revision++;
                            state.Rooms[roomId] = room;
                            publish = true;
                        }
                        return new(RoomActionStatus.Accepted, RoomPersonalLayout.Project(layout, context.Installation.RuntimeContext!.Manifest));
                    }, out RoomLayoutReply reply);
                    return (completed && publish && reply.Status == RoomActionStatus.Accepted, (completed, reply));
                });
                if (result.completed) return result.reply;
                spin.SpinOnce();
            }
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    private static RoomActionStatus LayoutEligibility(RoomActionContext context, long revision, bool write) =>
        context.Role != RoomClientRole.DesktopPlayer || context.Installation.RuntimeContext is null ? RoomActionStatus.Forbidden :
        context.Snapshot.Revision != revision ? RoomActionStatus.StaleInput :
        write && (!context.Snapshot.IsActive || !context.Snapshot.IsOperable || !context.Snapshot.IsDesktopForeground ||
            context.Snapshot.Lifecycle.Stage != RoomLifecycleStage.Desktop || context.Snapshot.Lifecycle.PlaybackPaused ||
            context.Snapshot.Lifecycle.Locked || context.Snapshot.TransitionId is not null) ? RoomActionStatus.NotOperable : RoomActionStatus.Accepted;

    private static bool LayoutItem(RoomActionContext context, RoomLayoutChange change)
    {
        var manifest = context.Installation.RuntimeContext!.Manifest;
        var current = manifest.GetProperty("desks").EnumerateArray().First(d => d.GetProperty("id").GetString() == context.Snapshot.CurrentDeskId);
        if (change.Kind == "icon")
            return change.DeskId == context.Snapshot.CurrentDeskId && change.Width is null && change.Height is null &&
                RoomPersonalLayout.Position(change.X, change.Y) && current.GetProperty("icons").EnumerateArray().Any(icon => icon.GetProperty("id").GetString() == change.Id);
        return change.Kind == "widget" && change.DeskId is null && change.Width is { } width && change.Height is { } height &&
            RoomPersonalLayout.Rectangle(change.X, change.Y, width, height) &&
            current.GetProperty("components").EnumerateArray().Any(id => id.GetString() == change.Id) &&
            manifest.TryGetProperty("components", out var components) &&
            components.EnumerateArray().Any(component => component.GetProperty("id").GetString() == change.Id && component.GetProperty("role").GetString() == "widget");
    }
}
