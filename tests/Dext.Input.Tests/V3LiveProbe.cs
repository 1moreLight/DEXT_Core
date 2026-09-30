using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Google.Protobuf.WellKnownTypes;
using GrpcDotNetNamedPipes;
using Lively.Common;
using Lively.Common.Helpers;
using Lively.Grpc.Common.Proto.Desktop;

// Runs only against a manually applied v3-core-probe Room on the live desktop.
static class V3LiveProbe
{
    public static async Task CheckStatus(string expectedDesk)
    {
        var client = new DesktopService.DesktopServiceClient(
            new NamedPipeChannel(".", Constants.SingleInstance.GrpcPipeServerName));
        var snapshot = await client.GetRoomSessionAsync(new Empty());
        if (expectedDesk == "inactive") {
            if (snapshot.Active) throw new Exception($"Expected no v3 session, got {snapshot.CurrentDeskId}");
        } else if (!snapshot.Active || snapshot.RoomId != "d2c89b4d-1253-45af-bd2e-16b830075e1a" ||
            snapshot.CurrentDeskId != expectedDesk || snapshot.PlayerPid <= 0) {
            throw new Exception($"Expected live {expectedDesk}, got active={snapshot.Active}, desk={snapshot.CurrentDeskId}");
        }
        Console.WriteLine($"PASS v3 live status: active={snapshot.Active}, desk={snapshot.CurrentDeskId}, session={snapshot.SessionId}, revision={snapshot.Revision}, player={snapshot.PlayerPid}");
    }

    public static async Task Run()
    {
        var client = new DesktopService.DesktopServiceClient(
            new NamedPipeChannel(".", Constants.SingleInstance.GrpcPipeServerName));
        var before = await client.GetRoomSessionAsync(new Empty());
        if (!before.Active || before.RoomId != "d2c89b4d-1253-45af-bd2e-16b830075e1a" ||
            before.CurrentDeskId != "probe-a" || before.PlayerPid <= 0)
            throw new Exception("Expected a live v3-core-probe session on probe-a");
        using var player = Process.GetProcessById(before.PlayerPid);
        IntPtr input = IntPtr.Zero;
        var logs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Dext", "Logs");
        var latest = new DirectoryInfo(logs).GetFiles("*.txt").OrderByDescending(file => file.LastWriteTimeUtc).First();
        using var logStream = new FileStream(latest.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var logReader = new StreamReader(logStream);
        foreach (var line in logReader.ReadToEnd().Split('\n').Reverse()) {
            var match = Regex.Match(line, "\\\"Type\\\":0,\\\"Hwnd\\\":([0-9]+)");
            if (!match.Success || !long.TryParse(match.Groups[1].Value, out var number)) continue;
            var form = (IntPtr)number;
            GetWindowThreadProcessId(form, out var pid);
            if (pid != (uint)before.PlayerPid) continue;
            var container = FindWindowExW(form, IntPtr.Zero, "Chrome_WidgetWin_0", null);
            if (container == IntPtr.Zero) continue;
            input = FindWindowExW(container, IntPtr.Zero, "Chrome_WidgetWin_1", null);
            if (input != IntPtr.Zero) break;
        }
        if (input == IntPtr.Zero) throw new Exception("Live Player WebView input window was not found");

        if (!GetClientRect(input, out var rect)) throw new Exception("Cannot measure Player WebView input");
        Console.WriteLine($"Live Player input: {rect.Right}x{rect.Bottom}");
        // Probe the two official Dock arrows at native scaling. This follows
        // the same mouse message path as Core's desktop input forwarder.
        foreach (var scale in new[] { 1.25, 1.0, 1.5 }) {
            foreach (var side in new[] { 1, -1 }) {
                var x = rect.Right / 2 + (int)Math.Round(side * 78 * scale);
                var y = rect.Bottom - (int)Math.Round(51 * scale);
                InputUtil.MouseMove(input, x, y);
                InputUtil.MouseLeftButtonDown(input, x, y);
                InputUtil.MouseLeftButtonUp(input, x, y);
                await Task.Delay(350);
                var after = await client.GetRoomSessionAsync(new Empty());
                if (after.Active && after.SessionId == before.SessionId &&
                    after.CurrentDeskId == "probe-b" && after.Revision > before.Revision &&
                    after.PlayerPid == before.PlayerPid) {
                    Console.WriteLine($"PASS live Core/Player v3 Desk: {before.CurrentDeskId} -> {after.CurrentDeskId}, revision {before.Revision} -> {after.Revision}, PID {after.PlayerPid}");
                    return;
                }
            }
        }
        throw new Exception("Live Player did not commit the requested Desk through Core");
    }

    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string className, string? title);
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr window, out Rect rect);
}
