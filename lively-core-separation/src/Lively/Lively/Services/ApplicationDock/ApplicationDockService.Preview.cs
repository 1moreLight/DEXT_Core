using System;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Threading;
using Lively.Core.Wallpapers;

namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockService
{
    private DockPreviewWindow themePreview;
    private DispatcherTimer themePreviewTimer;
    private WebWebView2 themePreviewHost;
    private DockTaskCompletion themePreviewCompletion;
    private string themePreviewContext;
    private double themePreviewFraction;
    private DateTime themePreviewLastInside;

    private bool CurrentThemePreview(out DockGroup group)
    {
        group = null;
        var host = themePreviewHost;
        var completion = themePreviewCompletion;
        if (disposed || host == null || completion == null ||
            !ReferenceEquals(host, taskHost) || !ReferenceEquals(host, rooms.ApplicationTaskHost()) ||
            !host.NativeDockPreviewIsCurrent(completion) || !taskbar.DockActionsReady(host.Pid ?? 0)) return false;
        var navigation = rooms.ReadApplicationDockNavigation();
        EffectivePins(navigation);
        return themePreviewContext == $"{host.NativeDockTaskEpoch}/{PinScope(navigation)}/{pinRevision}" &&
            taskDisplay.TryResolve(completion.ContextId, completion.ItemId, null, out group, out _) && group.Windows.Count > 0;
    }

    private void OpenThemePreview(WebWebView2 source, DockTaskCompletion completion)
    {
        CloseThemePreview();
        var viewport = source.ReadNativeViewport();
        if (viewport == null || viewport.Width <= 0) return;
        themePreviewHost = source;
        themePreviewCompletion = completion;
        themePreviewContext = taskDisplayContext;
        themePreviewFraction = completion.Gesture.ReleaseX is int x ?
            Math.Clamp((x - viewport.X) / (double)viewport.Width, 0, 1) : .5;
        themePreviewLastInside = DateTime.UtcNow;
        try
        {
            if (!CurrentThemePreview(out var current)) { CloseThemePreview(); return; }
            themePreview = new DockPreviewWindow((_, selected) =>
            {
                // WPF's own click supplies this gesture. Resolve the current group
                // again; an old card must not activate a recycled or moved window.
                var valid = CurrentThemePreview(out var fresh);
                var task = valid ? fresh.Windows.FirstOrDefault(window => window.Handle == selected.Handle &&
                    window.ProcessId == selected.ProcessId && DockModel.Identity(window.Target) == DockModel.Identity(selected.Target)) : null;
                CloseThemePreview();
                if (task != null) Click(fresh, task);
            });
            source.SetNativeDockPreview(true, opening: true);
            if (!themePreview.ShowForNative(current, source.Handle, themePreviewFraction)) { CloseThemePreview(); return; }
            themePreviewTimer = new DispatcherTimer(TimeSpan.FromMilliseconds(150), DispatcherPriority.Background,
                (_, _) => MaintainThemePreview(), dispatcher);
            themePreviewTimer.Start();
        }
        catch { CloseThemePreview(); throw; }
    }

    private void MaintainThemePreview()
    {
        try
        {
            if (themePreview?.IsVisible != true || !CurrentThemePreview(out var group)) { CloseThemePreview(); return; }
            var viewport = themePreviewHost.ReadNativeViewport();
            var inDock = viewport != null && PreviewGetCursorPos(out var cursor) &&
                cursor.X >= viewport.X && cursor.X < viewport.X + viewport.Width &&
                cursor.Y >= viewport.Y && cursor.Y < viewport.Y + viewport.Height;
            if (inDock || themePreview.IsMouseOver) themePreviewLastInside = DateTime.UtcNow;
            else if (DateTime.UtcNow - themePreviewLastInside > TimeSpan.FromMilliseconds(650)) { CloseThemePreview(); return; }
            themePreview.UpdateGroup(group);
            if (!themePreview.FollowNativeAnchor(themePreviewHost.Handle, themePreviewFraction)) { CloseThemePreview(); return; }
            themePreviewHost.SetNativeDockPreview(true);
        }
        catch (Exception ex) { CloseThemePreview(); error = "窗口预览已关闭：" + ex.Message; }
    }

    private void CloseThemePreview()
    {
        themePreviewTimer?.Stop();
        themePreviewTimer = null;
        var preview = themePreview;
        var host = themePreviewHost;
        themePreview = null; themePreviewHost = null; themePreviewCompletion = null; themePreviewContext = null;
        try { host?.SetNativeDockPreview(false); }
        catch (Exception ex) { error = "预览宿主已断开：" + ex.Message; }
        finally { preview?.Close(); }
    }

    [StructLayout(LayoutKind.Sequential)] private struct PreviewPoint { public int X, Y; }
    [DllImport("user32.dll", EntryPoint = "GetCursorPos")] private static extern bool PreviewGetCursorPos(out PreviewPoint point);
}
