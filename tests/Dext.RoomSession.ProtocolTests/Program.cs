using Dext.Core.Rooms;

var failures = 0;

void Check(string name, Action test)
{
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

Console.WriteLine($"{4 - failures}/4 protocol admission checks passed");
if (failures != 0) Environment.Exit(1);

internal sealed class TestAdmissionAuthority : IRoomSessionAdmissionAuthority
{
    public int Calls { get; private set; }

    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
    {
        Calls++;
        var allowed = peer.TransportId switch
        {
            "core-1" => RoomClientRole.Coordinator,
            "player-1" => RoomClientRole.DesktopPlayer,
            "dock-1" => RoomClientRole.Dock,
            _ => (RoomClientRole?)null
        };
        if (allowed != hello.Role || hello.RoomId != "install-a") return null;
        return new RoomSessionAdmission(peer.TransportId, allowed.Value,
            new VerifiedRoomInstallation("install-a", "stamp-a", ["home", "work"], "home"));
    }
}
