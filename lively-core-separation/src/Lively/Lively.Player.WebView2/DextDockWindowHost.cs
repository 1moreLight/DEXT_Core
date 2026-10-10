using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace Lively.Player.WebView2
{
    // Native window behavior reused by the explicit P2b probe. No WorkerW parenting
    // or wallpaper RawInput forwarding belongs to this window role.
    internal sealed class DextDockWindowHost : NativeWindow, IDisposable
    {
        internal enum DockMode { Overlay, Autohide, Reserve }
        private readonly Form owner;
        private readonly Timer timer;
        private readonly uint callbackMessage = RegisterWindowMessage("DEXT:DOCK:APPBAR");
        private readonly uint explorerMessage = RegisterWindowMessage("TaskbarCreated");
        private bool registered, arranging, arrangeQueued, disposed, started;
        private bool keyboard, expanded, fullscreen, shellFullscreen, arrangingWindows;
        private bool visible, available = true;
        private long previewHoldUntil;
        internal void HoldPreview(int milliseconds) => previewHoldUntil = milliseconds <= 0 ? 0 :
            Stopwatch.GetTimestamp() + (long)(Math.Min(milliseconds, 1500) / 1000d * Stopwatch.Frequency);
        private readonly string role;
        internal bool IsStarted => started;
        internal bool IsVisible => visible;
        internal bool IsKeyboard => keyboard;
        internal bool IsFullscreen => fullscreen;
        internal bool IsAppBarRegistered => registered;
        internal bool IsAppBarReady
        {
            get
            {
                if (disposed || !registered || mode != DockMode.Reserve || lastBounds.IsEmpty) return false;
                Rect actual;
                if (!GetWindowRect(Handle, out actual) || actual.Rectangle != lastBounds) return false;
                try
                {
                    var work = ReadPrimaryWorkArea();
                    var screen = Screen.PrimaryScreen.Bounds;
                    return work.Width > 0 && work.Height > 0 && work.Bottom <= lastBounds.Top &&
                        lastBounds.Top >= screen.Top && lastBounds.Bottom <= screen.Bottom;
                }
                catch { return false; }
            }
        }
        private int heightDip = 128;
        private DockMode mode;
        private IntPtr previousForeground;
        private Rectangle lastBounds, beforeWorkArea;
        private long lastInside;
        private string lastState;
        internal event Action<object> StateChanged;
        internal event Action<Exception> Failed;

        internal DextDockWindowHost(Form form, string role = "dock-probe")
        {
            owner = form;
            this.role = role;
            AssignHandle(form.Handle);
            // Form.Shown already made the offscreen HWND visible; establish real hidden state
            // before moving it onto the screen (initial autohide/fullscreen must stay hidden).
            SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, 0x0097);
            timer = new Timer { Interval = 150 };
            timer.Tick += Tick;
        }

        internal void Start(DockMode initial, int height)
        {
            if (started || disposed) return;
            // Application.Run may show the HWND after construction; reestablish
            // hidden native state before the first on-screen arrangement.
            SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, 0x0097);
            visible = false;
            beforeWorkArea = ReadPrimaryWorkArea();
            started = true;
            heightDip = ClampHeight(height);
            fullscreen = ForegroundCoversPrimary();
            SetMode(initial);
            timer.Start();
        }

        internal void SetAvailability(bool value)
        {
            if (disposed || available == value) return;
            available = value;
            if (!value) { previewHoldUntil = 0; expanded = false; LeaveKeyboard(false); }
            if (started && mode == DockMode.Reserve && role == "native-dock")
            {
                if (!value) Unregister();
                else if (!registered) SetMode(mode);
            }
            UpdateVisibility();
            Publish();
        }

        internal void SetMode(DockMode value)
        {
            if (disposed) return;
            if (registered && value != DockMode.Reserve) Unregister();

            if (value == DockMode.Reserve && !registered && (role != "native-dock" || available))
            {
                var data = AppBarData();
                data.Callback = callbackMessage;
                if (SHAppBarMessage(0, ref data) == UIntPtr.Zero)
                    throw new InvalidOperationException("Windows refused the Dock AppBar registration.");
                registered = true;
                lastBounds = Rectangle.Empty;
            }
            mode = value;
            expanded = value != DockMode.Autohide;
            Arrange();
            UpdateVisibility();
            Publish();
        }

        internal void SetHeight(int value)
        {
            heightDip = ClampHeight(value);
            Arrange();
            Publish();
        }

        internal bool EnterKeyboard()
        {
            if (disposed || !visible || fullscreen) return false;
            if (keyboard) return true;
            previousForeground = GetForegroundWindow();
            keyboard = true;
            UpdateActivationStyle();
            SetForegroundWindow(Handle);
            owner.ActiveControl?.Focus();
            if (GetAncestor(GetForegroundWindow(), 2) != Handle)
            {
                LeaveKeyboard(false);
                return false;
            }
            Publish();
            return true;
        }

        internal void LeaveKeyboard(bool restore)
        {
            if (!keyboard) return;
            keyboard = false;
            UpdateActivationStyle();
            if (restore && GetAncestor(GetForegroundWindow(), 2) == Handle && IsWindow(previousForeground))
                SetForegroundWindow(previousForeground);
            Publish();
        }

        private int ClampHeight(int value)
        {
            if (value < 48 || value > 240)
                throw new ArgumentOutOfRangeException(nameof(value), "Dock probe height must be 48..240 DIP.");
            return value;
        }

        private void UpdateActivationStyle()
        {
            var style = ReadStyle(Handle, -20).ToInt64();
            style = keyboard ? style & ~0x08000000L : style | 0x08000000L;
            WriteStyle(Handle, -20, new IntPtr(style));
            SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0, 0x0037); // framechanged, noactivate, no move/size/zorder
        }

        private void QueueArrange()
        {
            if (!started || disposed || arrangeQueued || arranging) return;
            arrangeQueued = true;
            owner.BeginInvoke((Action)(() =>
            {
                arrangeQueued = false;
                if (disposed) return;
                try { Arrange(); UpdateVisibility(); Publish(); }
                catch (Exception ex) { Failed?.Invoke(ex); }
            }));
        }

        private void Arrange()
        {
            if (disposed || arranging || !started) return;
            arranging = true;
            uint arrangedDpi = 0;
            try
            {
                var screen = Screen.PrimaryScreen;
                var bounds = screen.Bounds;
                var dpi = GetDpiForWindow(Handle);
                if (dpi == 0) dpi = 96;
                arrangedDpi = dpi;
                var height = Math.Min((int)Math.Round(heightDip * dpi / 96.0), Math.Max(1, bounds.Height / 5));
                Rectangle target;
                if (registered)
                {
                    var data = AppBarData();
                    data.Edge = 3; // ABE_BOTTOM
                    data.Rect = new Rect(bounds.Left, bounds.Bottom - height, bounds.Right, bounds.Bottom);
                    SHAppBarMessage(2, ref data); // ABM_QUERYPOS
                    data.Rect.Top = data.Rect.Bottom - height;
                    target = data.Rect.Rectangle;
                    if (target != lastBounds || !IsAppBarReady)
                    {
                        SHAppBarMessage(3, ref data); // ABM_SETPOS: final result belongs to Windows.
                        target = data.Rect.Rectangle;
                    }
                }
                else
                {
                    var work = ReadPrimaryWorkArea();
                    target = new Rectangle(work.Left, work.Bottom - height, work.Width, height);
                }
                if (target.Width <= 0 || target.Height <= 0)
                    throw new InvalidOperationException("Windows returned no drawable Dock rectangle.");
                Rect actual;
                if (!GetWindowRect(Handle, out actual) || target != actual.Rectangle)
                {
                    if (!SetWindowPos(Handle, new IntPtr(-1), target.Left, target.Top,
                        target.Width, target.Height, 0x0010)) // SWP_NOACTIVATE
                        throw new InvalidOperationException("Windows refused the Dock window rectangle.");
                }
                lastBounds = target;
            }
            finally
            {
                arranging = false;
                var currentDpi = GetDpiForWindow(Handle);
                if (currentDpi != 0 && currentDpi != arrangedDpi) QueueArrange();
            }
        }

        private void Tick(object sender, EventArgs args)
        {
            if (disposed) return;
            try
            {
                var nextFullscreen = shellFullscreen || ForegroundCoversPrimary();
                if (nextFullscreen != fullscreen)
                {
                    fullscreen = nextFullscreen;
                    if (fullscreen) { previewHoldUntil = 0; expanded = false; LeaveKeyboard(false); }
                    else if (mode != DockMode.Autohide) expanded = true;
                }
                if (available && mode == DockMode.Autohide && !fullscreen && !arrangingWindows)
                {
                    Point cursor;
                    if (GetCursorPos(out cursor))
                    {
                        var work = ReadPrimaryWorkArea();
                        var edge = new Rectangle(work.Left, work.Bottom - 3, work.Width, 4);
                        var inside = expanded && lastBounds.Contains(cursor);
                        if (edge.Contains(cursor) || inside || keyboard || Stopwatch.GetTimestamp() < previewHoldUntil)
                        {
                            expanded = true;
                            lastInside = Stopwatch.GetTimestamp();
                        }
                        else if (expanded && (Stopwatch.GetTimestamp() - lastInside) / (double)Stopwatch.Frequency >= .55)
                            expanded = false;
                    }
                }
                if (registered && !IsAppBarReady) QueueArrange();
                UpdateVisibility();
                Publish();
            }
            catch (Exception ex) { timer.Stop(); Failed?.Invoke(ex); }
        }

        private bool ForegroundCoversPrimary()
        {
            var hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero || GetAncestor(hwnd, 2) == Handle || IsIconic(hwnd)) return false;
            var name = new StringBuilder(128);
            GetClassName(hwnd, name, name.Capacity);
            var windowClass = name.ToString();
            if (windowClass == "Progman" || windowClass == "WorkerW" ||
                windowClass == "Shell_TrayWnd" || windowClass == "Shell_SecondaryTrayWnd") return false;
            // Ordinary captioned maximized software is not a fullscreen game.
            if ((ReadStyle(hwnd, -16).ToInt64() & 0x00C00000L) == 0x00C00000L) return false;
            Rect rect;
            if (DwmGetWindowAttribute(hwnd, 9, out rect, Marshal.SizeOf(typeof(Rect))) != 0 &&
                !GetWindowRect(hwnd, out rect)) return false;
            var screen = Screen.PrimaryScreen.Bounds;
            return rect.Left <= screen.Left + 1 && rect.Top <= screen.Top + 1 &&
                rect.Right >= screen.Right - 1 && rect.Bottom >= screen.Bottom - 1;
        }

        private void UpdateVisibility()
        {
            var next = started && available && !fullscreen && !arrangingWindows &&
                (mode != DockMode.Autohide || expanded);
            if (next == visible) return;
            visible = next;
            if (!visible) LeaveKeyboard(false);
            SetWindowPos(Handle, visible ? new IntPtr(-1) : new IntPtr(1), 0, 0, 0, 0,
                0x0013 | (visible ? 0x0040u : 0x0080u)); // noactivate, no move/size, show/hide
        }

        internal object Snapshot()
        {
            return new
            {
                role, started, available, mode = mode.ToString().ToLowerInvariant(), heightDip,
                dpi = GetDpiForWindow(Handle), visible, keyboard, fullscreen, appBarRegistered = registered, appBarReady = IsAppBarReady,
                hwnd = Handle.ToInt64().ToString(), foreground = GetForegroundWindow().ToInt64().ToString(),
                window = Describe(lastBounds), workArea = Describe(ReadPrimaryWorkArea()),
                originalWorkArea = Describe(beforeWorkArea), screen = Describe(Screen.PrimaryScreen.Bounds)
            };
        }

        private static object Describe(Rectangle rect)
        {
            return new { x = rect.X, y = rect.Y, width = rect.Width, height = rect.Height };
        }

        private void Publish()
        {
            if (disposed) return;
            var state = Snapshot();
            var text = Newtonsoft.Json.JsonConvert.SerializeObject(state);
            if (text == lastState) return;
            lastState = text;
            StateChanged?.Invoke(state);
        }

        protected override void WndProc(ref Message message)
        {
            if (disposed) { base.WndProc(ref message); return; }
            if ((uint)message.Msg == callbackMessage)
            {
                switch (message.WParam.ToInt32())
                {
                    case 1: QueueArrange(); break; // ABN_POSCHANGED
                    case 2: // ABN_FULLSCREENAPP
                        shellFullscreen = message.LParam != IntPtr.Zero;
                        Tick(null, EventArgs.Empty);
                        break;
                    case 3: // ABN_WINDOWARRANGE
                        arrangingWindows = message.LParam != IntPtr.Zero;
                        UpdateVisibility();
                        break;
                }
            }
            else if ((uint)message.Msg == explorerMessage)
            {
                registered = false;
                shellFullscreen = false;
                fullscreen = ForegroundCoversPrimary();
                lastBounds = Rectangle.Empty;
                owner.BeginInvoke((Action)(() =>
                {
                    if (disposed) return;
                    try { SetMode(mode); }
                    catch (Exception ex) { Failed?.Invoke(ex); }
                }));
            }
            else if (message.Msg == 0x0021 && !keyboard) // WM_MOUSEACTIVATE, still allow native click.
            {
                message.Result = new IntPtr(3); // MA_NOACTIVATE
                return;
            }
            else if (message.Msg == 0x0006) // WM_ACTIVATE
            {
                var active = (message.WParam.ToInt64() & 0xffff) != 0;
                if (!active) LeaveKeyboard(false);
                if (registered)
                {
                    var data = AppBarData();
                    data.Param = active ? new IntPtr(1) : IntPtr.Zero;
                    SHAppBarMessage(6, ref data);
                }
            }
            else if (message.Msg == 0x0047 && registered && !arranging) // WM_WINDOWPOSCHANGED
            {
                var data = AppBarData();
                SHAppBarMessage(9, ref data);
            }
            else if (message.Msg == 0x02E0 || message.Msg == 0x007E || message.Msg == 0x001A)
                QueueArrange(); // DPI, display, settings.
            base.WndProc(ref message);
        }

        private AppBar AppBarData()
        {
            return new AppBar { Size = (uint)Marshal.SizeOf(typeof(AppBar)), Hwnd = Handle };
        }

        private void Unregister()
        {
            if (!registered) return;
            var data = AppBarData();
            SHAppBarMessage(1, ref data);
            registered = false;
            lastBounds = Rectangle.Empty;
            shellFullscreen = false;
        }

        public void Dispose()
        {
            if (disposed) return;
            timer.Stop();
            timer.Dispose();
            LeaveKeyboard(true);
            Unregister(); // ABM_REMOVE before the HWND is destroyed.
            disposed = true;
            ReleaseHandle();
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Rect
        {
            internal int Left, Top, Right, Bottom;
            internal Rect(int left, int top, int right, int bottom)
            { Left = left; Top = top; Right = right; Bottom = bottom; }
            internal Rectangle Rectangle => System.Drawing.Rectangle.FromLTRB(Left, Top, Right, Bottom);
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct AppBar
        {
            internal uint Size;
            internal IntPtr Hwnd;
            internal uint Callback, Edge;
            internal Rect Rect;
            internal IntPtr Param;
        }

        // Read the current native work area, including immediately after ABM_REMOVE.
        // Screen.WorkingArea can still hold the preceding cached value.
        internal static Rectangle ReadPrimaryWorkArea()
        {
            var bounds = Screen.PrimaryScreen.Bounds;
            var monitor = MonitorFromPoint(new Point(bounds.Left + bounds.Width / 2, bounds.Top + bounds.Height / 2), 2);
            var info = new MonitorInfo { Size = (uint)Marshal.SizeOf(typeof(MonitorInfo)) };
            if (!GetMonitorInfo(monitor, ref info))
                throw new InvalidOperationException("Cannot read the primary monitor work area.");
            return info.Work.Rectangle;
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct MonitorInfo
        {
            internal uint Size;
            internal Rect Monitor, Work;
            internal uint Flags;
        }
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(Point point, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

        internal static int ExtendTransparentFrame(IntPtr hwnd)
        {
            var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
            return DwmExtendFrameIntoClientArea(hwnd, ref margins);
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct Margins { internal int Left, Right, Top, Bottom; }
        [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

        internal static void UsePerMonitorDpi() { SetThreadDpiAwarenessContext(new IntPtr(-4)); }
        private static IntPtr ReadStyle(IntPtr hwnd, int index)
        { return IntPtr.Size == 8 ? GetWindowLongPtr(hwnd, index) : new IntPtr(GetWindowLong(hwnd, index)); }
        private static void WriteStyle(IntPtr hwnd, int index, IntPtr value)
        {
            if (IntPtr.Size == 8) SetWindowLongPtr(hwnd, index, value);
            else SetWindowLong(hwnd, index, value.ToInt32());
        }
        [DllImport("shell32.dll")] private static extern UIntPtr SHAppBarMessage(uint message, ref AppBar data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern uint RegisterWindowMessage(string value);
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, uint attribute, out Rect rect, int size);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int count);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr hwnd, int index);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] private static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    }
}
