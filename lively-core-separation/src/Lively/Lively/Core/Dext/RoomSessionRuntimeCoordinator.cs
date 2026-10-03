using System;
using Lively.Core.Wallpapers;

namespace Dext.Core.Rooms;

public interface IRoomSessionRuntimeCoordinator
{
    RoomSessionSnapshot? CurrentSnapshot { get; }
    int ActivePlayerPid { get; }
    void OnPageReady(WebWebView2 player);
    bool OnPlayerExited(int? pid);
    RoomNativeIdleResult EnterNativeIdle();
    void ExitNativeIdle();
    bool IsNativeIdlePresented { get; }
    string? NativeIdleDisplayId { get; }
}

internal sealed partial class RoomSessionRuntimeCoordinator : IRoomSessionRuntimeCoordinator, IDisposable
{
    private static readonly NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();
    private readonly object gate = new();
    private readonly InstalledRoomSessionAuthority authority;
    private readonly RoomSessionProtocolGateway gateway;
    private readonly RoomSessionKernel kernel;
    private readonly RoomRuntimeFactsSource runtimeFacts;
    private readonly RoomActionAuthority actions;
    private WebWebView2? activePlayer;
    private bool activeNativeRoom;
    private string? activeDisplayId;
    private int activePlayerPid;
    private Guid activeSessionId;
    private string? activeInstallationStamp;

    public RoomSessionRuntimeCoordinator(InstalledRoomSessionAuthority authority,
        RoomSessionProtocolGateway gateway, RoomSessionKernel kernel, RoomRuntimeFactsSource runtimeFacts, RoomActionAuthority actions)
    {
        this.authority = authority;
        this.gateway = gateway;
        this.kernel = kernel;
        this.runtimeFacts = runtimeFacts;
        this.actions = actions;
        runtimeFacts.Sampled += OnRuntimeFactsSampled;
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
        QueueIdleRestoreIfChanged(pid);
        lock (gate)
        {
            if (activePlayerPid == pid)
            {
                if (player.RoomDocumentInvalidated && kernel.Snapshot is { IsActive: true } current)
                {
                    var peer = new RoomSessionPeer("core-runtime");
                    var document = gateway.Open(peer, new(1, RoomClientRole.Coordinator, current.RoomId));
                    if (document.ConnectionId is not { } connection) return;
                    try
                    {
                        var begun = gateway.BeginDocument(connection, peer, current.SessionId);
                        if (begun.Status != RoomProtocolStatus.Accepted)
                        { Logger.Warn($"v3 document restart rejected: {begun.Status}"); return; }
                    }
                    finally { gateway.Close(connection, peer); }
                }
                if (player.RefreshRoomSession() == RoomProtocolStatus.Accepted) return;
            }
            player.DetachRoomSession();
            if (activePlayerPid != 0) { gateway.Retire(activeSessionId); authority.Unbind(activePlayerPid); }
            activePlayerPid = 0;
            activePlayer = null;
            activeNativeRoom = false;
            activeDisplayId = null;
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
                // No Dispatcher calls under gate: page-ready runs on process stdout.
                var facts = runtimeFacts.Read(player.Screen.DeviceId);
                var session = gateway.Restore(connectionId, coordinator, facts);
                if (session.Status == RoomProtocolStatus.Rejected)
                    session = gateway.Start(connectionId, coordinator, facts);
                if (session.Status != RoomProtocolStatus.Accepted || session.Snapshot is null)
                {
                    authority.Unbind(pid);
                    Logger.Warn($"v3 Room session start/restore rejected: {session.Status}");
                    return;
                }
                var attached = player.AttachRoomSession(gateway, installation.RoomId,
                    installation.DeskIds, actions);
                if (attached != RoomProtocolStatus.Accepted)
                {
                    gateway.Stop(connectionId, coordinator, session.Snapshot.SessionId);
                    authority.Unbind(pid);
                    Logger.Warn($"v3 Player attach rejected: {attached}");
                    return;
                }
                activePlayerPid = pid;
                activePlayer = player;
                activeNativeRoom = installation.RuntimeContext is not null;
                activeDisplayId = player.Screen.DeviceId;
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

    private void OnRuntimeFactsSampled()
    {
        try
        {
            lock (gate)
            {
                var current = kernel.Snapshot;
                if (activePlayerPid == 0 || activeDisplayId is null || current is not { IsActive: true } ||
                    current.SessionId != activeSessionId) return;
                var facts = runtimeFacts.Read(activeDisplayId);
                if (current.Lifecycle.PlaybackPaused == facts.PlaybackPaused && current.Lifecycle.Locked == facts.Locked &&
                    current.IsDesktopForeground == facts.DesktopForeground) return;
                var peer = new RoomSessionPeer("core-runtime");
                var opened = gateway.Open(peer, new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
                    RoomClientRole.Coordinator, current.RoomId));
                if (opened.ConnectionId is not { } connection) return;
                try
                {
                    var result = gateway.SetRuntimeFacts(connection, peer, activeSessionId, facts);
                    if (result.Status != RoomProtocolStatus.Accepted)
                        Logger.Warn($"v3 Windows facts rejected: {result.Status}");
                }
                finally { gateway.Close(connection, peer); }
            }
        }
        catch (Exception error) { Logger.Error(error, "v3 Windows facts update failed; next sample will retry"); }
    }

    public void Dispose()
    {
        runtimeFacts.Sampled -= OnRuntimeFactsSampled;
        ExitNativeIdle();
    }

    public bool OnPlayerExited(int? pid)
    {
        if (pid is not { } exitedPid) return false;
        var wasNative = false;
        lock (gate)
        {
            if (activePlayerPid == exitedPid)
            {
                wasNative = activeNativeRoom;
                gateway.Retire(activeSessionId);
                activePlayerPid = 0;
                activePlayer = null;
                activeNativeRoom = false;
                activeDisplayId = null;
                activeInstallationStamp = null;
            }
            authority.Unbind(exitedPid);
        }
        ClearExitedNativeIdle(exitedPid);
        return wasNative;
    }
}
