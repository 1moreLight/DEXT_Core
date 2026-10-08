using Dext.Core.Rooms;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

internal static class NativeInstallationChecks
{
    public static void Run(Action<string, Action> check)
    {
        check("retained admission keeps resources stable until Player unbind", () => WithCopy(root =>
        {
            var peer = new RoomSessionPeer("player-process:7123");
            using var baseline = new InstalledRoomSessionAuthority();
            var original = baseline.Bind(root, 7123) ?? throw new Exception("baseline did not bind");
            var hello = new RoomSessionHello(1, RoomClientRole.DesktopPlayer, original.RoomId);
            var elapsed = System.Diagnostics.Stopwatch.StartNew();
            for (var i = 0; i < 200; i++)
                if (baseline.Admit(peer, hello) is null) throw new Exception("baseline admission failed");
            var baselineMs = elapsed.Elapsed.TotalMilliseconds;
            baseline.Unbind(7123);

            using var authority = new InstalledRoomSessionAuthority(retainNativeInstallation: true);
            var installation = authority.Bind(root, 7123) ?? throw new Exception("retained installation did not bind");
            elapsed.Restart();
            for (var i = 0; i < 200; i++)
                if (authority.Admit(peer, hello)?.Installation.InstallationStamp != installation.InstallationStamp)
                    throw new Exception("bound installation lost its context");
            Console.WriteLine($"200 admissions: repeated verification {baselineMs:F2}ms; retained {elapsed.Elapsed.TotalMilliseconds:F2}ms");

            var resourcePath = Path.Combine(root, "assets/background.svg");
            var writeBlocked = false;
            try { using var writer = new FileStream(resourcePath, FileMode.Open, FileAccess.Write, FileShare.ReadWrite); }
            catch (IOException) { writeBlocked = true; }
            if (!writeBlocked) throw new Exception("bound resource bytes could change while admissions reused them");
            authority.Unbind(7123);
            if (authority.Admit(peer, hello) is not null) throw new Exception("old Player survived unbind");
            using (var writer = new FileStream(resourcePath, FileMode.Open, FileAccess.Write, FileShare.ReadWrite)) { }
            if (authority.Bind(root, 7124) is null || authority.Admit(peer, hello) is not null)
                throw new Exception("replacement Player binding retained the previous Player");
            authority.Dispose();
            using (var writer = new FileStream(resourcePath, FileMode.Open, FileAccess.Write, FileShare.ReadWrite)) { }
        }));
        check("verified native manifest controls startup stage stamp and animation watchdog", () => WithCopy(root =>
        {
            PrepareHtmlSlots(root);
            var roomPath = Path.Combine(root, "room.json");
            var room = JsonNode.Parse(File.ReadAllText(roomPath))!;
            room["transition"]!["durationMs"] = 10000;
            File.WriteAllText(roomPath, room.ToJsonString());
            RefreshSnapshot(root);
            var authority = new InstalledRoomSessionAuthority();
            var installation = authority.Bind(root, 7123)!;
            var now = DateTimeOffset.UtcNow;
            using var kernel = new RoomSessionKernel(clock: () => now);
            var gateway = new RoomSessionProtocolGateway(kernel, authority);
            var control = new RoomSessionPeer("core-runtime");
            var coordinator = gateway.Open(control, new RoomSessionHello(1, RoomClientRole.Coordinator, installation.RoomId)).ConnectionId!.Value;
            var first = gateway.Start(coordinator, control).Snapshot!;
            if (first.Lifecycle.Stage != RoomLifecycleStage.Starting || first.IsOperable || first.InstallationStamp != installation.InstallationStamp)
                throw new Exception("verified native policy did not reach initial snapshot");
            var peer = new RoomSessionPeer("player-process:7123");
            var connection = gateway.Open(peer, new RoomSessionHello(1, RoomClientRole.DesktopPlayer, installation.RoomId)).ConnectionId!.Value;
            if (gateway.Request(connection, peer, first.SessionId, "focus").Status != RoomProtocolStatus.Queued)
                throw new Exception("navigation started before start content finished");
            gateway.SetLifecycle(coordinator, control, first.SessionId, RoomLifecycleStage.Desktop, false, false);
            if (kernel.Snapshot!.DeadlineUtc != now.AddSeconds(12) || kernel.Snapshot.TargetDeskId != "focus")
                throw new Exception("trusted ten-second animation watchdog was truncated");
        }));
        check("native runtime context survives source replacement without rereading the manifest", () => WithCopy(root =>
        {
            PrepareHtmlSlots(root);
            var installation = new InstalledRoomSessionAuthority().Bind(root, 7123)!;
            var context = installation.RuntimeContext ?? throw new Exception("no verified runtime context");
            File.WriteAllText(Path.Combine(root, "room.json"), "{}");
            if (context.RoomId != installation.RoomId || context.InstallationStamp != installation.InstallationStamp ||
                context.Manifest.GetProperty("startDesk").GetString() != "home" ||
                context.Manifest.GetProperty("start").GetProperty("buttonIds")[0].GetString() != "next")
                throw new Exception("runtime lost the exact verified public declarations");
            if (context.Resources.Count != 2 || !context.Resources.Any(item => item.Path == "scene/index.html" &&
                item.Sha256 == Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Path.Combine(root, item.Path)))).ToLowerInvariant() &&
                item.Size == new FileInfo(Path.Combine(root, item.Path)).Length))
                throw new Exception("verified resource inventory was lost");
            if (System.Text.Json.JsonSerializer.Serialize(context).Contains(System.Text.Json.JsonSerializer.Serialize(root).Trim('"'), StringComparison.OrdinalIgnoreCase))
                throw new Exception("runtime context exposes the private installation path");
        }));
        check("current Player receives verified runtime context through its private bridge", () => WithCopy(root =>
        {
            var authority = new InstalledRoomSessionAuthority();
            var installation = authority.Bind(root, 7123)!;
            using var kernel = new RoomSessionKernel();
            var gateway = new RoomSessionProtocolGateway(kernel, authority);
            var control = new RoomSessionPeer("core-runtime");
            var connection = gateway.Open(control, new RoomSessionHello(1, RoomClientRole.Coordinator, installation.RoomId));
            var session = gateway.Start(connection.ConnectionId!.Value, control).Snapshot!;
            if (RoomSessionPlayerBridge.Connect(gateway, new RoomSessionPeer("player-process:7123"),
                installation.RoomId, _ => { }, out var bridge) != RoomProtocolStatus.Accepted || bridge is null)
                throw new Exception("Player did not connect");
            using (bridge)
            {
                if (bridge.ReadRuntimeContext(session.SessionId, out var context) != RoomProtocolStatus.Accepted ||
                    context?.InstallationStamp != installation.InstallationStamp || context.Manifest.GetProperty("desks").GetArrayLength() != 2)
                    throw new Exception("Player received no matching runtime context");
                if (bridge.ReadRuntimeContext(Guid.NewGuid(), out context) != RoomProtocolStatus.StaleSession || context is not null)
                    throw new Exception("wrong session received runtime context");
            }
            if (bridge.ReadRuntimeContext(session.SessionId, out var afterClose) != RoomProtocolStatus.StaleSession || afterClose is not null)
                throw new Exception("disposed bridge retained runtime access");
        }));
        foreach (var change in new[] { "peer", "role", "session", "manifest", "resource", "replacement", "player", "unbind", "close" })
            check("runtime context denies stale or unauthorized access: " + change, () => WithCopy(root =>
            {
                var authority = new InstalledRoomSessionAuthority();
                var installation = authority.Bind(root, 7123)!;
                using var kernel = new RoomSessionKernel();
                var gateway = new RoomSessionProtocolGateway(kernel, authority);
                var control = new RoomSessionPeer("core-runtime");
                var coordinator = gateway.Open(control, new RoomSessionHello(1, RoomClientRole.Coordinator, installation.RoomId)).ConnectionId!.Value;
                var session = gateway.Start(coordinator, control).Snapshot!;
                var peer = new RoomSessionPeer("player-process:7123");
                var connection = gateway.Open(peer, new RoomSessionHello(1, RoomClientRole.DesktopPlayer, installation.RoomId)).ConnectionId!.Value;
                switch (change)
                {
                    case "peer": peer = new RoomSessionPeer("player-process:7124"); break;
                    case "role": connection = coordinator; peer = control; break;
                    case "session": gateway.Start(coordinator, control); break;
                    case "manifest": File.AppendAllText(Path.Combine(root, "room.json"), " "); break;
                    case "resource": File.AppendAllText(Path.Combine(root, "assets/background.svg"), " "); break;
                    case "replacement": PrepareHtmlSlots(root); break;
                    case "player": authority.Bind(root, 7124); break;
                    case "unbind": authority.Unbind(7123); break;
                    case "close": gateway.Close(connection, peer); break;
                }
                var expected = change switch { "role" => RoomProtocolStatus.Forbidden,
                    "session" or "close" => RoomProtocolStatus.StaleSession, _ => RoomProtocolStatus.Denied };
                if (gateway.ReadRuntimeContext(connection, peer, session.SessionId, out var context) != expected || context is not null)
                    throw new Exception("unauthorized or stale read exposed runtime context");
            }));
        check("Core accepts declared HTML slot capabilities and button references", () => WithCopy(root =>
        {
            PrepareHtmlSlots(root);
            if (new InstalledRoomSessionAuthority().Bind(root, 7123) is null)
                throw new Exception("valid start/idle/background declarations rejected");
        }));
        foreach (var mutation in new[] { "unknownCapability", "duplicateCapability", "missingButton", "duplicateButton" })
            check("Core rejects invalid HTML slot declarations: " + mutation, () => WithCopy(root =>
            {
                PrepareHtmlSlots(root);
                if (new InstalledRoomSessionAuthority().Bind(root, 7123) is null)
                    throw new Exception("valid slot baseline rejected");
                var path = Path.Combine(root, "room.json");
                var room = JsonNode.Parse(File.ReadAllText(path))!;
                var button = room["buttons"]![0]!["id"]!.GetValue<string>();
                foreach (var content in new[] { room["start"]!, room["idle"]!, room["desks"]![0]!["background"]! })
                {
                    var key = mutation.Contains("Capability") ? "capabilities" : "buttonIds";
                    content[key] = mutation switch {
                        "unknownCapability" => new JsonArray("file.read"),
                        "duplicateCapability" => new JsonArray("desk.read", "desk.read"),
                        "missingButton" => new JsonArray("missing"), _ => new JsonArray(button, button)
                    };
                }
                File.WriteAllText(path, room.ToJsonString());
                RefreshSnapshot(root);
                if (new InstalledRoomSessionAuthority().Bind(root, 7123) is not null)
                    throw new Exception("invalid slot declaration admitted");
            }));
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

    internal static void PrepareHtmlSlots(string root)
    {
        var path = Path.Combine(root, "room.json");
        var room = JsonNode.Parse(File.ReadAllText(path))!;
        Directory.CreateDirectory(Path.Combine(root, "scene"));
        File.WriteAllText(Path.Combine(root, "scene/index.html"), "<!doctype html><title>slot</title>");
        room["resources"]!.AsArray().Add("scene/index.html");
        var content = new JsonObject { ["type"] = "html", ["src"] = "scene/index.html",
            ["capabilities"] = new JsonArray("desk.read", "binding.launch"),
            ["buttonIds"] = new JsonArray(room["buttons"]![0]!["id"]!.GetValue<string>()) };
        room["start"] = content.DeepClone(); room["idle"] = content.DeepClone();
        room["desks"]![0]!["background"] = content.DeepClone();
        File.WriteAllText(path, room.ToJsonString());
        RefreshSnapshot(root);
    }
    private static void RefreshSnapshot(string root)
    {
        var room = JsonNode.Parse(File.ReadAllText(Path.Combine(root, "room.json")))!;
        var records = new JsonArray();
        foreach (var item in room["resources"]!.AsArray().Select(item => item!.GetValue<string>()).OrderBy(value => value, StringComparer.Ordinal))
        {
            var path = Path.Combine(root, item);
            records.Add(new JsonObject { ["path"] = item,
                ["sha256"] = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant(), ["size"] = new FileInfo(path).Length });
        }
        File.WriteAllText(Path.Combine(root, "installation.json"), new JsonObject { ["formatVersion"] = 1,
            ["roomId"] = room["id"]!.GetValue<string>(), ["manifestSha256"] = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Path.Combine(root, "room.json")))).ToLowerInvariant(),
            ["resources"] = records }.ToJsonString());
    }

    internal static void WithCopy(Action<string> test, string fixture = "installed-basic")
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
