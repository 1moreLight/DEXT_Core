using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Common;
using Lively.Grpc.Common.Proto.Desktop;

// Manual acceptance only. Temporarily mounts a private package into WorkerW,
// then restores the exact prior primary-display wallpaper on Enter or Ctrl+C.
static class WorkerWSceneProbe
{
    public static async Task Run()
    {
        var repo = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
        var expectedCore = Path.GetFullPath(Path.Combine(repo,
            "lively-core-separation/src/Lively/Lively/bin/x64/Debug/net9.0-windows10.0.18362.0"));
        var client = new DesktopService.DesktopServiceClient(
            new NamedPipeChannel(".", Constants.SingleInstance.GrpcPipeServerName));
        var identity = await client.GetCoreStatsAsync(new Empty());
        if (!string.Equals(Path.GetFullPath(identity.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar),
            expectedCore.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) ||
            identity.ProductName != "Dext")
            throw new Exception("The running Dext Core is not from this P2a worktree");

        async Task<List<GetWallpapersResponse>> Wallpapers()
        {
            var result = new List<GetWallpapersResponse>();
            using var call = client.GetWallpapers(new Empty());
            while (await call.ResponseStream.MoveNext(CancellationToken.None)) result.Add(call.ResponseStream.Current);
            return result;
        }
        var original = (await Wallpapers()).FirstOrDefault(item => item.Screen?.IsPrimary == true)
            ?? throw new Exception("No primary wallpaper is active; refusing to alter the desktop");
        if (!Directory.Exists(original.LivelyInfoPath))
            throw new Exception("Original wallpaper package is missing; refusing to alter the desktop");

        var fixture = Path.Combine(Path.GetTempPath(), "Dext-p2a-workerw-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(fixture, "scene"));
        var changed = false;
        var restored = false;
        try
        {
            var renderer = Path.Combine(repo, "wallpapers", "dext-room");
            foreach (var name in new[] { "LivelyInfo.json", "index.html", "style.css", "icon-feedback.css",
                "main.js", "capability-bridge.js", "layout.js", "layout-motion.js", "icon-feedback.js",
                "icon-preferences-layout.js", "icon-reorder-session.js" })
                File.Copy(Path.Combine(renderer, name), Path.Combine(fixture, name));
            var room = Path.Combine(repo, "rooms", "v3-p2a-probe");
            File.Copy(Path.Combine(room, "room.json"), Path.Combine(fixture, "room.json"));
            File.Copy(Path.Combine(room, "session.v3.json"), Path.Combine(fixture, "session.v3.json"));
            File.Copy(Path.Combine(room, "scene", "index.html"), Path.Combine(fixture, "scene", "index.html"));

            await client.SetWallpaperAsync(new SetWallpaperRequest {
                LivelyInfoPath = fixture, MonitorId = original.Screen.DeviceId
            });
            changed = true;
            var deadline = DateTime.UtcNow.AddSeconds(15);
            while (DateTime.UtcNow < deadline && !(await Wallpapers()).Any(item =>
                item.Screen?.DeviceId == original.Screen.DeviceId &&
                string.Equals(item.LivelyInfoPath, fixture, StringComparison.OrdinalIgnoreCase)))
                await Task.Delay(200);
            if (!(await Wallpapers()).Any(item =>
                item.Screen?.DeviceId == original.Screen.DeviceId &&
                string.Equals(item.LivelyInfoPath, fixture, StringComparison.OrdinalIgnoreCase)))
                throw new Exception("Core did not mount the P2a WorkerW fixture");

            Console.WriteLine("P2a scene is on the primary WorkerW desktop.");
            Console.WriteLine("Click the author button, switch desks twice, then double-click and drag official icons.");
            Console.WriteLine("Check the document ID and click count do not reset; press Enter or Ctrl+C to restore.");
            var stop = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            ConsoleCancelEventHandler handler = (_, eventArgs) => {
                eventArgs.Cancel = true;
                stop.TrySetResult();
            };
            Console.CancelKeyPress += handler;
            try { await Task.WhenAny(Task.Run(Console.ReadLine), stop.Task); }
            finally { Console.CancelKeyPress -= handler; }
        }
        finally
        {
            if (changed)
            {
                await client.SetWallpaperAsync(new SetWallpaperRequest {
                    LivelyInfoPath = original.LivelyInfoPath, MonitorId = original.Screen.DeviceId
                });
                var deadline = DateTime.UtcNow.AddSeconds(15);
                while (DateTime.UtcNow < deadline && !(await Wallpapers()).Any(item =>
                    item.Screen?.DeviceId == original.Screen.DeviceId &&
                    string.Equals(item.LivelyInfoPath, original.LivelyInfoPath, StringComparison.OrdinalIgnoreCase)))
                    await Task.Delay(200);
                restored = (await Wallpapers()).Any(item =>
                    item.Screen?.DeviceId == original.Screen.DeviceId &&
                    string.Equals(item.LivelyInfoPath, original.LivelyInfoPath, StringComparison.OrdinalIgnoreCase));
                if (!restored) Console.Error.WriteLine("Original wallpaper restore is unconfirmed: " + original.LivelyInfoPath);
                else Console.WriteLine("Original primary wallpaper restored: " + original.LivelyInfoPath);
            }
            if (restored || !changed)
            {
                for (var attempt = 0; attempt < 10 && Directory.Exists(fixture); attempt++) {
                    try { Directory.Delete(fixture, recursive: true); }
                    catch (Exception error) when (error is IOException or UnauthorizedAccessException) {
                        if (attempt == 9) Console.Error.WriteLine("P2a fixture remains locked: " + fixture);
                        else await Task.Delay(200);
                    }
                }
            }
        }
    }
}
