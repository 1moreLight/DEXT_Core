using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

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

// Authored messages cannot issue input. The native host must first verify a
// real activation of the current visible entry. Preparation is a short commit
// boundary; native launch and notification-producing navigation run afterwards.
internal sealed class RoomActionAuthority
{
    private readonly object gate = new();
    private readonly RoomSessionProtocolGateway gateway;
    private readonly RoomPersonalStore store;
    private readonly Action<PersonalTarget> launch;
    private readonly TimeProvider clock;
    private readonly long timestampFrequency;
    private readonly Dictionary<Guid, InputTicket> tickets = new();
    private static readonly TimeSpan InputLifetime = TimeSpan.FromMilliseconds(1500);
    private sealed record InputTicket(Guid Connection, string Peer, Guid Session, string Consumer, string Button,
        string Stamp, long SessionRevision, long PrivateRevision, long IssuedAt);
    private sealed record PreparedAction(RoomActionStatus Status, string? Type = null, PersonalTarget? Target = null,
        string? DeskId = null, long IssuedAt = 0);

    public RoomActionAuthority(RoomSessionProtocolGateway gateway, RoomPersonalStore store,
        Action<PersonalTarget> launch, TimeProvider? clock = null)
    {
        this.gateway = gateway; this.store = store; this.launch = launch; this.clock = clock ?? TimeProvider.System;
        timestampFrequency = this.clock.TimestampFrequency;
        if (timestampFrequency <= 0) throw new ArgumentException("Monotonic timestamp frequency must be positive", nameof(clock));
    }

