using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Lively.Common.Helpers
{
    // BCL-only shared source: compiled into Common and the standalone Watchdog.
    // A journal is durable before the first Windows mutation. No Room data or
    // authored parameters can select a taskbar/window/recovery path.
    public sealed class DextDockTaskbarRecovery
    {
        private sealed class WindowState
        {
            public long Handle, Started;
            public int Pid;
            public bool Visible;
        }
        private sealed class Journal
        {
            public string Lease;
            public int CorePid, GuardPid;
            public long CoreStarted, GuardStarted;
            public uint Flags;
            public bool OriginalVisible;
            public List<WindowState> Windows = new List<WindowState>();
        }
        private readonly Journal saved;
        public static bool? IsPrimaryVisible()
        {
            var handle = PrimaryTaskbar();
            return handle == IntPtr.Zero ? (bool?)null : IsWindowVisible(handle);
        }
        public static string JournalPath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Dext", "v3", "dock-taskbar-recovery.dat");
        public static string MutexName => @"Local\DEXT:DOCK-TASKBAR:" + Environment.UserDomainName + ":" + Environment.UserName;
        private DextDockTaskbarRecovery(Journal saved) { this.saved = saved; }

        public static bool IsProcessAlive(int pid, long started)
        {
            try { using (var process = Process.GetProcessById(pid))
                return !process.HasExited && process.StartTime.ToUniversalTime().Ticks == started; }
            catch { return false; }
        }
        public static long ProcessStarted(int pid)
        {
            using (var process = Process.GetProcessById(pid)) return process.StartTime.ToUniversalTime().Ticks;
        }
        public static bool Recover(string expectedLease, int corePid, long coreStarted)
        {
            using (var mutex = new Mutex(false, MutexName))
            {
                bool held;
                try { held = mutex.WaitOne(0); } catch (AbandonedMutexException) { held = true; }
                if (!held) return false;
                try { return RecoverUnderMutex(expectedLease, corePid, coreStarted); }
                finally { mutex.ReleaseMutex(); }
            }
        }
        public static bool RecoverUnderMutex(string expectedLease, int corePid, long coreStarted)
        {
            if (!File.Exists(JournalPath)) return true;
            var journal = Read();
            if (expectedLease != null && journal.Lease != expectedLease ||
                IsProcessAlive(journal.GuardPid, journal.GuardStarted) ||
                IsProcessAlive(journal.CorePid, journal.CoreStarted) &&
                    (journal.CorePid != corePid || journal.CoreStarted != coreStarted)) return false;
            return new DextDockTaskbarRecovery(journal).Restore();
        }
        public static DextDockTaskbarRecovery Capture(string lease, int corePid, long coreStarted, int guardPid, long guardStarted)
        {
            Guid parsed;
            if (!Guid.TryParseExact(lease, "D", out parsed) || parsed == Guid.Empty) throw new ArgumentException("Invalid taskbar lease");
            var main = PrimaryTaskbar();
            if (main == IntPtr.Zero) return null;
            var state = CaptureWindow(main);
            if (state == null) return null;
            var journal = new Journal { Lease = lease, CorePid = corePid, CoreStarted = coreStarted,
                GuardPid = guardPid, GuardStarted = guardStarted, Flags = ReadFlags(),
                OriginalVisible = state.Visible };
            journal.Windows.Add(state);
            Write(journal);
            return new DextDockTaskbarRecovery(journal);
        }
        public bool Hide()
        {
            var main = PrimaryTaskbar();
            if (main == IntPtr.Zero) return false; // Explorer can be between processes.
            var current = CaptureWindow(main);
            if (current == null) return false;
            if (!saved.Windows.Any(value => value.Handle == current.Handle && value.Pid == current.Pid && value.Started == current.Started))
            {
                // Explorer recreated the HWND while our temporary flag was set.
                // Preserve the original lease's visibility/flags, not that flag.
                current.Visible = saved.OriginalVisible;
                saved.Windows.RemoveAll(value => !IsProcessAlive(value.Pid, value.Started));
                saved.Windows.Add(current);
                if (saved.Windows.Count > 32) throw new InvalidOperationException("Taskbar recreation limit exceeded");
                Write(saved);
            }
            if ((ReadFlags() & 1) == 0) SetFlags(main, saved.Flags | 1);
            if (IsWindowVisible(main)) ShowWindow(main, 0); // SW_HIDE, no focus change.
            return (ReadFlags() & 1) != 0 && !IsWindowVisible(main);
        }
        public bool Restore()
        {
            var main = PrimaryTaskbar();
            if (main == IntPtr.Zero) return false; // Keep the journal for Explorer/startup recovery.
            SetFlags(main, saved.Flags);
            var current = CaptureWindow(main);
            if (current == null) return false;
            var original = saved.Windows.LastOrDefault(value => value.Handle == current.Handle &&
                value.Pid == current.Pid && value.Started == current.Started);
            var visible = original == null ? saved.OriginalVisible : original.Visible;
            // Restore the saved Shell policy during a fullscreen game without
            // forcing the taskbar above it. Explorer resumes its normal visibility
            // policy on the subsequent foreground/work-area change.
            var fullscreen = visible && FullscreenOnTaskbarMonitor(main);
            if (!fullscreen) ShowWindow(main, visible ? 4 : 0); // SW_SHOWNOACTIVATE / SW_HIDE.
            if ((ReadFlags() & 1) != (saved.Flags & 1) || !fullscreen && IsWindowVisible(main) != visible) return false;
            if (File.Exists(JournalPath) && Read().Lease == saved.Lease) File.Delete(JournalPath);
            return true;
        }
        private static bool FullscreenOnTaskbarMonitor(IntPtr taskbar)
        {
            var foreground = GetForegroundWindow();
            if (foreground == IntPtr.Zero || foreground == taskbar || IsIconic(foreground)) return false;
            var name = new StringBuilder(128); GetClassName(foreground, name, name.Capacity);
            if (name.ToString() == "Progman" || name.ToString() == "WorkerW") return false;
            var style = IntPtr.Size == 8 ? GetWindowLongPtr(foreground, -16).ToInt64() : GetWindowLong(foreground, -16);
            if (IsZoomed(foreground) && (style & 0x00C00000) != 0) return false; // ordinary maximized software.
            NativeRect bounds; var monitor = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
            return GetWindowRect(foreground, out bounds) && GetMonitorInfo(MonitorFromWindow(taskbar, 2), ref monitor) &&
                bounds.Left <= monitor.Bounds.Left && bounds.Top <= monitor.Bounds.Top &&
                bounds.Right >= monitor.Bounds.Right && bounds.Bottom >= monitor.Bounds.Bottom;
        }
        private static WindowState CaptureWindow(IntPtr handle)
        {
            int pid;
            if (!IsWindow(handle) || GetWindowThreadProcessId(handle, out pid) == 0) return null;
            try
            {
                using (var process = Process.GetProcessById(pid))
                {
                    if (process.HasExited || !string.Equals(process.ProcessName, "explorer", StringComparison.OrdinalIgnoreCase)) return null;
                    return new WindowState { Handle = handle.ToInt64(), Pid = pid,
                        Started = process.StartTime.ToUniversalTime().Ticks, Visible = IsWindowVisible(handle) };
                }
            }
            catch { return null; }
        }
        private static IntPtr PrimaryTaskbar() => FindWindow("Shell_TrayWnd", null);
        private static uint ReadFlags()
        {
            var data = new AppBarData { Size = Marshal.SizeOf(typeof(AppBarData)) };
            return unchecked((uint)SHAppBarMessage(4, ref data).ToUInt64()) & 3; // ABM_GETSTATE
        }
        private static void SetFlags(IntPtr handle, uint flags)
        {
            var data = new AppBarData { Size = Marshal.SizeOf(typeof(AppBarData)), Handle = handle,
                Param = new IntPtr((long)(flags & 3)) };
            SHAppBarMessage(10, ref data); // ABM_SETSTATE always returns TRUE; verify with GETSTATE.
        }
        private static string Number(long value) => value.ToString(CultureInfo.InvariantCulture);
        private static void Write(Journal value)
        {
            var lines = new List<string> { "DEXT-DOCK-TASKBAR-1", value.Lease,
                Number(value.CorePid) + "|" + Number(value.CoreStarted) + "|" + Number(value.GuardPid) + "|" + Number(value.GuardStarted),
                Number(value.Flags) + "|" + (value.OriginalVisible ? "1" : "0") };
            lines.AddRange(value.Windows.Select(window => Number(window.Handle) + "|" + Number(window.Pid) + "|" +
                Number(window.Started) + "|" + (window.Visible ? "1" : "0")));
            Directory.CreateDirectory(Path.GetDirectoryName(JournalPath));
            var temporary = JournalPath + "." + value.Lease + ".tmp";
            try
            {
                using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    var bytes = new UTF8Encoding(false).GetBytes(string.Join("\n", lines));
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(true);
                }
                if (File.Exists(JournalPath)) File.Replace(temporary, JournalPath, null);
                else File.Move(temporary, JournalPath);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
        private static Journal Read()
        {
            var info = new FileInfo(JournalPath);
            if (info.Length > 16384) throw new InvalidDataException("Taskbar recovery record too large");
            var lines = File.ReadAllLines(JournalPath, Encoding.UTF8);
            Guid lease;
            if (lines.Length < 5 || lines.Length > 36 || lines[0] != "DEXT-DOCK-TASKBAR-1" ||
                !Guid.TryParseExact(lines[1], "D", out lease) || lease == Guid.Empty)
                throw new InvalidDataException("Invalid taskbar recovery record");
            var owner = Parts(lines[2], 4); var flags = Parts(lines[3], 2);
            var value = new Journal { Lease = lines[1], CorePid = PositivePid(owner[0]), CoreStarted = Positive(owner[1]),
                GuardPid = PositivePid(owner[2]), GuardStarted = Positive(owner[3]),
                Flags = (uint)Integer(flags[0], 0, 3), OriginalVisible = Integer(flags[1], 0, 1) == 1 };
            foreach (var line in lines.Skip(4))
            {
                var window = Parts(line, 4);
                value.Windows.Add(new WindowState { Handle = Integer(window[0], long.MinValue, long.MaxValue),
                    Pid = PositivePid(window[1]), Started = Positive(window[2]), Visible = Integer(window[3], 0, 1) == 1 });
            }
            return value;
        }
        private static string[] Parts(string line, int count)
        {
            var values = line.Split('|');
            if (values.Length != count) throw new InvalidDataException("Invalid taskbar recovery fields");
            return values;
        }
        private static long Integer(string text, long low, long high)
        {
            long value;
            if (!long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value) || value < low || value > high)
                throw new InvalidDataException("Invalid taskbar recovery number");
            return value;
        }
        private static long Positive(string text) => Integer(text, 1, long.MaxValue);
        private static int PositivePid(string text) => (int)Integer(text, 1, int.MaxValue);

        [StructLayout(LayoutKind.Sequential)] private struct NativeRect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public NativeRect Bounds, Work; public uint Flags; }
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
        [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr handle);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr handle, out NativeRect rect);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr handle, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr handle, ref MonitorInfo info);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr handle, StringBuilder name, int size);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr handle, int index);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr handle, int index);
        [StructLayout(LayoutKind.Sequential)] private struct AppBarData
        {
            public int Size; public IntPtr Handle; public uint Callback, Edge; public NativeRect Rect; public IntPtr Param;
        }
        [DllImport("shell32.dll")] private static extern UIntPtr SHAppBarMessage(uint message, ref AppBarData data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindow(string name, string title);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr handle);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr handle, int command);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out int pid);
    }
}