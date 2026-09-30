using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using Lively.Models.Message;
using Dext.Core.Rooms;

static class ContinuousSceneProbe
{
    public static async Task Run(string player)
    {
        var repo = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
        var renderer = Path.Combine(repo, "wallpapers", "dext-room");
        var room = Path.Combine(repo, "rooms", "v3-p2a-probe");
        var fixture = Path.Combine(Path.GetTempPath(), "Dext-p2a-probe-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(fixture, "scene"));
        try
        {
            foreach (var name in new[] { "index.html", "style.css", "icon-feedback.css", "main.js",
                "capability-bridge.js", "layout.js", "layout-motion.js", "icon-feedback.js",
                "icon-preferences-layout.js", "icon-reorder-session.js" })
            {
                var source = Path.Combine(renderer, name);
                var destination = Path.Combine(fixture, name);
                File.Copy(source, destination);
                if (!SHA256.HashData(File.ReadAllBytes(source))
                    .SequenceEqual(SHA256.HashData(File.ReadAllBytes(destination))))
                    throw new Exception("P2a renderer fixture hash mismatch: " + name);
            }
            File.Copy(Path.Combine(room, "room.json"), Path.Combine(fixture, "room.json"));
            File.Copy(Path.Combine(room, "scene", "index.html"), Path.Combine(fixture, "scene", "index.html"));
            var index = Path.Combine(fixture, "index.html");
            File.WriteAllText(index, File.ReadAllText(index).Replace("</body>",
                "<script src=\"continuous-scene-observer.js\"></script></body>"));
            File.Copy(Path.Combine(AppContext.BaseDirectory, "continuous-scene-observer.js"),
                Path.Combine(fixture, "continuous-scene-observer.js"));

            var start = new ProcessStartInfo(Path.GetFullPath(player)) {
                UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(player))!
            };
            foreach (var arg in new[] { "--wallpaper-url", index, "--wallpaper-type", "local",
                "--wallpaper-geometry", "1280x800", "--wallpaper-scale", "1.25",
                "--wallpaper-user-data", Path.Combine(fixture, "user-data"),
                "--dext-trusted-host" }) start.ArgumentList.Add(arg);
            using var process = Process.Start(start) ?? throw new Exception("P2a Player did not start");
            var messages = new ConcurrentQueue<JsonElement>();
            var protocolMessages = new ConcurrentQueue<JsonElement>();
            var reader = Task.Run(async () => {
                while (await process.StandardOutput.ReadLineAsync() is { } line) {
                    try {
                        var message = JsonDocument.Parse(line).RootElement.Clone();
                        if (message.TryGetProperty("Type", out var kind) &&
                            kind.ValueKind == JsonValueKind.Number &&
                            (kind.GetInt32() == (int)MessageType.msg_room_session_request ||
                             kind.GetInt32() == (int)MessageType.msg_room_transition_complete))
                            protocolMessages.Enqueue(message);
                        else messages.Enqueue(message);
                    }
                    catch (JsonException) { }
                }
            });
            var errors = process.StandardError.ReadToEndAsync();
            using var kernel = new RoomSessionKernel(new ProbeCheckpointStore());
            var gateway = new RoomSessionProtocolGateway(kernel, new ProbeAdmissionAuthority(process.Id));
            var coordinator = new RoomSessionPeer("core-probe");
            var control = gateway.Open(coordinator, new RoomSessionHello(RoomSessionKernel.ProtocolVersion,
                RoomClientRole.Coordinator, "install-a"));
            if (control.ConnectionId is null) throw new Exception("Probe coordinator denied");
            var session = gateway.Start(control.ConnectionId.Value, coordinator).Snapshot
                ?? throw new Exception("Probe session did not start");
            RoomSessionPlayerBridge? bridge = null;
            try
            {
                var first = await Wait(state =>
                    state.TryGetProperty("childState", out var child) && child.ValueKind == JsonValueKind.Object &&
                    child.TryGetProperty("desk", out var desk) && desk.ValueKind == JsonValueKind.Number &&
                    desk.GetInt32() == 0);
                var id = first.GetProperty("childState").GetProperty("documentId").GetString();
                if (string.IsNullOrEmpty(id) || first.GetProperty("frames").GetInt32() != 1)
                    throw new Exception("P2a Player did not mount exactly one continuous document");
                var viewport = first.GetProperty("viewport");
                var scene = first.GetProperty("scene");
                Near(scene.GetProperty("x").GetDouble(), viewport.GetProperty("width").GetDouble() * 620 / 1920);
                Near(scene.GetProperty("y").GetDouble(), viewport.GetProperty("height").GetDouble() * 200 / 1080);
                Near(scene.GetProperty("width").GetDouble(), viewport.GetProperty("width").GetDouble() * 700 / 1920);
                Near(scene.GetProperty("height").GetDouble(), viewport.GetProperty("height").GetDouble() * 560 / 1080);

                await Send("p2a-next", "next");
                var second = await Wait(state =>
                    state.GetProperty("desk").GetInt32() == 1 &&
                    state.TryGetProperty("childState", out var child) && child.ValueKind == JsonValueKind.Object &&
                    child.GetProperty("desk").GetInt32() == 1);
                Check(second, id, "Official B");

                await Send("p2a-next", "next");
                var third = await Wait(state =>
                    state.GetProperty("desk").GetInt32() == 0 &&
                    state.TryGetProperty("childState", out var child) && child.ValueKind == JsonValueKind.Object &&
                    child.GetProperty("desk").GetInt32() == 0);
                Check(third, id, "Official A");
                Console.WriteLine("PASS Release WebView2 Player P2a: same sandbox document across desks, one frame, geometry and official icons");

                var status = RoomSessionPlayerBridge.Connect(gateway,
                    new RoomSessionPeer($"player-process:{process.Id}"), "install-a", snapshot => {
                        lock (process.StandardInput)
                        {
                            process.StandardInput.WriteLine(JsonSerializer.Serialize(new LivelyMessageRoomSessionSnapshot {
                                ProtocolVersion = snapshot.ProtocolVersion,
                                SessionId = snapshot.SessionId,
                                RoomId = snapshot.RoomId,
                                DeskIds = ["home", "work"],
                                CurrentDeskId = snapshot.CurrentDeskId,
                                TargetDeskId = snapshot.TargetDeskId,
                                TransitionId = snapshot.TransitionId,
                                Revision = snapshot.Revision,
                                IsOperable = snapshot.IsOperable,
                            }));
                            process.StandardInput.Flush();
                        }
                    }, out bridge);
                if (status != RoomProtocolStatus.Accepted || bridge is null)
                    throw new Exception("Probe Player bridge denied: " + status);
                await Send("p2a-next", "next");
                var requested = await WaitProtocol(MessageType.msg_room_session_request);
                if (requested.GetProperty("SessionId").GetGuid() != session.SessionId ||
                    requested.GetProperty("DeskId").GetString() != "work")
                    throw new Exception("Player did not request the Core-owned next Desk");
                var moving = bridge.Request(requested.GetProperty("SessionId").GetGuid(),
                    requested.GetProperty("DeskId").GetString()!);
                if (moving.Status != RoomProtocolStatus.Accepted || moving.Snapshot?.TransitionId is null)
                    throw new Exception("Core rejected the Player Desk request: " + moving.Status);
                var completed = await WaitProtocol(MessageType.msg_room_transition_complete);
                if (completed.GetProperty("SessionId").GetGuid() != session.SessionId ||
                    completed.GetProperty("TransitionId").GetGuid() != moving.Snapshot.TransitionId)
                    throw new Exception("Player did not acknowledge the Core transition");
                var committed = bridge.Complete(completed.GetProperty("SessionId").GetGuid(),
                    completed.GetProperty("TransitionId").GetGuid());
                if (committed.Status != RoomProtocolStatus.Accepted ||
                    committed.Snapshot?.CurrentDeskId != "work")
                    throw new Exception("Core did not commit Player completion: " + committed.Status);
                var coreDriven = await Wait(state => state.GetProperty("desk").GetInt32() == 1 &&
                    state.GetProperty("childState").GetProperty("desk").GetInt32() == 1);
                Check(coreDriven, id, "Official B");
                Console.WriteLine("PASS Gateway-to-Release Player v3 IPC: request, authoritative snapshots and completion; persistent scene unchanged");
            }
            finally
            {
                bridge?.Dispose();
                if (!process.HasExited) {
                    await process.StandardInput.WriteLineAsync("{\"Type\":7}");
                    process.StandardInput.Close();
                    try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)); }
                    catch (TimeoutException) { process.Kill(entireProcessTree: true); }
                }
            }

            async Task Send(string name, string value)
            {
                await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { Type = 15, Name = name, Value = value }));
                await process.StandardInput.FlushAsync();
            }
            async Task<JsonElement> WaitProtocol(MessageType type)
            {
                var deadline = DateTime.UtcNow.AddSeconds(20);
                while (DateTime.UtcNow < deadline)
                {
                    while (protocolMessages.TryDequeue(out var message))
                    {
                        if (message.GetProperty("Type").GetInt32() == (int)type) return message;
                    }
                    if (process.HasExited) throw new Exception("P2a Player exited: " + await errors);
                    await Task.Delay(20);
                }
                throw new TimeoutException("v3 Player IPC message missing: " + type);
            }
            async Task<JsonElement> Wait(Func<JsonElement, bool> accept)
            {
                var deadline = DateTime.UtcNow.AddSeconds(20);
                while (DateTime.UtcNow < deadline)
                {
                    while (messages.TryDequeue(out var message))
                    {
                        if (!message.TryGetProperty("RoomJson", out var json)) continue;
                        var state = JsonDocument.Parse(json.GetString()!).RootElement.Clone();
                        if (accept(state)) return state;
                    }
                    if (process.HasExited) throw new Exception("P2a Player exited: " + await errors);
                    await Task.Delay(20);
                }
                throw new TimeoutException("P2a Player scene did not advance; stderr: " + await errors);
            }
        }
        finally
        {
            var tempRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (Path.GetFullPath(fixture).StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase))
            {
                for (var attempt = 0; attempt < 10 && Directory.Exists(fixture); attempt++)
                {
                    try { Directory.Delete(fixture, recursive: true); }
                    catch (Exception error) when (error is IOException or UnauthorizedAccessException) {
                        if (attempt == 9) Console.Error.WriteLine("P2a fixture remains locked: " + fixture);
                        else await Task.Delay(200);
                    }
                }
            }
        }
    }

    private static void Check(JsonElement state, string id, string icon)
    {
        if (state.GetProperty("frames").GetInt32() != 1 ||
            state.GetProperty("childState").GetProperty("documentId").GetString() != id ||
            state.GetProperty("icon").GetString() != icon)
            throw new Exception("P2a Player scene or official icon diverged: " + state.GetRawText());
    }

    private static void Near(double actual, double expected)
    {
        if (Math.Abs(actual - expected) > 2)
            throw new Exception($"P2a Player geometry differs: actual={actual}, expected={expected}");
    }
}

internal sealed class ProbeAdmissionAuthority(int playerPid) : IRoomSessionAdmissionAuthority
{
    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
    {
        if (hello.RoomId != "install-a") return null;
        var allowed = peer.TransportId switch
        {
            "core-probe" => RoomClientRole.Coordinator,
            var id when id == $"player-process:{playerPid}" => RoomClientRole.DesktopPlayer,
            _ => (RoomClientRole?)null,
        };
        return allowed != hello.Role ? null : new RoomSessionAdmission(peer.TransportId,
            allowed.Value, new VerifiedRoomInstallation("install-a", "probe-installation",
                ["home", "work"], "home"));
    }
}

internal sealed class ProbeCheckpointStore : IRoomSessionCheckpointStore
{
    private RoomSessionCheckpoint? current;
    public RoomSessionCheckpoint? Read() => current;
    public void Write(RoomSessionCheckpoint checkpoint) => current = checkpoint;
    public void Clear() => current = null;
}
