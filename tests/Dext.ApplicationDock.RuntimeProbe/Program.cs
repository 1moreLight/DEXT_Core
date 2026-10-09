using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using System.Text.Json;
if (args.Length < 2) throw new ArgumentException("Usage: status|enable|disable|shutdown|probe|restart-probe EXPECTED_CORE_DIRECTORY");
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
JsonElement Read() => JsonSerializer.Deserialize<JsonElement>(client.GetApplicationDockStatus(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5)).ReplyJson);
JsonElement Edit(object patch) => JsonSerializer.Deserialize<JsonElement>(client.EditApplicationDock(
    new RoomDockPreferenceRequest { PatchJson = JsonSerializer.Serialize(patch) }, deadline: DateTime.UtcNow.AddSeconds(5)).ReplyJson);
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
