using System.Runtime.InteropServices;
using System.Windows.Forms;

// Observes OS-injected touch only on this probe's own window. No Core or Player mutation.
internal static class TouchPathProbe
{
    public static Task Run()
    {
        var done=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread=new Thread(()=>{
            using var form=new ProbeForm {Text="Dext owned touch path probe",Width=280,Height=140,Left=80,Top=80,StartPosition=FormStartPosition.Manual};
            form.Shown+=async(_,_)=>{
                var foreground=GetForegroundWindow();GetCursorPos(out var cursor);
                bool registered=false,contact=false;
                TouchInfo touch=default;
                Exception failure=null;
                try {
                    var devices=new[]{new RawDevice{Page=1,Usage=2,Flags=0x100,Target=form.Handle}};
                    if(!RegisterRawInputDevices(devices,1,(uint)Marshal.SizeOf<RawDevice>()))throw new System.ComponentModel.Win32Exception();
                    registered=true;
                    if(!InitializeTouchInjection(1,3))throw new System.ComponentModel.Win32Exception();
                    await Task.Delay(150);
                    var p=form.PointToScreen(new System.Drawing.Point(100,60));
                    if(GetAncestor(WindowFromPoint(new Point{X=p.X,Y=p.Y}),2)!=form.Handle||GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0)
                        throw new Exception("Own touch target is covered or mouse is held; no touch sent");
                    touch=new TouchInfo{Pointer=new PointerInfo{Type=2,Id=0,Flags=0x10000|2|4,Pixel=new Point{X=p.X,Y=p.Y}},Mask=1,Contact=new Rect{Left=p.X-2,Top=p.Y-2,Right=p.X+2,Bottom=p.Y+2}};
                    Console.WriteLine($"Touch interop sizes pointer={Marshal.SizeOf<PointerInfo>()} touch={Marshal.SizeOf<TouchInfo>()}");
                    if(!InjectTouchInput(1,new[]{touch}))throw new System.ComponentModel.Win32Exception();
                    contact=true;
                    await Task.Delay(70);
                    touch.Pointer.Flags=0x40000;
                    if(!InjectTouchInput(1,new[]{touch}))throw new System.ComponentModel.Win32Exception();
                    contact=false;
                    await Task.Delay(500);
                    Console.WriteLine($"TOUCH PATH pointerDown={form.PointerDown} pointerUp={form.PointerUp} validPointerInfo={form.ValidInfo} mouseDown={form.MouseDownCount} mouseUp={form.MouseUpCount} rawMouseDown={form.RawDown} rawMouseUp={form.RawUp}");
                    if(form.PointerDown!=1||form.PointerUp!=1||form.ValidInfo!=2)throw new Exception("Owned window did not receive a verified OS pointer pair");
                    Console.WriteLine("PASS OS touch reached own window; counts describe routing only, not Dext touch acceptance");
                } catch(Exception ex){failure=ex;}
                finally {
                    if(contact){touch.Pointer.Flags=0x40000|0x8000;if(!InjectTouchInput(1,new[]{touch}))failure??=new Exception("Touch cancellation failed");}
                    if(registered&&!RegisterRawInputDevices(new[]{new RawDevice{Page=1,Usage=2,Flags=1}},1,(uint)Marshal.SizeOf<RawDevice>()))failure??=new Exception("Raw input unregister failed");
                    SetCursorPos(cursor.X,cursor.Y);SetForegroundWindow(foreground);
                    form.Close();
                    if(failure is null)done.TrySetResult();else done.TrySetException(failure);
                }
            };
            try{Application.Run(form);}catch(Exception ex){done.TrySetException(ex);}
        }){IsBackground=true};
        thread.SetApartmentState(ApartmentState.STA);thread.Start();return done.Task;
    }
    internal static IDisposable RegisterForegroundMouse(IntPtr owner)
    {
        if(!RegisterRawInputDevices(new[]{new RawDevice{Page=1,Usage=2,Target=owner}},1,(uint)Marshal.SizeOf<RawDevice>()))throw new System.ComponentModel.Win32Exception();
        return new RawClaim();
    }
    private sealed class RawClaim:IDisposable
    {
        public void Dispose(){if(!RegisterRawInputDevices(new[]{new RawDevice{Page=1,Usage=2,Flags=1}},1,(uint)Marshal.SizeOf<RawDevice>()))throw new System.ComponentModel.Win32Exception();}
    }
    internal static Task Tap(IntPtr ownedRoot,int x,int y,Action<string> mark=null,int movePixels=0)=>Task.Run(()=>{
        if(GetAncestor(WindowFromPoint(new Point{X=x,Y=y}),2)!=ownedRoot||GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0)
            throw new Exception("Touch destination changed; no contact sent");
        var hit=WindowFromPoint(new Point{X=x,Y=y});
        for(var window=hit;window!=IntPtr.Zero;window=GetParent(window)) {
            var name=new System.Text.StringBuilder(256);
            GetClassName(window,name,name.Capacity);
            var thread=GetWindowThreadProcessId(window,out var process);
            Console.WriteLine($"TOUCH TARGET hwnd={window.ToInt64()} class={name} pid={process} tid={thread} root={window==ownedRoot}");
            if(window==ownedRoot)break;
        }
        if(!InitializeTouchInjection(1,3))throw new System.ComponentModel.Win32Exception();
        var touch=new TouchInfo{Pointer=new PointerInfo{Type=2,Id=0,Flags=0x10000|2|4,Pixel=new Point{X=x,Y=y}},
            Mask=1,Contact=new Rect{Left=x-2,Top=y-2,Right=x+2,Bottom=y+2}};
        mark?.Invoke("beforeDown");
        if(!InjectTouchInput(1,new[]{touch}))throw new System.ComponentModel.Win32Exception();
        try{
            Thread.Sleep(30);
            if(movePixels!=0){
                touch.Pointer.Pixel.X+=movePixels;touch.Contact.Left+=movePixels;touch.Contact.Right+=movePixels;
                touch.Pointer.Flags=0x20000|2|4;
                if(!InjectTouchInput(1,new[]{touch}))throw new System.ComponentModel.Win32Exception();
            }
            Thread.Sleep(60);
        }
        finally{
            touch.Pointer.Flags=0x40000;
            if(!InjectTouchInput(1,new[]{touch})){
                touch.Pointer.Flags|=0x8000;
                InjectTouchInput(1,new[]{touch});
                throw new System.ComponentModel.Win32Exception();
            }
            mark?.Invoke("afterUp");
        }
    });
    private sealed class ProbeForm:Form
    {
        internal int PointerDown,PointerUp,ValidInfo,MouseDownCount,MouseUpCount,RawDown,RawUp;
        protected override bool ShowWithoutActivation=>true;
        protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x08000000;return p;}}
        protected override void WndProc(ref Message m)
        {
            if(m.Msg==0x246||m.Msg==0x247) {
                if(m.Msg==0x246)PointerDown++;else PointerUp++;
                if(GetPointerInfo((uint)(m.WParam.ToInt64()&0xffff),out var p)&&p.Type==2&&p.Target==Handle)ValidInfo++;
            }
            if(m.Msg==0x201)MouseDownCount++;
            if(m.Msg==0x202)MouseUpCount++;
            if(m.Msg==0xff) {
                uint size=0;uint header=(uint)(8+2*IntPtr.Size);
                if(GetRawInputData(m.LParam,0x10000003,IntPtr.Zero,ref size,header)==0&&size>=header+8) {
                    var data=Marshal.AllocHGlobal((int)size);
                    try{if(GetRawInputData(m.LParam,0x10000003,data,ref size,header)==size&&Marshal.ReadInt32(data)==0){var flags=Marshal.ReadInt16(data,(int)header+4);if((flags&1)!=0)RawDown++;if((flags&2)!=0)RawUp++;}}
                    finally{Marshal.FreeHGlobal(data);}
                }
            }
            base.WndProc(ref m);
        }
    }
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)]private struct PointerInfo{
        public uint Type,Id,Frame,Flags;public IntPtr Device,Target;
        public Point Pixel,Himetric,PixelRaw,HimetricRaw;public uint Time,History;public int Data;public uint KeyStates;public ulong Performance;public uint Change;
    }
    [StructLayout(LayoutKind.Sequential)]private struct TouchInfo{public PointerInfo Pointer;public uint Flags,Mask;public Rect Contact,ContactRaw;public uint Orientation,Pressure;}
    [StructLayout(LayoutKind.Sequential)]private struct RawDevice{public ushort Page,Usage;public uint Flags;public IntPtr Target;}
    [DllImport("user32.dll",SetLastError=true)]private static extern bool InitializeTouchInjection(uint count,uint mode);
    [DllImport("user32.dll",SetLastError=true)]private static extern bool InjectTouchInput(uint count,TouchInfo[] contacts);
    [DllImport("user32.dll",SetLastError=true)]private static extern bool GetPointerInfo(uint id,out PointerInfo info);
    [DllImport("user32.dll",SetLastError=true)]private static extern bool RegisterRawInputDevices(RawDevice[] devices,uint count,uint size);
    [DllImport("user32.dll",SetLastError=true)]private static extern uint GetRawInputData(IntPtr input,uint command,IntPtr data,ref uint size,uint headerSize);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")]private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")]private static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetClassName(IntPtr window,System.Text.StringBuilder name,int size);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
    [DllImport("user32.dll")]private static extern IntPtr GetAncestor(IntPtr window,uint flags);
}
