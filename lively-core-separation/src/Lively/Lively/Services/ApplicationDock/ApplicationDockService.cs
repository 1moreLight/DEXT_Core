using Lively.Common;
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
    private DockPreferences preferences;
    private IReadOnlyList<DockGroup> groups = Array.Empty<DockGroup>();
    private ApplicationDockWindow window;
    private bool updating, disposed, started, loadFailed;
    private string error;

    public ApplicationDockService()
    {
        try { preferences = DockPreferenceFile.Load(path); }
        catch (Exception ex)
        {
            preferences = new(false, Array.Empty<DockPin>());
            loadFailed = true;
            error = "无法读取应用 Dock 设置，原文件已保留：" + ex.Message;
        }
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
        pins = preferences.Pins,
        groups = groups.Select(g => new { g.Key, g.Name, pinned = g.Pin != null, windows = g.Windows }).ToArray(),
        error
    });

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
        if (!preferences.Enabled || disposed)
        {
            window?.Hide();
            return;
        }
        window ??= new ApplicationDockWindow(Click, TogglePin, Icon);
        window.Update(groups, DockWindows.Foreground, error);
        if (DockWindows.IsFullscreen()) window.Hide();
        else if (!window.IsVisible) window.Show();
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
        timer.Stop();
        window?.Close();
        window = null;
    });
}
