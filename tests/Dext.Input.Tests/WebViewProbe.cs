using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Lively.Common.Helpers;

static class WebViewProbe
{
    public static async Task Run(string player)
    {
        var start = new ProcessStartInfo(Path.GetFullPath(player)) {
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(player))!
        };
        foreach (var arg in new[] { "--wallpaper-url", Path.Combine(AppContext.BaseDirectory, "probe.html"),
            "--wallpaper-type", "local", "--wallpaper-geometry", "800x600", "--wallpaper-scale", "1",
            "--wallpaper-user-data", Path.Combine(Path.GetTempPath(), "Dext-input-probe-" + Guid.NewGuid()) })
            start.ArgumentList.Add(arg);
        using var process = Process.Start(start) ?? throw new Exception("Player failed to start");
        var messages = new ConcurrentQueue<JsonElement>();
        var reader = Task.Run(async () => {
            while (await process.StandardOutput.ReadLineAsync() is { } line) {
                try { messages.Enqueue(JsonDocument.Parse(line).RootElement.Clone()); } catch (JsonException) { }
            }
        });
        var errors = process.StandardError.ReadToEndAsync();
        IntPtr input = IntPtr.Zero;
        try
        {
            await Wait("ready");
            if (input == IntPtr.Zero) throw new Exception("No WebView input HWND");
            ShowWindow(GetAncestor(input, 2), 4); // The standalone production Player starts minimized.
            await Task.Delay(500);
            // Reproduce the exact pre-fix native sequence and its DOM buttons=8 signature.
            InputUtil.MouseLeftButtonDown(input, 80, 80);
            await Task.Delay(100);
            InputUtil.ForwardMessageMouse(input, 110, 110, 0x0200, (IntPtr)0x20);
            var bad = await Wait("canceled", "bad-buttons");
            if (!bad.GetProperty("events").EnumerateArray().Any(e => e.GetProperty("buttons").GetInt32() == 8))
                throw new Exception("Old native sequence did not reproduce buttons=8");
            Console.WriteLine("PASS old native flags reproduce WebView2 buttons=8: " + bad.GetRawText());
            InputUtil.MouseLeftButtonUp(input, 110, 110);
            InputUtil.ForwardMessageMouse(input, 110, 110, 0x0200, IntPtr.Zero);
            await Task.Delay(100);
            await process.StandardInput.WriteLineAsync("{\"Type\":15,\"Name\":\"reset\",\"Value\":\"reset\"}");
            await process.StandardInput.FlushAsync();
            await Wait("ready");
            var gesture = new MouseForwardingSession(InputUtil.ForwardMessageMouse);
            for (int i = 1; i <= 10; i++)
            {
                gesture.Begin(new[] { new MouseForwardingSession.Target(input, 0, 0) }, 80, 80, 0);
                await Task.Delay(30);
                gesture.Move(110, 110, 0);
                await Task.Delay(30);
                gesture.Move(140, 140, 0);
                gesture.End(140, 140, 0);
                var result = await Wait("settled");
                if (result.GetProperty("completed").GetInt32() != i || result.GetProperty("canceled").GetInt32() != 0)
                    throw new Exception("WebView2 gesture canceled or failed to complete: " + result);
                if (result.GetProperty("events").EnumerateArray().Any(e =>
                    e.GetProperty("type").GetString() == "pointermove" && e.GetProperty("buttons").GetInt32() != 1))
                    throw new Exception("Incorrect button state during actual WebView2 movement");
                if (i == 10) {
                    var events = result.GetProperty("events").EnumerateArray().ToArray();
                    if (events.Count(e => e.GetProperty("type").GetString() == "pointermove") < 10 ||
                        events.Count(e => e.GetProperty("type").GetString() == "pointerup" && e.GetProperty("buttons").GetInt32() == 0) != 10)
                        throw new Exception("Missing WebView2 movement/release events");
                    if (events.Count(e => e.GetProperty("type").GetString() == "gotpointercapture") != 10)
                        throw new Exception("Not every WebView2 gesture acquired pointer capture");
                }
            }
            Console.WriteLine("PASS 10 WebView2 native input sequences: moves buttons=1, up buttons=0 completes once, no cancellation");
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

        async Task<JsonElement> Wait(params string[] stages)
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
                        if (stages.Contains(payload.GetProperty("stage").GetString())) return payload;
                    }
                }
                if (process.HasExited) throw new Exception("Player exited: " + await errors);
                await Task.Delay(20);
            }
            throw new TimeoutException("No WebView2 event " + string.Join("/", stages));
        }
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string className, string title);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
}
