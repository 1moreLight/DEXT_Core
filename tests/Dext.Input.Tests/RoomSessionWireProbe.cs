using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using Lively.Models.Message;
using Dext.Core.Rooms;

// Isolated Release Player transport test. It never applies a wallpaper or writes
// user Room data; saveRoom replies are captured only by this process's stdout.
internal static class RoomSessionWireProbe
{
    public static async Task Run(string player)
    {
        var fixture = Directory.CreateTempSubdirectory("Dext-v3-wire-");
        try
        {
            var index = Path.Combine(fixture.FullName, "index.html");
            File.WriteAllText(index, """
                <!doctype html><title>v3 wire probe</title><script>
                chrome.webview.addEventListener('message', event => {
                  if (event.data.type === 'dext:v3-session')
                    chrome.webview.postMessage(JSON.stringify({type:'saveRoom', room:{wire:event.data}}));
                });
                addEventListener('DOMContentLoaded', () =>
                  chrome.webview.postMessage(JSON.stringify({type:'saveRoom', room:{ready:true}})));
                </script>
                """);
            var info = new ProcessStartInfo(Path.GetFullPath(player))
            {
                UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(player))!
            };
            foreach (var arg in new[] { "--wallpaper-url", index, "--wallpaper-type", "local",
                "--wallpaper-geometry", "640x480", "--wallpaper-user-data", Path.Combine(fixture.FullName, "user-data"),
                "--dext-trusted-host" }) info.ArgumentList.Add(arg);
            using var process = Process.Start(info) ?? throw new Exception("wire Player did not start");
            var messages = new ConcurrentQueue<JsonElement>();
            var reader = Task.Run(async () =>
            {
                while (await process.StandardOutput.ReadLineAsync() is { } line)
                {
                    try
                    {
                        using var document = JsonDocument.Parse(line);
                        if (document.RootElement.TryGetProperty("RoomJson", out var json))
                        {
                            using var payload = JsonDocument.Parse(json.GetString()!);
                            messages.Enqueue(payload.RootElement.Clone());
                        }
                    }
                    catch (JsonException) { }
                }
            });
            var errors = process.StandardError.ReadToEndAsync();
            try
            {
                await Wait(value => value.TryGetProperty("ready", out _));
                var session = Guid.NewGuid();
                var transition = Guid.NewGuid();
                await Send(RoomSessionPlayerMessage.Create(new RoomSessionSnapshot(1, session, "wire-room", "home", "work", "media",
                    transition, 42, true, DateTimeOffset.Parse("2026-10-03T01:02:03Z"))
                {
                    InstallationStamp = "verified-wire-stamp", IsActive = true,
                    Lifecycle = new(RoomLifecycleStage.Desktop, false, false, 7)
                }, ["home", "work", "media"]));
                var moving = (await Wait(value => value.TryGetProperty("wire", out _))).GetProperty("wire");
                if (!moving.TryGetProperty("queuedDeskId", out var queue) || queue.GetString() != "media" ||
                    moving.GetProperty("installationStamp").GetString() != "verified-wire-stamp" ||
                    moving.GetProperty("sessionId").GetGuid() != session || moving.GetProperty("transitionId").GetGuid() != transition ||
                    moving.GetProperty("deadlineUtc").GetDateTimeOffset() != DateTimeOffset.Parse("2026-10-03T01:02:03Z") ||
                    !moving.GetProperty("active").GetBoolean() || moving.GetProperty("lifecycle").GetProperty("revision").GetInt64() != 7)
                    throw new Exception("Player lost full transition/lifecycle snapshot: " + moving.GetRawText());
                await Send(RoomSessionPlayerMessage.Create(new RoomSessionSnapshot(1, session, "wire-room", "work", null, null,
                    null, 43, false, null)
                {
                    InstallationStamp = "verified-wire-stamp", IsActive = false,
                    Lifecycle = new(RoomLifecycleStage.Idle, true, true, 8)
                }, ["home", "work", "media"]));
                var stopped = (await Wait(value => value.TryGetProperty("wire", out _))).GetProperty("wire");
                var life = stopped.GetProperty("lifecycle");
                if (stopped.GetProperty("active").GetBoolean() || stopped.GetProperty("operable").GetBoolean() ||
                    stopped.GetProperty("currentDeskId").GetString() != "work" ||
                    new[] { "targetDeskId", "queuedDeskId", "transitionId", "deadlineUtc" }.Any(name => stopped.GetProperty(name).ValueKind != JsonValueKind.Null) ||
                    life.GetProperty("stage").GetString() != "idle" || !life.GetProperty("playbackPaused").GetBoolean() ||
                    !life.GetProperty("locked").GetBoolean() || life.GetProperty("revision").GetInt64() != 8)
                    throw new Exception("Player lost inactive/orthogonal lifecycle/null fields");
                Console.WriteLine("PASS Release Player full v3 snapshot: queue/deadline/install/active/lifecycle and explicit nulls");
            }
            finally
            {
                if (!process.HasExited)
                {
                    await process.StandardInput.WriteLineAsync("{\"Type\":7}");
                    process.StandardInput.Close();
                    try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)); }
                    catch (TimeoutException) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); }
                }
                await reader;
            }
            async Task Send(object payload)
            {
                await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(payload));
                await process.StandardInput.FlushAsync();
            }
            async Task<JsonElement> Wait(Func<JsonElement, bool> accept)
            {
                var deadline = DateTime.UtcNow.AddSeconds(20);
                while (DateTime.UtcNow < deadline)
                {
                    while (messages.TryDequeue(out var value)) if (accept(value)) return value;
                    if (process.HasExited) throw new Exception("wire Player exited: " + await errors);
                    await Task.Delay(20);
                }
                throw new TimeoutException("wire Player did not deliver requested snapshot");
            }
        }
        finally
        {
            var temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!fixture.FullName.StartsWith(temp, StringComparison.OrdinalIgnoreCase)) throw new Exception("fixture outside temp");
            for (var attempt = 0; attempt < 20 && Directory.Exists(fixture.FullName); attempt++)
            {
                try { fixture.Delete(true); }
                catch (Exception error) when (error is IOException or UnauthorizedAccessException)
                { if (attempt == 19) Console.Error.WriteLine("wire fixture cleanup pending: " + fixture.FullName); else await Task.Delay(500); }
            }
        }
    }
}
