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
    public static Task<FusionActionWindow> Create(string title=Title)
    {
        var ready=new TaskCompletionSource<FusionActionWindow>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread=new Thread(()=>{
            try {
                using var form=new ProbeForm {Text=title,Width=320,Height=160,StartPosition=FormStartPosition.Manual,Left=60,Top=80};
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
    internal static async Task Click(IntPtr dock,Func<JsonElement?> observe,Action<string> mark=null,bool touch=false,int movePixels=0,bool multiple=false,bool mouseAway=false,Action held=null,bool right=false){
        JsonElement point=default;
        await Wait(()=>{var data=observe();if(data is null||!data.Value.TryGetProperty("target",out var p)||p.ValueKind!=JsonValueKind.Object)return false;point=p.Clone();return true;},"Owned task target not visible");
        if(!GetClientRect(dock,out var rect))throw new Exception("Dock client bounds unavailable");
        var origin=new Point();if(!ClientToScreen(dock,ref origin))throw new Exception("Dock origin unavailable");
        var x=origin.X+(int)Math.Round(point.GetProperty("x").GetDouble()*rect.Right/point.GetProperty("width").GetDouble());
        var y=origin.Y+(int)Math.Round(point.GetProperty("y").GetDouble()*rect.Bottom/point.GetProperty("height").GetDouble());
        SetCursorPos(x,y);await Task.Delay(150);
        await Wait(()=>{
            // A Desk change may resize the work area while this non-pressed
            // pointer is entering. Follow the owned Dock's current position,
            // and reveal it at its current bottom edge if it auto-hid.
            var data=observe();
            if(data is not null&&data.Value.GetProperty("enabled").GetBoolean()&&data.Value.GetProperty("phase").GetString()=="displayReady")return true;
            var currentOrigin=new Point();
            if(GetClientRect(dock,out var currentBounds)&&ClientToScreen(dock,ref currentOrigin)){
                var px=currentOrigin.X+(int)Math.Round(point.GetProperty("x").GetDouble()*currentBounds.Right/point.GetProperty("width").GetDouble());
                var py=IsWindowVisible(dock)?currentOrigin.Y+(int)Math.Round(point.GetProperty("y").GetDouble()*currentBounds.Bottom/point.GetProperty("height").GetDouble()):currentOrigin.Y+currentBounds.Bottom-1;
                SetCursorPos(px,py);
            }
            return false;
        },"Task input not ready after pointer entry");
        var fresh=observe();
        if(fresh is null||!fresh.Value.TryGetProperty("target",out var latest)||latest.ValueKind!=JsonValueKind.Object||
            Math.Abs(latest.GetProperty("x").GetDouble()-point.GetProperty("x").GetDouble())>1||
            Math.Abs(latest.GetProperty("y").GetDouble()-point.GetProperty("y").GetDouble())>1)
            throw new Exception("Owned task moved before click; no click sent");
        // Waiting for task readiness can include the one-time taskbar/work-area
        // relocation. Resolve the screen origin again before ownership checks.
        origin=new Point();
        if(!GetClientRect(dock,out rect)||!ClientToScreen(dock,ref origin))
            throw new Exception("Dock final bounds unavailable");
        x=origin.X+(int)Math.Round(latest.GetProperty("x").GetDouble()*rect.Right/latest.GetProperty("width").GetDouble());
        y=origin.Y+(int)Math.Round(latest.GetProperty("y").GetDouble()*rect.Bottom/latest.GetProperty("height").GetDouble());
        SetCursorPos(x,y);
        if(GetAncestor(WindowFromPoint(new Point{X=x,Y=y}),2)!=dock||GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0)
            throw new Exception($"Dock ownership or mouse idle check failed; no click sent: expected={dock.ToInt64()} actual={GetAncestor(WindowFromPoint(new Point{X=x,Y=y}),2).ToInt64()} point={x},{y} origin={origin.X},{origin.Y} size={rect.Right},{rect.Bottom} leftHeld={GetAsyncKeyState(1)<0} rightHeld={GetAsyncKeyState(2)<0}");
        if(touch){await TouchPathProbe.Tap(dock,x,y,mark,movePixels,multiple,mouseAway,held);await Task.Delay(350);Console.WriteLine("TOUCH DOM "+observe()?.GetRawText());return;}
        var down=new Input{Type=0,Mouse=new Mouse{Flags=right?8u:2u}};
        var up=new Input{Type=0,Mouse=new Mouse{Flags=right?16u:4u}};
        mark?.Invoke("beforeDown");
        if(SendInput(1,new[]{down},Marshal.SizeOf<Input>())!=1)throw new Exception("Mouse DOWN refused");
        try{await Task.Delay(90);held?.Invoke();}finally{if(SendInput(1,new[]{up},Marshal.SizeOf<Input>())!=1)throw new Exception("Mouse UP refused");mark?.Invoke("afterUp");}
    }
    public async Task Verify(IntPtr dock,Func<JsonElement?> observe,bool touch=false,bool competingRaw=false)
    {
        using var raw=competingRaw?TouchPathProbe.RegisterForegroundMouse(Handle):null;
        if(competingRaw){SetForegroundWindow(Handle);await Wait(()=>GetForegroundWindow()==Handle,"Owned raw-input window could not become foreground");}
        if(competingRaw){
            await Click(dock,observe,touch:touch);await Wait(()=>IsIconic(Handle),"Raw-input foreground owner prevented Dock minimize");
            Console.WriteLine("PASS Dock receives click while foreground app owns raw mouse input");
            await Task.Delay(650);
        }
        if(touch){
            var before=GetForegroundWindow();
            await Click(dock,observe,touch:true,movePixels:40);await Task.Delay(500);
            if(GetForegroundWindow()!=before)throw new Exception("Dragged touch unexpectedly activated a task");
            Console.WriteLine("PASS OS touch drag cancels without activating task");
            await Click(dock,observe,touch:true,multiple:true);await Task.Delay(500);
            if(GetForegroundWindow()!=before)throw new Exception("Two contacts unexpectedly activated a task" );
            Console.WriteLine("PASS two OS touch contacts cancel without activating task" );
            var menu=observe();
            if(menu?.TryGetProperty("menuBack",out var back)==true&&back.ValueKind==JsonValueKind.Object){
                JsonElement? ObserveBack(){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["menuBack"]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
                Console.WriteLine("Two-finger gesture opened task context menu; closing via actual Back button");
                await Click(dock,ObserveBack);
                await Wait(()=>observe()?.GetProperty("target").ValueKind==JsonValueKind.Object,"Task menu did not close after Back click");
                Console.WriteLine("PASS task menu Back restores icons after two-finger gesture");
            }
        }
        await Click(dock,observe,touch:touch,mouseAway:touch);await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Actual task click did not activate owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core activates owned test window");
        await Task.Delay(650);
        await Click(dock,observe,touch:touch);await Wait(()=>IsIconic(Handle),"Actual task click did not minimize owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core minimizes owned test window");
        await Task.Delay(650);
        await Click(dock,observe,touch:touch);await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Actual task click did not restore owned window");
        Console.WriteLine("PASS actual OS "+(touch?"injected touch":"mouse click")+" through Core restores owned test window");
        if(touch){await Click(dock,observe);await Wait(()=>IsIconic(Handle),"Mouse click after touch was lost" );Console.WriteLine("PASS immediate mouse click after touch minimizes task" );}
    }
    internal async Task VerifyWindowMenu(IntPtr dock,Func<JsonElement?> observe,FusionActionWindow second)
    {
        await Wait(()=>observe()?.TryGetProperty("targetWindowCount",out var count)==true&&count.GetInt32()==2,"Two owned windows were not grouped into one task");
        var foreground=GetForegroundWindow();
        await Click(dock,observe);
        await Wait(()=>observe()?.TryGetProperty("menuSecond",out var value)==true&&value.ValueKind==JsonValueKind.Object,"Task click did not open actual window list: "+observe()?.GetRawText());
        if(GetForegroundWindow()!=foreground)throw new Exception("Opening window list unexpectedly activated an app");
        JsonElement? Choice(){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["menuSecond"]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
        await Click(dock,Choice);
        await Wait(()=>GetForegroundWindow()==second.Handle&&!IsIconic(second.Handle),"Window choice did not activate the selected second window");
        Console.WriteLine("PASS actual task click opens grouped window list and choice activates exact second window");
        second.Dispose();
        await Wait(()=>observe()?.TryGetProperty("targetWindowCount",out var count)==true&&count.GetInt32()==1,"Closed second window remained in task projection");
        // Sibling close can asynchronously transfer foreground between threads.
        // Establish an explicit minimized state on this owned test Form first.
        form.Invoke(()=>form.WindowState=FormWindowState.Minimized);
        await Wait(()=>IsIconic(Handle)&&GetForegroundWindow()!=Handle,"Owned remaining window did not minimize before restore test");
        await Click(dock,observe);
        await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Remaining window did not restore after group shrank: "+observe()?.GetRawText());
        Console.WriteLine("PASS closing one grouped window refreshes task and remaining minimized window restores");
    }
    internal async Task VerifyNoDock(IntPtr dock,Func<JsonElement?> observe,Func<string> currentDesk)
    {
        JsonElement? Next(){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["navigation"]?["next"]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
        await Click(dock,Next);
        await Wait(()=>currentDesk()=="focus"&&observe()?.GetProperty("navigation").GetProperty("transition").ValueKind==JsonValueKind.Null,"Next did not settle on focus before no-Dock test");
        string stableTarget=null;var stableSince=DateTime.UtcNow;
        await Wait(()=>{
            var v=observe();if(v is null||!v.Value.GetProperty("enabled").GetBoolean())return false;
            var current=v.Value.GetProperty("target");if(current.ValueKind!=JsonValueKind.Object)return false;
            var key=current.GetRawText();if(key!=stableTarget){stableTarget=key;stableSince=DateTime.UtcNow;}
            return DateTime.UtcNow-stableSince>=TimeSpan.FromMilliseconds(300);
        },"Task layout did not settle after entering focus");
        await Click(dock,observe,right:true);
        await Wait(()=>observe()?.GetProperty("menuPin").ValueKind==JsonValueKind.Object,"Task menu did not open before leaving Dock Desk");
        await Click(dock,Next);
        await Wait(()=>currentDesk()=="quiet","Author next did not enter no-Dock Desk");
        await Wait(()=>!IsWindow(dock),"Old Dock window remained on no-Dock Desk");
        await Wait(()=>NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null)),"Windows taskbar did not recover on no-Dock Desk");
        Console.WriteLine("PASS actual navigation to no-Dock Desk closes native Dock/menu and restores Windows taskbar");
    }
    internal async Task VerifyFullscreen(IntPtr dock,Func<JsonElement?> observe)
    {
        var foreground=GetForegroundWindow();
        await Click(dock,observe,right:true);
        await Wait(()=>observe()?.GetProperty("menuPin").ValueKind==JsonValueKind.Object,"Pin menu did not open before fullscreen");
        var previousBounds=System.Drawing.Rectangle.Empty;
        var previousBorder=FormBorderStyle.Sizable;
        try {
            form.Invoke(()=>{previousBounds=form.Bounds;previousBorder=form.FormBorderStyle;form.FormBorderStyle=FormBorderStyle.None;form.Bounds=Screen.FromHandle(dock).Bounds;});
            SetForegroundWindow(Handle);
            await Wait(()=>GetForegroundWindow()==Handle,"Owned fullscreen window did not become foreground");
            await Wait(()=>!IsWindowVisible(dock),"Dock remained visible over owned fullscreen window");
            await Wait(()=>observe()?.GetProperty("menuBack").ValueKind==JsonValueKind.Null,"Task menu survived fullscreen hiding");
            Console.WriteLine("PASS owned fullscreen hides native Dock and clears open task menu");
        } finally {
            form.Invoke(()=>{form.FormBorderStyle=previousBorder;if(!previousBounds.IsEmpty)form.Bounds=previousBounds;});
            SetForegroundWindow(foreground);
        }
        await Wait(()=>{
            var origin=new Point();
            if(GetClientRect(dock,out var rect)&&ClientToScreen(dock,ref origin))SetCursorPos(origin.X+rect.Right/2,origin.Y+rect.Bottom-1);
            return IsWindowVisible(dock)&&observe()?.GetProperty("enabled").GetBoolean()==true;
        },"Dock did not recover after leaving fullscreen");
        if(observe()?.GetProperty("menuBack").ValueKind!=JsonValueKind.Null)throw new Exception("Old menu reappeared after fullscreen");
        Console.WriteLine("PASS leaving fullscreen restores usable Dock without stale menu");
    }
    internal async Task VerifyClosedTarget(IntPtr dock,Func<JsonElement?> observe)
    {
        var foreground=GetForegroundWindow();
        if(foreground==Handle)throw new Exception("Close cancellation requires owned target not in foreground");
        var elapsed=System.Diagnostics.Stopwatch.StartNew();
        await Click(dock,observe,mark:edge=>{if(edge=="beforeDown")elapsed.Restart();},held:()=>{
            Dispose();
            if(IsWindow(Handle))throw new Exception("Owned window did not close while mouse held");
            if(elapsed.ElapsedMilliseconds>=1000)throw new Exception("Close took too long to distinguish cancellation from gesture expiry");
            Console.WriteLine("Owned window closed while mouse held after "+elapsed.ElapsedMilliseconds+"ms");
        });
        await Wait(()=>observe()?.GetProperty("target").ValueKind==JsonValueKind.Null,"Closed task remained in projection");
        await Task.Delay(500);
        if(GetForegroundWindow()!=foreground||IsWindow(Handle))throw new Exception("Release after closing target changed foreground or revived target");
        Console.WriteLine("PASS actual mouse release after target closes neither activates another app nor revives the closed task");
    }
    [DllImport("user32.dll")]private static extern bool IsWindow(IntPtr window);
    internal async Task VerifyNavigation(IntPtr dock,Func<JsonElement?> observe)
    {
        JsonElement? NavigationButton(string button){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["navigation"]?[button]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
        bool At(string desk){var v=observe();return v?.GetProperty("navigation").GetProperty("desk").GetString()==desk&&v?.GetProperty("navigation").GetProperty("transition").ValueKind==JsonValueKind.Null;}
        await Wait(()=>At("home"),"Fusion navigation must start at home");
        var foreground=GetForegroundWindow();
        var homeWidth=observe().Value.GetProperty("navigation").GetProperty("rowWidth").GetDouble();
        await Click(dock,()=>NavigationButton("next"));
        try{await Wait(()=>At("focus"),"Author next did not settle on focus");}
        catch{Console.WriteLine("NAVIGATION OBSERVATION "+observe()?.GetRawText());throw;}
        await Task.Delay(700);
        if(!At("focus")||GetForegroundWindow()!=foreground)throw new Exception("Author next double-triggered or activated an application");
        var nav=observe().Value.GetProperty("navigation");
        if(nav.GetProperty("rowWidth").GetDouble()>=homeWidth||nav.GetProperty("scrollWidth").GetDouble()<=nav.GetProperty("rowWidth").GetDouble())throw new Exception("Focus did not create an overflowing narrow task area");
        Console.WriteLine("PASS actual author next enters focus once and narrows task area without activating an app");
        var row=nav.GetProperty("row");
        if(!GetClientRect(dock,out var bounds))throw new Exception("Dock scroll bounds unavailable");
        var origin=new Point();if(!ClientToScreen(dock,ref origin))throw new Exception("Dock scroll origin unavailable");
        var x=origin.X+(int)Math.Round(row.GetProperty("x").GetDouble()*bounds.Right/row.GetProperty("width").GetDouble());
        var y=origin.Y+(int)Math.Round(row.GetProperty("y").GetDouble()*bounds.Bottom/row.GetProperty("height").GetDouble());
        SetCursorPos(x,y);await Task.Delay(150);
        if(GetAncestor(WindowFromPoint(new Point{X=x,Y=y}),2)!=dock||GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0)throw new Exception("Scroll target not owned or mouse held; no wheel sent");
        var beforeScroll=nav.GetProperty("scrollLeft").GetDouble();
        var wheel=new Input{Type=0,Mouse=new Mouse{Flags=0x1000,Data=120}};
        if(SendInput(1,new[]{wheel},Marshal.SizeOf<Input>())!=1)throw new Exception("Horizontal wheel refused");
        await Wait(()=>observe()?.GetProperty("navigation").GetProperty("scrollLeft").GetDouble()>beforeScroll,"Actual horizontal wheel did not scroll narrow task area");
        await Task.Delay(300);
        if(!At("focus")||GetForegroundWindow()!=foreground)throw new Exception("Scrolling changed Desk or activated app");
        Console.WriteLine("PASS actual horizontal wheel scrolls narrow task area without navigation or app activation");
        if(observe()?.GetProperty("targetVisible").GetBoolean()!=true)throw new Exception("Owned application clipped after scrolling; no application click sent");
        await Verify(dock,observe);
        if(!At("focus"))throw new Exception("Narrow task activation triggered authored navigation");
        Console.WriteLine("PASS scrolled narrow task activates/minimizes/restores only owned application");
        SetForegroundWindow(foreground);
        await Click(dock,()=>NavigationButton("previous"));
        await Wait(()=>At("home"),"Author previous did not settle on home");
        await Task.Delay(700);
        if(!At("home")||GetForegroundWindow()!=foreground)throw new Exception("Author previous double-triggered or activated an application");
        Console.WriteLine("PASS actual author previous returns home once without activating an app");
    }
    internal async Task VerifyPinMenu(IntPtr dock,Func<JsonElement?> observe)
    {
        var original=observe()?.GetProperty("targetPinned").GetBoolean();
        if(original!=false)throw new Exception("Owned test app already pinned; no pin change performed");
        JsonElement? PinButton(){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["menuPin"]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
        foreach(var expected in new[]{true,false}){
            await Click(dock,observe,right:true);
            try { await Wait(()=>observe()?.TryGetProperty("menuPin",out var value)==true&&value.ValueKind==JsonValueKind.Object,"Right click did not open pin menu"); }
            catch { Console.WriteLine("PIN MENU OBSERVATION "+observe()?.GetRawText()); throw; }
            await Click(dock,PinButton);
            await Wait(()=>observe()?.GetProperty("targetPinned").GetBoolean()==expected&&observe()?.GetProperty("target").ValueKind==JsonValueKind.Object,"Pin menu action did not update pin state and close menu");
            Console.WriteLine("PASS actual context menu "+(expected?"pins":"unpins")+" owned app and restores task row");
        }
    }
    internal async Task VerifyKeyboard(IntPtr dock,Func<JsonElement?> observe)
    {
        JsonElement? KeyboardButton(){var v=observe();if(v is null)return null;var n=System.Text.Json.Nodes.JsonNode.Parse(v.Value.GetRawText());n["target"]=n["keyboardButton"]?.DeepClone();return JsonSerializer.SerializeToElement(n);}
        await Click(dock,KeyboardButton);
        await Wait(()=>GetAncestor(GetForegroundWindow(),2)==dock,"Official keyboard button did not activate Dock");
        Console.WriteLine("PASS actual keyboard entry button activates Dock");
        async Task Key(ushort key){
            if(GetAncestor(GetForegroundWindow(),2)!=dock)throw new Exception("Dock lost keyboard ownership; no key sent");
            var down=new Input{Type=1,Keyboard=new Keyboard{Key=key}};
            var up=new Input{Type=1,Keyboard=new Keyboard{Key=key,Flags=2}};
            if(SendInput(1,new[]{down},Marshal.SizeOf<Input>())!=1)throw new Exception("Key DOWN refused");
            try{await Task.Delay(60);}finally{if(SendInput(1,new[]{up},Marshal.SizeOf<Input>())!=1)throw new Exception("Key UP refused");}
            await Task.Delay(200);
        }
        var focused=false;
        for(int i=0;i<40;i++){
            await Key(9);
            Console.WriteLine("TAB "+i+" "+observe()?.GetRawText());
            if(observe()?.TryGetProperty("targetFocused",out var value)==true&&value.GetBoolean()){focused=true;break;}
        }
        if(!focused)throw new Exception("Tab did not reach owned task in bounded navigation");
        await Key(13);
        await Wait(()=>GetForegroundWindow()==Handle&&!IsIconic(Handle),"Keyboard Enter did not activate owned task");
        Console.WriteLine("PASS real Tab and Enter through Core activate owned task");
    }
    internal async Task VerifyDisabledContact(IntPtr dock,Func<JsonElement?> observe,Action disableDock)
    {
        if(!IsIconic(Handle))throw new Exception("Cancellation test requires minimized owned target");
        var foreground=GetForegroundWindow();
        var elapsed=System.Diagnostics.Stopwatch.StartNew();
        await Click(dock,observe,touch:true,held:()=>{
            elapsed.Restart();
            disableDock();
            while(IsWindowVisible(dock)&&elapsed.ElapsedMilliseconds<1000)Thread.Sleep(10);
            if(IsWindowVisible(dock))throw new Exception("Dock did not hide during held contact");
            if(elapsed.ElapsedMilliseconds>=1000)throw new Exception("Disable was too slow to distinguish cancellation from gesture expiry");
            Console.WriteLine("Dock hidden during contact after "+elapsed.ElapsedMilliseconds+"ms");
        });
        await Task.Delay(500);
        if(!IsIconic(Handle)||GetForegroundWindow()!=foreground)throw new Exception("Released contact activated task after Dock disabled");
        Console.WriteLine("PASS disabling Dock during OS touch cancels old task activation");
    }
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr window);
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)]private struct Keyboard{public ushort Key,Scan;public uint Flags,Time;public UIntPtr Extra;}
    [StructLayout(LayoutKind.Sequential)]private struct Mouse{public int X,Y;public uint Data,Flags,Time;public UIntPtr Extra;}
    [StructLayout(LayoutKind.Explicit)]private struct Input{[FieldOffset(0)]public uint Type;[FieldOffset(8)]public Mouse Mouse;[FieldOffset(8)]public Keyboard Keyboard;}
    [DllImport("user32.dll")]private static extern bool GetClientRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")]private static extern bool ClientToScreen(IntPtr window,ref Point point);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")]private static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")]private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll",SetLastError=true)]private static extern uint SendInput(uint count,Input[] inputs,int size);
}
