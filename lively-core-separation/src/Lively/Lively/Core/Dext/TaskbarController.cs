using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

internal interface ITaskbarLease
{
    bool IsAlive { get; }
    bool Ready { get; }
    string? Error { get; }
    void SetWanted(bool wanted);
    Task StopAsync();
}

// One owner serializes manual commands and the Room Dock's automatic requests.
internal sealed class TaskbarController : IDisposable
{
    private readonly string path;
    private readonly int corePid;
    private readonly Func<int, Task<ITaskbarLease>> acquire;
    private readonly Func<bool?> visible;
    private readonly Func<Task<bool>> recover;
    private Task<bool>? recovery;
    private bool recoveryPending = true;
    private readonly SemaphoreSlim serial = new(1, 1);
    private readonly object requests = new();
    private ITaskbarLease? lease;
    private int leasePid, automaticPid, polling;
    private long automaticStamp;
    private Timer? timer;
    private bool disposed, loadFailed;
    private string mode = "auto";
    private string? error;
    private DateTime retryAfter;
    public string Mode => mode;
    public bool Hidden => lease?.Ready == true;
    public string? Error => error ?? lease?.Error;
    public bool ReadyFor(int pid) => leasePid == pid && Hidden;
    // Geometry may still move while a taskbar lease is acquired or restored.
    // A deliberately visible taskbar is a supported settled state as well.
    public bool DockActionsReady(int pid) => !disposed && !recoveryPending && pid > 0 &&
        (mode == "visible" ? lease == null : mode == "hidden" ? ReadyFor(corePid) :
            DesiredPid() == pid && ReadyFor(pid));
    public object Status() => new { mode = Mode, hidden = Hidden, visible = visible(), error = Error };

    public TaskbarController(string path, int corePid, Func<int, Task<ITaskbarLease>> acquire, Func<bool?> visible, Func<Task<bool>>? recover = null)
    {
        this.path = path; this.corePid = corePid; this.acquire = acquire; this.visible = visible; this.recover = recover ?? (() => Task.FromResult(true));
        try { if (File.Exists(path)) { mode = JsonSerializer.Deserialize<string>(File.ReadAllText(path))!; Validate(mode); } }
        catch (Exception ex) { mode = "visible"; loadFailed = true; error = "任务栏偏好无法读取，原文件已保留：" + ex.Message; }
    }
    private static void Validate(string value)
    { if (value is not ("auto" or "hidden" or "visible")) throw new ArgumentException("未知任务栏模式。"); }

    public void Start() => timer ??= new Timer(_ =>
    {
        if (Interlocked.Exchange(ref polling, 1) == 0) _ = PollAsync();
    }, null, 0, 500);
    private async Task PollAsync()
    { try { await TickAsync().ConfigureAwait(false); } finally { Interlocked.Exchange(ref polling, 0); } }

    public void RequestAutomatic(int pid, bool wanted)
    {
        lock (requests)
        {
            if (disposed) return;
            if (wanted && pid > 0) { automaticPid = pid; automaticStamp = Stopwatch.GetTimestamp(); }
            else if (pid == automaticPid) { automaticPid = 0; automaticStamp = 0; }
        }
    }
    private int DesiredPid()
    {
        lock (requests)
        {
            if (disposed || mode == "visible") return 0;
            if (mode == "hidden") return corePid;
            return (Stopwatch.GetTimestamp() - automaticStamp) / (double)Stopwatch.Frequency < 3 ? automaticPid : 0;
        }
    }
    public async Task SetModeAsync(string value)
    {
        Validate(value);
        await serial.WaitAsync().ConfigureAwait(false);
        try
        {
            if (disposed) throw new ObjectDisposedException(nameof(TaskbarController));
            if (loadFailed && value != "visible") throw new InvalidOperationException(error);
            if (!loadFailed)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
                var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try { File.WriteAllText(temporary, JsonSerializer.Serialize(value)); File.Move(temporary, path, true); }
                finally { if (File.Exists(temporary)) File.Delete(temporary); }
            }
            mode = value;
            if (!loadFailed) error = null;
            if (value == "visible") recoveryPending = true;
            retryAfter = DateTime.MinValue;
            await ReconcileAsync().ConfigureAwait(false);
        }
        finally { serial.Release(); }
    }
    public async Task TickAsync()
    {
        await serial.WaitAsync().ConfigureAwait(false);
        try { await ReconcileAsync().ConfigureAwait(false); }
        finally { serial.Release(); }
    }
    // Releasing a request is not proof that its watchdog or recovery journal is gone.
    public async Task<bool> ReleaseAutomaticAsync(int pid)
    {
        RequestAutomatic(pid, false);
        await serial.WaitAsync().ConfigureAwait(false);
        try
        {
            await ReconcileAsync().ConfigureAwait(false);
            // Polling is non-blocking, but a host handoff needs the result of the
            // recovery already in flight before classifying the old owner as failed.
            if (recoveryPending && recovery is { IsCompleted: false } pending)
            {
                try { await pending.WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false); }
                catch (TimeoutException) { return false; }
                catch { return false; }
                await ReconcileAsync().ConfigureAwait(false);
            }
            // Application Dock shares Core PID with manual hide; that independent user request may remain.
            return (pid <= 0 || leasePid != pid || mode == "hidden" && leasePid == corePid) && !recoveryPending;
        }
        finally { serial.Release(); }
    }
    private async Task ReconcileAsync()
    {
        try
        {
            var desired = DesiredPid();
            if (lease != null && (leasePid != desired || !lease.IsAlive))
            {
                lease.SetWanted(false);
                await lease.StopAsync().ConfigureAwait(false);
                error = lease.Error;
                lease = null; leasePid = 0; recoveryPending = true;
            }
            if (recoveryPending)
            {
                recovery ??= recover();
                if (!recovery.IsCompleted)
                { error ??= "Windows 任务栏恢复尚未确认。"; return; }
                var restored = await recovery.ConfigureAwait(false);
                recovery = null;
                if (!restored) { error = "Windows 任务栏恢复尚未确认，正在重试。"; return; }
                recoveryPending = false;
            }
            if (desired > 0 && lease == null && DateTime.UtcNow >= retryAfter)
            {
                lease = await acquire(desired).ConfigureAwait(false);
                leasePid = desired;
            }
            // Recheck after asynchronous acquisition: disposal or a revoked automatic request may have arrived.
            var wanted = DesiredPid() == leasePid && leasePid != 0;
            lease?.SetWanted(wanted);
            if (!loadFailed && (lease != null || desired == 0)) error = null;
        }
        catch (Exception ex)
        { recovery = null; error = "任务栏操作尚未完成：" + ex.Message; retryAfter = DateTime.UtcNow.AddSeconds(5); }
    }
    public void Dispose()
    {
        lock (requests) disposed = true;
        timer?.Dispose();
        // Shutdown may run on WPF dispatcher; lease cleanup must not capture that context.
        Task.Run(TickAsync).GetAwaiter().GetResult();
    }
}
