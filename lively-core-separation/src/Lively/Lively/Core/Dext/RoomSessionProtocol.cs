using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;

namespace Dext.Core.Rooms;

// Only a trusted Core transport adapter may supply RoomSessionPeer. A value
// copied from an author-controlled message is not an authenticated peer.
internal sealed record RoomSessionPeer(string TransportId);
internal enum RoomClientRole { Coordinator, DesktopPlayer, Dock }
internal sealed record RoomSessionHello(int ProtocolVersion, RoomClientRole Role, string RoomId);

// RoomId identifies this installed copy, not the source share package. The
// stamp identifies the particular validated installation snapshot in use.
internal sealed class VerifiedRoomInstallation
{
    public string RoomId { get; }
    public string InstallationStamp { get; }
    public IReadOnlyList<string> DeskIds { get; }
    public string StartDeskId { get; }
    public RoomActionCatalog? ActionCatalog { get; }
    public RoomRuntimeContext? RuntimeContext { get; }

    public VerifiedRoomInstallation(string roomId, string installationStamp,
        IReadOnlyList<string> deskIds, string startDeskId, RoomActionCatalog? actionCatalog = null,
        RoomRuntimeContext? runtimeContext = null)
    {
        if (string.IsNullOrWhiteSpace(roomId)) throw new ArgumentException("Installed Room ID is required", nameof(roomId));
        if (string.IsNullOrWhiteSpace(installationStamp))
            throw new ArgumentException("Installation stamp is required", nameof(installationStamp));
        if (deskIds is null || deskIds.Count == 0 || deskIds.Any(string.IsNullOrWhiteSpace) ||
            deskIds.Distinct(StringComparer.Ordinal).Count() != deskIds.Count ||
            !deskIds.Contains(startDeskId, StringComparer.Ordinal))
            throw new ArgumentException("Installed Desk IDs must be unique and include the start Desk", nameof(deskIds));
        RoomId = roomId;
        InstallationStamp = installationStamp;
        DeskIds = Array.AsReadOnly(deskIds.ToArray());
        StartDeskId = startDeskId;
        ActionCatalog = actionCatalog;
        RuntimeContext = runtimeContext;
    }
}

internal sealed record RoomSessionAdmission(string TransportId, RoomClientRole Role,
    VerifiedRoomInstallation Installation);

// The authority must authenticate the transport peer and resolve an installed
// Room. Neither the requested role nor Room ID in the hello is proof by itself.
internal interface IRoomSessionAdmissionAuthority
{
    RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello);
}

// Side-effect preparation requires an authority which serializes this read
// with installation binding, replacement and revocation. No unsafe default.
internal interface IRoomSessionActionAdmissionAuthority : IRoomSessionAdmissionAuthority
{
    T WithAdmission<T>(RoomSessionPeer peer, RoomSessionHello hello, Func<RoomSessionAdmission?, T> prepare);
}

internal sealed class ClosedRoomSessionAdmissionAuthority : IRoomSessionAdmissionAuthority
{
    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello) => null;
}

internal enum RoomProtocolStatus
{
    Accepted,
    Queued,
    UnsupportedVersion,
    Denied,
    NoActiveSession,
    StaleSession,
    Forbidden,
    InvalidDesk,
    Rejected,
    StorageUnavailable
}

internal sealed record RoomProtocolReply(RoomProtocolStatus Status, Guid? ConnectionId,
    RoomSessionSnapshot? Snapshot);

internal sealed class RoomSessionProtocolGateway
{
    private readonly object gate = new();
    private readonly RoomSessionKernel kernel;
    private readonly IRoomSessionAdmissionAuthority authority;
    private readonly Dictionary<Guid, Connection> connections = new();
    private readonly Dictionary<Guid, List<Observation>> observations = new();
    private SessionBinding? activeBinding;

    public RoomSessionProtocolGateway(RoomSessionKernel kernel, IRoomSessionAdmissionAuthority authority)
    {
        this.kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
        this.authority = authority ?? throw new ArgumentNullException(nameof(authority));
    }

