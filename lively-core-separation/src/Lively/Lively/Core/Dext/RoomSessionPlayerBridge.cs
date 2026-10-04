using System;

namespace Dext.Core.Rooms;

// The caller supplies a peer derived from the Core-owned Player process, never
// from page data. Admission and installation verification stay in the gateway.
internal sealed partial class RoomSessionPlayerBridge : IDisposable
{
    private readonly RoomSessionProtocolGateway gateway;
    private readonly RoomSessionPeer peer;
    private readonly Guid connectionId;
    private readonly IDisposable subscription;
    private volatile bool disposed;
    private readonly Action<RoomSessionSnapshot> sendSnapshot;
    private readonly Action<RoomRuntimeContext?, RoomSessionSnapshot>? initialize;

    private RoomSessionPlayerBridge(RoomSessionProtocolGateway gateway, RoomSessionPeer peer,
        Guid connectionId, IDisposable subscription, Action<RoomSessionSnapshot> sendSnapshot,
        Action<RoomRuntimeContext?, RoomSessionSnapshot>? initialize, Action? revoked)
    {
        this.gateway = gateway;
        this.peer = peer;
        this.connectionId = connectionId;
        this.subscription = subscription;
        this.sendSnapshot = sendSnapshot;
        this.initialize = initialize;
    }

    public static RoomProtocolStatus Connect(RoomSessionProtocolGateway gateway, RoomSessionPeer peer,
        string roomId, Action<RoomSessionSnapshot> sendSnapshot, out RoomSessionPlayerBridge? bridge,
        Action<RoomRuntimeContext?, RoomSessionSnapshot>? initialize = null, Action? revoked = null,
        RoomClientRole role = RoomClientRole.DesktopPlayer)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(peer);
        ArgumentNullException.ThrowIfNull(sendSnapshot);
        bridge = null;
        var opened = gateway.Open(peer, new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
            role, roomId));
        if (opened.Status != RoomProtocolStatus.Accepted || opened.ConnectionId is not { } id)
            return opened.Status;
        try
        {
            var subscribed = gateway.Subscribe(id, peer, sendSnapshot, out var subscription, initialize, revoked);
            if (subscribed.Status != RoomProtocolStatus.Accepted || subscription is null)
            {
                gateway.Close(id, peer);
                return subscribed.Status;
            }
            bridge = new RoomSessionPlayerBridge(gateway, peer, id, subscription, sendSnapshot, initialize, revoked);
            return RoomProtocolStatus.Accepted;
        }
        catch { gateway.Close(id, peer); throw; }
    }

    public RoomProtocolStatus Refresh()
    {
        if (disposed) return RoomProtocolStatus.StaleSession;
        try
        {
            var result = gateway.Replay(connectionId, peer, initialize, sendSnapshot);
            if (result.Status != RoomProtocolStatus.Accepted) Dispose();
            return result.Status;
        }
        catch { Dispose(); throw; }
    }

    public RoomProtocolReply Request(Guid sessionId, string deskId) => disposed
        ? new(RoomProtocolStatus.StaleSession, null, null)
        : gateway.Request(connectionId, peer, sessionId, deskId);

    public RoomProtocolReply Read() => disposed
        ? new(RoomProtocolStatus.StaleSession, null, null)
        : gateway.Read(connectionId, peer);

    public RoomProtocolStatus ReadRuntimeContext(Guid sessionId, out RoomRuntimeContext? context)
    {
        context = null;
        return disposed ? RoomProtocolStatus.StaleSession
            : gateway.ReadRuntimeContext(connectionId, peer, sessionId, out context);
    }

    public RoomProtocolReply Complete(Guid sessionId, Guid transitionId) => disposed
        ? new(RoomProtocolStatus.StaleSession, null, null)
        : gateway.Complete(connectionId, peer, sessionId, transitionId);

    internal RoomProtocolReply CompleteStartup(Guid sessionId, long lifecycleRevision) => disposed
        ? new(RoomProtocolStatus.StaleSession, null, null)
        : gateway.CompleteStartup(connectionId, peer, sessionId, lifecycleRevision);

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        subscription.Dispose();
        gateway.Close(connectionId, peer);
    }
}
