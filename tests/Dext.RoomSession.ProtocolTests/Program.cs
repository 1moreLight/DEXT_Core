using Dext.Core.Rooms;
using System.Collections;
using System.Reflection;

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
    Equal(RoomProtocolStatus.Forbidden,
        gateway.Request(opened.ConnectionId.Value, peer, started.Snapshot!.SessionId, "work").Status,
        "coordinator cannot request navigation");
    var desktop = new RoomSessionPeer("player-1");
    var view = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(RoomProtocolStatus.InvalidDesk,
        gateway.Request(view.ConnectionId!.Value, desktop, started.Snapshot.SessionId, "injected").Status,
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
    var requested = gateway.Request(live.ConnectionId!.Value, livePeer, session.SessionId, "work");
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

Check("desktop and Dock subscriptions receive the same ordered full snapshots", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var dock = new RoomSessionPeer("dock-1");
    var desktopLease = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var dockLease = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var desktopEvents = new List<RoomSessionSnapshot>();
    var dockEvents = new List<RoomSessionSnapshot>();
    Equal(RoomProtocolStatus.Accepted,
        gateway.Subscribe(desktopLease.ConnectionId!.Value, desktop, desktopEvents.Add, out var desktopSubscription).Status,
        "desktop subscribes");
    Equal(RoomProtocolStatus.Accepted,
        gateway.Subscribe(dockLease.ConnectionId!.Value, dock, dockEvents.Add, out var dockSubscription).Status,
        "Dock subscribes");
    True(desktopSubscription is not null && dockSubscription is not null, "subscription handles issued");
    Equal(1, desktopEvents.Count, "initial complete desktop snapshot");
    Equal(active, desktopEvents[0], "initial snapshot is current Core state");
    var moving = gateway.Request(dockLease.ConnectionId.Value, dock, active.SessionId, "work");
    gateway.Complete(desktopLease.ConnectionId.Value, desktop, active.SessionId,
        moving.Snapshot!.TransitionId!.Value);
    Equal(3, desktopEvents.Count, "desktop receives transition and commit");
    Equal(3, dockEvents.Count, "Dock receives transition and commit");
    for (var i = 0; i < 3; i++)
    {
        Equal(desktopEvents[i], dockEvents[i], $"same full snapshot {i}");
        Equal(active.Revision + i, desktopEvents[i].Revision, $"ordered revision {i}");
    }
    Equal("work", desktopEvents[^1].CurrentDeskId, "committed Desk delivered");
    desktopSubscription!.Dispose();
    dockSubscription!.Dispose();
});

Check("wrong peer cannot subscribe and disposing a handle stops delivery", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var dock = new RoomSessionPeer("dock-1");
    var lease = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var events = new List<RoomSessionSnapshot>();
    var denied = gateway.Subscribe(lease.ConnectionId!.Value, new RoomSessionPeer("intruder"),
        events.Add, out var stolenHandle);
    Equal(RoomProtocolStatus.Denied, denied.Status, "stolen peer denied");
    Equal(null, denied.Snapshot, "stolen peer sees no snapshot");
    Equal(null, stolenHandle, "stolen peer gets no handle");
    var accepted = gateway.Subscribe(lease.ConnectionId.Value, dock, events.Add, out var handle);
    Equal(RoomProtocolStatus.Accepted, accepted.Status, "trusted Dock subscribes");
    Equal(1, events.Count, "initial notification");
    handle!.Dispose();
    gateway.Request(lease.ConnectionId.Value, dock, active.SessionId, "work");
    Equal(1, events.Count, "disposed handle receives no event");
});

Check("subscription reply reflects changes made during the initial callback", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var dock = new RoomSessionPeer("dock-1");
    var view = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var seen = new List<long>();
    var reply = gateway.Subscribe(view.ConnectionId!.Value, dock, snapshot =>
    {
        seen.Add(snapshot.Revision);
        if (snapshot.Revision == active.Revision)
            gateway.Request(view.ConnectionId.Value, dock, active.SessionId, "work");
    }, out var handle);
    Equal(RoomProtocolStatus.Accepted, reply.Status, "subscription accepted");
    Equal(kernel.Snapshot?.Revision, reply.Snapshot?.Revision, "reply uses latest full snapshot");
    Equal(2, seen.Count, "nested transition delivered once");
    handle!.Dispose();
});

