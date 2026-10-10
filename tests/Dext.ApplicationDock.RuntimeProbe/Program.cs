using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using System.Text.Json;
if (args.Length < 2) throw new ArgumentException("Usage: status|enable|disable|shutdown|probe|restart-probe|taskbar-probe|taskbar-exit-probe|grants-status EXPECTED_CORE_DIRECTORY");
var channel = new NamedPipeChannel(".", "Grpc_DEXT:DESKTOPSHELL" + Environment.UserName);
var client = new DesktopService.DesktopServiceClient(channel);
var identity = client.GetCoreStats(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5));
if (identity.ProductName != "Dext" || identity.RuntimeIdentity != "DEXT:DESKTOPSHELL" ||
    !Path.GetFullPath(identity.BaseDirectory).TrimEnd('\\').Equals(Path.GetFullPath(args[1]).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
    throw new Exception("Unexpected Core identity; no mutation performed.");
Console.WriteLine($"Core verified: PID={identity.ProcessId} {identity.BaseDirectory}");
if (args[0] == "shutdown")
{
    try { new CommandsService.CommandsServiceClient(channel).ShutDown(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5)); }
    catch (Grpc.Core.RpcException) { /* Pipe can close during normal shutdown; caller verifies exit. */ }
    return;
}
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
