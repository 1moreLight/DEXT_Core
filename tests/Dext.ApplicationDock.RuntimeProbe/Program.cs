using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using System.Text.Json;
if(args.Length==1 && args[0]=="touch-path") { try { await TouchPathProbe.Run(); } catch(Exception ex){Console.Error.WriteLine(ex);Environment.ExitCode=1;} return; }
if(args.Length==1 && args[0]=="--owned-launch-window") {
    using var owned=await FusionActionWindow.Create();
    await Task.WhenAny(owned.Closed,Task.Delay(TimeSpan.FromSeconds(45))); // Bounded even if the parent probe is interrupted.
    return;
}
if (args.Length < 2) throw new ArgumentException("Usage: status|enable|disable|shutdown|probe|restart-probe|taskbar-probe|taskbar-exit-probe|grants-status EXPECTED_CORE_DIRECTORY");
var channel = new NamedPipeChannel(".", "Grpc_DEXT:DESKTOPSHELL" + Environment.UserName);
var client = new DesktopService.DesktopServiceClient(channel);
var identity = client.GetCoreStats(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5));
if (identity.ProductName != "Dext" || identity.RuntimeIdentity != "DEXT:DESKTOPSHELL" ||
    !Path.GetFullPath(identity.BaseDirectory).TrimEnd('\\').Equals(Path.GetFullPath(args[1]).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
    throw new Exception("Unexpected Core identity; no mutation performed.");
Console.WriteLine($"Core verified: PID={identity.ProcessId} {identity.BaseDirectory}");
if(args[0]=="cleanup-desktop-fixture"){
    if(args.Length!=3)throw new ArgumentException("Expected isolated fixture Room ID");
    var fixtureHost=Path.Combine(identity.BaseDirectory,"wallpapers","dext-room-v3");
    using var fixture=JsonDocument.Parse(File.ReadAllBytes(Path.Combine(fixtureHost,"content/room.json")));
    if(fixture.RootElement.GetProperty("id").GetString()!=args[2]||fixture.RootElement.GetProperty("name").GetString()!="Storage grant acceptance fixture")throw new Exception("Not the isolated fixture");
    var active=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
    if(active.Active&&active.RoomId!=args[2])throw new Exception("Another Room is active");
    client.CloseWallpaperLibrary(new(){LivelyInfoPath=fixtureHost},deadline:DateTime.UtcNow.AddSeconds(5));
    var deadline=DateTime.UtcNow.AddSeconds(10);
    while(client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).Active){if(DateTime.UtcNow>deadline)throw new Exception("Fixture did not close");await Task.Delay(200);}
    var deleted=client.DeleteRoomPersonal(new(){RoomId=args[2]},deadline:DateTime.UtcNow.AddSeconds(5));
    if(deleted.Status!="accepted")throw new Exception("Fixture personal cleanup failed");
    Console.WriteLine("RESTORED no active Room; isolated fixture personal data removed");return;
}
if(args[0]=="session-status"){Console.WriteLine(client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)));return;}
if(args[0]=="desktop-drop-live"){
    if(args.Length!=3)throw new ArgumentException("desktop-drop-live requires isolated fixture Room ID");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:()=>DesktopDropLiveProbe.Run(client,identity));
    return;
}if(args[0] is "desktop-sync-live" or "desktop-watch-live"){
    if(args.Length!=3)throw new ArgumentException("desktop-sync-live requires isolated fixture Room ID");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:()=>DesktopSyncLiveProbe.Run(client,args[0]=="desktop-watch-live"));
    return;
}
if(args[0] is "fusion-presentation-live" or "fusion-modes-live" or "fusion-native-preview-live"){
    if(args.Length!=3)throw new ArgumentException("fusion-presentation-live requires isolated fixture Room ID");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:()=>FusionPresentationProbe.Run(client,identity.ProcessId,args[0]=="fusion-modes-live",args[0]=="fusion-native-preview-live"));
    return;
}
if(args[0]=="fusion-exit-live"){
    if(args.Length!=3)throw new ArgumentException("fusion-exit-live requires isolated fixture Room ID");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:()=>FusionTaskLiveProbe.Run(client,exitCheck:()=>FusionExitProbe.Run(client,channel,identity)));
    return;
}
if(args[0] is "fusion-live" or "fusion-actions-live" or "fusion-launch-live" or "fusion-touch-live" or "fusion-raw-owner-live" or "fusion-keyboard-live" or "fusion-menu-live" or "fusion-startup-live" or "fusion-restored-live" or "fusion-pin-live" or "fusion-navigation-live" or "fusion-close-live" or "fusion-fullscreen-live" or "fusion-no-dock-live") {
    if(args.Length!=3)throw new ArgumentException("fusion-live requires isolated fixture Room ID");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:()=>FusionTaskLiveProbe.Run(client,args[0] is "fusion-actions-live" or "fusion-touch-live" or "fusion-raw-owner-live" or "fusion-keyboard-live" or "fusion-menu-live" or "fusion-startup-live" or "fusion-restored-live" or "fusion-pin-live" or "fusion-navigation-live" or "fusion-close-live" or "fusion-fullscreen-live" or "fusion-no-dock-live",args[0]=="fusion-launch-live",args[0]=="fusion-touch-live",args[0]=="fusion-raw-owner-live",args[0]=="fusion-keyboard-live",args[0] is "fusion-menu-live" or "fusion-startup-live" or "fusion-restored-live",args[0]=="fusion-startup-live",args[0]=="fusion-restored-live",args[0]=="fusion-pin-live",args[0]=="fusion-navigation-live",args[0]=="fusion-close-live",args[0]=="fusion-fullscreen-live",args[0]=="fusion-no-dock-live"));
    return;
}
if (args[0] == "shutdown")
{
    try { new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5)); }
    catch (Grpc.Core.RpcException) { /* Pipe can close during normal shutdown; caller verifies exit. */ }
    return;
}
if (args[0] == "navigation-live")
{
    if(args.Length!=3)throw new ArgumentException("navigation-live requires fixture Room ID");
    JsonElement Navigation() => JsonDocument.Parse(client.GetApplicationDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.GetProperty("navigation").Clone();
    if(Navigation().ValueKind!=JsonValueKind.Null)throw new Exception("Expected no Room navigation before fixture");
    await StorageGrantLiveProbe.Run(client,channel,identity,args[2],runtimeCheck:async()=>{
        var until=DateTime.UtcNow.AddSeconds(15);
        while(DateTime.UtcNow<until) {
            var value=Navigation();
            var session=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
            if(value.ValueKind==JsonValueKind.Object) {
                if(value.GetProperty("deskIds").GetArrayLength()!=3 || value.GetProperty("sessionId").GetString()!=session.SessionId)
                    throw new Exception("Navigation does not match Core session");
                using var manifest=JsonDocument.Parse(File.ReadAllBytes(Path.Combine(identity.BaseDirectory,"wallpapers/dext-room-v3/content/room.json")));
                var name=manifest.RootElement.GetProperty("desks").EnumerateArray().Single(d=>d.GetProperty("id").GetString()==session.CurrentDeskId).GetProperty("name").GetString();
                if(value.GetProperty("currentName").GetString()!=name)throw new Exception("Navigation name mismatches installed Desk");
                var shouldNavigate=session.Lifecycle.Stage=="desktop" && !session.Lifecycle.Locked;
                if(value.GetProperty("canNavigate").GetBoolean()!=shouldNavigate)throw new Exception("Navigation lifecycle differs from Core");
                Console.WriteLine("PASS real Core navigation session, three Desks, installed current name and lifecycle="+session.Lifecycle.Stage+", paused="+session.Lifecycle.PlaybackPaused);
                return;
            }
            await Task.Delay(200);
        }
        throw new Exception("Navigation did not become ready: " + Navigation() + " / " + client.GetRoomSession(new Empty()));
    });
    if(Navigation().ValueKind!=JsonValueKind.Null)throw new Exception("Closed Room retained navigation");
    Console.WriteLine("PASS closing Room clears navigation; physical clicks remain manual acceptance");
    return;
}
if (args[0] == "dock-owner-live") { if(args.Length!=3)throw new ArgumentException("dock-owner-live requires fixture Room ID"); await StorageGrantLiveProbe.Run(client,channel,identity,args[2],dockOwnership:true); return; }
if (args[0] == "grants-live") { if(args.Length!=3)throw new ArgumentException("grants-live requires fixture Room ID"); await StorageGrantLiveProbe.Run(client,channel,identity,args[2]); return; }
if (args[0] == "grants-status")
{
    var session = client.GetRoomSession(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5));
    if (!session.Active || session.PlayerPid <= 0) throw new Exception("No active Room; no grant evidence available.");
    var grants = client.GetRoomReadGrants(new RoomReadGrantsRequest {
        RoomId = session.RoomId, InstallationStamp = session.InstallationStamp
    }, deadline: DateTime.UtcNow.AddSeconds(5));
    if (grants.Status != "accepted" || grants.RoomId != session.RoomId || grants.InstallationStamp != session.InstallationStamp)
        throw new Exception("Grant response does not match active Room.");
    var storage = grants.Consumers.Where(c => c.Capabilities.Any(x => x.Capability is "storage.read" or "storage.write")).ToArray();
    if (storage.Length == 0) throw new Exception("Active Room declares no storage consumer; this is not storage UI evidence.");
    foreach (var consumer in storage)
        Console.WriteLine($"PASS real Core exposes {consumer.ConsumerId}: " + string.Join(", ", consumer.Capabilities.Select(x => $"{x.Capability}={x.Allowed}")));
    Console.WriteLine("Read-only probe; no permission or personal value changed.");
    return;
}
JsonElement Read() => JsonSerializer.Deserialize<JsonElement>(client.GetApplicationDockStatus(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5)).ReplyJson);
JsonElement Edit(object patch) => JsonSerializer.Deserialize<JsonElement>(client.EditApplicationDock(
    new RoomDockPreferenceRequest { PatchJson = JsonSerializer.Serialize(patch) }, deadline: DateTime.UtcNow.AddSeconds(5)).ReplyJson);
