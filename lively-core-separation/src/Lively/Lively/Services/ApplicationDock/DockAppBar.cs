using System;
using System.Runtime.InteropServices;
using System.Windows.Interop;

namespace Lively.Services.ApplicationDock;

// The existing narrow Dock HWND owns the AppBar; no transparent full-screen input window.
internal sealed class DockAppBar : IDockReservationPlatform, IDisposable
{
    private readonly IntPtr handle;
    private readonly HwndSource source;
    private readonly uint callback = RegisterWindowMessage("DEXT:APPLICATIONDOCK:APPBAR");
    private readonly uint explorer = RegisterWindowMessage("TaskbarCreated");
    public DockReservation Reservation { get; }
    private bool disposed;

    public DockAppBar(IntPtr handle)
    {
        this.handle = handle;
        Reservation = new DockReservation(this);
        source = HwndSource.FromHwnd(handle);
        source.AddHook(Hook);
    }
    public DockBounds Screen => Monitor().Monitor.Bounds;
    public DockBounds WorkArea => Monitor().Work.Bounds;
    public uint Dpi => Math.Max(96, GetDpiForWindow(handle));
    public bool Register()
    {
        var data = Data(); data.Callback = callback;
        return SHAppBarMessage(0, ref data) != UIntPtr.Zero;
    }
    public DockBounds Reserve(DockBounds requested)
    {
        var data = Data(); data.Edge = 3; data.Rect = new NativeRect(requested);
        SHAppBarMessage(2, ref data);
        data.Rect.Top = data.Rect.Bottom - requested.Height;
        SHAppBarMessage(3, ref data);
        return data.Rect.Bounds;
    }
    public void Remove() { var data = Data(); SHAppBarMessage(1, ref data); }
    private AppBarData Data() => new() { Size = (uint)Marshal.SizeOf<AppBarData>(), Handle = handle };
    private MonitorInfo Monitor()
    {
        var info = new MonitorInfo { Size = (uint)Marshal.SizeOf<MonitorInfo>() };
        if (!GetMonitorInfo(MonitorFromPoint(new NativePoint(), 1), ref info))
            throw new InvalidOperationException("无法读取主屏工作区。");
        return info;
    }
    private IntPtr Hook(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (disposed) return IntPtr.Zero;
        if ((uint)message == explorer) Reservation.ExplorerRestarted();
        else if ((uint)message == callback && wParam.ToInt32() == 1 || message is 0x02E0 or 0x007E or 0x001A)
            Reservation.Invalidate();
        else if (message == 0x0006 && Reservation.Registered)
        {
            var data = Data(); data.Param = (wParam.ToInt64() & 0xffff) != 0 ? new IntPtr(1) : IntPtr.Zero;
            SHAppBarMessage(6, ref data);
        }
        return IntPtr.Zero;
    }
    public void Dispose()
    {
        if (disposed) return;
        Reservation.Release();
        source.RemoveHook(Hook);
        disposed = true;
    }
    [StructLayout(LayoutKind.Sequential)] private struct NativePoint { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] private struct NativeRect
    {
        public int Left, Top, Right, Bottom;
        public NativeRect(DockBounds value) { Left=value.Left; Top=value.Top; Right=value.Right; Bottom=value.Bottom; }
        public DockBounds Bounds => new(Left,Top,Right,Bottom);
    }
    [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public uint Size; public NativeRect Monitor, Work; public uint Flags; }
    [StructLayout(LayoutKind.Sequential)] private struct AppBarData
    {
        public uint Size; public IntPtr Handle; public uint Callback, Edge; public NativeRect Rect; public IntPtr Param;
    }
    [DllImport("shell32.dll")] private static extern UIntPtr SHAppBarMessage(uint message, ref AppBarData data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern uint RegisterWindowMessage(string name);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(NativePoint point, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr handle);
}
