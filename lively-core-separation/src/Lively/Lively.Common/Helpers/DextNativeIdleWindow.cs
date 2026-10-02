using System;
using System.Drawing;
using System.Runtime.InteropServices;

namespace Lively.Common.Helpers
{
    // The host serializes presentation on its UI thread. Never call these
    // cross-process window APIs while holding a session/authorization lock.
    public sealed class DextNativeIdleWindow
    {
        private const long Child = 0x40000000, Popup = 0x80000000, Visible = 0x10000000, Topmost = 8;
        private const uint NoActivate = 0x10, FrameChanged = 0x20, Show = 0x40;
        private readonly IntPtr window, parent, previous;
        private readonly int pid, parentPid, previousPid;
        private readonly uint windowThread, parentThread, previousThread;
        private readonly long style, extended;
        private readonly Rectangle original, presented;
        private bool restored;

        private DextNativeIdleWindow(IntPtr window, int pid, IntPtr parent, Rectangle original, Rectangle presented)
        {
            this.window = window; this.pid = pid; this.parent = parent;
            this.original = original; this.presented = presented;
            windowThread = Native.GetWindowThreadProcessId(window, out _);
            parentThread = Native.GetWindowThreadProcessId(parent, out parentPid);
            previous = Native.GetWindow(window, 3);
            if (previous != IntPtr.Zero) previousThread = Native.GetWindowThreadProcessId(previous, out previousPid);
            style = ReadLong(window, -16); extended = ReadLong(window, -20);
        }

        public bool IsPresented => !restored && Owned(window, pid, windowThread) &&
            Native.GetAncestor(window, 2) == window && Native.IsWindowVisible(window) &&
            (ReadLong(window, -16) & Child) == 0 && (ReadLong(window, -20) & Topmost) != 0 &&
            TryBounds(window, out var actual) && actual == presented;

        // On failure a non-null lease means restoration also failed; the host
        // must close its owned Player rather than leave a detached window.
        public static bool TryPresent(IntPtr window, int pid, Rectangle bounds, out DextNativeIdleWindow lease) =>
            TryPresent(window, pid, bounds, out lease, out _);

        public static bool TryPresent(IntPtr window, int pid, Rectangle bounds, out DextNativeIdleWindow lease, out string diagnostic)
        {
            lease = null; diagnostic = "Invalid Player/window bounds or desktop parent.";
            if (pid <= 0 || bounds.Width <= 0 || bounds.Height <= 0 || bounds.Width > 65536 || bounds.Height > 65536 ||
                !Owned(window, pid, 0) || !TryBounds(window, out var original)) return false;
            var parent = Native.GetAncestor(window, 1);
            if (parent == IntPtr.Zero || parent == Native.GetDesktopWindow() || !Native.IsWindow(parent)) return false;
            var point = new Native.Point { X = original.X, Y = original.Y };
            if (!Native.ScreenToClient(parent, ref point)) return false;
            var candidate = new DextNativeIdleWindow(window, pid, parent,
                new Rectangle(point.X, point.Y, original.Width, original.Height), bounds);
            Native.ShowWindow(window, 0);
            var ok = SetLong(window, -16, (candidate.style & ~Popup) | Child) &&
                Native.SetWindowPos(window, IntPtr.Zero, 0, 0, 0, 0, NoActivate | FrameChanged | 1 | 2 | 4) &&
                SetParent(window, IntPtr.Zero) && SetLong(window, -16, (candidate.style & ~Child) | Popup) &&
                SetLong(window, -20, ReadLong(window, -20) | 0x80) &&
                Native.SetWindowPos(window, IntPtr.Zero, bounds.X, bounds.Y, bounds.Width, bounds.Height, NoActivate | FrameChanged | Show | 4) &&
                Native.SetWindowPos(window, new IntPtr(-2), 0, 0, 0, 0, NoActivate | 1 | 2) &&
                Native.SetWindowPos(window, new IntPtr(-1), 0, 0, 0, 0, NoActivate | 1 | 2);
            if (ok && candidate.IsPresented) { lease = candidate; diagnostic = string.Empty; return true; }
            var error = Marshal.GetLastWin32Error();
            TryBounds(window, out var actual);
            diagnostic = $"presentation={ok}; win32={error}; parent={Native.GetParent(window)}; ancestor={Native.GetAncestor(window,1)}; root={Native.GetAncestor(window,2)}; hwnd={window}; visible={Native.IsWindowVisible(window)}; bounds={actual}; expected={bounds}; style={ReadLong(window,-16):X}; extended={ReadLong(window,-20):X}";
            if (!candidate.TryRestore()) lease = candidate;
            return false;
        }

