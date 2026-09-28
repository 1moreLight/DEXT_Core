using Dext.Core.Rooms;

var failures = 0;
var total = 0;

void Check(string name, Action test)
{
    total++;
    try
    {
        test();
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception error)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {name}: {error.Message}");
    }
}

static void Equal<T>(T expected, T actual, string detail)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new Exception($"{detail}: expected {expected}, got {actual}");
}

static void True(bool condition, string detail)
{
    if (!condition) throw new Exception(detail);
}

Check("wrong protocol version is rejected before admission", () =>
{
    using var kernel = new RoomSessionKernel();
    var authority = new TestAdmissionAuthority();
    var gateway = new RoomSessionProtocolGateway(kernel, authority);
    var result = gateway.Open(new RoomSessionPeer("core-1"),
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion + 1, RoomClientRole.Coordinator, "install-a"));
    Equal(RoomProtocolStatus.UnsupportedVersion, result.Status, "version status");
    Equal(null, result.ConnectionId, "no connection on wrong version");
    Equal(null, result.Snapshot, "no snapshot leak");
    Equal(0, authority.Calls, "admission must not run");
});

Check("untrusted source, role spoof and unknown Room reveal no session", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var claims = new[]
    {
        (new RoomSessionPeer("intruder"), RoomClientRole.Coordinator, "install-a"),
        (new RoomSessionPeer("player-1"), RoomClientRole.Coordinator, "install-a"),
        (new RoomSessionPeer("core-1"), RoomClientRole.Coordinator, "unknown")
    };
    foreach (var (peer, role, roomId) in claims)
    {
        var result = gateway.Open(peer, new RoomSessionHello(RoomSessionKernel.ProtocolVersion, role, roomId));
        Equal(RoomProtocolStatus.Denied, result.Status, "denied source or installation");
        Equal(null, result.ConnectionId, "no connection for denied claim");
        Equal(null, result.Snapshot, "no snapshot for denied claim");
    }
    Equal(null, kernel.Snapshot, "denied claims cannot start a Room");
});

Check("trusted coordinator can connect only to verified installation data", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var result = gateway.Open(new RoomSessionPeer("core-1"),
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    Equal(RoomProtocolStatus.Accepted, result.Status, "trusted coordinator accepted");
    True(result.ConnectionId is { } id && id != Guid.Empty, "opaque connection issued");
    Equal(null, result.Snapshot, "connect does not implicitly start a Room");
    Equal(null, kernel.Snapshot, "kernel stays idle");
});

Check("production admission is closed until real adapters exist", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new ClosedRoomSessionAdmissionAuthority());
    var result = gateway.Open(new RoomSessionPeer("core-1"),
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    Equal(RoomProtocolStatus.Denied, result.Status, "closed policy rejects even plausible claims");
    Equal(null, result.Snapshot, "closed policy leaks no snapshot");
});

Check("views cannot attach before the coordinator starts a verified Room", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var view = gateway.Open(new RoomSessionPeer("player-1"),
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(RoomProtocolStatus.NoActiveSession, view.Status, "no active session");
    Equal(null, view.ConnectionId, "no view lease issued");
});

Check("coordinator starts from verified installation rather than client Desk data", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var peer = new RoomSessionPeer("core-1");
    var opened = gateway.Open(peer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var started = gateway.Start(opened.ConnectionId!.Value, peer);
    Equal(RoomProtocolStatus.Accepted, started.Status, "start accepted");
    Equal("install-a", started.Snapshot?.RoomId, "installed copy identity");
    Equal("home", started.Snapshot?.CurrentDeskId, "trusted start Desk");
    Equal(RoomProtocolStatus.InvalidDesk,
        gateway.Request(opened.ConnectionId.Value, peer, started.Snapshot!.SessionId, "injected").Status,
        "unverified Desk rejected");
});