if (args[0] == "taskbar-visible")
{
    Console.WriteLine(Edit(new { operation = "taskbar", mode = "visible" }));
    var deadline = DateTime.UtcNow.AddSeconds(10);
    while (DateTime.UtcNow < deadline)
    {
        var taskbarVisibility = Read().GetProperty("taskbar");
        if (taskbarVisibility.GetProperty("mode").GetString() == "visible" && taskbarVisibility.GetProperty("visible").ValueKind == JsonValueKind.True && !taskbarVisibility.GetProperty("hidden").GetBoolean())
        { Console.WriteLine("RESTORED persistent visible Windows taskbar: " + taskbarVisibility); return; }
        await Task.Delay(200);
    }
    throw new Exception("Taskbar restore was requested but visibility was not confirmed.");
}
if (args[0] == "autohide-probe")
{
    if(client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).Active)
        throw new Exception("Requires no active Room for isolated application ownership test");
    var before=Read();
    var enabled=before.GetProperty("enabled").GetBoolean();
    var autoHide=before.GetProperty("autoHide").GetBoolean();
    var mode=before.GetProperty("taskbar").GetProperty("mode").GetString();
    async Task Wait(Func<bool> condition,string label) {
        var until=DateTime.UtcNow.AddSeconds(15);
        while(DateTime.UtcNow<until) {if(condition()){Console.WriteLine("PASS "+label);return;}await Task.Delay(200);}
        throw new Exception(label+" not confirmed: "+Read().GetProperty("runtime"));
    }
    try {
        Edit(new{operation="taskbar",mode="visible"});
        Edit(new{operation="enable",enabled=true});
        Edit(new{operation="autoHide",autoHide=true});
        if(!Read().GetProperty("autoHide").GetBoolean())throw new Exception("AutoHide edit not acknowledged");
        Console.WriteLine("PASS real Core persists auto-hide preference");
        Edit(new{operation="autoHide",autoHide=false});
        var runtime=Read().GetProperty("runtime");
        if(runtime.TryGetProperty("blocked",out var blocked) && blocked.ValueKind==JsonValueKind.String) {
            if(runtime.GetProperty("visible").GetBoolean())throw new Exception("Blocked Dock unexpectedly visible");
            Console.WriteLine("PASS real Dock remains hidden during "+blocked.GetString());
            Console.WriteLine("DEFER visible/edge and automatic taskbar handoff until no fullscreen/lock; preferences restored below");
            return;
        }
        await Wait(()=>Read().GetProperty("runtime").GetProperty("visible").GetBoolean(),"always-visible setting restores real Dock");
        Edit(new{operation="taskbar",mode="auto"});
        await Wait(()=>Read().GetProperty("taskbar").GetProperty("hidden").GetBoolean(),"automatic taskbar request confirms active application Dock");
        Edit(new{operation="enable",enabled=false});
        await Wait(()=>Read().GetProperty("runtime").GetProperty("owner").GetString()=="none" && !Read().GetProperty("taskbar").GetProperty("hidden").GetBoolean(),"application owner releases after automatic taskbar recovery");
        Edit(new{operation="enable",enabled=true});
        Edit(new{operation="taskbar",mode="visible"});
        await Task.Delay(1200);
        if(Read().GetProperty("taskbar").GetProperty("hidden").GetBoolean())throw new Exception("Manual restore overridden by application Dock");
        Console.WriteLine("PASS manual restore overrides application automatic request");
    } finally {
        Edit(new{operation="autoHide",autoHide});
        Edit(new{operation="enable",enabled});
        Edit(new{operation="taskbar",mode});
        Console.WriteLine("RESTORED application visibility and taskbar preferences");
    }
    return;
}
if (args[0] == "taskbar-probe" || args[0] == "taskbar-exit-probe")
{
    var before = Read().GetProperty("taskbar").GetProperty("mode").GetString();
    void Mode(string value) => client.EditApplicationDock(new RoomDockPreferenceRequest {
        PatchJson = JsonSerializer.Serialize(new { operation = "taskbar", mode = value })
    }, deadline: DateTime.UtcNow.AddSeconds(25));
    bool Visible() {
        var handle = NativeTaskbar.FindWindow("Shell_TrayWnd", null);
        if (handle == IntPtr.Zero) throw new Exception("Windows taskbar not found");
        return NativeTaskbar.IsWindowVisible(handle);
    }
    void WaitFor(Func<bool> condition) {
        var until=DateTime.UtcNow.AddSeconds(15);
        while(DateTime.UtcNow<until){if(condition())return;Thread.Sleep(200);}
        throw new Exception("Taskbar state was not confirmed in time: "+Read().GetProperty("taskbar"));
    }
    try {
        Mode("hidden");
        WaitFor(()=>Read().GetProperty("taskbar").GetProperty("hidden").GetBoolean() && !Visible());
        Console.WriteLine("PASS actual Windows taskbar hidden with confirmed watchdog");
        if (args[0] == "taskbar-exit-probe")
        {
            using var oldCore=System.Diagnostics.Process.GetProcessById(identity.ProcessId);
            try {new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));}
            catch(Grpc.Core.RpcException) { }
            if(!oldCore.WaitForExit(15000)) throw new Exception("Core did not exit during taskbar recovery");
            var until=DateTime.UtcNow.AddSeconds(12);
            while(!Visible() && DateTime.UtcNow<until) Thread.Sleep(200);
            if(!Visible()) throw new Exception("Taskbar was not restored after Core exit");
            Console.WriteLine("PASS actual Core exit restores Windows taskbar");
            using var restarted=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(identity.BaseDirectory,"Lively.exe")) {
                WorkingDirectory=identity.BaseDirectory,UseShellExecute=true,WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden
            }) ?? throw new Exception("Core restart failed");
            var ready=false;until=DateTime.UtcNow.AddSeconds(25);
            while(DateTime.UtcNow<until) {
                try {var current=client.GetCoreStats(new Empty(),deadline:DateTime.UtcNow.AddSeconds(1));
                    ready=current.ProcessId==restarted.Id && current.IsCoreInitialized && current.BaseDirectory.Equals(identity.BaseDirectory,StringComparison.OrdinalIgnoreCase);
                    if(ready)break;
                } catch(Grpc.Core.RpcException) { }
                Thread.Sleep(200);
            }
            if(!ready)throw new Exception("Restarted Core identity did not become ready");
            if(Read().GetProperty("taskbar").GetProperty("mode").GetString()!="hidden")throw new Exception("Manual taskbar mode was not restored");
            Console.WriteLine("PASS taskbar mode persists across actual Core restart");
        }
        Mode("visible");
        WaitFor(()=>Visible() && !Read().GetProperty("taskbar").GetProperty("hidden").GetBoolean());
        Thread.Sleep(10000);
        if(!Visible()) throw new Exception("Taskbar was hidden again after manual restore");
        Console.WriteLine("PASS actual taskbar restored and remains visible after ten seconds");
    }
    finally { Mode(before ?? "visible"); }
}
if (args[0] == "enable" || args[0] == "disable")
    Edit(new { operation = "enable", enabled = args[0] == "enable" });