        public bool TryRestore()
        {
            if (restored) return true;
            if (!Owned(window, pid, windowThread)) { restored = true; return true; }
            Native.ShowWindow(window, 0);
            // Remove topmost even if Explorer has disappeared. A failed restore
            // remains hidden until the host closes the same owned Player.
            Native.SetWindowPos(window, new IntPtr(-2), 0, 0, 0, 0, NoActivate | 1 | 2);
            if (!Owned(parent, parentPid, parentThread) ||
                previous != IntPtr.Zero && (!Owned(previous, previousPid, previousThread) || Native.GetAncestor(previous, 1) != parent)) return false;
            if (!SetLong(window, -16, (style & ~Popup) | Child) || !SetParent(window, parent) || !SetLong(window, -16, style) || !SetLong(window, -20, extended) ||
                !Native.SetWindowPos(window, previous, original.X, original.Y, original.Width, original.Height, NoActivate | FrameChanged)) return false;
            Native.ShowWindow(window, (style & Visible) != 0 ? 4 : 0);
            var point = new Native.Point { X = original.X, Y = original.Y };
            if (!Native.ClientToScreen(parent, ref point) || !TryBounds(window, out var actual) ||
                actual != new Rectangle(point.X, point.Y, original.Width, original.Height) || Native.GetAncestor(window, 1) != parent ||
                ReadLong(window, -16) != style || ReadLong(window, -20) != extended)
            { Native.ShowWindow(window, 0); return false; }
            restored = true;
            return true;
        }

        private static bool Owned(IntPtr h, int expectedPid, uint expectedThread)
        {
            if (h == IntPtr.Zero || !Native.IsWindow(h)) return false;
            var thread = Native.GetWindowThreadProcessId(h, out var actualPid);
            return thread != 0 && actualPid == expectedPid && (expectedThread == 0 || thread == expectedThread);
        }
        private static bool TryBounds(IntPtr h, out Rectangle bounds)
        {
            bounds = default;
            if (!Native.GetWindowRect(h, out var r)) return false;
            bounds = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            return bounds.Width > 0 && bounds.Height > 0;
        }
        private static long ReadLong(IntPtr h, int index) => IntPtr.Size == 8 ? Native.GetWindowLongPtrW(h, index).ToInt64() : unchecked((uint)Native.GetWindowLongW(h, index));
        private static bool SetLong(IntPtr h, int index, long value)
        {
            Native.SetLastError(0);
            var old = IntPtr.Size == 8 ? Native.SetWindowLongPtrW(h, index, new IntPtr(value)) : new IntPtr(Native.SetWindowLongW(h, index, unchecked((int)value)));
            return old != IntPtr.Zero || Marshal.GetLastWin32Error() == 0;
        }
        private static bool SetParent(IntPtr h, IntPtr parent)
        {
            Native.SetLastError(0);
            var old = Native.SetParent(h, parent);
            return old != IntPtr.Zero || Marshal.GetLastWin32Error() == 0;
        }
        private static class Native
        {
            [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
            [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
            [DllImport("kernel32.dll")] public static extern void SetLastError(uint error);
            [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
            [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
            [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
            [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
            [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
            [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint command);
            [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
            [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out Rect r);
            [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref Point p);
            [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h, ref Point p);
            [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetParent(IntPtr h, IntPtr parent);
            [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtrW(IntPtr h, int index);
            [DllImport("user32.dll")] public static extern int GetWindowLongW(IntPtr h, int index);
            [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowLongPtrW(IntPtr h, int index, IntPtr value);
            [DllImport("user32.dll", SetLastError = true)] public static extern int SetWindowLongW(IntPtr h, int index, int value);
            [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
            [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int show);
        }
    }
}
