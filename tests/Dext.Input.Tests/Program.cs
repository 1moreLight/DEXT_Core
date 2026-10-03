using System.Runtime.InteropServices;
using Lively.Common.Helpers;

if (args.Length == 8 && args[0] == "--v3-native-lifecycle-live") { await NativeCoreLiveProbe.Run(args[1],args[2],args[3],args[4],args[5],args[6],authoredNavigation:true,lifecycleMedia:args[7]); return; }

if (args.Length == 7 && args[0] == "--v3-native-recovery-live") { await NativeCoreLiveProbe.Run(args[1],args[2],args[3],args[4],args[5],args[6],authoredNavigation:true,playerRecovery:true); return; }

if (args.Length == 8 && args[0] == "--v3-native-exit-live") { await NativeCoreLiveProbe.Run(args[1],args[2],args[3],args[4],args[5],args[6],true,false,true,args[7]); return; }

if (args.Length == 7 && args[0] == "--v3-native-controls-live") { await NativeCoreLiveProbe.Run(args[1], args[2], args[3], args[4], args[5], args[6], false, true); return; }
if (args.Length == 7 && args[0] == "--v3-native-navigation-live") { await NativeCoreLiveProbe.Run(args[1], args[2], args[3], args[4], args[5], args[6], true); return; }
if (args.Length == 7 && args[0] == "--v3-native-core-live") { await NativeCoreLiveProbe.Run(args[1], args[2], args[3], args[4], args[5], args[6]); return; }

if (args.Length == 1 && args[0] == "--v3-idle-window") { NativeIdleWindowChecks.Run(); return; }

if (args.Length == 2 && args[0] == "--v3-input-wire") { await NativeInputWireProbe.Run(args[1]); return; }

if (args.Length == 1 && args[0] == "--v3-frame-media-messages") { NativeFrameMediaMessageChecks.Run(); return; }

if (args.Length == 1 && args[0] == "--v3-input-request-join") { NativeInputRequestJoinChecks.Run(); return; }

if (args.Length == 1 && args[0] == "--v3-input-guardian-policy") { NativeInputGuardianPolicyChecks.Run(); return; }

if (args.Length == 2 && args[0] == "--v3-pointer-wire") { await NativePointerWireProbe.Run(args[1]); return; }

if (args.Length == 1 && args[0] == "--v3-pointer-delivery") { await NativePointerDeliveryChecks.Run(); return; }

if (args.Length == 1 && args[0] == "--v3-input-messages") { NativeInputMessageChecks.Run(); return; }

if (args.Length == 5 && args[0] == "--v3-frame-media-wire") { await NativeFrameMediaWireProbe.Run(args[1], args[2], args[3], args[4]); return; }

if (args.Length == 4 && args[0] == "--v3-official-host-wire") {
    await OfficialHostWireProbe.Run(args[1], args[2], args[3]);
    return;
}

if (args.Length == 7 && args[0] == "--v3-native-host-wire") {
    await FrameHostWireProbe.Run(args[1], args[2], args[3], args[4], args[5], args[6]);
    return;
}

if (args.Length == 6 && args[0] == "--v3-playback-wire") {
    await FrameHostWireProbe.Run(args[1], args[2], args[3], args[4], args[5]);
    return;
}

if (args.Length == 4 && args[0] == "--v3-frame-host-wire") {
    await FrameHostWireProbe.Run(args[1], args[2], args[3]);
    return;
}

if (args.Length == 4 && args[0] == "--v3-media-host-wire") {
    await ResourceWireProbe.Run(args[1], args[2], mediaHostFile: args[3]);
    return;
}

if (args.Length >= 3 && args[0] == "--v3-resources-reject")
{
    await ResourceWireProbe.Run(args[1], args[2], policyUnavailable: true);
    return;
}
if (args.Length == 1 && args[0] == "--workerw-p2a") {
    await WorkerWSceneProbe.Run();
    return;
}
if (args.Length == 1 && args[0] == "--v3-live") {
    await V3LiveProbe.Run();
    return;
}
if (args.Length == 2 && args[0] == "--v3-status") {
    await V3LiveProbe.CheckStatus(args[1]);
    return;
}

