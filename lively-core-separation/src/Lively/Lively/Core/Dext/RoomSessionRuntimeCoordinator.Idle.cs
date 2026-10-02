using System;
using System.Threading;
using System.Windows;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Core.Wallpapers;

namespace Dext.Core.Rooms;

public enum RoomNativeIdleResult { NotNative, Entered, Failed }

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private sealed record NativeIdle(WebWebView2 Player, DextNativeIdleWindow Window, Guid Session, string Display);
    private NativeIdle? nativeIdle;
    public bool IsNativeIdlePresented => Volatile.Read(ref nativeIdle) is { } idle && idle.Window.IsPresented;
    public string? NativeIdleDisplayId => Volatile.Read(ref nativeIdle)?.Display;

    public RoomNativeIdleResult EnterNativeIdle()
    {
        WebWebView2 player; Guid session; string display;
        lock (gate)
        {
            if (!activeNativeRoom) return RoomNativeIdleResult.NotNative;
            if (activePlayer is not { } currentPlayer || CurrentSnapshot is not { IsActive: true } current)
                return RoomNativeIdleResult.Failed;
            if (nativeIdle is not null) return RoomNativeIdleResult.Failed;
            player = currentPlayer; session = current.SessionId; display = activeDisplayId!;
            if (!ChangeHostStage(session, RoomLifecycleStage.Idle)) return RoomNativeIdleResult.Failed;
        }
        // Window messages can synchronously involve another process; no Core
        // state or authorization lock is held across presentation/restoration.
        DextNativeIdleWindow? window = null;
        string diagnostic = "Player exited before presentation.";
        if (!player.IsExited && player.Pid is { } pid &&
            DextNativeIdleWindow.TryPresent(player.Handle, pid, player.Screen.Bounds, out window, out diagnostic))
        {
            var attached = false;
            lock (gate)
            {
                if (ReferenceEquals(activePlayer, player) && activeSessionId == session && CurrentSnapshot is { IsActive: true })
                { nativeIdle = new(player, window, session, display); attached = true; }
            }
            if (attached)
            {
                runtimeFacts.SetNativePresentation(display, window.IsPresented);
                Logger.Info($"v3 same-Player idle started | playerPid={pid} | session={session}");
                return RoomNativeIdleResult.Entered;
            }
            RestoreOrClose(player, window);
        }
        else if (window is not null) RestoreOrClose(player, window);
        runtimeFacts.SetNativePresentation(null, false, IsActualDesktopForeground());
        lock (gate) { if (ReferenceEquals(activePlayer, player) && activeSessionId == session) ChangeHostStage(session, RoomLifecycleStage.Desktop); }
        Logger.Warn($"v3 native idle could not present the current Player: {diagnostic}");
        return RoomNativeIdleResult.Failed;
    }

    public void ExitNativeIdle()
    {
        NativeIdle? idle;
        lock (gate) { idle = nativeIdle; nativeIdle = null; }
        if (idle is null) return;
        RestoreOrClose(idle.Player, idle.Window);
        // Remove the visible-idle override and sample real desktop foreground
        // before any queued Desk can resume in the desktop stage.
        runtimeFacts.SetNativePresentation(null, false, IsActualDesktopForeground());
        lock (gate)
        {
            if (ReferenceEquals(activePlayer, idle.Player) && activeSessionId == idle.Session)
                ChangeHostStage(idle.Session, RoomLifecycleStage.Desktop);
        }
        Logger.Info($"v3 same-Player idle stopped | playerPid={idle.Player.Pid} | session={idle.Session}");
    }

    // Must be called under gate. No window APIs in this method.
    private bool ChangeHostStage(Guid session, RoomLifecycleStage stage)
    {
        var current = kernel.Snapshot;
        if (current is not { IsActive: true } || current.SessionId != session) return false;
        var peer = new RoomSessionPeer("core-runtime");
        var opened = gateway.Open(peer, new(1, RoomClientRole.Coordinator, current.RoomId));
        if (opened.ConnectionId is not { } connection) return false;
        try
        {
            var result = gateway.SetHostStage(connection, peer, session, stage);
            if (result.Status == RoomProtocolStatus.Accepted) return true;
            Logger.Warn($"v3 host stage rejected: {result.Status}"); return false;
        }
        finally { gateway.Close(connection, peer); }
    }
    private static bool IsActualDesktopForeground()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        return hwnd != IntPtr.Zero && (hwnd == NativeMethods.GetDesktopWindow() || hwnd == NativeMethods.GetShellWindow() || WindowUtil.IsExcludedDesktopWindowClass(hwnd));
    }
    private static void RestoreOrClose(WebWebView2 player, DextNativeIdleWindow window)
    {
        if (window.TryRestore()) return;
        Logger.Error("v3 idle desktop restoration failed; hidden owned Player will close");
        player.Terminate();
    }
    private void QueueIdleRestoreIfChanged(int pid)
    {
        var idle = Volatile.Read(ref nativeIdle);
        if (idle is null || idle.Player.Pid == pid) return;
        Application.Current.Dispatcher.BeginInvoke(new Action(() =>
        { if (ReferenceEquals(Volatile.Read(ref nativeIdle), idle)) ExitNativeIdle(); }));
    }
    private void ClearExitedNativeIdle(int pid)
    {
        var idle = Volatile.Read(ref nativeIdle);
        if (idle?.Player.Pid != pid || Interlocked.CompareExchange(ref nativeIdle, null, idle) != idle) return;
        runtimeFacts.SetNativePresentation(null, false, IsActualDesktopForeground());
    }
}