Check("closing a connection stops its subscription while reconnect gets latest state", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var dock = new RoomSessionPeer("dock-1");
    var old = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var live = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var events = new List<RoomSessionSnapshot>();
    gateway.Subscribe(old.ConnectionId!.Value, desktop, events.Add, out var handle);
    True(gateway.Close(old.ConnectionId.Value, desktop), "old connection closed");
    var moving = gateway.Request(live.ConnectionId!.Value, dock, active.SessionId, "work");
    Equal(1, events.Count, "closed view does not see transition");
    var fresh = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    Equal(moving.Snapshot, fresh.Snapshot, "reconnect gets current full snapshot");
    handle!.Dispose();
});

Check("revocation and installation replacement stop old subscriptions", () =>
{
    using var kernel = new RoomSessionKernel();
    var authority = new TestAdmissionAuthority();
    var gateway = new RoomSessionProtocolGateway(kernel, authority);
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var view = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var events = new List<RoomSessionSnapshot>();
    gateway.Subscribe(view.ConnectionId!.Value, desktop, events.Add, out var handle);
    authority.InstallAEnabled = false;
    kernel.Request(active.SessionId, "work");
    Equal(1, events.Count, "revoked installation receives no update");
    authority.InstallAEnabled = true;
    Equal(RoomProtocolStatus.StaleSession, gateway.Read(view.ConnectionId.Value, desktop).Status,
        "revoked connection stays invalid");
    var newView = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var replacementEvents = new List<RoomSessionSnapshot>();
    gateway.Subscribe(newView.ConnectionId!.Value, desktop, replacementEvents.Add, out var replacementHandle);
    authority.StampA = "replacement";
    kernel.Complete(active.SessionId, kernel.Snapshot!.TransitionId!.Value);
    Equal(1, replacementEvents.Count, "replaced installation receives no update");
    handle!.Dispose();
    replacementHandle!.Dispose();
});

Check("new session and stop invalidate old subscriptions; observer failures are isolated", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var first = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var dock = new RoomSessionPeer("dock-1");
    var view = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    var dockView = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var events = new List<RoomSessionSnapshot>();
    gateway.Subscribe(view.ConnectionId!.Value, desktop, _ => throw new InvalidOperationException("observer fails"), out var badHandle);
    gateway.Subscribe(dockView.ConnectionId!.Value, dock, events.Add, out var oldHandle);
    gateway.Request(dockView.ConnectionId.Value, dock, first.SessionId, "work");
    Equal(2, events.Count, "healthy observer survives another observer failure");
    var second = gateway.Start(control.ConnectionId.Value, coordinator).Snapshot!;
    Equal(2, events.Count, "old subscription does not see new session");
    var replacement = gateway.Open(dock,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Dock, "install-a"));
    var newEvents = new List<RoomSessionSnapshot>();
    gateway.Subscribe(replacement.ConnectionId!.Value, dock, newEvents.Add, out var newHandle);
    Equal(second, newEvents[0], "new subscription sees replacement session");
    gateway.Stop(control.ConnectionId.Value, coordinator, second.SessionId);
    Equal(1, newEvents.Count, "stopped session no longer pushes active snapshots");
    badHandle!.Dispose();
    oldHandle!.Dispose();
    newHandle!.Dispose();
});

