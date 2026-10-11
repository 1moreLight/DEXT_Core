using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;

namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockWindow
{
    private readonly DispatcherTimer visibilityTimer = new() { Interval = TimeSpan.FromMilliseconds(50) };
    private readonly DockVisibilityPolicy visibilityPolicy = new();
    private bool visibilityActive, autoHide;
    private Func<bool> presentationBlocked;

    public bool NativeReady => visibilityActive && new WindowInteropHelper(this).Handle != IntPtr.Zero;

    private void InitializeVisibility()
    {
        visibilityTimer.Tick += (_, _) => UpdatePresentation();
        Closed += (_, _) => { visibilityActive = false; visibilityTimer.Stop(); };
    }

    public void SetVisibilityMode(bool hide, Func<bool> blocked)
    {
        autoHide = hide;
        presentationBlocked = blocked;
        visibilityActive = true;
        if (!visibilityTimer.IsEnabled) visibilityTimer.Start();
        UpdatePresentation();
    }

    private void StopVisibility()
    {
        visibilityActive = false;
        visibilityTimer.Stop();
    }

    private void UpdatePresentation()
    {
        if (!visibilityActive) return;
        UpdateReservation();
        Position();
        var blocked = presentationBlocked?.Invoke() == true;
        var pointer = false;
        if (GetCursorPos(out var cursor))
        {
            var transform = PresentationSource.FromVisual(this)?.CompositionTarget?.TransformFromDevice;
            var point = transform?.Transform(new Point(cursor.X, cursor.Y)) ?? new Point(cursor.X, cursor.Y);
            pointer = DockVisibilityPolicy.AtRevealEdge(point.X, point.Y, Left, ActualWidth,
                SystemParameters.PrimaryScreenHeight);
        }
        pointer |= IsVisible && IsMouseOver;
        var interacting = IsVisible && (preview?.IsVisible == true ||
            Mouse.LeftButton == MouseButtonState.Pressed || Mouse.RightButton == MouseButtonState.Pressed ||
            strip.Children.OfType<Button>().Any(b => b.ContextMenu?.IsOpen == true));
        var shown = visibilityPolicy.Update(autoHide, blocked, pointer, interacting,
            (long)(Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency));
        if (shown && !IsVisible) Show();
        else if (!shown && IsVisible)
        {
            // Blocking always wins; close menus as well as the preview before hiding.
            foreach (var button in strip.Children.OfType<Button>())
                if (button.ContextMenu is { } menu) menu.IsOpen = false;
            ClosePreview();
            Hide();
        }
    }

    [StructLayout(LayoutKind.Sequential)] private struct CursorPoint { public int X, Y; }
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out CursorPoint point);
}
