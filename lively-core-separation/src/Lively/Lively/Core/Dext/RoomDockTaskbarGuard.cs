using Lively.Common.Helpers;
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

// Dedicated mode of the bundled Watchdog; not the wallpaper CLR/ADD list.
// Its durable journal survives either side. No taskbar mutation happens here
// until the helper has acknowledged the exact lease/process identity.
internal sealed class RoomDockTaskbarGuard
{
    private static readonly NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();
    private readonly Process process;
    private readonly string lease = Guid.NewGuid().ToString("D");
    private readonly int corePid;
    private readonly long coreStarted;
    private readonly Action changed;
    private readonly TaskCompletionSource<bool> initialized = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource exited = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource stopped = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Timer? pulse;
    private volatile bool wanted, hidden;
    private long lastWanted, lastReceived;
    private int sending, stopping, faulted;
    private Task recovery = Task.CompletedTask;
    internal string? Error { get; private set; }
    internal bool IsAlive { get { try { return !process.HasExited; } catch { return false; } } }
    internal bool Ready => Volatile.Read(ref stopping) == 0 && wanted && hidden && IsAlive;

    private RoomDockTaskbarGuard(int dockPid, Action changed)
    {
        this.changed = changed;
        using (var core = Process.GetCurrentProcess())
        { corePid = core.Id; coreStarted = core.StartTime.ToUniversalTime().Ticks; }
        var dockStarted = DextDockTaskbarRecovery.ProcessStarted(dockPid);
        process = new Process { EnableRaisingEvents = true, StartInfo = new ProcessStartInfo {
            FileName = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "Watchdog", "Lively.Watchdog.exe"),
            Arguments = $"--dext-dock-guard {corePid} {coreStarted} {dockPid} {dockStarted} {lease}",
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true
        }};
        process.OutputDataReceived += OnOutput;
        process.Exited += OnExited;
    }

    internal static async Task<RoomDockTaskbarGuard> StartAsync(int dockPid, Action changed, CancellationToken cancellation)
    {
        var guard = new RoomDockTaskbarGuard(dockPid, changed);
        try
        {
            if (!File.Exists(guard.process.StartInfo.FileName)) throw new FileNotFoundException("Bundled Dock recovery helper missing");
            guard.lastReceived = Stopwatch.GetTimestamp();
            guard.process.Start();
            guard.process.BeginOutputReadLine();
            if (!await guard.initialized.Task.WaitAsync(TimeSpan.FromSeconds(5), cancellation))
                throw new InvalidOperationException("Dock recovery helper initialization failed");
            guard.pulse = new Timer(guard.Pulse, null, 0, 1000);
            return guard;
        }
        catch { await guard.StopAsync(); throw; }
    }

    internal static void RecoverPrevious()
    {
        try
        {
            using var core = Process.GetCurrentProcess();
            if (!DextDockTaskbarRecovery.Recover(null, core.Id, core.StartTime.ToUniversalTime().Ticks))
                Logger.Warn("v3 taskbar recovery still owned by a live helper or waiting for Explorer");
        }
        catch (Exception error) { Logger.Error(error, "v3 previous taskbar recovery failed; journal retained"); }
    }

    internal void SetWanted(bool value)
    {
        Interlocked.Exchange(ref lastWanted, Stopwatch.GetTimestamp());
        if (wanted == value) return;
        wanted = value;
        if (!value) hidden = false;
        changed();
    }

    private void OnOutput(object sender, DataReceivedEventArgs args)
    {
        if (args.Data == null || args.Data.Length > 256) return;
        var fields = args.Data.Split(' ');
        if (fields.Length < 2 || fields[1] != lease) return;
        if (fields[0] is not ("READY" or "PULSE" or "HIDDEN" or "WAITING" or "RESTORED" or "RESTORE_PENDING" or "FAULT")) return;
        Interlocked.Exchange(ref lastReceived, Stopwatch.GetTimestamp());
        if (fields[0] == "READY") initialized.TrySetResult(true);
        if (fields[0] == "PULSE")
        {
            var confirmed = fields.Length == 3 && fields[2] == "HIDDEN";
            if (confirmed != hidden) { hidden = confirmed; changed(); }
            return;
        }
        hidden = fields[0] == "HIDDEN";
        Error = fields[0] == "FAULT" || fields[0] == "RESTORE_PENDING"
            ? "Windows 任务栏恢复尚未确认，保留恢复记录。" : null;
        if (fields[0] == "FAULT") initialized.TrySetResult(false);
        changed();
    }

    private void Pulse(object? state)
    {
        if (Volatile.Read(ref stopping) != 0) return;
        if (!IsAlive || Age(Interlocked.Read(ref lastReceived)) > 5)
        { Fault(); return; }
        var active = wanted && Age(Interlocked.Read(ref lastWanted)) < 3;
        _ = SendAsync($"STATE {lease} {(active ? 1 : 0)}");
    }

    private async Task SendAsync(string text)
    {
        if (Interlocked.CompareExchange(ref sending, 1, 0) != 0) return;
        try { if (IsAlive) await process.StandardInput.WriteLineAsync(text).ConfigureAwait(false); }
        catch (Exception error) { Logger.Warn(error, "v3 Dock guard pipe lost"); Fault(); }
        finally { Interlocked.Exchange(ref sending, 0); }
    }

    private void Fault()
    {
        if (Interlocked.Exchange(ref faulted, 1) != 0) return;
        hidden = false;
        Error = "任务栏恢复看护已断开，正在还原 Windows 任务栏。";
        initialized.TrySetResult(false);
        try { if (IsAlive) process.Kill(); } catch { }
        changed();
    }

    private void OnExited(object? sender, EventArgs args)
    {
        hidden = false;
        initialized.TrySetResult(false);
        recovery = Task.Run(RecoverOwnedAsync);
        exited.TrySetResult();
        changed();
    }

    private async Task RecoverOwnedAsync()
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            try { if (DextDockTaskbarRecovery.Recover(lease, corePid, coreStarted)) return; }
            catch (Exception error) { Logger.Warn(error, "v3 taskbar fallback recovery deferred"); }
            await Task.Delay(250);
        }
        Error = "Windows 任务栏恢复尚未确认，保留恢复记录供下次启动还原。";
    }

    internal async Task StopAsync()
    {
        if (Interlocked.Exchange(ref stopping, 1) != 0) { await stopped.Task; return; }
        try
        {
            pulse?.Dispose();
            hidden = wanted = false;
            if (IsAlive)
            {
                _ = SendAsync("QUIT " + lease);
                if (await Task.WhenAny(exited.Task, Task.Delay(3000)) != exited.Task)
                { try { if (IsAlive) process.Kill(); } catch { } }
                await Task.WhenAny(exited.Task, Task.Delay(2000));
            }
            // A hung Explorer API must not hold the entire Dock worker indefinitely.
            // The owned recovery task keeps its handle/journal; no new helper can
            // acquire its recovery mutex until it actually finishes.
            await Task.WhenAny(recovery, Task.Delay(5000));
            process.OutputDataReceived -= OnOutput;
            process.Exited -= OnExited;
            process.Dispose();
        }
        finally { stopped.TrySetResult(); }
    }

    private static double Age(long stamp) => (Stopwatch.GetTimestamp() - stamp) / (double)Stopwatch.Frequency;
}