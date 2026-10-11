using System;
using System.Threading;
using Lively.Core.Wallpapers;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    private WebWebView2? InputDock()
    {
        lock (dockGate)
            return VolatileDock();
    }

    // Do not keep coordinator/process locks while native input sends IPC or
    // reads the leaf authority. The Player rechecks its current attachment.
    private WebWebView2? VolatileDock() => Volatile.Read(ref dockDisposed) == 0 &&
        dockPlayer is { Attached: true, Stopping: false } owned && !owned.Player.IsExited
        ? owned.Player : null;

    internal WebWebView2? ApplicationTaskHost() => InputDock();

    public void RouteDockMouse(int x, int y, string edge, bool blocked)
    {
        try { InputDock()?.RouteNativeDockMouse(x, y, edge, blocked); }
        catch (Exception error) { Logger.Error(error, "v3 Dock mouse route failed"); }
    }

    public void RouteDockKey(int key, bool down, bool reverse, int scanCode, bool extended, bool blocked)
    {
        try { InputDock()?.RouteNativeDockKey(key, down, reverse, scanCode, extended, blocked); }
        catch (Exception error) { Logger.Error(error, "v3 Dock keyboard route failed"); }
    }
}