if (args[0] == "probe" || args[0] == "restart-probe")
{
    var before = Read();
    var enabled = before.GetProperty("enabled").GetBoolean();
    var target = Environment.ProcessPath!;
    if (before.GetProperty("pins").EnumerateArray().Any(p => p.GetProperty("target").GetString() == target))
        throw new Exception("Probe target was already pinned; aborting to preserve user state.");
    try
    {
        var pinned = Edit(new { operation = "pin", app = new { name = "Dext controlled pin probe", target, arguments = "", workingDirectory = "" } });
        if (!pinned.GetProperty("pins").EnumerateArray().Any(p => p.GetProperty("target").GetString() == target)) throw new Exception("Pin not acknowledged.");
        Edit(new { operation = "enable", enabled = true });
        Thread.Sleep(700);
        var visible = Read();
        if (!visible.GetProperty("enabled").GetBoolean() || visible.GetProperty("error").ValueKind != JsonValueKind.Null) throw new Exception("Dock failed: " + visible.GetProperty("error"));
        if (args[0] == "restart-probe")
        {
            using var oldCore = System.Diagnostics.Process.GetProcessById(identity.ProcessId);
            try { new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5)); }
            catch (Grpc.Core.RpcException) { }
            if (!oldCore.WaitForExit(10000)) throw new Exception("Core did not exit normally; restart cancelled.");
            using var restarted = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
                Path.Combine(identity.BaseDirectory, "Lively.exe"))
            {
                WorkingDirectory = identity.BaseDirectory,
                UseShellExecute = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
            });
            if (restarted == null) throw new Exception("Core restart failed.");
            var ready = false;
            var until = DateTime.UtcNow.AddSeconds(20);
            while (DateTime.UtcNow < until)
            {
                if (restarted.HasExited) throw new Exception("Restarted Core exited before ready.");
                try
                {
                    var current = client.GetCoreStats(new Empty(), deadline: DateTime.UtcNow.AddSeconds(1));
                    ready = current.ProcessId == restarted.Id && current.IsCoreInitialized &&
                        current.BaseDirectory.Equals(identity.BaseDirectory, StringComparison.OrdinalIgnoreCase);
                    if (ready) break;
                }
                catch (Grpc.Core.RpcException) { }
                Thread.Sleep(200);
            }
            if (!ready) throw new Exception("Restarted Core identity not ready.");
            var restored = Read();
            if (!restored.GetProperty("enabled").GetBoolean() ||
                restored.GetProperty("pins").GetRawText() != pinned.GetProperty("pins").GetRawText())
                throw new Exception("Pinned applications/order did not survive actual Core restart.");
            Console.WriteLine("PASS actual Core restart restores complete pinned list/order and enabled flag; PID=" + restarted.Id);
        }
        Edit(new { operation = "unpin", target });
        if (Read().GetProperty("pins").EnumerateArray().Any(p => p.GetProperty("target").GetString() == target)) throw new Exception("Unpin failed.");
        Console.WriteLine("PASS actual Core RPC pin/enable/render health/unpin");
    }
    finally
    {
        Edit(new { operation = "unpin", target });
        Edit(new { operation = "enable", enabled });
    }
}
var state = Read();
Console.WriteLine($"enabled={state.GetProperty("enabled")} pins={state.GetProperty("pins").GetArrayLength()} groups={state.GetProperty("groups").GetArrayLength()} error={state.GetProperty("error")}");

static class NativeTaskbar
{
    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet=System.Runtime.InteropServices.CharSet.Unicode)]
    internal static extern IntPtr FindWindow(string className, string title);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    internal static extern bool IsWindowVisible(IntPtr handle);
}
