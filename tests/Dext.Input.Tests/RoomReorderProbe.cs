using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Lively.Common.Helpers;

static class RoomReorderProbe
{
    public static async Task Run(string player)
    {
        var source = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../wallpapers/dext-room"));
        if (!File.Exists(Path.Combine(source, "main.js")))
            throw new Exception("Production Room source was not found: " + source);
        var fixture = Path.Combine(Path.GetTempPath(), "Dext-room-reorder-probe-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(fixture);
        try
        {
            foreach (var name in new[] { "index.html", "style.css", "icon-feedback.css", "main.js",
                "capability-bridge.js", "layout.js", "layout-motion.js", "icon-feedback.js",
                "icon-preferences-layout.js", "icon-reorder-session.js" }) {
                File.Copy(Path.Combine(source, name), Path.Combine(fixture, name));
                if (!SHA256.HashData(File.ReadAllBytes(Path.Combine(source, name)))
                    .SequenceEqual(SHA256.HashData(File.ReadAllBytes(Path.Combine(fixture, name)))))
                    throw new Exception("Fixture source hash mismatch: " + name);
            }
            File.Copy(Path.Combine(AppContext.BaseDirectory, "room-reorder-observer.js"),
                Path.Combine(fixture, "room-reorder-observer.js"));
            var index = Path.Combine(fixture, "index.html");
            File.WriteAllText(index, File.ReadAllText(index).Replace("</body>",
                "<script src=\"room-reorder-observer.js\"></script></body>"));
            File.WriteAllText(Path.Combine(fixture, "room.json"), JsonSerializer.Serialize(new {
                version = 2, startDesk = 0, @switch = "none", switches = new { },
                desks = new[] { new { name = "probe", background = (object?)null,
                    iconSize = "medium", widgets = Array.Empty<object>(),
                    icons = new[] { new { label = "A", glyph = "A", color = "#346", x = 0, y = 0 },
                        new { label = "B", glyph = "B", color = "#457", x = 1, y = 0 },
                        new { label = "C", glyph = "C", color = "#568", x = 2, y = 0 } } } }
            }));
            var start = new ProcessStartInfo(Path.GetFullPath(player)) {
                UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(player))!
            };
            foreach (var arg in new[] { "--wallpaper-url", index, "--wallpaper-type", "local",
                "--wallpaper-geometry", "800x600", "--wallpaper-scale", "1",
                "--wallpaper-user-data", Path.Combine(fixture, "user-data") }) start.ArgumentList.Add(arg);
            using var process = Process.Start(start) ?? throw new Exception("Player did not start");
            var messages = new ConcurrentQueue<JsonElement>();
            var reader = Task.Run(async () => {
                while (await process.StandardOutput.ReadLineAsync() is { } line) {
                    try { messages.Enqueue(JsonDocument.Parse(line).RootElement.Clone()); } catch (JsonException) { }
                }
            });
            var errors = process.StandardError.ReadToEndAsync();
            IntPtr input = IntPtr.Zero;
            var saves = 0;
            try
            {
                var ready = await Wait("ready");
                if (input == IntPtr.Zero || ready.GetProperty("icons").GetArrayLength() != 3)
                    throw new Exception("Real Room icons were not loaded in the Player");
                ShowWindow(GetAncestor(input, 2), 4);
                await Task.Delay(500);
                var startIcon = ready.GetProperty("icons")[0];
                var ax = Center(startIcon, "left", "width");
                var ay = Center(startIcon, "top", "height");
                InputUtil.MouseLeftButtonDown(input, ax, ay);
                await Task.Delay(550);
                InputUtil.MouseLeftButtonUp(input, ax, ay);
                var editing = await Wait("editing");
                if (!editing.GetProperty("editing").GetBoolean())
                    throw new Exception("Native long press did not enter editing");
                // The Player's --wallpaper-geometry may scale native client messages even
                // when devicePixelRatio reports 1. Calibrate from an observed real down.
                var scale = editing.GetProperty("downX").GetDouble() / ax;
                if (scale <= 0) throw new Exception("Invalid native-to-CSS coordinate scale");

                for (var round = 0; round < 10; round++)
                {
                    var before = await Measure("before-" + round);
                    var icons = before.GetProperty("icons");
                    ax = (int)Math.Round(Center(icons[0], "left", "width") / scale);
                    ay = (int)Math.Round(Center(icons[0], "top", "height") / scale);
                    var destination = (int)Math.Round(Center(icons[2], "left", "width") / scale);
                    var held = new MouseForwardingSession(InputUtil.ForwardMessageMouse);
                    held.Begin(new[] { new MouseForwardingSession.Target(input, 0, 0) }, ax, ay, 0);
                    await Task.Delay(60);
                    for (var step = 1; step <= 5; step++) {
                        held.Move(ax + (destination - ax) * step / 5, ay, 0);
                        await Task.Delay(35);
                    }
                    var preview = await Measure("preview-" + round);
                    if (!preview.GetProperty("icons")[0].GetProperty("dragging").GetBoolean() ||
                        Math.Abs(preview.GetProperty("icons")[0].GetProperty("left").GetDouble() - destination * scale + icons[0].GetProperty("width").GetDouble() / 2) > 18)
                        throw new Exception($"Real Room icon stopped following native pointer: start={before.GetRawText()} preview={preview.GetRawText()} destination={destination}");
                    if (preview.GetProperty("positions")[0].GetInt32() != before.GetProperty("positions")[0].GetInt32())
                        throw new Exception("Room changed before pointerup");
                    if (!Enumerable.Range(1, 2).Any(peer =>
                        preview.GetProperty("icons")[peer].GetProperty("x").GetString() !=
                        before.GetProperty("icons")[peer].GetProperty("x").GetString()))
                        throw new Exception("Real Room peers did not preview the path before pointerup");
                    held.End(destination, ay, 0);
                    await Task.Delay(100);
                    var after = await Measure("after-" + round);
                    if (after.GetProperty("canceled").GetInt32() != 0 || after.GetProperty("moves").GetInt32() < round + 1)
                        throw new Exception("Real Room lost the native pointer sequence");
                    if (after.GetProperty("positions")[0].GetInt32() != before.GetProperty("positions")[2].GetInt32())
                        throw new Exception($"Path reorder did not commit: round={round} before={before.GetRawText()} preview={preview.GetRawText()} after={after.GetRawText()} saves={saves}");
                    if (saves != round + 1) throw new Exception($"Expected {round + 1} saves, got {saves}");
                }
                Console.WriteLine("PASS 10 real Room native drags: follows pointer, previews without mutation, saves once per drop");
            }
            finally
            {
                if (!process.HasExited) {
                    await process.StandardInput.WriteLineAsync("{\"Type\":7}");
                    process.StandardInput.Close();
                    try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)); }
                    catch (TimeoutException) { process.Kill(entireProcessTree: true); }
                }
            }

            async Task<JsonElement> Measure(string stage)
            {
                await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { Type = 15, Name = "measure", Value = stage }));
                await process.StandardInput.FlushAsync();
                return await Wait(stage);
            }
            async Task<JsonElement> Wait(string stage)
            {
                var deadline = DateTime.UtcNow.AddSeconds(20);
                while (DateTime.UtcNow < deadline)
                {
                    while (messages.TryDequeue(out var message))
                    {
                        if (message.TryGetProperty("Hwnd", out var hwnd)) {
                            var container = FindWindowExW((IntPtr)hwnd.GetInt64(), IntPtr.Zero, "Chrome_WidgetWin_0", null);
                            input = FindWindowExW(container, IntPtr.Zero, "Chrome_WidgetWin_1", null);
                        }
                        if (message.TryGetProperty("RoomJson", out var json)) {
                            var payload = JsonDocument.Parse(json.GetString()!).RootElement.Clone();
                            if (payload.TryGetProperty("stage", out var seen) && seen.GetString() == stage) return payload;
                            if (payload.TryGetProperty("version", out _)) {
                                foreach (var desk in payload.GetProperty("desks").EnumerateArray())
                                    foreach (var icon in desk.GetProperty("icons").EnumerateArray())
                                        if (icon.TryGetProperty("launch", out _))
                                            throw new Exception("Reordering added launch to a legacy glyph icon");
                                saves++;
                            }
                        }
                    }
                    if (process.HasExited) throw new Exception("Player exited: " + await errors);
                    await Task.Delay(20);
                }
                throw new TimeoutException("No real Room probe stage " + stage + "; stderr: " + await errors);
            }
        }
        finally
        {
            var tempRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (Path.GetFullPath(fixture).StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase)) {
                for (var attempt = 0; attempt < 10 && Directory.Exists(fixture); attempt++) {
                    try { Directory.Delete(fixture, recursive: true); }
                    catch (Exception error) when (error is IOException or UnauthorizedAccessException) {
                        if (attempt == 9) Console.Error.WriteLine("Temporary Room fixture remains locked: " + fixture);
                        else await Task.Delay(200);
                    }
                }
            }
        }
    }

    private static int Center(JsonElement icon, string start, string size) =>
        (int)Math.Round(icon.GetProperty(start).GetDouble() + icon.GetProperty(size).GetDouble() / 2);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string className, string? title);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
}
