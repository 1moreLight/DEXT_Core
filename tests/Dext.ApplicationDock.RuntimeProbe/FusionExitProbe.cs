using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using System.Diagnostics;
using System.Text.Json;

internal static class FusionExitProbe
{
    internal static async Task Run(DesktopService.DesktopServiceClient client,NamedPipeChannel channel,GetCoreStatsResponse identity)
    {
        using var core=Process.GetProcessById(identity.ProcessId);
        var desktopPid=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).PlayerPid;
        using var status=JsonDocument.Parse(client.GetRoomDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson);
        var dockPid=status.RootElement.GetProperty("runtime").GetProperty("playerPid").GetInt32();
        using var desktop=Process.GetProcessById(desktopPid);
        using var dock=Process.GetProcessById(dockPid);
        if(NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null)))throw new Exception("Taskbar not hidden before theme Core exit");
        try {
            try{new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));}
            catch(Grpc.Core.RpcException){}
            if(!await Task.Run(()=>core.WaitForExit(15000)))throw new Exception("Theme Core did not exit normally");
            await FusionActionWindow.Wait(()=>desktop.HasExited&&dock.HasExited,"Theme Players survived Core exit",15);
            await FusionActionWindow.Wait(()=>NativeTaskbar.IsWindowVisible(NativeTaskbar.FindWindow("Shell_TrayWnd",null)),"Taskbar did not restore after theme Core exit",15);
            Console.WriteLine("PASS normal Core exit closes both theme Players and restores actual Windows taskbar");
        } finally {
            // Existing fixture cleanup uses the official RPC, so restart only the
            // exact isolated candidate that this probe had already verified.
            if(core.HasExited){
                using var restarted=Process.Start(new ProcessStartInfo(Path.Combine(identity.BaseDirectory,"Lively.exe")){WorkingDirectory=identity.BaseDirectory,UseShellExecute=true,WindowStyle=ProcessWindowStyle.Hidden})??throw new Exception("Candidate restart failed");
                await FusionActionWindow.Wait(()=>{
                    try{var value=client.GetCoreStats(new Empty(),deadline:DateTime.UtcNow.AddSeconds(1));return value.ProcessId==restarted.Id&&value.IsCoreInitialized&&value.BaseDirectory.Equals(identity.BaseDirectory,StringComparison.OrdinalIgnoreCase)&&client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(1)).Active;}
                    catch(Grpc.Core.RpcException){return false;}
                },"Candidate identity/Room did not restore for cleanup",30);
                Console.WriteLine("RESTORED isolated candidate identity and Room for fixture cleanup");
            }
        }
    }
}
