using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Lively.Services.ApplicationDock;

// Only trusted Core UI calls these operations; HWNDs are never author capabilities.
internal static class DockWindows
{
    public static long Foreground => GetForegroundWindow().ToInt64();
    public static IReadOnlyList<DockTask> Enumerate()
    {
        var result = new List<DockTask>();
        EnumWindows((window, _) =>
        {
            try
            {
                if (!IsWindowVisible(window) || GetWindow(window, 4) != IntPtr.Zero) return true;
                var style = GetWindowLong(window, -20);
                if ((style & 0x80) != 0 || (style & 0x08000000) != 0) return true;
                if (DwmGetWindowAttribute(window, 14, out int cloaked, sizeof(int)) == 0 && cloaked != 0) return true;
                var title = new StringBuilder(1024);
                if (GetWindowText(window, title, title.Capacity) == 0) return true;
                var className = new StringBuilder(128);
                GetClassName(window, className, className.Capacity);
                if (className.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd" or "Shell_SecondaryTrayWnd") return true;
                GetWindowThreadProcessId(window, out var pid);
                if (pid == Environment.ProcessId) return true;
                var target = ProcessPath(pid);
                // Packaged applications may have their visible window owned by ApplicationFrameHost.
                if (string.Equals(Path.GetFileName(target), "ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase))
                {
                    EnumChildWindows(window, (child, _) =>
                    {
                        GetWindowThreadProcessId(child, out var childPid);
                        if (childPid == pid) return true;
                        var childPath = ProcessPath(childPid);
                        if (string.IsNullOrEmpty(childPath)) return true;
                        target = childPath;
                        return false;
                    }, IntPtr.Zero);
                }
                if (!string.IsNullOrEmpty(target))
                    result.Add(new(window.ToInt64(), pid, title.ToString(), target));
            }
            catch { /* A window can close or deny access while it is being enumerated. */ }
            return true;
        }, IntPtr.Zero);
        return result;
    }

    public static bool Perform(DockTask task, bool minimize)
    {
        // Re-enumeration checks visibility, process and application identity before using an old button.
        var current = System.Linq.Enumerable.FirstOrDefault(Enumerate(), w =>
            w.Handle == task.Handle && w.ProcessId == task.ProcessId &&
            DockModel.Identity(w.Target) == DockModel.Identity(task.Target));
        if (current == null) return false;
        var handle = new IntPtr(task.Handle);
        if (minimize) return ShowWindowAsync(handle, 6);
        if (IsIconic(handle)) ShowWindowAsync(handle, 9);
        return SetForegroundWindow(handle);
    }

    public static bool IsFullscreen()
    {
        var handle = GetForegroundWindow();
        if (handle == IntPtr.Zero || !IsWindowVisible(handle) || IsIconic(handle)) return false;
        var name = new StringBuilder(128);
        GetClassName(handle, name, name.Capacity);
        if (name.ToString() is "Progman" or "WorkerW") return false;
        var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (!GetMonitorInfo(MonitorFromWindow(handle, 2), ref info) || !GetWindowRect(handle, out var rect)) return false;
        var coversMonitor = rect.Left <= info.Monitor.Left && rect.Top <= info.Monitor.Top &&
            rect.Right >= info.Monitor.Right && rect.Bottom >= info.Monitor.Bottom;
        return DockVisibilityPolicy.IsFullscreen(coversMonitor, IsZoomed(handle),
            (GetWindowLong(handle, -16) & 0x00C00000) != 0);
    }
    private static string ProcessPath(int pid)
    {
        var process = OpenProcess(0x1000, false, pid);
        if (process == IntPtr.Zero) return null;
        try
        {
            var text = new StringBuilder(32768);
            var size = text.Capacity;
            return QueryFullProcessImageName(process, 0, text, ref size) ? text.ToString() : null;
        }
        finally { CloseHandle(process); }
    }

    private delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] internal static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] internal static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out int pid);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
    [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder text, ref int size);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
