using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Dext.Core.Rooms;

internal enum RoomActionStatus
{
    Accepted, Queued, Denied, StaleSession, Forbidden, UnknownConsumer, InvalidButton,
    MissingPermission, MissingBinding, InputRequired, StaleInput, ExpiredInput,
    NotOperable, RequiresConfirmation, LaunchFailed, StorageUnavailable
}
internal sealed record PublicRoomButton(string Id, string Name, string Scope, string? Action, bool IsBound);
internal sealed record RoomButtonsReply(RoomActionStatus Status, PublicRoomButton[]? Buttons = null);
internal sealed record RoomInputReply(RoomActionStatus Status, Guid? Ticket = null);
internal sealed record RoomActionReply(RoomActionStatus Status);

// Only the Core-owned native host adapter may call IssueHostInput, after it has
// verified physical mouse/keyboard activation. No authored wire payload maps
// to this method. Author requests only consume an already-issued opaque ticket.
internal sealed class RoomActionAuthority
{
    private readonly object gate = new();
    private readonly RoomSessionProtocolGateway gateway;
    private readonly RoomPersonalStore store;
    private readonly Action<PersonalTarget> launch;
    private readonly TimeProvider clock;
    private readonly Dictionary<Guid, InputTicket> tickets = new();
    private static readonly TimeSpan InputLifetime = TimeSpan.FromMilliseconds(1500);
    private sealed record InputTicket(Guid Connection, string Peer, Guid Session, string Consumer, string Button,
        string Stamp, long SessionRevision, long PrivateRevision, long IssuedAt);
    public RoomActionAuthority(RoomSessionProtocolGateway gateway, RoomPersonalStore store, Action<PersonalTarget> launch, TimeProvider? clock = null)
    { this.gateway = gateway; this.store = store; this.launch = launch; this.clock = clock ?? TimeProvider.System; }

    public RoomButtonsReply ReadButtons(Guid connection, RoomSessionPeer peer, Guid session, string consumer)
    {
        lock (gate)
        {
            var status = Context(connection, peer, session, consumer, out var context, out var owner);
            if (status != RoomActionStatus.Accepted) return new(status);
            try
            {
                var state = store.Read(); var catalog = context!.Installation.ActionCatalog!;
                return new(RoomActionStatus.Accepted, catalog.Buttons.Values.Where(b => InScope(b, owner!, context.Snapshot))
                    .Select(b => { var action = Resolve(state, context.Installation.RoomId, b, out var target);
                        return new PublicRoomButton(b.Id, b.Name, b.Scope, action?.Type, target is not null); }).ToArray());
            }
            catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
        }
    }
    public RoomActionStatus AuthorizeCapability(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string capability)
    {
        lock (gate)
        {
            var status = Context(connection, peer, session, consumer, out var context, out var owner);
            if (status != RoomActionStatus.Accepted) return status;
            try { return Permission(store.Read(), context!.Installation, owner!, consumer, capability); }
            catch (Exception error) when (StorageFailure(error)) { return RoomActionStatus.StorageUnavailable; }
        }
    }
    public RoomInputReply IssueHostInput(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button)
    {
        lock (gate)
        {
            var status = Context(connection, peer, session, consumer, out var context, out var owner);
            if (status != RoomActionStatus.Accepted) return new(status);
            status = Button(context!, owner!, button, out _);
            if (status != RoomActionStatus.Accepted) return new(status);
            if (!context!.Snapshot.IsOperable) return new(RoomActionStatus.NotOperable);
            try
            {
                var state = store.Read();
                foreach (var expired in tickets.Where(t => clock.GetElapsedTime(t.Value.IssuedAt) > InputLifetime).Select(t => t.Key).ToArray()) tickets.Remove(expired);
                // One physical activation replaces earlier tickets from that view.
                foreach (var earlier in tickets.Where(t => t.Value.Connection == connection).Select(t => t.Key).ToArray()) tickets.Remove(earlier);
                if (tickets.Count >= 128) return new(RoomActionStatus.Denied);
                var id = Guid.NewGuid(); tickets.Add(id, new(connection, peer.TransportId, session, consumer, button,
                    context.Installation.InstallationStamp, context.Snapshot.Revision, state.Revision, clock.GetTimestamp()));
                return new(RoomActionStatus.Accepted, id);
            }
            catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
        }
    }
    public RoomActionReply InvokeButton(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button, Guid? ticket)
    {
        lock (gate)
        {
            var status = Context(connection, peer, session, consumer, out var context, out var owner);
            if (status != RoomActionStatus.Accepted) return new(status);
            status = Button(context!, owner!, button, out var authored);
            if (status != RoomActionStatus.Accepted) return new(status);
            if (!context!.Snapshot.IsOperable) return new(RoomActionStatus.NotOperable);
            try
            {
                var state = store.Read(); var action = Resolve(state, context.Installation.RoomId, authored!, out var target);
                if (action is null) return new(RoomActionStatus.MissingBinding);
                var capability = action.Type.StartsWith("desk.", StringComparison.Ordinal) ? "desk.navigate" : action.Type;
                status = Permission(state, context.Installation, owner!, consumer, capability);
                if (status != RoomActionStatus.Accepted) return new(status);
                if (ticket is null) return new(RoomActionStatus.InputRequired);
                if (!tickets.Remove(ticket.Value, out var input)) return new(RoomActionStatus.StaleInput);
                if (input.Connection != connection || input.Peer != peer.TransportId || input.Session != session ||
                    input.Consumer != consumer || input.Button != button || input.Stamp != context.Installation.InstallationStamp ||
                    input.SessionRevision != context.Snapshot.Revision || input.PrivateRevision != state.Revision)
                    return new(RoomActionStatus.StaleInput);
                if (clock.GetElapsedTime(input.IssuedAt) > InputLifetime) return new(RoomActionStatus.ExpiredInput);
                if (action.Type == "binding.launch")
                {
                    if (target is null) return new(RoomActionStatus.MissingBinding);
                    try { launch(target); return new(RoomActionStatus.Accepted); }
                    catch (Exception error) when (error is IOException or UnauthorizedAccessException or Win32Exception or InvalidOperationException or ArgumentException)
                    { return new(RoomActionStatus.LaunchFailed); }
                }
                if (action.Type == "dext.exit") return new(RoomActionStatus.RequiresConfirmation);
                var desks = context.Installation.DeskIds; var current = context.Snapshot.TargetDeskId ?? context.Snapshot.CurrentDeskId;
                var index = Array.IndexOf(desks.ToArray(), current);
                var targetDesk = action.Type switch { "desk.next" => desks[(index + 1) % desks.Count],
                    "desk.previous" => desks[(index + desks.Count - 1) % desks.Count], "desk.go" => action.DeskId, _ => null };
                if (targetDesk is null || !desks.Contains(targetDesk, StringComparer.Ordinal)) return new(RoomActionStatus.InvalidButton);
                return new(Status(gateway.Request(connection, peer, session, targetDesk).Status));
            }
            catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
        }
    }