Check("desktop and Dock share a snapshot but only desktop completes transitions", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var session = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var dock = new RoomSessionPeer("dock-1");
    var desktopConnection = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var dockConnection = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    Equal(session.SessionId, desktopConnection.Snapshot?.SessionId, "desktop session");
    Equal(session.Revision, dockConnection.Snapshot?.Revision, "Dock revision");
    var first = gateway.Request(dockConnection.ConnectionId!.Value, dock, session.SessionId, "work");
    Equal(RoomProtocolStatus.Accepted, first.Status, "Dock navigation");
    var transitionId = first.Snapshot!.TransitionId!.Value;
    Equal(RoomProtocolStatus.Forbidden,
        gateway.Complete(dockConnection.ConnectionId.Value, dock, session.SessionId, transitionId).Status,
        "Dock cannot complete animation");
    Equal("home", kernel.Snapshot?.CurrentDeskId, "forbidden completion leaves Desk intact");
    Equal(RoomProtocolStatus.Accepted,
        gateway.Complete(desktopConnection.ConnectionId!.Value, desktop, session.SessionId, transitionId).Status,
        "desktop completion");
    Equal("work", gateway.Read(dockConnection.ConnectionId.Value, dock).Snapshot?.CurrentDeskId,
        "Dock sees committed Desk");
});

Check("stolen token, closed connection and old session cannot mutate Core", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var lease = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var first = gateway.Start(lease.ConnectionId!.Value, coordinator).Snapshot!;
    Equal(RoomProtocolStatus.Denied,
        gateway.Request(lease.ConnectionId.Value, new RoomSessionPeer("intruder"), first.SessionId, "work").Status,
        "wrong peer denied even with token");
    Equal("home", kernel.Snapshot?.CurrentDeskId, "wrong peer cannot change Desk");
    var view = new RoomSessionPeer("player-1");
    var viewLease = gateway.Open(view,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var second = gateway.Start(lease.ConnectionId.Value, coordinator).Snapshot!;
    True(second.SessionId != first.SessionId, "new start changes session ID");
    Equal(RoomProtocolStatus.StaleSession,
        gateway.Request(viewLease.ConnectionId!.Value, view, first.SessionId, "work").Status,
        "old view lease rejected");
    True(gateway.Close(lease.ConnectionId.Value, coordinator), "coordinator connection closes");
    Equal(RoomProtocolStatus.StaleSession,
        gateway.Request(lease.ConnectionId.Value, coordinator, second.SessionId, "work").Status,
        "closed connection rejected");
});

