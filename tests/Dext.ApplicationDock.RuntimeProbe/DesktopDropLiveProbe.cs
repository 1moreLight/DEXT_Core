using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

internal static class DesktopDropLiveProbe
{
    internal static async Task Run(DesktopService.DesktopServiceClient client, GetCoreStatsResponse identity)
    {
        var session = client.GetRoomSession(new Empty(), deadline: DateTime.UtcNow.AddSeconds(5));
        var root = Directory.CreateTempSubdirectory("Dext-drop-live-").FullName;
        var name = "Dext Drop Probe " + Guid.NewGuid().ToString("N") + ".txt";
        var source = Path.Combine(root, name);
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (!Path.IsPathFullyQualified(desktop) || !Directory.Exists(desktop)) throw new Exception("Desktop unavailable");
        var destination = Path.GetFullPath(Path.Combine(desktop, name));
        if (!string.Equals(Path.GetDirectoryName(destination), Path.TrimEndingDirectorySeparator(Path.GetFullPath(desktop)), StringComparison.OrdinalIgnoreCase) || File.Exists(destination))
            throw new Exception("Unexpected fixture destination");
        var run = Path.Combine(Environment.CurrentDirectory, ".build", "drop-live-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(run);
        const string contents = "Dext isolated Explorer drop fixture";
        File.WriteAllText(source, contents);
        JsonElement Read()
        {
            var value = client.GetRoomPersonalEditor(new() { RoomId = session.RoomId, InstallationStamp = session.InstallationStamp }, deadline: DateTime.UtcNow.AddSeconds(5));
            using var parsed = JsonDocument.Parse(value.ReplyJson); return parsed.RootElement.Clone();
        }
        try
        {
            var reply = client.EditRoomPersonal(new() { RoomId = session.RoomId, InstallationStamp = session.InstallationStamp,
                EditJson = JsonSerializer.Serialize(new { operation = "setDesktopSync", deskId = session.CurrentDeskId, enabled = true }) }, deadline: DateTime.UtcNow.AddSeconds(5));
            using var edited = JsonDocument.Parse(reply.ReplyJson);
            if (edited.RootElement.GetProperty("status").GetString() != "accepted") throw new Exception("Sync enable rejected");
            var deadline = DateTime.UtcNow.AddSeconds(35);
            while (Read().GetProperty("editor").GetProperty("desktopSync").GetProperty("scanState").GetString() != "ready")
            { if (DateTime.UtcNow > deadline) throw new Exception("Desktop scan timed out"); await Task.Delay(250); }
            File.WriteAllText(Path.Combine(run, "ready.json"), JsonSerializer.Serialize(new { source, sourceDirectory = root, destination, session.PlayerPid, session.SessionId, session.CurrentDeskId }));
            Console.WriteLine("READY Explorer fixture " + run);
            deadline = DateTime.UtcNow.AddMinutes(8);
            while (!File.Exists(destination))
            {
                if (File.Exists(Path.Combine(run, "cancel"))) throw new OperationCanceledException("Probe cancelled");
                if (DateTime.UtcNow > deadline) throw new TimeoutException("No actual desktop drop observed");
                await Task.Delay(250);
            }
            if (File.ReadAllText(destination) != contents) throw new Exception("Dropped content mismatch");
            var id = "desktop-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(destination.ToUpperInvariant()))).ToLowerInvariant();
            var personal = Path.Combine(identity.AppDataDirectory, "v3", "personal", "personal.json");
            var slot = -1; deadline = DateTime.UtcNow.AddSeconds(35);
            while (DateTime.UtcNow < deadline)
            {
                using var saved = JsonDocument.Parse(File.ReadAllBytes(personal));
                if (saved.RootElement.GetProperty("rooms").GetProperty(session.RoomId).GetProperty("desktopSync").GetProperty("slots").TryGetProperty(id, out var value))
                { slot = value.GetInt32(); break; }
                await Task.Delay(250);
            }
            if (slot < 0) throw new Exception("Transferred file has no persisted desktop slot");
            // File watching can observe a native Explorer transfer too; this is not proof of the Dext drop route.
            var result = new { destinationExists = true, sourceExists = File.Exists(source), slot, id, dextDropRouteVerified = false };
            File.WriteAllText(Path.Combine(run, "result.json"), JsonSerializer.Serialize(result));
            Console.WriteLine("OBSERVED transferred content and saved slot; Dext route still unverified " + JsonSerializer.Serialize(result));
            // Leave time to observe the actual icon through Windows computer-use.
            // An explicit marker ends observation; even a lost UI session is bounded.
            deadline = DateTime.UtcNow.AddSeconds(45);
            while (DateTime.UtcNow < deadline && !File.Exists(Path.Combine(run, "observed")) && !File.Exists(Path.Combine(run, "cancel")))
                await Task.Delay(250);
        }
        finally
        {
            // Only our exact unique files and empty source directory may be removed.
            if (File.Exists(source)) File.Delete(source);
            if (File.Exists(destination)) File.Delete(destination);
            Directory.Delete(root, false);
            File.WriteAllText(Path.Combine(run, "cleaned.txt"), DateTime.UtcNow.ToString("O"));
        }
    }
}