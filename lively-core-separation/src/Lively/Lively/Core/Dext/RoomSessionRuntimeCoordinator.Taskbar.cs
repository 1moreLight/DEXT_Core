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
        _ = Task.Run(RoomDockTaskbarGuard.RecoverPrevious);
        dockMaintenance = new Timer(_ =>
        {
            var owned = Volatile.Read(ref dockPlayer);
            if (owned is null) return;
            var guard = owned.Guard;
            if (!owned.Stopping && Volatile.Read(ref dockDisposed) == 0 && owned.Player.RoomDockHeartbeatExpired)
            {
                guard?.SetWanted(false);
                var now = Stopwatch.GetTimestamp();
                if (owned.HeartbeatStaleSince == 0) owned.HeartbeatStaleSince = now;
                // A resume can deliver Core's timer before the Player's first
                // timer. Restore the taskbar immediately, but allow five seconds
                // for a healthy document to resume before closing that Player.
                if ((now - owned.HeartbeatStaleSince) / (double)Stopwatch.Frequency >= 5)
                    owned.Player.Terminate();
                QueueDockUpdate();
                return;
            }
            owned.HeartbeatStaleSince = 0;
            if (guard?.IsAlive != true) { QueueDockUpdate(); return; }
            // Healthy heartbeat maintenance needs no repeated installation/file
            // admission. Snapshot and real Player liveness are sufficient to
            // relinquish a lease; acquiring one still uses ReadDockDemand.
            var snapshot = kernel.Snapshot;
            guard.SetWanted(!owned.Stopping && owned.Attached && Volatile.Read(ref dockDisposed) == 0 &&
                owned.Demand.Desktop?.Pid == Volatile.Read(ref activePlayerPid) &&
                owned.Demand.Desktop?.IsExited == false &&
                snapshot is { IsActive: true } && snapshot.SessionId == owned.Demand.Snapshot?.SessionId &&
                !snapshot.Lifecycle.Locked && snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop &&
                owned.Player.RoomDockWindowState is { RendererReady: true, WindowReady: true, Locked: false });
        }, null, 1000, 1000);
    }

    private async Task EnsureDockTaskbarAsync(DockPlayer owned, DockDemand demand)
    {
        var window = owned.Player.RoomDockWindowState;
        var wanted = !owned.Stopping && Volatile.Read(ref dockDisposed) == 0 && demand.Matches(owned.Demand) &&
            owned.Attached && window is { RendererReady: true, WindowReady: true, Locked: false } &&
            demand.Snapshot is { IsActive: true } && !demand.Snapshot.Lifecycle.Locked &&
            demand.Snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop;
        var guard = owned.Guard;
        if (guard is not null && !guard.IsAlive)
        {
            // Lose the whole owned Dock on helper failure; do not keep a second
            // top window over the restored Windows taskbar during retry.
            await StopDockAsync();
            throw new InvalidOperationException("Dock taskbar helper exited; owned Dock closed before retry");
        }
        if (guard is null && wanted && DateTimeOffset.UtcNow >= owned.GuardRetryAfter && owned.Player.Pid is { } pid)
        {
            try
            {
                guard = await RoomDockTaskbarGuard.StartAsync(pid, QueueDockUpdate, dockLifetime.Token);
                owned.Guard = guard;
            }
            catch (OperationCanceledException) when (dockLifetime.IsCancellationRequested) { return; }
            catch (Exception error)
            {
                Logger.Error(error, "v3 Dock taskbar helper could not start; original taskbar retained");
                owned.GuardRetryAfter = DateTimeOffset.UtcNow.AddSeconds(5);
            }
        }
        guard?.SetWanted(wanted);
    }

    private async Task StopDockTaskbarAsync(DockPlayer owned)
    {
        var guard = owned.Guard;
        if (guard is null) return;
        guard.SetWanted(false);
        await guard.StopAsync();
        if (ReferenceEquals(owned.Guard, guard)) owned.Guard = null;
    }
}