Check("reconnect receives complete latest snapshot after missed changes", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var session = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var oldPeer = new RoomSessionPeer("player-1");
    var old = gateway.Open(oldPeer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    True(gateway.Close(old.ConnectionId!.Value, oldPeer), "first view disconnected");
    var livePeer = new RoomSessionPeer("player-2");
    var live = gateway.Open(livePeer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var requested = gateway.Request(control.ConnectionId.Value, coordinator, session.SessionId, "work");
    gateway.Complete(live.ConnectionId!.Value, livePeer, session.SessionId,
        requested.Snapshot!.TransitionId!.Value);
    var fresh = gateway.Open(oldPeer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(RoomProtocolStatus.Accepted, fresh.Status, "reconnect accepted");
    Equal(session.SessionId, fresh.Snapshot?.SessionId, "same live session");
    Equal("work", fresh.Snapshot?.CurrentDeskId, "latest Desk after missed transition");
    Equal(kernel.Snapshot?.Revision, fresh.Snapshot?.Revision, "latest full revision");
});

Check("installation revocation or replacement invalidates an existing lease", () =>
{
    using var kernel = new RoomSessionKernel();
    var authority = new TestAdmissionAuthority();
    var gateway = new RoomSessionProtocolGateway(kernel, authority);
    var peer = new RoomSessionPeer("core-1");
    var lease = gateway.Open(peer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    gateway.Start(lease.ConnectionId!.Value, peer);
    authority.StampA = "reinstalled-a";
    Equal(RoomProtocolStatus.Denied, gateway.Read(lease.ConnectionId.Value, peer).Status,
        "replaced installation denied");
    authority.StampA = "stamp-a";
    Equal(RoomProtocolStatus.StaleSession, gateway.Read(lease.ConnectionId.Value, peer).Status,
        "invalidated lease cannot be revived");
    var fresh = gateway.Open(peer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    authority.InstallAEnabled = false;
    Equal(RoomProtocolStatus.Denied, gateway.Read(fresh.ConnectionId!.Value, peer).Status,
        "removed installation denied");
});

Check("new view cannot attach to a session from an older installation snapshot", () =>
{
    using var kernel = new RoomSessionKernel();
    var authority = new TestAdmissionAuthority();
    var gateway = new RoomSessionProtocolGateway(kernel, authority);
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var oldSession = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    authority.StampA = "new-installation-snapshot";
    var player = new RoomSessionPeer("player-1");
    var oldView = gateway.Open(player,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(RoomProtocolStatus.NoActiveSession, oldView.Status, "old installation session hidden");
    var newControl = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    Equal(null, newControl.Snapshot, "new coordinator cannot claim the old snapshot");
    var newSession = gateway.Start(newControl.ConnectionId!.Value, coordinator).Snapshot!;
    True(newSession.SessionId != oldSession.SessionId, "new installation starts a new session");
    Equal(RoomProtocolStatus.Accepted,
        gateway.Open(player, new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
            RoomClientRole.DesktopPlayer, "install-a")).Status,
        "new installation view attaches to new session");
});

Check("a kernel session started outside the gateway is not admitted as a view", () =>
{
    using var kernel = new RoomSessionKernel();
    kernel.Start("install-a", ["home", "work"], "home");
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var view = gateway.Open(new RoomSessionPeer("player-1"),
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(RoomProtocolStatus.NoActiveSession, view.Status, "unbound kernel session is not a protocol session");
    Equal(null, view.Snapshot, "unbound state is not leaked");
});

Check("only coordinator controls operability, restore and stop", () =>
{
    var store = new MemoryCheckpointStore();
    var authority = new TestAdmissionAuthority();
    using (var kernel = new RoomSessionKernel(store))
    {
        var gateway = new RoomSessionProtocolGateway(kernel, authority);
        var coordinator = new RoomSessionPeer("core-1");
        var control = gateway.Open(coordinator,
            new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
        var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
        var dock = new RoomSessionPeer("dock-1");
        var dockLease = gateway.Open(dock,
            new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
        Equal(RoomProtocolStatus.Forbidden,
            gateway.SetOperable(dockLease.ConnectionId!.Value, dock, active.SessionId, false).Status,
            "Dock cannot set foreground policy");
        Equal(RoomProtocolStatus.Accepted,
            gateway.SetOperable(control.ConnectionId.Value, coordinator, active.SessionId, false).Status,
            "coordinator pauses transitions");
        Equal(RoomProtocolStatus.Accepted,
            gateway.Stop(control.ConnectionId.Value, coordinator, active.SessionId).Status,
            "coordinator stops session");
        Equal(null, store.Current, "stop clears checkpoint");
    }
    using var restarted = new RoomSessionKernel(store);
    var newGateway = new RoomSessionProtocolGateway(restarted, authority);
    var newCoordinator = new RoomSessionPeer("core-1");
    var newControl = newGateway.Open(newCoordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    Equal(RoomProtocolStatus.Rejected,
        newGateway.Restore(newControl.ConnectionId!.Value, newCoordinator).Status,
        "stopped session cannot restore");
});

Check("restart restores only a currently admitted installed Room", () =>
{
    var store = new MemoryCheckpointStore();
    var authority = new TestAdmissionAuthority();
    Guid oldSession;
    using (var firstKernel = new RoomSessionKernel(store))
    {
        var firstGateway = new RoomSessionProtocolGateway(firstKernel, authority);
        var coordinator = new RoomSessionPeer("core-1");
        var control = firstGateway.Open(coordinator,
            new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
        var active = firstGateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
        oldSession = active.SessionId;
        var player = new RoomSessionPeer("player-1");
        var view = firstGateway.Open(player,
            new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
        var moving = firstGateway.Request(view.ConnectionId!.Value, player, oldSession, "work");
        firstGateway.Complete(view.ConnectionId.Value, player, oldSession,
            moving.Snapshot!.TransitionId!.Value);
    }
    authority.InstallAEnabled = false;
    using var restarted = new RoomSessionKernel(store);
    var gateway = new RoomSessionProtocolGateway(restarted, authority);
    var peer = new RoomSessionPeer("core-1");
    Equal(RoomProtocolStatus.Denied,
        gateway.Open(peer, new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
            RoomClientRole.Coordinator, "install-a")).Status,
        "removed installation cannot restore");
    authority.InstallAEnabled = true;
    var connection = gateway.Open(peer,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var restored = gateway.Restore(connection.ConnectionId!.Value, peer);
    Equal(RoomProtocolStatus.Accepted, restored.Status, "verified restoration accepted");
    Equal("work", restored.Snapshot?.CurrentDeskId, "committed Desk restored");
    True(restored.Snapshot?.SessionId != oldSession, "restored session gets a fresh token");
});

Console.WriteLine($"{total - failures}/{total} protocol checks passed");
if (failures != 0) Environment.Exit(1);

if (args.Contains("--demo"))
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var hello = new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a");
    Console.WriteLine($"wrong version: {gateway.Open(coordinator, hello with { ProtocolVersion = 99 }).Status}");
    Console.WriteLine($"spoofed coordinator: {gateway.Open(new RoomSessionPeer("player-1"), hello).Status}");
    Console.WriteLine($"unknown installation: {gateway.Open(coordinator, hello with { RoomId = "unknown" }).Status}");
    var control = gateway.Open(coordinator, hello);
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var dock = new RoomSessionPeer("dock-1");
    var desktopLease = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var dockLease = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    Console.WriteLine($"desktop and Dock: {desktopLease.Snapshot?.SessionId} / {dockLease.Snapshot?.SessionId}");
    var moving = gateway.Request(dockLease.ConnectionId!.Value, dock, active.SessionId, "work");
    Console.WriteLine($"Dock completion: {gateway.Complete(dockLease.ConnectionId.Value, dock, active.SessionId, moving.Snapshot!.TransitionId!.Value).Status}");
    gateway.Complete(desktopLease.ConnectionId!.Value, desktop, active.SessionId, moving.Snapshot.TransitionId!.Value);
    Console.WriteLine($"reconnected Desk: {gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a")).Snapshot?.CurrentDeskId}");
}

internal sealed class TestAdmissionAuthority : IRoomSessionAdmissionAuthority
{
    public int Calls { get; private set; }
    public bool InstallAEnabled { get; set; } = true;
    public string StampA { get; set; } = "stamp-a";

    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
    {
        Calls++;
        var allowed = peer.TransportId switch
        {
            "core-1" => RoomClientRole.Coordinator,
            "player-1" => RoomClientRole.DesktopPlayer,
            "player-2" => RoomClientRole.DesktopPlayer,
            "dock-1" => RoomClientRole.Dock,
            _ => (RoomClientRole?)null
        };
        if (allowed != hello.Role || hello.RoomId != "install-a" || !InstallAEnabled) return null;
        return new RoomSessionAdmission(peer.TransportId, allowed.Value,
            new VerifiedRoomInstallation("install-a", StampA, ["home", "work"], "home"));
    }
}

internal sealed class MemoryCheckpointStore : IRoomSessionCheckpointStore
{
    public RoomSessionCheckpoint? Current { get; private set; }
    public RoomSessionCheckpoint? Read() => Current;
    public void Write(RoomSessionCheckpoint checkpoint) => Current = checkpoint;
    public void Clear() => Current = null;
}
