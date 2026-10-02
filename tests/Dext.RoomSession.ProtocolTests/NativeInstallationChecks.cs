using Dext.Core.Rooms;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

internal static class NativeInstallationChecks
{
    public static void Run(Action<string, Action> check)
    {
        check("Core reader retains directories and rejects concurrent byte replacement", () => WithCopy(root =>
        {
            using var reader = RoomV3Installation.OpenResource(root, "assets/background.svg");
            var blocked = false;
            try { File.WriteAllText(Path.Combine(root, "assets/background.svg"), "changed"); }
            catch (IOException) { blocked = true; }
            if (!blocked) throw new Exception("opened resource allowed replacement");
            blocked = false;
            try { Directory.Move(Path.Combine(root, "assets"), Path.Combine(root, "changed")); }
            catch (IOException) { blocked = true; }
            if (!blocked) throw new Exception("opened parent allowed substitution");
        }));
        check("Core agrees with Rust Unicode resource ordering", () => WithCopy(root =>
        {
            if (new InstalledRoomSessionAuthority().Bind(root, 7123) is null)
                throw new Exception("valid UTF-8 ordered installation rejected");
        }, "installed-unicode"));
        check("official native host binds its verified content child", () => WithCopy(root =>
        {
            var parent = Path.Combine(root, "host");
            var content = Path.Combine(parent, "content");
            Directory.CreateDirectory(content);
            foreach (var entry in Directory.EnumerateFileSystemEntries(root).Where(p => p != parent).ToArray())
            {
                var dest = Path.Combine(content, Path.GetFileName(entry));
                if (Directory.Exists(entry)) Directory.Move(entry, dest); else File.Move(entry, dest);
            }
            if (new InstalledRoomSessionAuthority().Bind(parent, 7123) is null)
                throw new Exception("official host content not bound");
        }));
        check("native v3 binds stable Desk IDs and the real Player", () => WithCopy(root =>
        {
            var authority = new InstalledRoomSessionAuthority();
            var installation = authority.Bind(root, 7123) ?? throw new Exception("native installation rejected");
            if (installation.StartDeskId != "home" || installation.DeskIds.Count != 2)
                throw new Exception("native Desk identity mismatch");
            var hello = new RoomSessionHello(1, RoomClientRole.DesktopPlayer, installation.RoomId);
            if (authority.Admit(new RoomSessionPeer("player-process:7123"), hello) is null ||
                authority.Admit(new RoomSessionPeer("player-process:7124"), hello) is not null)
                throw new Exception("Player PID admission mismatch");
        }));
        foreach (var change in new[] { "manifest", "resource", "extra", "missing", "snapshot" })
            check($"native v3 rejects {change} tampering after binding", () => WithCopy(root =>
            {
                var authority = new InstalledRoomSessionAuthority();
                var installation = authority.Bind(root, 7123) ?? throw new Exception("fixture rejected");
                switch (change)
                {
                    case "manifest": File.AppendAllText(Path.Combine(root, "room.json"), " "); break;
                    case "resource": File.AppendAllText(Path.Combine(root, "assets/background.svg"), " "); break;
                    case "extra": File.WriteAllText(Path.Combine(root, "extra.js"), "0"); break;
                    case "missing": File.Delete(Path.Combine(root, "assets/background.svg")); break;
                    default: File.WriteAllText(Path.Combine(root, "installation.json"), "{}"); break;
                }
                if (authority.Admit(new RoomSessionPeer("player-process:7123"),
                    new RoomSessionHello(1, RoomClientRole.DesktopPlayer, installation.RoomId)) is not null)
                    throw new Exception("changed content still admitted");
            }));
        foreach (var change in new[] { "unknown", "duplicateDesk", "missingStart", "private", "undeclared", "arrayConfig", "fileUri" })
            check($"Core independently rejects invalid native contract: {change}", () => WithCopy(root =>
            {
                var path = Path.Combine(root, "room.json");
                var room = JsonNode.Parse(File.ReadAllText(path))!;
                switch (change)
                {
                    case "unknown": room["surprise"] = true; break;
                    case "duplicateDesk": room["desks"]![1]!["id"] = "home"; break;
                    case "missingStart": room["startDesk"] = "missing"; break;
                    case "private": room["buttons"]![0]!["action"]!["target"] = "C:/private.exe"; break;
                    case "undeclared": room["desks"]![0]!["background"]!["src"] = "missing.png"; break;
                    case "fileUri": room["roomScene"] = new JsonObject { ["entry"] = "scene/index.html", ["config"] = new JsonObject { ["value"] = "FILE:///C:/private.txt" } }; break;
                    default: room["roomScene"] = new JsonObject { ["entry"] = "scene/index.html", ["config"] = new JsonArray() }; break;
                }
                if (change is "arrayConfig" or "fileUri")
                {
                    Directory.CreateDirectory(Path.Combine(root, "scene"));
                    File.WriteAllText(Path.Combine(root, "scene/index.html"), "<!doctype html><title>local</title>");
                    room["resources"]!.AsArray().Add("scene/index.html");
                }
                File.WriteAllText(path, room.ToJsonString());
                var snapshotPath = Path.Combine(root, "installation.json");
                var snapshot = JsonNode.Parse(File.ReadAllText(snapshotPath))!;
                snapshot["manifestSha256"] = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
                if (change is "arrayConfig" or "fileUri")
                {
                    var htmlPath = Path.Combine(root, "scene/index.html");
                    snapshot["resources"]!.AsArray().Add(new JsonObject { ["path"] = "scene/index.html",
                        ["sha256"] = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(htmlPath))).ToLowerInvariant(),
                        ["size"] = new FileInfo(htmlPath).Length });
                }
                File.WriteAllText(snapshotPath, snapshot.ToJsonString());
                if (new InstalledRoomSessionAuthority().Bind(root, 7123) is not null)
                    throw new Exception("structurally invalid manifest admitted despite matching hash");
            }));
    }

    private static void WithCopy(Action<string> test, string fixture = "installed-basic")
    {
        var temp = Directory.CreateTempSubdirectory("dext-native-admission-");
        try
        {
            var source = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,
                "../../../../../dev_docs/fixtures/room-v3/" + fixture));
            foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
            {
                var target = Path.Combine(temp.FullName, Path.GetRelativePath(source, file));
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.Copy(file, target);
            }
            test(temp.FullName);
        }
        finally { temp.Delete(true); }
    }
}
