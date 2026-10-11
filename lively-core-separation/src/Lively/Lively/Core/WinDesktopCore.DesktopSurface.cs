using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Threading;
using Lively.Common.Helpers.Pinvoke;
using Lively.Core.Wallpapers;
using Lively.Services.DesktopSync;

namespace Lively.Core;

public partial class WinDesktopCore
{
    private DispatcherTimer desktopSurfaceTimer;
    private readonly Dictionary<WebWebView2, DesktopSurfaceWindow> desktopSurfaces = new();
    private readonly HashSet<WebWebView2> desktopSurfaceFailures = new();

    private void InitializeDesktopSurfaces()
    {
        desktopSurfaceTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(250) };
        desktopSurfaceTimer.Tick += (_, _) => RefreshDesktopSurfaces();
        desktopSurfaceTimer.Start();
    }
    private void RefreshDesktopSurfaces()
    {
        if(disposedValue || roomSessionRuntime.IsNativeIdlePresented)return;
        try
        {
            var players=Wallpapers.OfType<WebWebView2>().ToArray();
            foreach(var pair in desktopSurfaces.ToArray())
            {
                if(players.Contains(pair.Key) && !screenSaver.IsRunning && pair.Key.WantsDesktopSurface && pair.Value.IsPresented)continue;
                desktopSurfaces.Remove(pair.Key);
                if(!pair.Value.TryRestore())
                {
                    desktopSurfaceFailures.Add(pair.Key);
                    Logger.Error("DesktopDrop surface restore failed; closing owned Player");
                    pair.Key.TerminateAfterNativeFailure();
                }
                else Logger.Info($"DesktopDrop surface released | player={pair.Key.Pid}");
            }
            desktopSurfaceFailures.RemoveWhere(player=>!players.Contains(player));
            if(screenSaver.IsRunning || shellDLL_DefView==IntPtr.Zero)return;
            foreach(var player in players)
            {
                if(desktopSurfaces.ContainsKey(player) || desktopSurfaceFailures.Contains(player) ||
                    player.Pid is not int pid || !player.WantsDesktopSurface)continue;
                if(DesktopSurfaceWindow.TryRaise(player.Handle,pid,shellDLL_DefView,out var lease))
                {
                    desktopSurfaces.Add(player,lease);
                    Logger.Info($"DesktopDrop surface acquired | player={pid} | hwnd={player.Handle}");
                }
                else
                {
                    desktopSurfaceFailures.Add(player);
                    Logger.Warn($"DesktopDrop surface unavailable | player={pid}");
                    if(lease!=null)player.TerminateAfterNativeFailure();
                }
            }
        }
        catch(Exception error){Logger.Error(error,"DesktopDrop surface update failed");}
    }
    private bool IsDesktopSurfaceForeground(IntPtr foreground) => desktopSurfaces.Any(pair =>
        pair.Value.ContainsWindow(foreground));
    private void StopDesktopSurfaces()
    {
        desktopSurfaceTimer?.Stop();
        foreach(var pair in desktopSurfaces)
            if(!pair.Value.TryRestore())pair.Key.TerminateAfterNativeFailure();
        desktopSurfaces.Clear();
    }
}