    private RoomActionStatus Context(Guid connection, RoomSessionPeer peer, Guid session, string consumer,
        out RoomActionContext? context, out RoomActionCatalog.Consumer? owner)
    {
        owner = null;
        var status = gateway.ReadActionContext(connection, peer, session, out context);
        if (status != RoomProtocolStatus.Accepted) return Status(status);
        if (context!.Installation.ActionCatalog is not { } catalog) return RoomActionStatus.Denied;
        if (consumer is null || !catalog.Consumers.TryGetValue(consumer, out owner)) return RoomActionStatus.UnknownConsumer;
        return owner.IsActive(context.Role, context.Snapshot.TargetDeskId ?? context.Snapshot.CurrentDeskId) ? RoomActionStatus.Accepted : RoomActionStatus.Forbidden;
    }
    private static bool InScope(AuthoredRoomButton button, RoomActionCatalog.Consumer owner, RoomSessionSnapshot snapshot) =>
        owner.HasButton(button.Id) && (button.Scope == "room" || button.Scope == (snapshot.TargetDeskId ?? snapshot.CurrentDeskId));
    private static RoomActionStatus Button(RoomActionContext context, RoomActionCatalog.Consumer owner, string id, out AuthoredRoomButton? button)
    {
        button = null;
        if (id is null || !context.Installation.ActionCatalog!.Buttons.TryGetValue(id, out button)) return RoomActionStatus.InvalidButton;
        return InScope(button, owner, context.Snapshot) ? RoomActionStatus.Accepted : RoomActionStatus.Forbidden;
    }
    private static RoomActionStatus Permission(RoomPersonalState state, VerifiedRoomInstallation installed, RoomActionCatalog.Consumer owner, string consumer, string capability)
    {
        if (!owner.HasCapability(capability)) return RoomActionStatus.Forbidden;
        return state.Rooms.TryGetValue(installed.RoomId, out var room) && room.Grants.TryGetValue(consumer, out var grant) &&
            grant.InstallationStamp == installed.InstallationStamp && grant.Capabilities.Contains(capability, StringComparer.Ordinal)
            ? RoomActionStatus.Accepted : RoomActionStatus.MissingPermission;
    }
    private static RoomButtonAction? Resolve(RoomPersonalState state, string roomId, AuthoredRoomButton button, out PersonalTarget? target)
    {
        target = null; PersonalButtonOverride? local = null;
        if (state.Rooms.TryGetValue(roomId, out var room)) room.Buttons.TryGetValue(button.Id, out local);
        var action = local?.Action is { } type ? new RoomButtonAction(type, local.DeskId) : button.Action;
        if (action?.Type == "binding.launch" && local?.TargetId is { } id) state.Targets.TryGetValue(id, out target);
        return action;
    }
    private static bool StorageFailure(Exception error) => error is IOException or InvalidDataException or UnauthorizedAccessException or JsonException;
    private static RoomActionStatus Status(RoomProtocolStatus status) => status switch
    {
        RoomProtocolStatus.Accepted => RoomActionStatus.Accepted,
        RoomProtocolStatus.Queued => RoomActionStatus.Queued,
        RoomProtocolStatus.Forbidden => RoomActionStatus.Forbidden,
        RoomProtocolStatus.StaleSession or RoomProtocolStatus.NoActiveSession => RoomActionStatus.StaleSession,
        RoomProtocolStatus.StorageUnavailable => RoomActionStatus.StorageUnavailable,
        _ => RoomActionStatus.Denied,
    };
}
