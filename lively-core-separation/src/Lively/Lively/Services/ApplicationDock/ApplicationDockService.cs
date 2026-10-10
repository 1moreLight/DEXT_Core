using Lively.Common;
using Dext.Core.Rooms;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace Lively.Services.ApplicationDock;

internal sealed class ApplicationDockService : IDisposable
{
    private readonly string path = Path.Combine(Constants.CommonPaths.AppDataDir, "v3", "application-dock.json");
    private readonly Dispatcher dispatcher = Application.Current.Dispatcher;
    private readonly DispatcherTimer timer;
    private readonly AppCatalogService catalog = new();
    private readonly Dext.Core.Rooms.TaskbarController taskbar;
    private readonly DockHostOwnership ownership;
    private readonly RoomSessionRuntimeCoordinator rooms;
    private readonly RoomRuntimeFactsSource facts;
    private readonly int corePid = Environment.ProcessId;
    private bool releasingOwner;
    private DockPreferences preferences;
    private IReadOnlyList<DockGroup> groups = Array.Empty<DockGroup>();
    private ApplicationDockWindow window;
    private bool updating, disposed, started, loadFailed;
    private string error;

    public ApplicationDockService(Dext.Core.Rooms.TaskbarController taskbar, DockHostOwnership ownership, RoomSessionRuntimeCoordinator rooms, RoomRuntimeFactsSource facts)
    {
        this.taskbar = taskbar;
        this.ownership = ownership;
        this.rooms = rooms;
        this.facts = facts;
        try { preferences = DockPreferenceFile.Load(path); }
        catch (Exception ex)
        {
            preferences = new(false, Array.Empty<DockPin>());
            loadFailed = true;
            error = "无法读取应用 Dock 设置，原文件已保留：" + ex.Message;
        }
        ownership.SetApplicationRequested(preferences.Enabled);
        timer = new DispatcherTimer(TimeSpan.FromMilliseconds(500), DispatcherPriority.Background,
            async (_, _) => await Refresh(), dispatcher);
        timer.Stop();
    }

    public void Start() => dispatcher.Invoke(() =>
    {
        if (started || disposed) return;
        started = true;
        timer.Start();
        _ = Refresh();
    });

    public object Status() => dispatcher.Invoke<object>(() => new
    {
        enabled = preferences.Enabled,
        autoHide = preferences.AutoHide,
        reserveSpace = preferences.ReserveSpace,
        taskbar = taskbar.Status(),
        runtime = new { owner = ownership.Owner.ToString().ToLowerInvariant(), visible = window?.IsVisible == true,
            waiting = preferences.Enabled && ownership.Owner == DockHost.Theme,
            reservation = new { registered = window?.ReservationRegistered == true, ready = window?.ReservationReady == true, error = window?.ReservationError },
            blocked = facts.Read(string.Empty).Locked ? "locked" : DockWindows.IsFullscreen() ? "fullscreen" : null },
        navigation = rooms.ReadApplicationDockNavigation(),
        pins = preferences.Pins,
        groups = groups.Select(g => new { g.Key, g.Name, pinned = g.Pin != null, windows = g.Windows }).ToArray(),
        error
    });

    public Task SetTaskbarModeAsync(string mode) => taskbar.SetModeAsync(mode);

    public object Edit(string json) => dispatcher.Invoke<object>(() =>
    {
        if (loadFailed) throw new InvalidOperationException(error);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var updated = preferences;
        var operation = root.GetProperty("operation").GetString();
        switch (operation)
        {
            case "enable":
                updated = preferences with { Enabled = root.GetProperty("enabled").GetBoolean() };
                break;
            case "autoHide":
                updated = preferences.WithAutoHide(root.GetProperty("autoHide").GetBoolean());
                break;
            case "reserveSpace":
                updated = preferences.WithReserveSpace(root.GetProperty("reserveSpace").GetBoolean());
                break;
            case "pin":
                var value = root.GetProperty("app");
                var target = value.GetProperty("target").GetString();
                if (string.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !File.Exists(target))
                    throw new ArgumentException("请选择存在的本机应用。");
                var pin = new DockPin(value.GetProperty("name").GetString(), target,
                    value.TryGetProperty("arguments", out var args) ? args.GetString() ?? "" : "",
                    value.TryGetProperty("workingDirectory", out var cwd) ? cwd.GetString() ?? "" : "");
                if (string.IsNullOrWhiteSpace(pin.Name)) throw new ArgumentException("应用名称不能为空。");
                if (!preferences.Pins.Any(p => DockModel.Identity(p.Target) == DockModel.Identity(pin.Target)))
                    updated = preferences with { Pins = preferences.Pins.Append(pin).ToArray() };
                break;
            case "unpin":
                var key = DockModel.Identity(root.GetProperty("target").GetString());
                updated = preferences with { Pins = preferences.Pins.Where(p => DockModel.Identity(p.Target) != key).ToArray() };
                break;
            default: throw new ArgumentException("未知应用 Dock 操作。");
        }
        // Persist first. A failed save must not falsely acknowledge an in-memory-only change.
        DockPreferenceFile.Save(path, updated);
        preferences = updated;
        error = null;
        groups = DockModel.Group(preferences.Pins, groups.SelectMany(g => g.Windows).ToArray());
        Render();
        _ = Refresh();
        return Status();
    });