    public RoomProtocolReply Open(RoomSessionPeer peer, RoomSessionHello hello)
    {
        ArgumentNullException.ThrowIfNull(peer);
        ArgumentNullException.ThrowIfNull(hello);
        if (hello.ProtocolVersion != RoomSessionKernel.ProtocolVersion)
            return Reject(RoomProtocolStatus.UnsupportedVersion);
        if (string.IsNullOrWhiteSpace(peer.TransportId) || string.IsNullOrWhiteSpace(hello.RoomId) ||
            !Enum.IsDefined(typeof(RoomClientRole), hello.Role))
            return Reject(RoomProtocolStatus.Denied);

        var admission = authority.Admit(peer, hello);
        if (admission is null || admission.TransportId != peer.TransportId ||
            admission.Role != hello.Role || admission.Installation is null ||
            admission.Installation.RoomId != hello.RoomId)
            return Reject(RoomProtocolStatus.Denied);

        lock (gate)
        {
            var current = kernel.Snapshot;
            var snapshot = IsBound(current, admission.Installation) ? current : null;
            if (hello.Role != RoomClientRole.Coordinator && snapshot is null)
                return Reject(RoomProtocolStatus.NoActiveSession);
            var id = Guid.NewGuid();
            connections.Add(id, new Connection(peer.TransportId, hello,
                admission.Installation, snapshot?.SessionId));
            return new RoomProtocolReply(RoomProtocolStatus.Accepted, id, snapshot);
        }
    }

    public RoomProtocolReply Start(Guid connectionId, RoomSessionPeer peer, RoomSessionFacts? initialFacts = null)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            try
            {
                var result = kernel.Start(installation.RoomId, installation.DeskIds, installation.StartDeskId, installation.RuntimeContext?.Policy, initialFacts);
                activeBinding = new SessionBinding(result.SessionId, installation.RoomId, installation.InstallationStamp);
                connections[connectionId] = connection with { SessionId = result.SessionId };
                ReleaseAllObservations();
                return Accept(result);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public RoomProtocolReply Restore(Guid connectionId, RoomSessionPeer peer, RoomSessionFacts? initialFacts = null)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            try
            {
                if (!kernel.TryRestore(installation.RoomId, installation.DeskIds, out var result, installation.RuntimeContext?.Policy, initialFacts) || result is null)
                    return Reject(RoomProtocolStatus.Rejected);
                activeBinding = new SessionBinding(result.SessionId, installation.RoomId, installation.InstallationStamp);
                connections[connectionId] = connection with { SessionId = result.SessionId };
                ReleaseAllObservations();
                return Accept(result);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    internal RoomProtocolStatus ReadActionContext(Guid connectionId, RoomSessionPeer peer, Guid sessionId, out RoomActionContext? context)
    {
        lock (gate)
        {
            context = null;
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error.Status;
            if (connection.Hello.Role == RoomClientRole.Coordinator) return RoomProtocolStatus.Forbidden;
            if (!TryCurrentSession(connection, out var current, out error)) return error.Status;
            if (current.SessionId != sessionId) return RoomProtocolStatus.StaleSession;
            context = new RoomActionContext(installation, current, connection.Hello.Role);
            return RoomProtocolStatus.Accepted;
        }
    }

    // Caller owns its private snapshot lock. Do not wait for gate here: a
    // snapshot observer under gate can itself need that private lock. Retrying
    // after releasing it avoids reversing the existing observation lock order.
    internal bool TryWithActionContext<T>(Guid connectionId, RoomSessionPeer peer, Guid sessionId,
        Func<RoomProtocolStatus, RoomActionContext?, T> prepare, out T result)
    {
        result = default!;
        if (!Monitor.TryEnter(gate)) return false;
        try
        {
            if (!connections.TryGetValue(connectionId, out var stored))
            { result = prepare(RoomProtocolStatus.StaleSession, null); return true; }
            if (authority is not IRoomSessionActionAdmissionAuthority synchronized)
            { result = prepare(RoomProtocolStatus.Denied, null); return true; }
            result = synchronized.WithAdmission(peer, stored.Hello, admission =>
            {
                if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error, (_, _) => admission))
                    return prepare(error.Status, null);
                if (connection.Hello.Role == RoomClientRole.Coordinator) return prepare(RoomProtocolStatus.Forbidden, null);
                return kernel.WithSnapshot(current =>
                {
                    if (!IsBound(current, installation) || current!.SessionId != sessionId || connection.SessionId != sessionId)
                        return prepare(RoomProtocolStatus.StaleSession, null);
                    return prepare(RoomProtocolStatus.Accepted, new RoomActionContext(installation, current, connection.Hello.Role));
                });
            });
            return true;
        }
        finally { Monitor.Exit(gate); }
    }

