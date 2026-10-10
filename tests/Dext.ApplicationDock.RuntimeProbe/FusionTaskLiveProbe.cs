using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

// The title observer is installed only in an isolated development candidate.
internal static class FusionTaskLiveProbe
{
    public static async Task Run(DesktopService.DesktopServiceClient client, bool actions=false,bool launch=false,bool touch=false,bool competingRaw=false,bool keyboard=false,bool menu=false,bool startup=false,bool restoreTaskbar=false,bool pinMenu=false,bool navigation=false)
    {
        JsonElement App()=>JsonDocument.Parse(client.GetApplicationDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        JsonElement Theme()=>JsonDocument.Parse(client.GetRoomDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        void Enable(bool enabled)=>client.EditApplicationDock(new(){PatchJson=JsonSerializer.Serialize(new{operation="enable",enabled})},deadline:DateTime.UtcNow.AddSeconds(5));
        void Settings(object patch)=>client.SetRoomDockPreference(new(){PatchJson=JsonSerializer.Serialize(patch)},deadline:DateTime.UtcNow.AddSeconds(5));
        var beforeApp=App().GetProperty("enabled").GetBoolean();
        var beforeTaskbar=App().GetProperty("taskbar").GetProperty("mode").GetString();
        void Taskbar(string mode)=>client.EditApplicationDock(new(){PatchJson=JsonSerializer.Serialize(new{operation="taskbar",mode})},deadline:DateTime.UtcNow.AddSeconds(5));
        var beforeTheme=Theme().GetProperty("preferences").Clone();
        if(!GetCursorPos(out var cursor))throw new Exception("Cannot preserve cursor");
        var foreground=GetForegroundWindow();
        using var target=actions?await FusionActionWindow.Create():null;
        using var second=menu?await FusionActionWindow.Create("Dext Fusion Second Probe"):null;
        var launcher=launch?new FusionLaunchProbe(client):null;
        string last="waiting";
        try
        {
            if(navigation){
                var session=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
                var reply=client.EditRoomPersonal(new(){RoomId=session.RoomId,InstallationStamp=session.InstallationStamp,EditJson="{\"operation\":\"enableNavigation\"}"},deadline:DateTime.UtcNow.AddSeconds(5));
                using var enabled=JsonDocument.Parse(reply.ReplyJson);
                if(enabled.RootElement.GetProperty("status").GetString()!="accepted")throw new Exception("Fixture navigation grant failed: "+reply.ReplyJson);
            }
            Enable(false);Settings(new{enabled=true,mode="autohide",heightDip=96});
            var until=DateTime.UtcNow.AddSeconds(40);
            string stableWindow=null;DateTime stableSince=DateTime.UtcNow;
            while(DateTime.UtcNow<until)
            {
                var runtime=Theme().GetProperty("runtime");
                var pid=runtime.GetProperty("playerPid").GetInt32();
                IntPtr window=IntPtr.Zero;string title="";
                EnumWindows((h,_)=>{
                    GetWindowThreadProcessId(h,out var owner);
                    if(owner!=(uint)pid||pid<=0)return true;
                    var text=new StringBuilder(4096);GetWindowText(h,text,text.Capacity);
                    if(text.ToString().StartsWith("DEXT_FUSION_PROBE:")){window=h;title=text.ToString();return false;}
                    return true;
                },IntPtr.Zero);
                last=title.Length>0?title:runtime.GetRawText();
                if(window!=IntPtr.Zero&&GetWindowRect(window,out var rect))
                {
                    SetCursorPos((rect.Left+rect.Right)/2,rect.Bottom-1);
                    // Page diagnostics update asynchronously. A first ready title
                    // may precede taskbar handoff and a native work-area move.
                    var key=$"{window}/{rect.Left}/{rect.Top}/{rect.Right}/{rect.Bottom}/{runtime.GetProperty("phase").GetString()}/{runtime.GetProperty("taskbarReplacementReady").GetBoolean()}";
                    if(key!=stableWindow){stableWindow=key;stableSince=DateTime.UtcNow;}
                    using var doc=JsonDocument.Parse(title[18..]);
                    var value=doc.RootElement;
                    if((startup||runtime.GetProperty("phase").GetString()=="running"&&runtime.GetProperty("taskbarReplacementReady").GetBoolean()&&DateTime.UtcNow-stableSince>=TimeSpan.FromMilliseconds(750))&&
                        value.GetProperty("phase").GetString()=="displayReady"&&value.GetProperty("enabled").GetBoolean()&&value.GetProperty("count").GetInt32()>0)
                    {
                        if(GetForegroundWindow()!=foreground)throw new Exception("Probe unexpectedly changed foreground");
                        Console.WriteLine("PASS real Core task projection reaches actual Player, geometry ready and actions enabled; items="+value.GetProperty("count")+", PID="+pid);
                        JsonElement? Observe(){
                            var text=new StringBuilder(4096);GetWindowText(window,text,text.Capacity);
                            var title=text.ToString();return title.StartsWith("DEXT_FUSION_PROBE:")?JsonDocument.Parse(title[18..]).RootElement.Clone():(JsonElement?)null;
                        }
                        if(restoreTaskbar){
                            Taskbar("visible");
                            await FusionActionWindow.Wait(()=>{
                                if(GetWindowRect(window,out var restoredBounds))SetCursorPos((restoredBounds.Left+restoredBounds.Right)/2,restoredBounds.Bottom-1);
                                return NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null))&&
                                    !App().GetProperty("taskbar").GetProperty("hidden").GetBoolean()&&
                                    Theme().GetProperty("runtime").GetProperty("phase").GetString()=="running"&&
                                    Observe()?.GetProperty("enabled").GetBoolean()==true;
                            },"Restoring Windows taskbar did not leave official tasks usable");
                            Console.WriteLine("PASS actual Windows taskbar restored while theme Dock remains enabled");
                        }
                        if(target is not null){
                            if(navigation){
                                using var watch=new CancellationTokenSource();
                                GetWindowRect(window,out var initialBounds);
                                var changed=false;
                                var monitor=Task.Run(async()=>{
                                    while(!watch.IsCancellationRequested){
                                        if(NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null))||
                                            !GetWindowRect(window,out var currentBounds)||currentBounds.Top!=initialBounds.Top)changed=true;
                                        try{await Task.Delay(25,watch.Token);}catch(OperationCanceledException){break;}
                                    }
                                });
                                try{await target.VerifyNavigation(window,Observe);}
                                finally{watch.Cancel();await monitor;}
                                if(changed)throw new Exception("Taskbar appeared or Dock moved during same-host Desk navigation");
                                Console.WriteLine("PASS taskbar stays hidden and native Dock position stays stable across both Desk changes");
                            }
                            else if(pinMenu)await target.VerifyPinMenu(window,Observe);
                            else if(menu)await target.VerifyWindowMenu(window,Observe,second);
                            else if(keyboard)await target.VerifyKeyboard(window,Observe);
                            else await target.Verify(window,Observe,touch,competingRaw);
                            if(touch)await target.VerifyDisabledContact(window,Observe,()=>Settings(new{enabled=false}));
                        }
                        else if(launcher is not null)await launcher.Verify(window,Observe);
                        else Console.WriteLine("No application action or touch was simulated; those remain separate acceptance.");
                        if(restoreTaskbar&&!NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null)))throw new Exception("Task actions hid manually restored taskbar");
                        return;
                    }
                }
                await Task.Delay(250);
            }
            throw new Exception("Fusion readiness not confirmed: "+last);
        }
        catch(Exception ex){Console.Error.WriteLine("Fusion probe failure: "+ex);throw;}
        finally
        {
            try { target?.Dispose();launcher?.Dispose(); }
            finally {
                if(actions||launch)SetForegroundWindow(foreground);
                SetCursorPos(cursor.X,cursor.Y);
                try { Settings(new{enabled=beforeTheme.GetProperty("enabled").GetBoolean(),mode=beforeTheme.GetProperty("mode").GetString(),heightDip=beforeTheme.GetProperty("heightDip").GetInt32()}); }
                finally {try{Enable(beforeApp);}finally{if(restoreTaskbar)Taskbar(beforeTaskbar);}}
                Console.WriteLine("RESTORED Dock preferences and cursor");
            }
        }
    }
    private delegate bool EnumCallback(IntPtr window,IntPtr param);
    [DllImport("user32.dll")]private static extern bool EnumWindows(EnumCallback callback,IntPtr param);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll")]private static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")]private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(IntPtr window);
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
}
