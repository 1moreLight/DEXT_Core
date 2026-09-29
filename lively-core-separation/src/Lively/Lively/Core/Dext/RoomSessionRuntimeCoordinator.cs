using System;
using Lively.Core.Wallpapers;

namespace Dext.Core.Rooms;

public interface IRoomSessionRuntimeCoordinator
{
    RoomSessionSnapshot? CurrentSnapshot { get; }
    int ActivePlayerPid { get; }
    void OnPageReady(WebWebView2 player);
    void OnPlayerExited(int? pid);
}

internal sealed class RoomSessionRuntimeCoordinator : IRoomSessionRuntimeCoordinator
{
    private static readonly NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();
    private readonly object gate = new();
    private readonly InstalledRoomSessionAuthority authority;
    private readonly RoomSessionProtocolGateway gateway;
    private readonly RoomSessionKernel kernel;
    private int activePlayerPid;
    private Guid activeSessionId;
    private string? activeInstallationStamp;

    public RoomSessionRuntimeCoordinator(InstalledRoomSessionAuthority authority,
        RoomSessionProtocolGateway gateway, RoomSessionKernel kernel)
    {
        this.authority = authority;
        this.gateway = gateway;
        this.kernel = kernel;
    }

    public int ActivePlayerPid { get { lock (gate) return activePlayerPid; } }

    public RoomSessionSnapshot? CurrentSnapshot
    {
        get
        {
            lock (gate)
            {
                var snapshot = kernel.Snapshot;
                if (activePlayerPid == 0 || snapshot is not { IsActive: true } ||
                    snapshot.SessionId != activeSessionId)
                    return null;
                var admission = authority.Admit(new RoomSessionPeer("core-runtime"),
                    new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
                        RoomClientRole.Coordinator, snapshot.RoomId));
                return admission?.Installation.InstallationStamp == activeInstallationStamp
                    ? snapshot : null;
            }
        }
    }

    public void OnPageReady(WebWebView2 player)
    {
        if (!player.IsTrustedDextHost || player.Pid is not { } pid) return;
        lock (gate)
        {
            if (activePlayerPid == pid && player.RefreshRoomSession() == RoomProtocolStatus.Accepted)
                return;
            player.DetachRoomSession();
            if (activePlayerPid != 0) authority.Unbind(activePlayerPid);
            activePlayerPid = 0;
            activeInstallationStamp = null;

            var installation = authority.Bind(player.RoomPackageDirectory, pid);
            if (installation is null) return;
            var coordinator = new RoomSessionPeer("core-runtime");
            var opened = gateway.Open(coordinator, new RoomSessionHello(
                RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, installation.RoomId));
            if (opened.ConnectionId is not { } connectionId)
            {
                authority.Unbind(pid);
                Logger.Warn($"v3 Room coordinator rejected: {opened.Status}");
                return;
            }
            try
            {
                var session = gateway.Restore(connectionId, coordinator);
                if (session.Status == RoomProtocolStatus.Rejected)
                    session = gateway.Start(connectionId, coordinator);
                if (session.Status != RoomProtocolStatus.Accepted || session.Snapshot is null)
                {
                    authority.Unbind(pid);
                    Logger.Warn($"v3 Room session start/restore rejected: {session.Status}");
                    return;
                }
                var attached = player.AttachRoomSession(gateway, installation.RoomId,
                    installation.DeskIds);
                if (attached != RoomProtocolStatus.Accepted)
                {
                    gateway.Stop(connectionId, coordinator, session.Snapshot.SessionId);
                    authority.Unbind(pid);
                    Logger.Warn($"v3 Player attach rejected: {attached}");
                    return;
                }
                activePlayerPid = pid;
                activeSessionId = session.Snapshot.SessionId;
                activeInstallationStamp = installation.InstallationStamp;
                Logger.Info($"v3 Room session active | playerPid={pid} | room={installation.RoomId} | " +
                    $"session={session.Snapshot.SessionId} | revision={session.Snapshot.Revision} | desk={session.Snapshot.CurrentDeskId}");
            }
            finally
            {
                gateway.Close(connectionId, coordinator);
            }
        }
    }

    public void OnPlayerExited(int? pid)
    {
        if (pid is not { } exitedPid) return;
        lock (gate)
        {
            authority.Unbind(exitedPid);
            if (activePlayerPid == exitedPid)
            {
                activePlayerPid = 0;
                activeInstallationStamp = null;
            }
        }
    }
}
