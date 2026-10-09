using Lively.Common.Services;
using Lively.Models.Services;
using System;
using System.Globalization;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

// Per admitted Player attachment. Sampling stays outside authorization locks;
// RoomActionAuthority rechecks current consent before publishing any value.
internal sealed partial class RoomNativeDataSource : IDisposable
{
    private readonly object gate = new();
    private readonly Func<RoomDataSample>? media, audio;
    private readonly Func<IHardwareUsageService>? createHardware;
    private readonly TimeProvider clock;
    private IHardwareUsageService? hardware;
    private RoomDataSample latestHardware = new("missing");
    private int disposed, pending, hardwareEnabled = 1;

    public RoomNativeDataSource(Func<RoomDataSample>? media, Func<RoomDataSample>? audio,
        Func<IHardwareUsageService>? createHardware, TimeProvider? clock = null)
    { this.media = media; this.audio = audio; this.createHardware = createHardware; this.clock = clock ?? TimeProvider.System; }

    public bool TryBeginRead()
    {
        if (Volatile.Read(ref disposed) != 0) return false;
        if (Interlocked.Increment(ref pending) <= 16 && Volatile.Read(ref disposed) == 0) return true;
        EndRead(); return false;
    }
    public void EndRead() => Interlocked.Decrement(ref pending);

    public RoomDataSample Read(string capability)
    {
        if (Volatile.Read(ref disposed) != 0) return new("error");
        try
        {
            switch (capability)
            {
                case "time.read":
                    var now = clock.GetUtcNow().ToUniversalTime();
                    return new("available", JsonSerializer.SerializeToElement(new { utc = now.ToString("O", CultureInfo.InvariantCulture),
                        unixMilliseconds = now.ToUnixTimeMilliseconds(), localOffsetMinutes = TimeZoneInfo.Local.GetUtcOffset(now).TotalMinutes }));
                case "media.read": return media?.Invoke() ?? new("unsupported");
                case "audio.read": return audio?.Invoke() ?? new("unsupported");
                case "hardware.read": return ReadHardware();
                default: return new("unsupported");
            }
        }
        catch (Exception) { return new("error"); }
    }

    public void ObserveSnapshot(RoomSessionSnapshot snapshot, bool isDock = false, bool dockVisible = true)
    {
        var enabled = snapshot.IsActive && !snapshot.Lifecycle.Locked &&
            (isDock ? dockVisible && snapshot.Lifecycle.Stage == RoomLifecycleStage.Desktop :
                !snapshot.Lifecycle.PlaybackPaused);
        Volatile.Write(ref hardwareEnabled, enabled ? 1 : 0);
        if (!enabled) Suspend();
    }
    public void Suspend()
    {
        Volatile.Write(ref hardwareEnabled, 0); Volatile.Write(ref latestHardware, new("missing"));
        // Observer callbacks only set leaf facts. Constructor/monitor stop work
        // must not wait while gateway/kernel observers are running.
        _ = Task.Run(() => StopHardware(force: false));
    }

    private RoomDataSample ReadHardware()
    {
        if (createHardware == null) return new("unsupported");
        lock (gate)
        {
            if (Volatile.Read(ref disposed) != 0) return new("error");
            if (Volatile.Read(ref hardwareEnabled) == 0) return new("missing");
            if (hardware == null)
            {
                hardware = createHardware(); hardware.HWMonitor += OnHardware;
                try { hardware.Start(); }
                catch { var failed = hardware; hardware = null; failed.HWMonitor -= OnHardware; try { failed.Stop(); } catch { } throw; }
            }
            return Volatile.Read(ref latestHardware);
        }
    }
    private void OnHardware(object? sender, HardwareUsageEventArgs value)
    {
        if (Volatile.Read(ref disposed) != 0 || Volatile.Read(ref hardwareEnabled) == 0 || !ReferenceEquals(sender, Volatile.Read(ref hardware))) return;
        RoomDataSample sample;
        if (!value.IsAvailable) sample = new("missing");
        else if (!float.IsFinite(value.CurrentCpu) || !float.IsFinite(value.CurrentGpu3D) || !float.IsFinite(value.CurrentRamAvail) ||
            !float.IsFinite(value.CurrentNetDown) || !float.IsFinite(value.CurrentNetUp) || value.TotalRam < 0) sample = new("error");
        else sample = new("available", JsonSerializer.SerializeToElement(new { cpuName = Name(value.NameCpu), gpuName = Name(value.NameGpu),
            cpuPercent = Math.Clamp(value.CurrentCpu, 0, 100), gpuPercent = Math.Clamp(value.CurrentGpu3D, 0, 100),
            totalMemoryMB = value.TotalRam, availableMemoryMB = Math.Max(0, value.CurrentRamAvail),
            networkDownloadBytesPerSecond = Math.Max(0, value.CurrentNetDown), networkUploadBytesPerSecond = Math.Max(0, value.CurrentNetUp) }));
        if (Volatile.Read(ref disposed) == 0 && Volatile.Read(ref hardwareEnabled) != 0 && ReferenceEquals(sender, Volatile.Read(ref hardware))) Volatile.Write(ref latestHardware, sample);
    }
    private static string Name(string? value) => value is null ? string.Empty : value[..Math.Min(value.Length, 160)];
    private void StopHardware(bool force)
    {
        IHardwareUsageService? old;
        lock (gate)
        {
            if (!force && Volatile.Read(ref hardwareEnabled) != 0) return;
            old = hardware; hardware = null; Volatile.Write(ref latestHardware, new("missing"));
            if (old != null) old.HWMonitor -= OnHardware;
        }
        try { old?.Stop(); } catch { }
    }
    public void Dispose() { if (Interlocked.Exchange(ref disposed, 1) == 0) StopHardware(force: true); }
}