Check("closing an observer cannot deadlock a concurrent kernel notification", () =>
{
    using var kernel = new RoomSessionKernel();
    var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
    var coordinator = new RoomSessionPeer("core-1");
    var control = gateway.Open(coordinator,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, "install-a"));
    var active = gateway.Start(control.ConnectionId!.Value, coordinator).Snapshot!;
    var desktop = new RoomSessionPeer("player-1");
    var view = gateway.Open(desktop,
        new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a"));
    gateway.Subscribe(view.ConnectionId!.Value, desktop, _ => { }, out var handle);

    // Hold the gateway gate while a notification holds the kernel observer's
    // notify gate. Close must not synchronously wait for that observer gate.
    var gatewayGate = typeof(RoomSessionProtocolGateway)
        .GetField("gate", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(gateway)!;
    var listeners = (IDictionary)typeof(RoomSessionKernel)
        .GetField("subscriptions", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(kernel)!;
    var listener = listeners.Values.Cast<object>().Single();
    var notifyGate = listener.GetType()
        .GetField("notifyGate", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(listener)!;
    Task? publish = null;
    var close = Task.Run(() =>
    {
        Monitor.Enter(gatewayGate);
        try
        {
            publish = Task.Run(() => kernel.Request(active.SessionId, "work"));
            True(SpinWait.SpinUntil(() =>
            {
                if (!Monitor.TryEnter(notifyGate)) return true;
                Monitor.Exit(notifyGate);
                return false;
            }, TimeSpan.FromSeconds(3)), "kernel observer reached delivery");
            return gateway.Close(view.ConnectionId.Value, desktop);
        }
        finally { Monitor.Exit(gatewayGate); }
    });
    True(close.Wait(TimeSpan.FromSeconds(3)), "Close completed without lock inversion");
    True(close.Result, "view closed");
    True(publish!.Wait(TimeSpan.FromSeconds(3)), "kernel notification completed");
    handle!.Dispose();
});

Console.WriteLine($"{total - failures}/{total} protocol checks passed");
if (failures != 0) Environment.Exit(1);

if (args.Contains("--demo"))
{
    using var kernel = new RoomSessionKernel();
    var authority = new TestAdmissionAuthority();
    var gateway = new RoomSessionProtocolGateway(kernel, authority);
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
    Console.WriteLine($"desktop and Dock: session={desktopLease.Snapshot?.SessionId}/{dockLease.Snapshot?.SessionId}, revision={desktopLease.Snapshot?.Revision}/{dockLease.Snapshot?.Revision}, Desk={desktopLease.Snapshot?.CurrentDeskId}/{dockLease.Snapshot?.CurrentDeskId}");
    var desktopEvents = new List<RoomSessionSnapshot>();
    var dockEvents = new List<RoomSessionSnapshot>();
    gateway.Subscribe(desktopLease.ConnectionId!.Value, desktop, desktopEvents.Add, out var desktopSubscription);
    gateway.Subscribe(dockLease.ConnectionId!.Value, dock, dockEvents.Add, out var dockSubscription);
    var moving = gateway.Request(dockLease.ConnectionId!.Value, dock, active.SessionId, "work");
    Console.WriteLine($"Dock completion: {gateway.Complete(dockLease.ConnectionId.Value, dock, active.SessionId, moving.Snapshot!.TransitionId!.Value).Status}");
    gateway.Complete(desktopLease.ConnectionId!.Value, desktop, active.SessionId, moving.Snapshot.TransitionId!.Value);
    Console.WriteLine($"observation revisions: desktop={string.Join(',', desktopEvents.Select(x => x.Revision))}, Dock={string.Join(',', dockEvents.Select(x => x.Revision))}");
    var desktopHello = new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.DesktopPlayer, "install-a");
    var reconnected = gateway.Open(desktop, desktopHello);
    Console.WriteLine($"reconnected snapshot: session={reconnected.Snapshot?.SessionId}, revision={reconnected.Snapshot?.Revision}, Desk={reconnected.Snapshot?.CurrentDeskId}");
    gateway.Close(desktopLease.ConnectionId.Value, desktop);
    Console.WriteLine($"closed connection write: {gateway.Request(desktopLease.ConnectionId.Value, desktop, active.SessionId, "home").Status}");
    var afterClose = gateway.Request(dockLease.ConnectionId.Value, dock, active.SessionId, "home");
    gateway.Complete(reconnected.ConnectionId!.Value, desktop, active.SessionId,
        afterClose.Snapshot!.TransitionId!.Value);
    Console.WriteLine($"after desktop closes: old desktop events={desktopEvents.Count}, live Dock events={dockEvents.Count}");
    authority.InstallAEnabled = false;
    Console.WriteLine($"revoked installation: {gateway.Open(desktop, desktopHello).Status}");
    authority.InstallAEnabled = true;
    authority.StampA = "reinstalled-a";
    Console.WriteLine($"old connection after replacement: {gateway.Read(reconnected.ConnectionId!.Value, desktop).Status}");
    Console.WriteLine($"new view before restart: {gateway.Open(desktop, desktopHello).Status}");
    var newControl = gateway.Open(coordinator, hello);
    var restarted = gateway.Start(newControl.ConnectionId!.Value, coordinator).Snapshot!;
    Console.WriteLine($"new installation session: {gateway.Open(desktop, desktopHello).Snapshot?.SessionId} (expected {restarted.SessionId})");
    Console.WriteLine($"old Dock events after session replacement: {dockEvents.Count}");
    desktopSubscription!.Dispose();
    dockSubscription!.Dispose();
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
