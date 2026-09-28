using System;
using System.Collections.Generic;
using System.Linq;

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

    public VerifiedRoomInstallation(string roomId, string installationStamp,
        IReadOnlyList<string> deskIds, string startDeskId)
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
    InvalidDesk
}

internal sealed record RoomProtocolReply(RoomProtocolStatus Status, Guid? ConnectionId,
    RoomSessionSnapshot? Snapshot);

internal sealed class RoomSessionProtocolGateway
{
    private readonly object gate = new();
    private readonly RoomSessionKernel kernel;
    private readonly IRoomSessionAdmissionAuthority authority;
    private readonly Dictionary<Guid, Connection> connections = new();

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
            if (hello.Role != RoomClientRole.Coordinator &&
                (current is null || !current.IsActive || current.RoomId != hello.RoomId))
                return Reject(RoomProtocolStatus.NoActiveSession);
            var snapshot = current is { IsActive: true } && current.RoomId == hello.RoomId ? current : null;
            var id = Guid.NewGuid();
            connections.Add(id, new Connection(peer.TransportId, hello,
                admission.Installation.InstallationStamp, snapshot?.SessionId));
            return new RoomProtocolReply(RoomProtocolStatus.Accepted, id, snapshot);
        }
    }

    private static RoomProtocolReply Reject(RoomProtocolStatus status) => new(status, null, null);

    private sealed record Connection(string TransportId, RoomSessionHello Hello,
        string InstallationStamp, Guid? SessionId);
}
