using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Lively.Core.Wallpapers;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private readonly object dockGate = new();
    private readonly CancellationTokenSource dockLifetime = new();
    private DockPlayer? dockPlayer;
    private int dockRequested, dockWorker, dockDisposed, dockFailures;
    private DateTimeOffset dockRetryAfter;
    private string dockPhase = "disabled";
    private string? dockReason;

    private sealed record DockDemand(RoomDockPreferenceResult Settings, WebWebView2? Desktop,
        RoomSessionSnapshot? Snapshot, VerifiedRoomInstallation? Installation, string? DeskId,
        bool HasDock, string Phase, long FusionAttempt = 0)
    {
        public bool ShouldRun => Phase == "hostPending";
        public bool Matches(DockDemand other) => ShouldRun && other.ShouldRun && FusionAttempt == other.FusionAttempt &&
            ReferenceEquals(Desktop, other.Desktop) && Snapshot?.SessionId == other.Snapshot?.SessionId &&
            Installation?.InstallationStamp == other.Installation?.InstallationStamp &&
            Settings.Preferences?.HeightDip == other.Settings.Preferences?.HeightDip &&
            Settings.Preferences?.Mode == other.Settings.Preferences?.Mode;
    }

    private sealed class DockPlayer(WebWebView2 player, DockDemand demand)
    {
        public WebWebView2 Player { get; } = player;
        public DockDemand Demand { get; } = demand;
        public TaskCompletionSource PageReady { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Exited { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public volatile bool Stopping;
        public volatile bool Attached;


        public long HeartbeatStaleSince;
        public volatile bool TasksPresented;
    }

    private DockDemand ReadDockDemand(RoomDockPreferenceResult? settings = null)
    {
        settings ??= dockPreferences.Read();
        var fusion=Volatile.Read(ref applicationThemeRequest);
        if(fusion is not null&&settings.Preferences is {} original)
            settings=settings with {Preferences=original with {Enabled=true,Mode=fusion.Mode}};
        lock (gate)
        {
            var snapshot = CurrentSnapshot;
            var installation = snapshot is null ? null : authority.Admit(new RoomSessionPeer("core-runtime"),
                new(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, snapshot.RoomId))?.Installation;
            var context = installation?.RuntimeContext;
            var deskId = snapshot?.TargetDeskId ?? snapshot?.CurrentDeskId;
            var hasDock = false;
            if (context is not null && deskId is not null &&
                context.Manifest.TryGetProperty("dockComponentId", out var nativeDock) &&
                context.Manifest.TryGetProperty("components", out var components))
            {
                var desk = context.Manifest.GetProperty("desks").EnumerateArray()
                    .FirstOrDefault(item => item.GetProperty("id").GetString() == deskId);
                if (desk.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    var referenced = desk.GetProperty("components").EnumerateArray()
                        .Select(item => item.GetString()).ToHashSet();
                    hasDock = components.EnumerateArray().Any(item =>
                        item.GetProperty("id").GetString() == nativeDock.GetString() &&
                        item.GetProperty("role").GetString() == "dock" &&
                        referenced.Contains(item.GetProperty("id").GetString()));
                }
            }
            var phase = fusion is not null && fusion.ContextKey!=$"{snapshot?.SessionId}/{snapshot?.InstallationStamp}" ? "fusionContextChanged" : settings.Preferences is null ? "settingsUnavailable" :
                !settings.Preferences.Enabled ? "disabled" :
                dockOwnership.ApplicationRequested ? "applicationSelected" :
                context is null ? "noNativeRoom" : !hasDock ? "noDock" :
                "hostPending";
            return new(settings, activePlayer, snapshot, installation, deskId, hasDock, phase,fusion?.Attempt??0);
        }
    }

    public RoomDockStatusReply GetRoomDockStatus()
    {
        QueueDockUpdate();
        return DockReply(dockPreferences.Read());
    }

    public RoomDockStatusReply SetRoomDockPreference(string patchJson)
    {
        var result = dockPreferences.Patch(patchJson);
        if (result.Status == "accepted") QueueDockUpdate();
        return DockReply(result);
    }

    private RoomDockStatusReply DockReply(RoomDockPreferenceResult result)
    {
        var demand = ReadDockDemand(result);
        lock (dockGate)
        {
            var player = dockPlayer;
            var current = player is not null && demand.Matches(player.Demand);
            var window = current ? player?.Player.RoomDockWindowState : null;
            var ready = window is { RendererReady: true, WindowReady: true };
            var viewport = ready ? player?.Player.ReadNativeViewport() : null;
            ready = ready && viewport != null && window!.Mode == demand.Settings.Preferences?.Mode;
            var appBarOccupied = current && player?.Player.NativeDockReservationReady == true;
            var reserve = demand.Settings.Preferences?.Mode == "reserve";
            var modeReady = ready && (!reserve || appBarOccupied);
            int? effectiveHeight = viewport is null ? null : Math.Max(1, (int)Math.Round(viewport.Height * 96.0 / viewport.Dpi));
            int? displayDpi = viewport?.Dpi;
            var heightConstrained = effectiveHeight is { } actualHeight &&
                result.Preferences is { } preferences && actualHeight < preferences.HeightDip;
            var taskbarReady = current && modeReady && taskbar.Hidden;
            var phase = current ? (window is { RendererReady: true } ?
                !ready ? "awaitingInput" : demand.Snapshot!.Lifecycle.Locked ? "locked" :
                window!.Fullscreen ? "fullscreen" : reserve && !appBarOccupied ? "awaitingWorkArea" :
                window.Visible ? "running" : "hidden" : dockPhase) : demand.Phase;
            if (player is not null && !current) phase = "stopping";
            else if (demand.ShouldRun && player is null && dockPhase == "faulted") phase = "faulted";
            var reason = phase == "applicationSelected" ? "系统应用 Dock 已启用，主题独立 Dock 暂停；关闭应用 Dock 后按原设置恢复。" :
                phase == "awaitingWorkArea" ? "正在等待 Windows 确认 Dock 占位工作区。" :
                phase == "hostPending" ? "Dock 宿主正在等待启动。" :
                phase == "stopping" ? "正在关闭上一份 Dock。" :
                phase == "awaitingInput" ? "Dock 输入与窗口状态正在同步。" :
                current && ready && !taskbarReady && !demand.Snapshot!.Lifecycle.Locked
                    ? taskbar.Error ?? (taskbar.Mode == "visible" ? "已手动恢复 Windows 任务栏，自动隐藏已暂停。" : "Dock 已就绪，正在等待 Windows 任务栏替代看护。")
                    : current || phase == "faulted" ? dockReason : null;
            // A connected process is not proof of an initialized visible window.
            return new(result.Status, result.Preferences,
                new(phase, player?.Player.IsExited == false ? player.Player.Pid ?? 0 : 0,
                    demand.Snapshot?.RoomId, demand.DeskId, demand.HasDock, modeReady && demand.Settings.Preferences?.Mode == "autohide", modeReady && reserve, taskbarReady, reason, effectiveHeight, displayDpi, heightConstrained, appBarOccupied, modeReady && demand.Settings.Preferences?.Mode == "overlay"), result.Message);
        }
    }

    // Snapshot callbacks may run while the gateway holds its lock. Only enqueue;
    // installation reads, process launch and waits run outside that callback.
    private readonly RoomPerformanceTrace performanceTrace = new();
    private void OnDockSourceSnapshot(RoomSessionSnapshot snapshot)
    {
        performanceTrace.Observe(snapshot);
        QueueDockUpdate();
    }

    private void QueueDockUpdate()
    {
        if (Volatile.Read(ref dockDisposed) != 0) return;
        Interlocked.Increment(ref dockRequested);
        StartDockWorker();
    }

    private void StartDockWorker()
    {
        if (Interlocked.CompareExchange(ref dockWorker, 1, 0) == 0)
            _ = Task.Run(DockWorkerAsync);
    }

    private async Task DockWorkerAsync()
    {
        var observed = -1;
        try
        {
            do
            {
                observed = Volatile.Read(ref dockRequested);
                if (Volatile.Read(ref dockDisposed) != 0) break;
                var fusionAttempt=Volatile.Read(ref applicationThemeRequest)?.Attempt??0;
                try { await ReconcileDockAsync(); }
                catch (OperationCanceledException) when (dockLifetime.IsCancellationRequested) { break; }
                catch (Exception error)
                {
                    Logger.Error(error, "v3 Dock host update failed");
                    RecordApplicationThemeFailure(fusionAttempt);
                    lock (dockGate)
                    {
                        dockPhase = "faulted";
                        dockReason = "Dock 宿主未能就绪，稍后重试。";
                        dockRetryAfter = DateTimeOffset.UtcNow.AddSeconds(Math.Min(30, 5 * ++dockFailures));
                    }
                    _ = RetryDockLaterAsync();
                }
            } while (observed != Volatile.Read(ref dockRequested));
        }
        finally
        {
            if (Volatile.Read(ref dockDisposed) != 0)
            {
                try { await StopDockAsync(); }
                catch (Exception error) { Logger.Error(error, "v3 Dock shutdown failed"); }
            }
            Interlocked.Exchange(ref dockWorker, 0);
            if (Volatile.Read(ref dockDisposed) == 0 && observed != Volatile.Read(ref dockRequested))
                StartDockWorker();
        }
    }

    private async Task ReconcileDockAsync()
    {
        var demand = ReadDockDemand();
        DockPlayer? owned;
        lock (dockGate) owned = dockPlayer;
        if (owned is not null && (!demand.Matches(owned.Demand) || owned.Player.IsExited))
        {
            await StopDockAsync();
            owned = null;
        }
        if (!demand.ShouldRun)
        {
            lock (dockGate) { dockPhase = demand.Phase; dockReason = null; dockFailures = 0; dockRetryAfter = default; }
            return;
        }
        if (owned is not null)
        {
            if (owned.Attached && owned.Player.RoomDocumentInvalidated)
            {
                if (owned.Player.RefreshRoomSession() != RoomProtocolStatus.Accepted)
                    throw new InvalidOperationException("Dock document replay rejected");
            }
            if (owned.Attached) owned.Player.ConnectNativeDockInput();
            await EnsureDockTaskbarAsync(owned, demand);
            return;
        }
        lock (dockGate)
            if (DateTimeOffset.UtcNow < dockRetryAfter) return;
        if (Volatile.Read(ref dockDisposed) != 0) return;

        if (!dockOwnership.TryAcquire(DockHost.Theme)) return;
        WebWebView2 player;
        try { player = demand.Desktop!.CreateDockPlayer(demand.Settings.Preferences!.HeightDip, demand.Settings.Preferences.Mode); }
        catch { dockOwnership.Release(DockHost.Theme); throw; }
        owned = new DockPlayer(player, demand);
        player.RoomDockStateChanged += QueueDockUpdate;
        player.RoomPageReady += (_, _) => { owned.PageReady.TrySetResult(); QueueDockUpdate(); };
        player.Exited += (_, _) =>
        {
            owned.Exited.TrySetResult();
            if (!owned.Stopping)
            {
                RecordApplicationThemeFailure(owned.Demand.FusionAttempt);
                authority.UnbindDock(player.Pid ?? 0);
                lock (dockGate)
                {
                    dockPhase = "faulted"; dockReason = "Dock Player 已退出，正在等待重建。";
                    dockRetryAfter = DateTimeOffset.UtcNow.AddSeconds(Math.Min(30, 5 * ++dockFailures));
                }
                _ = RetryDockLaterAsync();
            }
            QueueDockUpdate();
        };
        lock (dockGate) { dockPlayer = owned; dockPhase = "starting"; dockReason = null; }
        try
        {
            await player.ShowAsync().WaitAsync(TimeSpan.FromSeconds(15), dockLifetime.Token);
            await owned.PageReady.Task.WaitAsync(TimeSpan.FromSeconds(15), dockLifetime.Token);
            if (Volatile.Read(ref dockDisposed) != 0 || !demand.Matches(ReadDockDemand()))
            { await StopDockAsync(); return; }
            var installation = demand.Installation!;
            if (player.Pid is not { } pid || player.IsExited ||
                !authority.BindDock(demand.Desktop!.Pid ?? 0, pid, installation.InstallationStamp))
                throw new InvalidOperationException("Dock process admission rejected");
            var attached = player.AttachRoomSession(gateway, installation.RoomId, installation.DeskIds, actions, RoomClientRole.Dock);
            if (attached != RoomProtocolStatus.Accepted)
                throw new InvalidOperationException("Dock session attach rejected: " + attached);
            owned.Attached = true;
            // WinDesktopCore routes its existing raw OS input to this owned
            // Player. Natural WebView edges are gated before controlled replay.
            player.ConnectNativeDockInput();
            lock (dockGate)
            {
                dockPhase = "awaitingRenderer"; dockReason = "已连接共享会话，正式 Dock 视图和输入正在初始化。";
                dockFailures = 0; dockRetryAfter = default;
            }
            Logger.Info($"v3 Dock session attached | playerPid={pid} | desktopPid={demand.Desktop.Pid} | room={installation.RoomId} | session={demand.Snapshot!.SessionId}");
        }
        catch { await StopDockAsync(); throw; }
    }

    private async Task StopDockAsync()
    {
        DockPlayer? owned;
        lock (dockGate)
        {
            owned = dockPlayer;
            if (owned is null) return;
            owned.Stopping = true;
            dockPhase = "stopping"; dockReason = null;
        }
        var taskbarReleased = await StopDockTaskbarAsync(owned);
        var player = owned.Player;
        player.DisconnectNativeDockInput();
        authority.UnbindDock(player.Pid ?? 0);
        player.RoomDockStateChanged -= QueueDockUpdate;
        player.DetachRoomSession();
        if (player.Pid is not null && !player.IsExited)
        {
            player.Close();
            if (await Task.WhenAny(owned.Exited.Task, Task.Delay(3000)) != owned.Exited.Task)
                player.Terminate();
            if (await Task.WhenAny(owned.Exited.Task, Task.Delay(2000)) != owned.Exited.Task && !player.IsExited)
                throw new InvalidOperationException("Previous Dock process is still alive; replacement withheld");
        }
        if (!taskbarReleased) throw new InvalidOperationException(taskbar.Error ?? "Previous Dock taskbar recovery is not confirmed; replacement withheld");
        lock (dockGate) { if (ReferenceEquals(dockPlayer, owned)) dockPlayer = null; }
        dockOwnership.Release(DockHost.Theme);
    }

    private async Task RetryDockLaterAsync()
    {
        try
        {
            TimeSpan delay;
            lock (dockGate) delay = dockRetryAfter - DateTimeOffset.UtcNow;
            if (delay > TimeSpan.Zero) await Task.Delay(delay, dockLifetime.Token);
            QueueDockUpdate();
        }
        catch (OperationCanceledException) when (dockLifetime.IsCancellationRequested) { }
    }

    private void DisposeDock()
    {
        if (Interlocked.Exchange(ref dockDisposed, 1) != 0) return;
        dockOwnership.Changed -= QueueDockUpdate;
        dockOwnership.Shutdown();
        dockLifetime.Cancel();
        dockMaintenance?.Dispose();
        DockPlayer? owned;
        lock (dockGate) owned = dockPlayer;
        if (owned is not null)
        {
            owned.Stopping = true;
            _ = StopDockTaskbarAsync(owned);
            authority.UnbindDock(owned.Player.Pid ?? 0);
            owned.Player.DisconnectNativeDockInput();
            owned.Player.DetachRoomSession();
            owned.Player.Close();
            // Also covers disposal arriving after an idle worker has made its
            // final cleanup decision. Never target a different/new process.
            _ = Task.Run(async () =>
            {
                await Task.Delay(3000);
                if (owned.Player.Pid is not null && !owned.Player.IsExited) owned.Player.Terminate();
            });
        }
        StartDockWorker();
    }
}
