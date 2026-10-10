using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using System.Text.Json;

internal static class StorageGrantLiveProbe
{
    public static async Task Run(DesktopService.DesktopServiceClient client, NamedPipeChannel channel, GetCoreStatsResponse identity, string expectedRoom, bool dockOwnership = false, Func<Task>? runtimeCheck = null)
    {
        var host=Path.Combine(identity.BaseDirectory,"wallpapers","dext-room-v3");
        using var manifest=JsonDocument.Parse(File.ReadAllBytes(Path.Combine(host,"content","room.json")));
        if(manifest.RootElement.GetProperty("id").GetString()!=expectedRoom || manifest.RootElement.GetProperty("name").GetString()!="Storage grant acceptance fixture")
            throw new Exception("Not the isolated acceptance fixture; no mutation performed.");
        if(client.GetRoomSession(new Empty()).Active) throw new Exception("An existing Room is active; no mutation performed.");
        using(var wallpapers=client.GetWallpapers(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)))
            if(await wallpapers.ResponseStream.MoveNext(CancellationToken.None)) throw new Exception("Existing wallpaper found; no mutation performed.");
        var checkpoint=Path.Combine(identity.AppDataDirectory,"v3","room-session.json");
        var original=File.Exists(checkpoint)?File.ReadAllBytes(checkpoint):null;
        var personalPath=Path.Combine(identity.AppDataDirectory,"v3","personal","personal.json");
        if(File.Exists(personalPath) && File.ReadAllText(personalPath).Contains(expectedRoom)) throw new Exception("Fixture already has personal data.");
        RoomSessionStatusResponse Session()=>client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
        async Task Wait(Func<bool> condition) {var until=DateTime.UtcNow.AddSeconds(30);while(DateTime.UtcNow<until){if(condition())return;await Task.Delay(200);}throw new Exception("Runtime condition timed out.");}
        RoomReadGrantsResponse Grants() {var s=Session();return client.GetRoomReadGrants(new(){RoomId=expectedRoom,InstallationStamp=s.InstallationStamp},deadline:DateTime.UtcNow.AddSeconds(5));}
        bool Allowed(string capability) {var r=Grants();if(r.Status!="accepted")throw new Exception(r.Status);return r.Consumers.Single(c=>c.ConsumerId=="component.observatory").Capabilities.Single(c=>c.Capability==capability).Allowed;}
        void Edit(bool allow,params string[] capabilities) {var s=Session();var request=new RoomSetReadGrantRequest{RoomId=expectedRoom,InstallationStamp=s.InstallationStamp,ConsumerId="component.observatory",Allow=allow};request.Capabilities.AddRange(capabilities);var reply=client.SetRoomReadGrant(request,deadline:DateTime.UtcNow.AddSeconds(5));if(reply.Status!="accepted")throw new Exception("Grant edit: "+reply.Status);}
        try
        {
            client.SetWallpaper(new(){LivelyInfoPath=host},deadline:DateTime.UtcNow.AddSeconds(5));
            await Wait(()=>{var s=Session();return s.Active && s.RoomId==expectedRoom && s.PlayerPid>0;});
            if(runtimeCheck is not null) { await runtimeCheck(); return; }
            if(dockOwnership) { await DockOwnershipLiveProbe.Run(client); return; }
            if(Allowed("storage.read")||Allowed("storage.write"))throw new Exception("New fixture unexpectedly pre-authorized.");
            Edit(true,"storage.read","storage.write");
            if(!Allowed("storage.read")||!Allowed("storage.write"))throw new Exception("Grant not effective.");
            Edit(false,"storage.write");
            if(!Allowed("storage.read")||Allowed("storage.write")||Allowed("time.read"))throw new Exception("Independent grant state lost.");
            Console.WriteLine("PASS real Core declared storage controls, explicit allow and independent revoke");
            using var process=System.Diagnostics.Process.GetProcessById(identity.ProcessId);
            try{new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));}catch(Grpc.Core.RpcException){}
            if(!process.WaitForExit(15000))throw new Exception("Core did not exit.");
            using var restarted=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(identity.BaseDirectory,"Lively.exe")){WorkingDirectory=identity.BaseDirectory,UseShellExecute=true,WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden});
            await Wait(()=>{try{var stats=client.GetCoreStats(new Empty(),deadline:DateTime.UtcNow.AddSeconds(1));return stats.ProcessId!=identity.ProcessId && stats.BaseDirectory==identity.BaseDirectory && Session().Active;}catch(Grpc.Core.RpcException){return false;}});
            if(!Allowed("storage.read")||Allowed("storage.write"))throw new Exception("Grant changed after Core restart.");
            Console.WriteLine("PASS actual Core restart restores temporary Room and preserves independent grants");
        }
        finally
        {
            client.CloseWallpaperLibrary(new(){LivelyInfoPath=host},deadline:DateTime.UtcNow.AddSeconds(5));
            await Wait(()=>!Session().Active);
            var deleted=client.DeleteRoomPersonal(new(){RoomId=expectedRoom},deadline:DateTime.UtcNow.AddSeconds(5));
            if(deleted.Status!="accepted")throw new Exception("Temporary personal data cleanup: "+deleted.Status);
            if(original is not null)File.WriteAllBytes(checkpoint,original);
            else if(File.Exists(checkpoint))File.Delete(checkpoint);
            Console.WriteLine("RESTORED empty wallpaper state, original checkpoint, removed temporary Room personal data");
        }
    }
}
