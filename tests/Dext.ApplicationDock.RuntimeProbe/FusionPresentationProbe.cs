using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

internal static class FusionPresentationProbe
{
    internal static async Task Run(DesktopService.DesktopServiceClient client,int corePid,bool modesOnly=false)
    {
        JsonElement App()=>JsonDocument.Parse(client.GetApplicationDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        JsonElement Theme()=>JsonDocument.Parse(client.GetRoomDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        void Edit(object patch)=>client.EditApplicationDock(new(){PatchJson=JsonSerializer.Serialize(patch)},deadline:DateTime.UtcNow.AddSeconds(5));
        void Settings(object patch)=>client.SetRoomDockPreference(new(){PatchJson=JsonSerializer.Serialize(patch)},deadline:DateTime.UtcNow.AddSeconds(5));
        var before=App();var originalTheme=Theme().GetProperty("preferences").Clone();
        async Task Wait(Func<bool> condition,string label){var end=DateTime.UtcNow.AddSeconds(45);while(DateTime.UtcNow<end){if(condition()){Console.WriteLine("PASS "+label);return;}await Task.Delay(200);}throw new Exception(label+" timed out: "+App()+" / "+Theme());}
        bool At(string target,string phase){var a=App();var p=a.GetProperty("presentationState");return p.ValueKind==JsonValueKind.Object&&p.GetProperty("actual").GetString()==target&&p.GetProperty("target").GetString()==target&&p.GetProperty("phase").GetString()==phase;}
        int ThemePid()=>Theme().GetProperty("runtime").GetProperty("playerPid").GetInt32();
        bool NativeVisible(){bool found=false;EnumWindows((w,_)=>{GetWindowThreadProcessId(w,out var pid);if(pid==corePid&&IsWindowVisible(w)){var title=new StringBuilder(256);GetWindowText(w,title,title.Capacity);if(title.ToString()=="Dext 系统应用 Dock")found=true;}return true;},IntPtr.Zero);return found;}
        try
        {
            Edit(new{operation="presentation",presentation="native"});
            Edit(new{operation="autoHide",autoHide=true});Edit(new{operation="enable",enabled=true});
            Settings(new{enabled=false,mode="autohide",heightDip=96});
            await Wait(()=>At("native","ready")&&ThemePid()==0,"native host ready with standalone theme disabled");
            Edit(new{operation="presentation",presentation="theme"});
            await Wait(()=>At("theme","ready")&&ThemePid()>0&&!NativeVisible(),"real fused host ready and native main window hidden");
            if(modesOnly)
            {
                await FusionModeProbe.Run(App,Theme,patch=>Edit(patch),()=>At("theme","ready"));
                return;
            }
            using(var previous=Process.GetProcessById(ThemePid())){
                Edit(new{operation="presentation",presentation="native"});
                await Wait(()=>previous.HasExited&&ThemePid()==0&&At("native","ready"),"theme Player exits before native round-trip completes");
            }
            Edit(new{operation="presentation",presentation="theme"});
            await Wait(()=>At("theme","ready")&&ThemePid()>0&&!NativeVisible(),"fusion can be selected again");
            using(var failed=Process.GetProcessById(ThemePid())){
                // Only the temporary fixture's admitted Dock Player, never Core or another application.
                Console.WriteLine("FAULT isolated theme Player PID="+failed.Id);
                failed.Kill();await failed.WaitForExitAsync();
            }
            await Wait(()=>At("native","fallback")&&ThemePid()==0,"failed theme Player falls back after releasing ownership");
            await Task.Delay(6000);
            if(!At("native","fallback")||App().GetProperty("presentation").GetString()!="theme"||ThemePid()!=0)
                throw new Exception("Fallback lost theme preference or restarted without retry");
            Console.WriteLine("PASS fallback retains theme intent without automatic retry loop");
            Edit(new{operation="retryPresentation"});
            await Wait(()=>At("theme","ready")&&ThemePid()>0&&!NativeVisible(),"explicit retry restores fused host");
            if(Theme().GetProperty("preferences").GetProperty("enabled").GetBoolean())throw new Exception("Fusion overwrote standalone theme preference");
            Console.WriteLine("PASS standalone theme preference remains unchanged");
        }
        finally
        {
            Edit(new{operation="presentation",presentation="native"});
            Edit(new{operation="autoHide",autoHide=before.GetProperty("autoHide").GetBoolean()});
            Edit(new{operation="reserveSpace",reserveSpace=before.GetProperty("reserveSpace").GetBoolean()});
            Settings(new{enabled=originalTheme.GetProperty("enabled").GetBoolean(),mode=originalTheme.GetProperty("mode").GetString(),heightDip=originalTheme.GetProperty("heightDip").GetInt32()});
            Edit(new{operation="enable",enabled=before.GetProperty("enabled").GetBoolean()});
            Edit(new{operation="presentation",presentation=before.GetProperty("presentation").GetString()});
            Console.WriteLine("RESTORED application/standalone theme preferences");
        }
    }
    private delegate bool Callback(IntPtr window,IntPtr parameter);
    [DllImport("user32.dll")]private static extern bool EnumWindows(Callback callback,IntPtr parameter);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
}
