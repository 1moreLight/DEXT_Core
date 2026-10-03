using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
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
internal sealed record RoomDataSample(string Status, JsonElement? Value = null);
internal sealed record RoomDataReply(RoomActionStatus Status, RoomDataSample? Sample = null);
internal sealed record RoomStorageReply(RoomActionStatus Status, JsonElement? Value = null);
internal sealed record RoomCapabilitiesReply(RoomActionStatus Status, IReadOnlyDictionary<string, RoomActionStatus>? Capabilities = null);
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
        string Stamp, long SessionRevision, long PrivateRevision, long IssuedAt, RoomNativeInputProof? NativeInput);
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

    // Metadata is copied at one authorization boundary. It is not a permit for
    // a later data read/action; those operations must independently reauthorize.
    public RoomCapabilitiesReply ReadCapabilities(Guid connection, RoomSessionPeer peer, Guid session, string consumer, long? revision = null)
    {
        try
        {
            return Prepare(connection, peer, session, consumer, status => new RoomCapabilitiesReply(status), (state, context, owner) =>
            {
                if (revision is { } expected && context.Snapshot.Revision != expected) return new(RoomActionStatus.StaleInput);
                var canConsume = owner.CanConsume(context.Role, context.Snapshot);
                var result = owner.DeclaredCapabilities.ToDictionary(capability => capability,
                    capability => canConsume ? Permission(state, context.Installation, owner, consumer, capability) : RoomActionStatus.NotOperable,
                    StringComparer.Ordinal);
                return new(RoomActionStatus.Accepted, new ReadOnlyDictionary<string, RoomActionStatus>(result));
            });
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

    private static readonly HashSet<string> ReadableData = new(StringComparer.Ordinal) { "time.read", "hardware.read", "media.read", "audio.read" };

    public RoomDataReply ReadData(Guid connection, RoomSessionPeer peer, Guid session, long revision,
        string consumer, string capability, Func<RoomDataSample> capture)
    {
        if (capability is null || !ReadableData.Contains(capability)) return new(RoomActionStatus.Forbidden);
        RoomActionStatus Authorize() => Prepare(connection, peer, session, consumer, status => status, (state, context, owner) =>
            context.Snapshot.Revision != revision ? RoomActionStatus.StaleInput : !owner.CanConsume(context.Role, context.Snapshot)
                ? RoomActionStatus.NotOperable : Permission(state, context.Installation, owner, consumer, capability));
        try
        {
            var status = Authorize();
            if (status != RoomActionStatus.Accepted) return new(status);
            RoomDataSample sample;
            // System/COM calls and injectable capture code never hold the private
            // store, gateway, installation or kernel locks. The result is still
            // private until the second current-consent boundary accepts it.
            try { sample = NormalizeData(capture()); }
            catch (Exception) { sample = new("error"); }
            status = Authorize();
            return status == RoomActionStatus.Accepted ? new(status, sample) : new(status);
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    private static RoomDataSample NormalizeData(RoomDataSample? sample)
    {
        if (sample?.Status is "missing" or "unsupported" or "error") return new(sample.Status);
        if (sample?.Status != "available" || sample.Value is not { } value) return new("error");
        var json = value.GetRawText();
        if (System.Text.Encoding.UTF8.GetByteCount(json) > 32768) return new("error");
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 24 });
        return new("available", document.RootElement.Clone());
    }

    public RoomStorageReply ReadStorage(Guid connection,RoomSessionPeer peer,Guid session,long revision,string consumer,string key)
    {
        try { RoomPersonalStore.Id(key); } catch(InvalidDataException) {return new(RoomActionStatus.Denied);}
        try
        {
            return Prepare(connection,peer,session,consumer,status=>new RoomStorageReply(status),(state,context,owner)=>
            {
                var status=StoragePermission(state,context,owner,consumer,revision,"storage.read");
                if(status!=RoomActionStatus.Accepted)return new(status);
                return state.Rooms.TryGetValue(context.Installation.RoomId,out var room) && room.Storage.TryGetValue(consumer,out var values) && values.TryGetValue(key,out var value)
                    ?new(RoomActionStatus.Accepted,value.Clone()):new(RoomActionStatus.Accepted);
            });
        }
        catch(Exception error)when(StorageFailure(error)){return new(RoomActionStatus.StorageUnavailable);}
    }
    public RoomActionReply WriteStorage(Guid connection,RoomSessionPeer peer,Guid session,long revision,string consumer,string key,JsonElement value)
    {
        JsonElement normalized;
        try {RoomPersonalStore.Id(key);normalized=RoomPersonalStore.NormalizeStorageValue(value);}
        catch(Exception error)when(error is InvalidDataException or JsonException or InvalidOperationException or ArgumentException){return new(RoomActionStatus.Denied);}
        try
        {
            var initial=gateway.ReadActionContext(connection,peer,session,out var early);
            if(initial!=RoomProtocolStatus.Accepted)return new(Status(initial));
            var initialOwner=Consumer(early!,consumer,out _);if(initialOwner!=RoomActionStatus.Accepted)return new(initialOwner);
            var spin=new SpinWait();
            while(true)
            {
                var result=store.UpdateForDispatch(state=>
                {
                    var completed=gateway.TryWithActionContext(connection,peer,session,(admitted,context)=>
                    {
                        if(admitted!=RoomProtocolStatus.Accepted)return new RoomActionReply(Status(admitted));
                        var status=Consumer(context!,consumer,out var owner);if(status!=RoomActionStatus.Accepted)return new(status);
                        status=StoragePermission(state,context!,owner!,consumer,revision,"storage.write");if(status!=RoomActionStatus.Accepted)return new(status);
                        var room=state.Rooms[context!.Installation.RoomId];
                        var candidate=room.Storage.TryGetValue(consumer,out var existing)?new Dictionary<string,JsonElement>(existing,StringComparer.Ordinal):new(StringComparer.Ordinal);
                        candidate[key]=normalized;
                        if(!RoomPersonalStore.StorageFits(candidate))return new(RoomActionStatus.Denied);
                        room.Storage[consumer]=candidate;return new(RoomActionStatus.Accepted);
                    },out RoomActionReply reply);
                    return(completed && reply.Status==RoomActionStatus.Accepted,(completed,reply));
                });
                if(result.completed)return result.reply;spin.SpinOnce();
            }
        }
        catch(Exception error)when(StorageFailure(error)){return new(RoomActionStatus.StorageUnavailable);}
    }
    private static RoomActionStatus StoragePermission(RoomPersonalState state,RoomActionContext context,RoomActionCatalog.Consumer owner,
        string consumer,long revision,string capability) => context.Snapshot.Revision!=revision?RoomActionStatus.StaleInput:
        !owner.CanConsume(context.Role,context.Snapshot)?RoomActionStatus.NotOperable:Permission(state,context.Installation,owner,consumer,capability);

    internal RoomNativeInputAuthority CreateNativeInput() => new(clock);

    public RoomInputReply IssueHostInput(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button, RoomNativeInputProof? nativeInput = null)
    {
        var issuedAt = clock.GetTimestamp();
        try
        {
            return Prepare(connection, peer, session, consumer, status => new RoomInputReply(status), (state, context, owner) =>
            {
                var status = Button(context, owner, button, out _);
                if (status != RoomActionStatus.Accepted) return new(status);
                if (!owner.CanConsume(context.Role, context.Snapshot)) return new(RoomActionStatus.NotOperable);
                if (nativeInput != null && !nativeInput.Validate(context.Snapshot, consumer, button)) return new(RoomActionStatus.StaleInput);
                var physicalTime = nativeInput?.IssuedAt ?? issuedAt;
                if (Expired(physicalTime, issuedAt)) return new(RoomActionStatus.ExpiredInput);
                lock (gate)
                {
                    foreach (var expired in tickets.Where(t => Expired(t.Value.IssuedAt, issuedAt)).Select(t => t.Key).ToArray()) tickets.Remove(expired);
                    foreach (var earlier in tickets.Where(t => t.Value.Connection == connection).Select(t => t.Key).ToArray()) tickets.Remove(earlier);
                    if (tickets.Count >= 128) return new(RoomActionStatus.Denied);
                    var id = Guid.NewGuid();
                    tickets.Add(id, new(connection, peer.TransportId, session, consumer, button,
                        context.Installation.InstallationStamp, context.Snapshot.Revision, state.Revision, physicalTime, nativeInput));
                    return new(RoomActionStatus.Accepted, id);
                }
            });
        }
        catch (Exception error) when (StorageFailure(error)) { return new(RoomActionStatus.StorageUnavailable); }
    }

    public RoomActionReply InvokeButton(Guid connection, RoomSessionPeer peer, Guid session, string consumer, string button, Guid? ticket) =>
        InvokeConfiguredButton(connection,peer,session,consumer,button,ticket,null);

    public RoomActionReply InvokeNavigation(Guid connection,RoomSessionPeer peer,Guid session,string consumer,string button,Guid? ticket,RoomButtonAction requested)
    {
        if(requested==null || requested.Type is not ("desk.next" or "desk.previous" or "desk.go") ||
            (requested.Type=="desk.go"?string.IsNullOrEmpty(requested.DeskId):requested.DeskId is not null))return new(RoomActionStatus.Denied);
        return InvokeConfiguredButton(connection,peer,session,consumer,button,ticket,requested);
    }

    private RoomActionReply InvokeConfiguredButton(Guid connection,RoomSessionPeer peer,Guid session,string consumer,string button,Guid? ticket,RoomButtonAction? requested)
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
                if (requested?.Type == "desk.go" && !context.Installation.DeskIds.Contains(requested.DeskId!, StringComparer.Ordinal))
                    return new(RoomActionStatus.Denied);
                var action = Resolve(state, context.Installation.RoomId, authored!, out var target);
                // An otherwise unconfigured declared region can request dynamic
                // navigation; configured defaults/private bindings keep priority.
                action ??= requested;
                if (action is null) return new(RoomActionStatus.MissingBinding);
                // Read the current user override/default inside this same private
                // preparation boundary. An author cannot replace a configured
                // entry's action by requesting a different navigation operation.
                if (requested is not null && action != requested) return new(RoomActionStatus.Denied);
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
                // The leaf's one-time consume is the geometry/input commit point.
                // All authority and personal state is still protected here.
                if (input.NativeInput != null && !input.NativeInput.Validate(context.Snapshot, consumer, button, consume: true))
                    return new(RoomActionStatus.StaleInput);
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
        var action = local?.Action is { } type ? new RoomButtonAction(type, local.DeskId) :
            button.Action ?? (local?.TargetId is not null ? new RoomButtonAction("binding.launch") : null);
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
