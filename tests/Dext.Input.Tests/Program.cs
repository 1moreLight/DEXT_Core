using System.Runtime.InteropServices;
using Lively.Common.Helpers;

// A hidden native receiver checks the messages actually posted by production code.
// No browser automation can catch a wrong Win32 wParam before it reaches WebView2.
var window = Native.CreateWindowExW(0, "STATIC", "Dext input regression", 0,
    0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
if (window == IntPtr.Zero) throw new Exception("Could not create hidden input receiver");
try
{
    InputUtil.MouseMove(window, 12, 23);
    CheckMessage(0x0200, 0, 12, 23);
    InputUtil.MouseLeftButtonDown(window, 12, 23);
    CheckMessage(0x0201, 1, 12, 23);
    InputUtil.MouseLeftButtonUp(window, 12, 23);
    CheckMessage(0x0202, 0, 12, 23);
    InputUtil.MouseRightButtonUp(window, 12, 23);
    CheckMessage(0x0205, 0, 12, 23);
    Console.WriteLine("PASS native hover/down/up button flags");

    var session = new MouseForwardingSession(InputUtil.ForwardMessageMouse);
    var source = new[] { new MouseForwardingSession.Target(window, 100, 200) };
    session.Begin(source, 112, 223, 0);
    CheckMessage(0x0201, 1, 12, 23);
    session.Begin(source, 112, 223, 0);
    if (Native.PeekMessageW(out _, window, 0x0201, 0x0201, 1))
        throw new Exception("Duplicate DOWN was forwarded");
    session.Move(130, 240, 0);
    CheckMessage(0x0200, 1, 30, 40);
    session.Move(90, 180, 0x2c); // cross source display; never forward fake X1
    CheckMessage(0x0200, 0x0d, -10, -20);
    session.End(80, 170, 0x04); // release to the same receiver outside the source bounds
    CheckMessage(0x0202, 0x04, -20, -30);
    if (session.IsActive) throw new Exception("Gesture was not cleared");
    session.End(80, 170, 0);
    session.Move(90, 180, 0);
    if (Native.PeekMessageW(out _, window, 0x0200, 0x0202, 1))
        throw new Exception("Completed gesture forwarded late input");
    Console.WriteLine("PASS held-button movement, signed coordinates, modifiers, duplicate/late events");

    var delivered = new List<IntPtr>();
    var routing = new MouseForwardingSession((handle, x, y, message, flags) => delivered.Add(handle));
    routing.Begin(new[] { new MouseForwardingSession.Target((IntPtr)11, 0, 0),
        new MouseForwardingSession.Target((IntPtr)12, -1920, 0),
        new MouseForwardingSession.Target(IntPtr.Zero, 0, 0) }, 100, 100, 0);
    routing.Move(2500, 100, 0);
    routing.End(2500, 100, 0);
    if (!delivered.SequenceEqual(new IntPtr[] { (IntPtr)11, (IntPtr)12, (IntPtr)11, (IntPtr)12, (IntPtr)11, (IntPtr)12 }))
        throw new Exception("Gesture recipients changed after DOWN");
    Console.WriteLine("PASS stable recipients across monitor/focus changes and zero HWND rejection");
}
finally { Native.DestroyWindow(window); }

if (args.Length == 1) await WebViewProbe.Run(args[0]);

void CheckMessage(uint expectedMessage, uint flags, short x, short y)
{
    if (!Native.PeekMessageW(out var message, window, expectedMessage, expectedMessage, 1))
        throw new Exception($"Missing message {expectedMessage:X}");
    if (message.WParam.ToUInt64() != flags)
        throw new Exception($"WM_{expectedMessage:X}: expected buttons {flags:X}, got {message.WParam.ToUInt64():X}");
    var packed = message.LParam.ToInt64();
    if (unchecked((short)packed) != x || unchecked((short)(packed >> 16)) != y)
        throw new Exception("Incorrect signed client coordinates");
}

static class Native
{
    [StructLayout(LayoutKind.Sequential)] public struct Message
    {
        public IntPtr HWnd;
        public uint Id;
        public UIntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public int X, Y;
        public uint Private;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateWindowExW(uint extendedStyle, string className, string title,
        uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool PeekMessageW(out Message message, IntPtr window, uint min, uint max, uint remove);
}
