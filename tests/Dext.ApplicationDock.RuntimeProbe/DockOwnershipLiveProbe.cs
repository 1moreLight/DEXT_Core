using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Text.Json;

internal static class DockOwnershipLiveProbe
{
    public static async Task Run(DesktopService.DesktopServiceClient client)
    {
        JsonElement App()=>JsonDocument.Parse(client.GetApplicationDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        JsonElement Theme()=>JsonDocument.Parse(client.GetRoomDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        void AppEnabled(bool enabled)=>client.EditApplicationDock(new(){PatchJson=JsonSerializer.Serialize(new{operation="enable",enabled})},deadline:DateTime.UtcNow.AddSeconds(5));
        void ThemeSettings(object patch)=>client.SetRoomDockPreference(new(){PatchJson=JsonSerializer.Serialize(patch)},deadline:DateTime.UtcNow.AddSeconds(5));
        async Task Wait(Func<bool> condition){var until=DateTime.UtcNow.AddSeconds(35);while(DateTime.UtcNow<until){if(condition())return;await Task.Delay(200);}throw new Exception("Dock handoff timed out: "+Theme()+" / "+App());}
        var beforeApp=App().GetProperty("enabled").GetBoolean();
        var beforeTheme=Theme().GetProperty("preferences").Clone();
        try
        {
            AppEnabled(true);ThemeSettings(new{enabled=true,mode="autohide",heightDip=80});
            await Wait(()=>App().GetProperty("runtime").GetProperty("owner").GetString()=="application" && Theme().GetProperty("runtime").GetProperty("phase").GetString()=="applicationSelected" && Theme().GetProperty("runtime").GetProperty("playerPid").GetInt32()==0);
            Console.WriteLine("PASS both preferences enabled selects only application host");
            AppEnabled(false);
            await Wait(()=>{var t=Theme().GetProperty("runtime");return t.GetProperty("playerPid").GetInt32()>0 && t.GetProperty("autoHideAvailable").GetBoolean() && !App().GetProperty("runtime").GetProperty("visible").GetBoolean();});
            var oldPid=Theme().GetProperty("runtime").GetProperty("playerPid").GetInt32();
            using var old=System.Diagnostics.Process.GetProcessById(oldPid);
            Console.WriteLine("PASS disabling application resumes real theme Player PID="+oldPid);
            AppEnabled(true);
            await Wait(()=>old.HasExited && Theme().GetProperty("runtime").GetProperty("playerPid").GetInt32()==0 && App().GetProperty("runtime").GetProperty("owner").GetString()=="application");
            Console.WriteLine("PASS theme process exits before application owns the slot again");
        }
        finally
        {
            ThemeSettings(new{enabled=beforeTheme.GetProperty("enabled").GetBoolean(),mode=beforeTheme.GetProperty("mode").GetString(),heightDip=beforeTheme.GetProperty("heightDip").GetInt32()});
            AppEnabled(beforeApp);
            Console.WriteLine("RESTORED application and theme preferences");
        }
    }
}
