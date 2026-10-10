using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private Timer? dockMaintenance;
    private void InitializeDockTaskbarMaintenance()
    {
        dockMaintenance = new Timer(_ =>
        {
            var owned = Volatile.Read(ref dockPlayer);
            if (owned is null) return;
            if (!owned.Stopping && Volatile.Read(ref dockDisposed) == 0 && owned.Player.RoomDockHeartbeatExpired)
            {
                taskbar.RequestAutomatic(owned.Player.Pid ?? 0, false);
                var now = Stopwatch.GetTimestamp();
                if (owned.HeartbeatStaleSince == 0) owned.HeartbeatStaleSince = now;
                if ((now - owned.HeartbeatStaleSince) / (double)Stopwatch.Frequency >= 5)
                    owned.Player.Terminate();
                QueueDockUpdate();
                return;
            }
            owned.HeartbeatStaleSince = 0;
            var snapshot = kernel.Snapshot;
            taskbar.RequestAutomatic(owned.Player.Pid ?? 0,
                !owned.Stopping && owned.Attached && Volatile.Read(ref dockDisposed) == 0 &&
                owned.Demand.Desktop?.Pid == Volatile.Read(ref activePlayerPid) &&
                owned.Demand.Desktop?.IsExited == false && snapshot is { IsActive: true } &&
                snapshot.SessionId == owned.Demand.Snapshot?.SessionId && !snapshot.Lifecycle.Locked &&
                snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop &&
                owned.Player.RoomDockWindowState is { RendererReady: true, WindowReady: true, Locked: false } &&
                owned.Player.ReadNativeViewport() is not null &&
                (owned.Player.NativeDockMode != "reserve" || owned.Player.NativeDockReservationReady));
        }, null, 1000, 1000);
    }
    private async Task EnsureDockTaskbarAsync(DockPlayer owned, DockDemand demand)
    {
        var wanted = !owned.Stopping && Volatile.Read(ref dockDisposed) == 0 && demand.Matches(owned.Demand) &&
            owned.Attached && owned.Player.RoomDockWindowState is { RendererReady: true, WindowReady: true, Locked: false } &&
            owned.Player.ReadNativeViewport() is not null &&
            (owned.Player.NativeDockMode != "reserve" || owned.Player.NativeDockReservationReady) &&
            demand.Snapshot is { IsActive: true } && !demand.Snapshot.Lifecycle.Locked &&
            demand.Snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop;
        taskbar.RequestAutomatic(owned.Player.Pid ?? 0, wanted);
        await taskbar.TickAsync();
    }
    private Task<bool> StopDockTaskbarAsync(DockPlayer owned) =>
        taskbar.ReleaseAutomaticAsync(owned.Player.Pid ?? 0);
}