    internal RoomProtocolStatus ReadRuntimeContext(Guid connectionId, RoomSessionPeer peer,
        Guid sessionId, out RoomRuntimeContext? context)
    {
        lock (gate)
        {
            context = null;
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error.Status;
            if (connection.Hello.Role != RoomClientRole.DesktopPlayer) return RoomProtocolStatus.Forbidden;
            if (!TryCurrentSession(connection, out var current, out error)) return error.Status;
            if (current.SessionId != sessionId) return RoomProtocolStatus.StaleSession;
            // Legacy development overlays have no native verified manifest.
            if (installation.RuntimeContext is null) return RoomProtocolStatus.Rejected;
            context = installation.RuntimeContext;
            return RoomProtocolStatus.Accepted;
        }
    }

    public RoomProtocolReply Read(Guid connectionId, RoomSessionPeer peer)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            return Accept(current);
        }
    }

    public RoomProtocolReply Subscribe(Guid connectionId, RoomSessionPeer peer,
        Action<RoomSessionSnapshot> observer, out IDisposable? subscription,
        Action<RoomRuntimeContext?, RoomSessionSnapshot>? initialize = null, Action? revoked = null)
    {
        ArgumentNullException.ThrowIfNull(observer);
        lock (gate)
        {
            subscription = null;
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (initialize is not null && connection.Hello.Role != RoomClientRole.DesktopPlayer)
                return Reject(RoomProtocolStatus.Forbidden);
            var observation = new Observation(this, connectionId, revoked);
            if (!observations.TryGetValue(connectionId, out var list))
                observations.Add(connectionId, list = new List<Observation>());
            list.Add(observation);
            try
            {
                // Register invalidation before publishing any context. A synchronous
                // initializer may close/stop/replace this session before Subscribe.
                initialize?.Invoke(installation.RuntimeContext, current);
                if (observation.IsDisposed) return Reject(RoomProtocolStatus.StaleSession);
                if (!TryAuthorize(connectionId, peer, out connection, out _, out error) ||
                    !TryCurrentSession(connection, out current, out error))
                { Unsubscribe(observation); return error; }
                observation.Attach(kernel.Subscribe(snapshot => Deliver(observation, peer, observer, snapshot)));
                if (observation.IsDisposed) return Reject(RoomProtocolStatus.StaleSession);
                if (!TryAuthorize(connectionId, peer, out connection, out _, out error)) return error;
                if (!TryCurrentSession(connection, out current, out error))
                { Unsubscribe(observation); return error; }
                subscription = observation;
                return Accept(current);
            }
            catch { Unsubscribe(observation); throw; }
        }
    }

    internal RoomProtocolReply Replay(Guid connectionId, RoomSessionPeer peer,
        Action<RoomRuntimeContext?, RoomSessionSnapshot>? initialize, Action<RoomSessionSnapshot> observer)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.DesktopPlayer) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            initialize?.Invoke(installation.RuntimeContext, current);
            if (!TryAuthorize(connectionId, peer, out connection, out _, out error) ||
                !TryCurrentSession(connection, out current, out error)) return error;
            observer(current);
            return Accept(current);
        }
    }

    public RoomProtocolReply Request(Guid connectionId, RoomSessionPeer peer, Guid sessionId, string deskId)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role == RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            if (!installation.DeskIds.Contains(deskId, StringComparer.Ordinal))
                return Reject(RoomProtocolStatus.InvalidDesk);
            var result = kernel.Request(sessionId, deskId);
            return result.Status switch
            {
                RoomCommandStatus.Accepted => Accept(result.Snapshot!),
                RoomCommandStatus.Queued => new RoomProtocolReply(RoomProtocolStatus.Queued, null, result.Snapshot),
                _ => Reject(RoomProtocolStatus.Rejected)
            };
        }
    }

    public RoomProtocolReply Complete(Guid connectionId, RoomSessionPeer peer, Guid sessionId, Guid transitionId)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.DesktopPlayer) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            try
            {
                return kernel.Complete(sessionId, transitionId)
                    ? Accept(kernel.Snapshot!)
                    : Reject(RoomProtocolStatus.Rejected);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    internal RoomProtocolReply SetHostStage(Guid connectionId, RoomSessionPeer peer, Guid sessionId, RoomLifecycleStage stage)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            if (installation.RuntimeContext is null) return Reject(RoomProtocolStatus.Rejected);
            try { return kernel.SetHostStage(sessionId, stage) ? Accept(kernel.Snapshot!) : Reject(RoomProtocolStatus.Rejected); }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    internal RoomProtocolReply BeginDocument(Guid connectionId, RoomSessionPeer peer, Guid sessionId)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            if (installation.RuntimeContext?.Policy.HasStart != true) return Accept(current);
            try { return kernel.BeginDocument(sessionId) ? Accept(kernel.Snapshot!) : Reject(RoomProtocolStatus.Rejected); }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    internal RoomProtocolReply CompleteStartup(Guid connectionId, RoomSessionPeer peer, Guid sessionId, long lifecycleRevision)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out var installation, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.DesktopPlayer) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            if (installation.RuntimeContext?.Policy.HasStart != true) return Reject(RoomProtocolStatus.Rejected);
            try { return kernel.CompleteStartup(sessionId, lifecycleRevision) ? Accept(kernel.Snapshot!) : Reject(RoomProtocolStatus.Rejected); }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public RoomProtocolReply SetOperable(Guid connectionId, RoomSessionPeer peer, Guid sessionId, bool operable)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            try
            {
                return kernel.SetOperable(sessionId, operable)
                    ? Accept(kernel.Snapshot!)
                    : Reject(RoomProtocolStatus.StaleSession);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public RoomProtocolReply SetLifecycle(Guid connectionId, RoomSessionPeer peer, Guid sessionId,
        RoomLifecycleStage stage, bool playbackPaused, bool locked)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            try
            {
                return kernel.SetLifecycle(sessionId, stage, playbackPaused, locked)
                    ? Accept(kernel.Snapshot!) : Reject(RoomProtocolStatus.Rejected);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public RoomProtocolReply SetRuntimeFacts(Guid connectionId, RoomSessionPeer peer, Guid sessionId, RoomSessionFacts facts)
    {
        ArgumentNullException.ThrowIfNull(facts);
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            try
            {
                return kernel.SetRuntimeFacts(sessionId, facts)
                    ? Accept(kernel.Snapshot!) : Reject(RoomProtocolStatus.Rejected);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public RoomProtocolReply Stop(Guid connectionId, RoomSessionPeer peer, Guid sessionId)
    {
        lock (gate)
        {
            if (!TryAuthorize(connectionId, peer, out var connection, out _, out var error)) return error;
            if (connection.Hello.Role != RoomClientRole.Coordinator) return Reject(RoomProtocolStatus.Forbidden);
            if (!TryCurrentSession(connection, out var current, out error)) return error;
            if (current.SessionId != sessionId) return Reject(RoomProtocolStatus.StaleSession);
            try
            {
                if (!kernel.Stop(sessionId)) return Reject(RoomProtocolStatus.StaleSession);
                activeBinding = null;
                ReleaseAllObservations();
                return Accept(kernel.Snapshot!);
            }
            catch (Exception failure) when (IsStorageFailure(failure)) { return StorageFailure(failure); }
        }
    }

    public bool Close(Guid connectionId, RoomSessionPeer peer)
    {
        ArgumentNullException.ThrowIfNull(peer);
        lock (gate)
        {
            if (!connections.TryGetValue(connectionId, out var connection) ||
                connection.TransportId != peer.TransportId) return false;
            connections.Remove(connectionId);
            ReleaseObservations(connectionId);
            return true;
        }
    }

    private void Deliver(Observation observation, RoomSessionPeer peer,
        Action<RoomSessionSnapshot> observer, RoomSessionSnapshot snapshot)
    {
        lock (gate)
        {
            if (observation.IsDisposed) return;
            if (!TryAuthorize(observation.ConnectionId, peer, out var connection, out _, out _)) return;
            if (!TryCurrentSession(connection, out var current, out _) ||
                snapshot.SessionId != current.SessionId || !snapshot.IsActive)
            {
                Unsubscribe(observation);
                return;
            }
            observer(snapshot);
        }
    }

    private void Unsubscribe(Observation observation)
    {
        lock (gate)
        {
            if (observation.IsDisposed) return;
            observation.Deactivate();
            if (observations.TryGetValue(observation.ConnectionId, out var list))
            {
                list.Remove(observation);
                if (list.Count == 0) observations.Remove(observation.ConnectionId);
            }
        }
    }

    private void ReleaseObservations(Guid connectionId)
    {
        if (!observations.Remove(connectionId, out var list)) return;
        foreach (var observation in list) observation.Deactivate();
    }

    private void ReleaseAllObservations()
    {
        foreach (var connectionId in observations.Keys.ToArray()) ReleaseObservations(connectionId);
    }

    private bool TryAuthorize(Guid connectionId, RoomSessionPeer peer, out Connection connection,
        out VerifiedRoomInstallation installation, out RoomProtocolReply error,
        Func<RoomSessionPeer, RoomSessionHello, RoomSessionAdmission?>? readAdmission = null)
    {
        ArgumentNullException.ThrowIfNull(peer);
        connection = null!;
        installation = null!;
        error = Reject(RoomProtocolStatus.StaleSession);
        if (!connections.TryGetValue(connectionId, out var stored)) return false;
        if (stored.TransportId != peer.TransportId || string.IsNullOrWhiteSpace(peer.TransportId))
        {
            error = Reject(RoomProtocolStatus.Denied);
            return false;
        }
        var admission = readAdmission is null ? authority.Admit(peer, stored.Hello) : readAdmission(peer, stored.Hello);
        if (admission is null || admission.TransportId != stored.TransportId ||
            admission.Role != stored.Hello.Role || admission.Installation is null ||
            admission.Installation.RoomId != stored.Installation.RoomId ||
            admission.Installation.InstallationStamp != stored.Installation.InstallationStamp ||
            admission.Installation.StartDeskId != stored.Installation.StartDeskId ||
            !admission.Installation.DeskIds.SequenceEqual(stored.Installation.DeskIds, StringComparer.Ordinal))
        {
            connections.Remove(connectionId);
            ReleaseObservations(connectionId);
            error = Reject(RoomProtocolStatus.Denied);
            return false;
        }
        connection = stored;
        installation = admission.Installation;
        return true;
    }

    private bool TryCurrentSession(Connection connection, out RoomSessionSnapshot current,
        out RoomProtocolReply error)
    {
        var snapshot = kernel.Snapshot;
        current = null!;
        if (connection.SessionId is null)
        {
            error = Reject(RoomProtocolStatus.NoActiveSession);
            return false;
        }
        if (!IsBound(snapshot, connection.Installation) || snapshot!.SessionId != connection.SessionId)
        {
            error = Reject(RoomProtocolStatus.StaleSession);
            return false;
        }
        current = snapshot;
        error = Accept(snapshot);
        return true;
    }

    private bool IsBound(RoomSessionSnapshot? snapshot, VerifiedRoomInstallation installation) =>
        snapshot is { IsActive: true } && activeBinding is not null &&
        snapshot.SessionId == activeBinding.SessionId &&
        snapshot.RoomId == activeBinding.RoomId &&
        installation.RoomId == activeBinding.RoomId &&
        installation.InstallationStamp == activeBinding.InstallationStamp;

    private static RoomProtocolReply Reject(RoomProtocolStatus status) => new(status, null, null);

    private static bool IsStorageFailure(Exception failure) =>
        failure is IOException or UnauthorizedAccessException;

    private static RoomProtocolReply StorageFailure(Exception failure)
    {
        Trace.TraceError($"Dext Room checkpoint operation failed: {failure}");
        return Reject(RoomProtocolStatus.StorageUnavailable);
    }

    private static RoomProtocolReply Accept(RoomSessionSnapshot snapshot) =>
        new(RoomProtocolStatus.Accepted, null, snapshot);

    private sealed record Connection(string TransportId, RoomSessionHello Hello,
        VerifiedRoomInstallation Installation, Guid? SessionId);

    private sealed record SessionBinding(Guid SessionId, string RoomId, string InstallationStamp);

    private sealed class Observation(RoomSessionProtocolGateway owner, Guid connectionId, Action? revoked) : IDisposable
    {
        private IDisposable? kernelSubscription;
        public Guid ConnectionId { get; } = connectionId;
        public bool IsDisposed { get; private set; }

        public void Attach(IDisposable subscription)
        {
            if (IsDisposed) DisposeOutsideGateway(subscription);
            else kernelSubscription = subscription;
        }

        public void Deactivate()
        {
            if (IsDisposed) return;
            IsDisposed = true;
            if (kernelSubscription is { } subscription) DisposeOutsideGateway(subscription);
            kernelSubscription = null;
            try { revoked?.Invoke(); }
            catch (Exception error) { Trace.TraceError($"Dext Player revocation delivery failed: {error}"); }
        }

        private static void DisposeOutsideGateway(IDisposable subscription)
        {
            // A kernel notification holds its own observer lock before calling
            // back into the gateway. Waiting for that lock under gate deadlocks.
            ThreadPool.QueueUserWorkItem(static state => ((IDisposable)state!).Dispose(), subscription);
        }

        public void Dispose() => owner.Unsubscribe(this);
    }
}