    private async Task Refresh()
    {
        if (updating || disposed) return;
        updating = true;
        try
        {
            var tasks = await Task.Run(DockWindows.Enumerate);
            if (disposed) return;
            groups = DockModel.Group(preferences.Pins, tasks);
            Render();
        }
        catch (Exception ex) { error = ex.Message; }
        finally { updating = false; }
    }

    private void Render()
    {
        ownership.SetApplicationRequested(preferences.Enabled && !disposed);
        if (!preferences.Enabled || disposed || !ownership.TryAcquire(DockHost.Application))
        {
            window?.Suspend();
            taskbar.RequestAutomatic(corePid, false);
            if (!releasingOwner) _ = ReleaseOwnerAsync();
            return;
        }
        window ??= new ApplicationDockWindow(Click, TogglePin, Icon, Navigate);
        window.SetReservationMode(preferences.ReserveSpace);
        window.UpdateNavigation(rooms.ReadApplicationDockNavigation());
        window.Update(groups, DockWindows.Foreground, error);
        window.SetVisibilityMode(preferences.AutoHide, () => facts.Read(string.Empty).Locked || DockWindows.IsFullscreen());
        taskbar.RequestAutomatic(corePid, DockVisibilityPolicy.TaskbarReady(true, window.NativeReady && (!preferences.ReserveSpace || window.ReservationReady), facts.Read(string.Empty).Locked));
    }

    private async Task ReleaseOwnerAsync()
    {
        releasingOwner = true;
        try
        {
            var released = await taskbar.ReleaseAutomaticAsync(corePid);
            if (disposed || preferences.Enabled && ownership.Owner == DockHost.Application) return;
            if (released) ownership.Release(DockHost.Application);
            else error = taskbar.Error ?? "正在等待任务栏恢复后交接 Dock。";
        }
        catch (Exception ex) { error = "Dock 交接失败：" + ex.Message; }
        finally { releasingOwner = false; }
    }

    private void Navigate(Guid session, int direction)
    {
        if (disposed || !preferences.Enabled || window?.IsVisible != true ||
            ownership.Owner != DockHost.Application || DockWindows.IsFullscreen()) return;
        try
        {
            error = rooms.NavigateApplicationDock(session, direction) ? null : "当前无法切换 Desk，请稍后重试。";
        }
        catch (Exception ex) { error = "切换 Desk 失败：" + ex.Message; }
        Render();
    }

    private byte[] Icon(string target)
    {
        try { return catalog.ResolveOne(target)?.IconPng; }
        catch { return null; }
    }

    private void Click(DockGroup group, DockTask selected)
    {
        try
        {
            var action = selected == null ? DockModel.Action(group, DockWindows.Foreground) : DockAction.Activate;
            if (action == DockAction.Launch && group.Pin != null)
                catalog.Launch(group.Pin.Target, group.Pin.Arguments, group.Pin.WorkingDirectory)?.Dispose();
            else if (action is DockAction.Activate or DockAction.Minimize)
            {
                if (!DockWindows.Perform(selected ?? group.Windows[0], action == DockAction.Minimize))
                    throw new InvalidOperationException("窗口已关闭，或 Windows 未允许切换到此窗口。");
            }
            error = null;
        }
        catch (Exception ex) { error = ex.Message; }
        _ = Refresh();
    }

    private void TogglePin(DockGroup group)
    {
        try
        {
            Edit(JsonSerializer.Serialize(group.Pin != null
                ? (object)new { operation = "unpin", target = group.Pin.Target }
                : new { operation = "pin", app = new { name = group.Name, target = group.Windows[0].Target, arguments = "", workingDirectory = "" } }));
        }
        catch (Exception ex) { error = ex.Message; Render(); }
    }

    public void Dispose() => dispatcher.Invoke(() =>
    {
        disposed = true;
        ownership.Shutdown();
        taskbar.RequestAutomatic(corePid, false);
        timer.Stop();
        window?.Close();
        window = null;
        ownership.Release(DockHost.Application);
    });
}
