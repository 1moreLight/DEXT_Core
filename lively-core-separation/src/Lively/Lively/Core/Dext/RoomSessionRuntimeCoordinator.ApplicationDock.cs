using System;
using System.Collections.Generic;
using System.Threading;
using Lively.Core.Wallpapers;
using Lively.Models.Message;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private string systemDockOwner = "none";
    private sealed record ApplicationThemeRequest(string ContextKey,long Attempt,string Mode);
    private ApplicationThemeRequest? applicationThemeRequest;
    private long failedApplicationThemeAttempt;
    private void RecordApplicationThemeFailure(long attempt)
    {
        if(attempt<=0)return;
        // Attempts are monotonic for this Core lifetime. A late old Player exit
        // must not overwrite a newer failure before the service observes it.
        var seen=Interlocked.Read(ref failedApplicationThemeAttempt);
        while(attempt>seen)
        {
            var actual=Interlocked.CompareExchange(ref failedApplicationThemeAttempt,attempt,seen);
            if(actual==seen)return;
            seen=actual;
        }
    }
    internal void PublishSystemDock(string owner)
    {
        if (owner is not ("native" or "theme" or "none")) throw new ArgumentException("Unknown system dock.");
        WebWebView2 player;
        lock (gate)
        {
            systemDockOwner = owner;
            player = activePlayer;
        }
        // Desktop wallpaper only. The theme dock player is a separate host.
        player?.SendMessage(new LivelyMessageRoomSystemDock { Owner = owner });
    }
    internal void ConfigureApplicationTheme(string? contextKey,long attempt,string? mode)
    {
        if(mode is not (null or "overlay" or "autohide" or "reserve"))throw new ArgumentException("Unsupported fusion mode.");
        var next=mode is null?null:new ApplicationThemeRequest(contextKey??throw new ArgumentNullException(nameof(contextKey)),attempt,mode);
        if(Volatile.Read(ref applicationThemeRequest)==next)return;
        Volatile.Write(ref applicationThemeRequest,next);
        lock(dockGate){dockRetryAfter=default;}
        QueueDockUpdate();
    }

    internal sealed record ThemeTaskCandidate(string? ContextKey,string? UnavailableReason,
        string Phase,bool Attached,bool Ready,string TaskAreaStatus,long FailedAttempt,bool Blocked,long HostAttempt);

    internal ThemeTaskCandidate ReadThemeTaskCandidate()
    {
        // ReadDockDemand releases the session lock before taking dockGate, matching
        // reconciliation lock order. Eligibility does not depend on current owner.
        var demand=ReadDockDemand();
        var context=demand.Installation?.RuntimeContext;
        var reason=context is null ? "noNativeRoom" :
            Lively.Services.ApplicationDock.DockThemeEligibility.Reason(context.Manifest,demand.Snapshot?.CurrentDeskId);
        if(demand.Desktop?.IsExited!=false)reason="noNativeRoom";
        var key=demand.Snapshot is {} snapshot ? $"{snapshot.SessionId}/{snapshot.InstallationStamp}" : null;
        lock(dockGate)
        {
            var host=dockPlayer;
            var attached=host is {Attached:true,Stopping:false}&&!host.Player.IsExited;
            var current=attached&&ReferenceEquals(host!.Demand.Desktop,demand.Desktop)&&
                host.Demand.Snapshot?.SessionId==demand.Snapshot?.SessionId&&
                host.Demand.Installation?.InstallationStamp==demand.Installation?.InstallationStamp;
            var state=current?host!.Player.RoomDockWindowState:null;
            return new(key,reason,dockPhase,attached,state is {RendererReady:true,WindowReady:true},state?.TaskAreaStatus??"pending",Interlocked.Read(ref failedApplicationThemeAttempt),
                demand.Snapshot?.Lifecycle.Locked==true||state?.Fullscreen==true,host?.Demand.FusionAttempt??0);
        }
    }

    internal RoomDockNavigation? ReadApplicationDockNavigation()
    {
        lock (gate)
        {
            var snapshot = CurrentSnapshot;
            if (!activeNativeRoom || snapshot is null || activePlayer?.IsExited != false) return null;
            var installation = authority.Admit(new RoomSessionPeer("core-runtime"),
                new(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, snapshot.RoomId))?.Installation;
            return installation?.RuntimeContext is { } context && installation.InstallationStamp == snapshot.InstallationStamp
                ? RoomDockNavigation.Create(snapshot, context.Manifest) : null;
        }
    }

    internal PersonalTarget[]? ReadApplicationDockPins(RoomDockNavigation context) =>
        actions.ReadApplicationDockPins(context.RoomId, context.CurrentDeskId);

    internal void SetApplicationDockPins(Guid sessionId, string roomId, string deskId, PersonalTarget[]? pins)
    {
        if (ReadApplicationDockNavigation()?.MatchesPinEdit(sessionId, roomId, deskId) != true)
            throw new InvalidOperationException("当前 Room/Desk 已改变，请重新选择固定应用。");
        // Persist to the explicit checked identity. A later page change never redirects this write.
        actions.SetApplicationDockPins(roomId, deskId, pins);
    }
    internal bool NeedsDockPinMigration(string roomId) => actions.NeedsDockPinMigration(roomId);
    internal void MigrateDockPinsToAppend(string roomId, IReadOnlyCollection<string> globalTargets) =>
        actions.MigrateDockPinsToAppend(roomId, globalTargets);

    // Only the official Core WPF button calls this. No RPC or author SDK entry.
    internal bool NavigateApplicationDock(Guid expectedSession, int direction)
    {
        lock (gate)
        {
            if (dockOwnership.Owner != DockHost.Application) return false;
            var navigation = ReadApplicationDockNavigation();
            if (navigation?.SessionId != expectedSession || navigation.Target(direction) is not { } target) return false;
            return kernel.RequestFromDock(expectedSession, target).Status is RoomCommandStatus.Accepted or RoomCommandStatus.Queued;
        }
    }
}