    public RoomButtonsReply ReadButtons(Guid connection, RoomSessionPeer peer, Guid session, string consumer)
    {
        try
        {
            return Prepare(connection, peer, session, consumer, status => new RoomButtonsReply(status), (state, context, owner) =>
                new(RoomActionStatus.Accepted, context.Installation.ActionCatalog!.Buttons.Values.Where(b => InScope(b, owner, context.Snapshot))
                    .Select(b => { var action = Resolve(state, context.Installation.RoomId, b, out var target);
                        return new PublicRoomButton(b.Id, b.Name, b.Scope, action?.Type, target is not null); }).ToArray()));
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    public RoomActionStatus AuthorizeCapability(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string capability)
    {
        try { return Prepare(connection, peer, session, consumer, status => status,
            (state, context, owner) => owner.CanConsume(context.Role, context.Snapshot)
                ? Permission(state, context.Installation, owner, consumer, capability) : RoomActionStatus.NotOperable); }
        catch (Exception error) when (StorageFailure(error)) { return RoomActionStatus.StorageUnavailable; }
    }

    public RoomInputReply IssueHostInput(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button)
    {
        var issuedAt = clock.GetTimestamp();
        try
        {
            return Prepare(connection, peer, session, consumer, status => new RoomInputReply(status), (state, context, owner) =>
            {
                var status = Button(context, owner, button, out _);
                if (status != RoomActionStatus.Accepted) return new(status);
                if (!owner.CanConsume(context.Role, context.Snapshot)) return new(RoomActionStatus.NotOperable);
                lock (gate)
                {
                    foreach (var expired in tickets.Where(t => Expired(t.Value.IssuedAt, issuedAt)).Select(t => t.Key).ToArray()) tickets.Remove(expired);
                    foreach (var earlier in tickets.Where(t => t.Value.Connection == connection).Select(t => t.Key).ToArray()) tickets.Remove(earlier);
                    if (tickets.Count >= 128) return new(RoomActionStatus.Denied);
                    var id = Guid.NewGuid();
                    tickets.Add(id, new(connection, peer.TransportId, session, consumer, button,
                        context.Installation.InstallationStamp, context.Snapshot.Revision, state.Revision, issuedAt));
                    return new(RoomActionStatus.Accepted, id);
                }
            });
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    public RoomActionReply InvokeButton(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button, Guid? ticket)
    {
        // TimeProvider is injectable; invoke it outside all authorization locks.
        var requestedAt = clock.GetTimestamp();
        PreparedAction prepared;
        try
        {
            prepared = Prepare(connection, peer, session, consumer, status => new PreparedAction(status), (state, context, owner) =>
            {
                var status = Button(context, owner, button, out var authored);
                if (status != RoomActionStatus.Accepted) return new(status);
                if (!owner.CanConsume(context.Role, context.Snapshot)) return new(RoomActionStatus.NotOperable);
                var action = Resolve(state, context.Installation.RoomId, authored!, out var target);
                if (action is null) return new(RoomActionStatus.MissingBinding);
                var capability = action.Type.StartsWith("desk.", StringComparison.Ordinal) ? "desk.navigate" : action.Type;
                status = Permission(state, context.Installation, owner, consumer, capability);
                if (status != RoomActionStatus.Accepted) return new(status);
                if (ticket is null) return new(RoomActionStatus.InputRequired);
                InputTicket input;
                lock (gate)
                {
                    if (!tickets.Remove(ticket.Value, out input!)) return new(RoomActionStatus.StaleInput);
                }
                if (input.Connection != connection || input.Peer != peer.TransportId || input.Session != session ||
                    input.Consumer != consumer || input.Button != button || input.Stamp != context.Installation.InstallationStamp ||
                    input.SessionRevision != context.Snapshot.Revision || input.PrivateRevision != state.Revision)
                    return new(RoomActionStatus.StaleInput);
                if (Expired(input.IssuedAt, requestedAt)) return new(RoomActionStatus.ExpiredInput);
                if (action.Type == "binding.launch")
                    return target is null ? new(RoomActionStatus.MissingBinding) : new(RoomActionStatus.Accepted, action.Type, target, IssuedAt: input.IssuedAt);
                if (action.Type == "dext.exit") return new(RoomActionStatus.Accepted, action.Type, IssuedAt: input.IssuedAt);
                var desks = context.Installation.DeskIds;
                var current = context.Snapshot.TargetDeskId ?? context.Snapshot.CurrentDeskId;
                var index = Array.IndexOf(desks.ToArray(), current);
                var targetDesk = action.Type switch { "desk.next" => desks[(index + 1) % desks.Count],
                    "desk.previous" => desks[(index + desks.Count - 1) % desks.Count], "desk.go" => action.DeskId, _ => null };
                return targetDesk is null || !desks.Contains(targetDesk, StringComparer.Ordinal)
                    ? new(RoomActionStatus.InvalidButton) : new(RoomActionStatus.Accepted, action.Type, DeskId: targetDesk, IssuedAt: input.IssuedAt);
            });
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
        if (prepared.Status != RoomActionStatus.Accepted) return new(prepared.Status);
        if (Expired(prepared.IssuedAt, clock.GetTimestamp())) return new(RoomActionStatus.ExpiredInput);
        if (prepared.Type == "dext.exit") return new(RoomActionStatus.RequiresConfirmation);
        if (prepared.Type != "binding.launch") return new(Status(gateway.Request(connection, peer, session, prepared.DeskId!).Status));
        try { launch(prepared.Target!); return new(RoomActionStatus.Accepted); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or Win32Exception or InvalidOperationException or ArgumentException)
        { return new(RoomActionStatus.LaunchFailed); }
    }

    private bool Expired(long issued, long now)
    {
        var elapsed = ((decimal)now - issued) / timestampFrequency;
        return elapsed < 0 || elapsed > (decimal)InputLifetime.TotalSeconds;
    }

    private T Prepare<T>(Guid connection, RoomSessionPeer peer, Guid session, string consumer,
        Func<RoomActionStatus, T> rejected, Func<RoomPersonalState, RoomActionContext, RoomActionCatalog.Consumer, T> prepare)
    {
        // Early refusal avoids reading private state for unauthenticated callers.
        // It is not authority to dispatch: every accepted attempt rechecks below.
        var initial = gateway.ReadActionContext(connection, peer, session, out var early);
        if (initial != RoomProtocolStatus.Accepted) return rejected(Status(initial));
        var status = Consumer(early!, consumer, out _);
        if (status != RoomActionStatus.Accepted) return rejected(status);
        var spin = new SpinWait();
        while (true)
        {
            var result = store.ReadForDispatch(state =>
            {
                // Never wait for gateway while holding the private store: a
                // current snapshot observer may itself read personal state.
                var completed = gateway.TryWithActionContext(connection, peer, session, (admitted, context) =>
                {
                    if (admitted != RoomProtocolStatus.Accepted) return rejected(Status(admitted));
                    var authorized = Consumer(context!, consumer, out var owner);
                    return authorized == RoomActionStatus.Accepted ? prepare(state, context!, owner!) : rejected(authorized);
                }, out T value);
                return (completed, value);
            });
            if (result.completed) return result.value;
            spin.SpinOnce(); // All locks have been released before retrying.
        }
    }

    private static RoomActionStatus Consumer(RoomActionContext context, string consumer, out RoomActionCatalog.Consumer? owner)
    {
        owner = null;
        if (context.Installation.ActionCatalog is not { } catalog) return RoomActionStatus.Denied;
        if (consumer is null || !catalog.Consumers.TryGetValue(consumer, out owner)) return RoomActionStatus.UnknownConsumer;
        return owner.IsActive(context.Role, context.Snapshot) ? RoomActionStatus.Accepted : RoomActionStatus.Forbidden;
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
