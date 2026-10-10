using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;

// A single owned window: the test never chooses an existing user application.
internal sealed class FusionActionWindow : IDisposable
{
    internal const string Title="Dext Fusion Action Probe";
    private readonly Form form;
    internal IntPtr Handle {get;}
    private readonly TaskCompletionSource closed=new(TaskCreationOptions.RunContinuationsAsynchronously);
    internal Task Closed=>closed.Task;
    private FusionActionWindow(Form value){form=value;Handle=value.Handle;value.FormClosed+=(_,_)=>closed.TrySetResult();}
    private sealed class ProbeForm : Form {protected override bool ShowWithoutActivation=>true;}
    public static Task<FusionActionWindow> Create()
    {
        var ready=new TaskCompletionSource<FusionActionWindow>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread=new Thread(()=>{
            try {
                using var form=new ProbeForm {Text=Title,Width=320,Height=160,StartPosition=FormStartPosition.Manual,Left=60,Top=80};
                form.Shown+=(_,_)=>ready.TrySetResult(new FusionActionWindow(form));
                Application.Run(form);
            } catch(Exception ex){ready.TrySetException(ex);}
        }){IsBackground=true,Name="Owned Dock action test window"};
        thread.SetApartmentState(ApartmentState.STA);thread.Start();return ready.Task;
    }
    public void Dispose(){if(!form.IsDisposed)form.Invoke(()=>form.Close());}
    internal static async Task Wait(Func<bool> condition,string description,int seconds=8){
        var end=DateTime.UtcNow.AddSeconds(seconds);
        while(DateTime.UtcNow<end){if(condition())return;await Task.Delay(100);}
        throw new Exception(description);
    }
    internal static async Task Click(IntPtr dock,Func<JsonElement?> observe,Action<string> mark=null,bool touch=false){
        JsonElement point=default;
        await Wait(()=>{var data=observe();if(data is null||!data.Value.TryGetProperty("target",out var p)||p.ValueKind!=JsonValueKind.Object)return false;point=p.Clone();return true;},"Owned task target not visible");
        if(!GetClientRect(dock,out var rect))throw new Exception("Dock client bounds unavailable");
        var origin=new Point();if(!ClientToScreen(dock,ref origin))throw new Exception("Dock origin unavailable");
        var x=origin.X+(int)Math.Round(point.GetProperty("x").GetDouble()*rect.Right/point.GetProperty("width").GetDouble());
        var y=origin.Y+(int)Math.Round(point.GetProperty("y").GetDouble()*rect.Bottom/point.GetProperty("height").GetDouble());
        SetCursorPos(x,y);await Task.Delay(150);
        await Wait(()=>{var data=observe();return data is not null&&data.Value.GetProperty("enabled").GetBoolean()&&data.Value.GetProperty("phase").GetString()=="displayReady";},"Task input not ready after pointer entry");
        var fresh=observe();
        if(fresh is null||!fresh.Value.TryGetProperty("target",out var latest)||latest.ValueKind!=JsonValueKind.Object||
            Math.Abs(latest.GetProperty("x").GetDouble()-point.GetProperty("x").GetDouble())>1||
            Math.Abs(latest.GetProperty("y").GetDouble()-point.GetProperty("y").GetDouble())>1)
            throw new Exception("Owned task moved before click; no click sent");
        if(GetAncestor(WindowFromPoint(new Point{X=x,Y=y}),2)!=dock||GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0)
            throw new Exception("Dock ownership or mouse idle check failed; no click sent");
        if(touch){await TouchPathProbe.Tap(dock,x,y,mark);return;}
        var down=new Input{Type=0,Mouse=new Mouse{Flags=2}};
        var up=new Input{Type=0,Mouse=new Mouse{Flags=4}};
        mark?.Invoke("beforeDown");
        if(SendInput(1,new[]{down},Marshal.SizeOf<Input>())!=1)throw new Exception("Mouse DOWN refused");
        try{await Task.Delay(90);}finally{if(SendInput(1,new[]{up},Marshal.SizeOf<Input>())!=1)throw new Exception("Mouse UP refused");mark?.Invoke("afterUp");}
    }
    public async Task Verify(IntPtr dock,Func<JsonElement?> observe,bool touch=false)
    {
        await Click(dock,observe,touch:touch);await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Actual task click did not activate owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core activates owned test window");
        await Task.Delay(650);
        await Click(dock,observe,touch:touch);await Wait(()=>IsIconic(Handle),"Actual task click did not minimize owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core minimizes owned test window");
        await Task.Delay(650);
        await Click(dock,observe,touch:touch);await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Actual task click did not restore owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core restores owned test window");
    }
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)]private struct Mouse{public int X,Y;public uint Data,Flags,Time;public UIntPtr Extra;}
    [StructLayout(LayoutKind.Explicit)]private struct Input{[FieldOffset(0)]public uint Type;[FieldOffset(8)]public Mouse Mouse;}
    [DllImport("user32.dll")]private static extern bool GetClientRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")]private static extern bool ClientToScreen(IntPtr window,ref Point point);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")]private static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll",SetLastError=true)]private static extern uint SendInput(uint count,Input[] inputs,int size);
}