if (args.Length == 2 && args[0] == "--v3-wire") {
    await RoomSessionWireProbe.Run(args[1]);
    return;
}

if (args.Length == 2 && args[0] == "--v3-runtime-wire") {
    await RuntimeWireProbe.Run(args[1]);
    return;
}

if (args.Length == 1 && args[0] == "--v3-runtime-messages") {
    RuntimeMessageChecks.Run();
    return;
}

if (args.Length == 1 && args[0] == "--v3-resources") {
    ResourceBoundaryChecks.Run();
    return;
}

if (args.Length == 3 && args[0] == "--v3-resources-wire") {
    await ResourceWireProbe.Run(args[1],args[2]);
    return;
}

if (args.Length > 1 || (args.Length == 1 && args[0].StartsWith("--", StringComparison.Ordinal)))
    throw new ArgumentException("Unknown input probe mode or invalid argument count");

// A hidden native receiver checks the messages actually posted by production code.
// No browser automation can catch a wrong Win32 wParam before it reaches WebView2.
var window = Native.CreateWindowExW(0, "STATIC", "Dext input regression", 0x80000000,
    -300, -200, 1, 1, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
if (window == IntPtr.Zero) throw new Exception("Could not create hidden input receiver");
try
{
    var anchor=Native.CreateWindowExW(0,"STATIC","anchor",0x40000000,17,23,80,60,window,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
    var input=Native.CreateWindowExW(0,"STATIC","input",0x40000000,0,0,80,60,anchor,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
    try {
        var measured=DextNativeInputWindow.TryMeasure(window,anchor,input,Environment.ProcessId,out var rect,out var dpi);
        if(!measured || rect.X!= -283 || rect.Y!= -177 || rect.Width!=80 || rect.Height!=60 || dpi<=0)throw new Exception($"native child mapping failed: measured={measured}, rect={rect}, dpi={dpi}, anchor={anchor}, input={input}");
        if(DextNativeInputWindow.TryMeasure(window,anchor,input,Environment.ProcessId+1,out _,out _) || DextNativeInputWindow.TryMeasure(window,input,anchor,Environment.ProcessId,out _,out _))throw new Exception("foreign process/parent accepted");
        Native.SetWindowPos(input,IntPtr.Zero,1,0,80,60,0x14);
        if(DextNativeInputWindow.TryMeasure(window,anchor,input,Environment.ProcessId,out _,out _))throw new Exception("offset input viewport accepted");
        Native.SetWindowPos(input,IntPtr.Zero,0,0,79,60,0x14);
        if(DextNativeInputWindow.TryMeasure(window,anchor,input,Environment.ProcessId,out _,out _))throw new Exception("different input dimensions accepted");
        Console.WriteLine("PASS native window ownership, nested origin and dimension/offset rejection");
    }finally { Native.DestroyWindow(anchor); }
    // RI_KEY_BREAK is a bit, so E0 | BREAK must still be an UP.
    if(!InputUtil.RawKeyIsDown(0) || InputUtil.RawKeyIsDown(1) || InputUtil.RawKeyIsDown(3) || !InputUtil.RawKeyIsExtended(3) || InputUtil.RawKeyIsExtended(4))throw new Exception("Raw keyboard flags decoded incorrectly");
    foreach(var extended in new[]{false,true})
    foreach(var down in new[]{true,false})
    {
        var id=down?0x0100:0x0101;
        InputUtil.ForwardMessageKeyboard(window,id,(IntPtr)13,0x1c,down,extended);
        if(!Native.PeekMessageW(out var key,window,(uint)id,(uint)id,1))throw new Exception("Missing forwarded key");
        var packed=(uint)key.LParam.ToInt64();var expected=1u|(0x1cu<<16)|(extended?1u<<24:0)|(down?0:3u<<30);
        if(packed!=expected || key.WParam.ToUInt64()!=13)throw new Exception("Wrong extended/break bits");
    }
    Console.WriteLine("PASS raw keyboard BREAK/E0 and native key lParam flags");
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

if (args.Length == 1) {
    await WebViewProbe.Run(args[0]);
    await RoomReorderProbe.Run(args[0]);
    await ContinuousSceneProbe.Run(args[0]);
}

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
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool PeekMessageW(out Message message, IntPtr window, uint min, uint max, uint remove);
}
