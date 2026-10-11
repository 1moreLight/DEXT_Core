using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Runtime.InteropServices;
using System.Text.Json;

internal static class DesktopSurfaceLiveProbe
{
    internal static async Task Run(DesktopService.DesktopServiceClient client)
    {
        var session=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
        if(!session.Active)throw new Exception("No active Room");
        JsonElement Read() => JsonDocument.Parse(client.GetRoomPersonalEditor(new(){RoomId=session.RoomId,
            InstallationStamp=session.InstallationStamp},deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
        void Set(string desk,bool enabled)
        {
            var reply=client.EditRoomPersonal(new(){RoomId=session.RoomId,InstallationStamp=session.InstallationStamp,
                EditJson=JsonSerializer.Serialize(new{operation="setDesktopSync",deskId=desk,enabled})},deadline:DateTime.UtcNow.AddSeconds(5));
            if(JsonDocument.Parse(reply.ReplyJson).RootElement.GetProperty("status").GetString()!="accepted")throw new Exception("Sync setting rejected");
        }
        var prior=Read().GetProperty("editor").GetProperty("desktopSync");
        var wasEnabled=prior.ValueKind==JsonValueKind.Object && prior.GetProperty("enabled").GetBoolean();
        var desk=prior.ValueKind==JsonValueKind.Object ? prior.GetProperty("deskId").GetString()! : session.CurrentDeskId;
        nint player=0,shell=0;
        EnumWindows((root,_)=>{
            var view=FindWindowEx(root,0,"SHELLDLL_DefView",null);if(view!=0)shell=view;
            EnumChildWindows(root,(h,_)=>{GetWindowThreadProcessId(h,out var pid);
                if(pid==session.PlayerPid && GetParent(h)==root)player=h;return true;},0);return true;
        },0);
        if(player==0||shell==0)throw new Exception("Desktop HWND not found");
        var parent=GetParent(player); var previous=GetWindow(player,3);
        bool Above(){if(GetParent(player)!=GetParent(shell))return false;for(var h=GetWindow(shell,3);h!=0;h=GetWindow(h,3))if(h==player)return true;return false;}
        try
        {
            Set(session.CurrentDeskId,true);
            var end=DateTime.UtcNow.AddSeconds(12);
            while(!Above()&&DateTime.UtcNow<end)await Task.Delay(200);
            if(!Above())throw new Exception("Actual Player never moved above Shell view");
            Console.WriteLine("PASS actual Player is above Explorer Shell view, same desktop container");
            GetWindowRect(player,out var r);var own=0;var shellHits=0;var covered=0;
            foreach(var x in new[]{.1,.5,.9})foreach(var y in new[]{.1,.5,.9}){
                var hit=WindowFromPoint(new Point{X=r.Left+(int)((r.Right-r.Left)*x),Y=r.Top+(int)((r.Bottom-r.Top)*y)});
                if(hit==player||IsChild(player,hit))own++;else if(hit==shell||IsChild(shell,hit))shellHits++;else covered++;
            }
            Console.WriteLine($"Hit samples: Player={own}, Explorer={shellHits}, other windows={covered}; no mouse movement");
            if(shellHits!=0)throw new Exception("Explorer still wins visible desktop hits");
            if(own==0)throw new Exception("Desktop covered; actual hit evidence unavailable");
            Set(session.CurrentDeskId,false);end=DateTime.UtcNow.AddSeconds(5);
            while((GetParent(player)!=parent||Above())&&DateTime.UtcNow<end)await Task.Delay(100);
            if(GetParent(player)!=parent||Above())throw new Exception("Disabled sync did not restore original desktop layer");
            Console.WriteLine("PASS disable restores desktop layer");
        }
        finally {Set(desk,wasEnabled);Console.WriteLine("RESTORED previous sync enabled="+wasEnabled+"; no files moved or input injected");}
    }
    private delegate bool Callback(nint h,nint p);
    [StructLayout(LayoutKind.Sequential)] private struct Rect{public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)] private struct Point{public int X,Y;}
    [DllImport("user32.dll")] private static extern bool EnumWindows(Callback callback,nint p);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(nint h,Callback callback,nint p);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern nint FindWindowEx(nint p,nint after,string name,string? title);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint h,out int pid);
    [DllImport("user32.dll")] private static extern nint GetParent(nint h);
    [DllImport("user32.dll")] private static extern nint GetWindow(nint h,uint command);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint h,out Rect rect);
    [DllImport("user32.dll")] private static extern nint WindowFromPoint(Point point);
    [DllImport("user32.dll")] private static extern bool IsChild(nint parent,nint h);
}
