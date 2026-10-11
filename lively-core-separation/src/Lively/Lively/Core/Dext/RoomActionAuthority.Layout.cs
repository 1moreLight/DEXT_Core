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
                        var saved = state.Rooms.TryGetValue(context!.Installation.RoomId, out var room) ? room : new RoomPersonalData();
                        return new(RoomActionStatus.Accepted, ProjectDesktopLayout(saved, context.Installation.RuntimeContext!.Manifest));
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
        var changes=new[]{change}.Concat(change.Peers??Array.Empty<RoomLayoutChange>()).ToArray();
        if(changes.Length>1025 || changes.Skip(1).Any(c=>c is null||c.Kind!="icon"||c.Peers is not null) ||
            changes.Select(c=>(c.Kind,c.Id)).Distinct().Count()!=changes.Length || changes.Any(c=>!LayoutItem(early!,c)))return new(RoomActionStatus.Denied);
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
                        if (changes.Any(c=>!LayoutItem(context!, c))) return new(RoomActionStatus.Denied);
                        var roomId = context!.Installation.RoomId;
                        var room = state.Rooms.TryGetValue(roomId, out var saved) ? saved : new RoomPersonalData();
                        var layout = room.Layout;
                        if(changes.Any(c=>c.Kind=="icon"&&c.Id.StartsWith("desktop-",StringComparison.Ordinal)&&
                            (room.DesktopSync is not {Enabled:true} sync || sync.DeskId!=c.DeskId || !sync.Slots.ContainsKey(c.Id))))
                            return new(RoomActionStatus.Denied);
                        if (layout.Revision != expectedLayoutRevision) return new(RoomActionStatus.StaleInput);
                        var changed = false;
                        foreach(var entry in changes){
                        if (entry.Kind == "icon")
                        {
                            var position = new RoomLayoutPosition(entry.X, entry.Y);
                            if (!layout.Icons.TryGetValue(entry.DeskId!, out var icons))
                            { icons = new(StringComparer.Ordinal); layout.Icons[entry.DeskId!] = icons; }
                            var itemChanged = !icons.TryGetValue(entry.Id, out var old) || old != position;
                            changed |= itemChanged;
                            if (itemChanged) icons[entry.Id] = position;
                        }
                        else
                        {
                            var rect = new RoomLayoutRectangle(entry.X, entry.Y, entry.Width!.Value, entry.Height!.Value);
                            var itemChanged = !layout.Components.TryGetValue(entry.Id, out var old) || old != rect;
                            changed |= itemChanged;
                            if (itemChanged) layout.Components[entry.Id] = rect;
                        }
                        }
                        if (changed)
                        {
                            if (layout.Revision >= 9007199254740991) return new(RoomActionStatus.Denied);
                            layout.Revision++;
                            state.Rooms[roomId] = room;
                            publish = true;
                        }
                        return new(RoomActionStatus.Accepted, ProjectDesktopLayout(room, context.Installation.RuntimeContext!.Manifest));
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

    private static RoomPersonalLayout ProjectDesktopLayout(RoomPersonalData room, System.Text.Json.JsonElement manifest)
    {
        var result=RoomPersonalLayout.Project(room.Layout,manifest);
        if(room.DesktopSync is {Enabled:true} sync && room.Layout.Icons.TryGetValue(sync.DeskId,out var saved))
        {
            if(!result.Icons.TryGetValue(sync.DeskId,out var icons)){icons=new(StringComparer.Ordinal);result.Icons[sync.DeskId]=icons;}
            foreach(var pair in saved)if(sync.Slots.ContainsKey(pair.Key))icons[pair.Key]=pair.Value;
        }
        return result;
    }
    private bool DesktopLayoutItem(RoomActionContext context,RoomLayoutChange change)
    {
        var desktop=Volatile.Read(ref desktopPresentation);
        return desktop is not null && desktop.Session==context.Snapshot.SessionId && desktop.Room==context.Installation.RoomId &&
            desktop.Stamp==context.Installation.InstallationStamp && desktop.View.DeskId==change.DeskId &&
            desktop.View.Items?.Any(item=>item.Id==change.Id)==true;
    }
    private bool LayoutItem(RoomActionContext context, RoomLayoutChange change)
    {
        var manifest = context.Installation.RuntimeContext!.Manifest;
        var current = manifest.GetProperty("desks").EnumerateArray().First(d => d.GetProperty("id").GetString() == context.Snapshot.CurrentDeskId);
        if (change.Kind == "icon")
            return change.DeskId == context.Snapshot.CurrentDeskId && change.Width is null && change.Height is null &&
                RoomPersonalLayout.Position(change.X, change.Y) && (current.GetProperty("icons").EnumerateArray().Any(icon => icon.GetProperty("id").GetString() == change.Id) || DesktopLayoutItem(context,change));
        return change.Kind == "widget" && change.DeskId is null && change.Width is { } width && change.Height is { } height &&
            RoomPersonalLayout.Rectangle(change.X, change.Y, width, height) &&
            current.GetProperty("components").EnumerateArray().Any(id => id.GetString() == change.Id) &&
            manifest.TryGetProperty("components", out var components) &&
            components.EnumerateArray().Any(component => component.GetProperty("id").GetString() == change.Id && component.GetProperty("role").GetString() == "widget");
    }
}
