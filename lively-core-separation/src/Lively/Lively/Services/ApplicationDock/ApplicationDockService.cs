using Lively.Core.Wallpapers;
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
    private string pinContextKey;
    private DockPin[] deskPins;
    private readonly DockTaskDisplay taskDisplay;
    private long pinRevision;
    private WebWebView2 taskHost;
    private string taskDisplayContext;
    private static readonly JsonSerializerOptions taskJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ApplicationDockService(Dext.Core.Rooms.TaskbarController taskbar, DockHostOwnership ownership, RoomSessionRuntimeCoordinator rooms, RoomRuntimeFactsSource facts)
    {
        taskDisplay = new DockTaskDisplay(Icon);
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

    private DockPin[] EffectivePins(RoomDockNavigation navigation)
    {
        var key = navigation is null ? null : $"{navigation.SessionId}/{navigation.RoomId}/{navigation.CurrentDeskId}";
        if (key != pinContextKey)
        {
            var stored = navigation is null ? null : rooms.ReadApplicationDockPins(navigation);
            deskPins = stored?.Select(p => new DockPin(p.Name, p.Target, p.Arguments, p.WorkingDirectory)).ToArray();
            pinContextKey = key; // Failed reads never cache a different Room/Desk.
        }
        return navigation is null ? preferences.Pins : deskPins ?? preferences.Pins;
    }

    private string PinScope(RoomDockNavigation navigation) => navigation is null ? "global" :
        $"{navigation.SessionId}/{navigation.RoomId}/{navigation.CurrentDeskId}/{(deskPins is null ? "global" : "desk")}";

    private IReadOnlyList<DockGroup> GroupForCurrentDesk(IReadOnlyList<DockTask> tasks)
    {
        var navigation = rooms.ReadApplicationDockNavigation();
        var pins = EffectivePins(navigation);
        var scope = PinScope(navigation);
        return DockModel.Group(pins, tasks).Select(group => group with { PinScope = scope }).ToArray();
    }

    public object Status() => dispatcher.Invoke<object>(() =>
    {
        var navigation = rooms.ReadApplicationDockNavigation();
        var effective = EffectivePins(navigation);
        return new
        {
            enabled = preferences.Enabled,
            autoHide = preferences.AutoHide,
            reserveSpace = preferences.ReserveSpace,
            taskbar = taskbar.Status(),
            runtime = new { owner = ownership.Owner.ToString().ToLowerInvariant(), visible = window?.IsVisible == true,
                waiting = preferences.Enabled && ownership.Owner == DockHost.Theme,
                reservation = new { registered = window?.ReservationRegistered == true, ready = window?.ReservationReady == true, error = window?.ReservationError },
                blocked = facts.Read(string.Empty).Locked ? "locked" : DockWindows.IsFullscreen() ? "fullscreen" : null },
            navigation,
            pins = preferences.Pins,
            effectivePins = effective,
            pinContext = navigation is null ? null : new { sessionId = navigation.SessionId, roomId = navigation.RoomId,
                deskId = navigation.CurrentDeskId, name = navigation.CurrentName, inherits = deskPins is null,
                changing = navigation.PendingName is not null },
            groups = groups.Select(g => new { g.Key, g.Name, pinned = g.Pin != null, windows = g.Windows }).ToArray(),
            error
        };
    });

    private RoomDockNavigation PinEditContext(JsonElement root)
    {
        var scope = root.TryGetProperty("scope", out var value) ? value.GetString() : "global";
        if (scope == "global") return null;
        if (scope != "desk") throw new ArgumentException("未知固定范围。");
        var current = rooms.ReadApplicationDockNavigation();
        if (!root.TryGetProperty("sessionId", out var session) || !session.TryGetGuid(out var id) ||
            current?.MatchesPinEdit(id, root.GetProperty("roomId").GetString(), root.GetProperty("deskId").GetString()) != true)
            throw new InvalidOperationException("当前 Room/Desk 已改变，请重新选择固定应用。");
        return current;
    }
    public Task SetTaskbarModeAsync(string mode) => taskbar.SetModeAsync(mode);

    public object Edit(string json) => dispatcher.Invoke<object>(() =>
    {
        if (loadFailed) throw new InvalidOperationException(error);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var updated = preferences;
        var operation = root.GetProperty("operation").GetString();
        var editingPins = operation is "pin" or "unpin" or "inheritPins";
        var context = editingPins ? PinEditContext(root) : null;
        var selectedPins = context is null ? preferences.Pins : EffectivePins(context);
        var updatedPins = selectedPins;
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
                if (!selectedPins.Any(p => DockModel.Identity(p.Target) == DockModel.Identity(pin.Target)))
                    updatedPins = selectedPins.Append(pin).ToArray();
                break;
            case "unpin":
                var key = DockModel.Identity(root.GetProperty("target").GetString());
                updatedPins = selectedPins.Where(p => DockModel.Identity(p.Target) != key).ToArray();
                break;
            case "inheritPins":
                if (context is null) throw new ArgumentException("请选择当前 Desk。");
                updatedPins = null;
                break;
            default: throw new ArgumentException("未知应用 Dock 操作。");
        }
        // Persist first. A failed save must not falsely acknowledge an in-memory-only change.
        if (editingPins && context is not null)
        {
            rooms.SetApplicationDockPins(context.SessionId, context.RoomId, context.CurrentDeskId,
                updatedPins?.Select(p => new PersonalTarget(p.Name, "application", p.Target, p.Arguments, p.WorkingDirectory)).ToArray());
            pinContextKey = null;
        }
        else
        {
            if (editingPins) updated = updated with { Pins = updatedPins };
            DockPreferenceFile.Save(path, updated);
            preferences = updated;
        }
        if (editingPins) pinRevision++;
        error = null;
        groups = GroupForCurrentDesk(groups.SelectMany(g => g.Windows).ToArray());
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
            groups = GroupForCurrentDesk(tasks);
            Render();
        }
        catch (Exception ex) { error = ex.Message; }
        finally { updating = false; }
    }

    private void PublishTaskDisplay()
    {
        var host = rooms.ApplicationTaskHost();
        AttachTaskHost(host);
        var epoch = host?.NativeDockTaskEpoch;
        if (epoch == null || disposed) { taskDisplay.Clear(); return; }
        // Group scope was captured with the committed Desk when these tasks were grouped.
        // If the Desk changed since then, regroup before minting any IDs for it.
        var navigation = rooms.ReadApplicationDockNavigation();
        EffectivePins(navigation);
        var scope = PinScope(navigation);
        if (groups.Any(group => group.PinScope != scope))
            groups = GroupForCurrentDesk(groups.SelectMany(group => group.Windows).ToArray());
        taskDisplayContext = $"{epoch}/{scope}/{pinRevision}";
        var display = taskDisplay.Update(taskDisplayContext, groups, DockWindows.Foreground);
        host.SendNativeDockTasks(epoch, JsonSerializer.Serialize(display, taskJson), display);
    }

    private void AttachTaskHost(WebWebView2 host)
    {
        if(ReferenceEquals(taskHost,host))return;
        if(taskHost!=null)taskHost.NativeDockTaskCompleted-=CompleteTask;
        taskDisplay.Clear();taskDisplayContext=null;taskHost=host;
        if(taskHost!=null)taskHost.NativeDockTaskCompleted+=CompleteTask;
    }

    private void CompleteTask(WebWebView2 source,DockTaskCompletion completion)
    {
        if(dispatcher.HasShutdownStarted)return;
        // Player receipts arrive off the UI thread. Recheck the host/Desk after
        // queuing; a completed old click may not act on a replacement Desk.
        dispatcher.BeginInvoke((Action)(()=>
        {
            try
            {
                if(disposed||!ReferenceEquals(source,taskHost)||!ReferenceEquals(source,rooms.ApplicationTaskHost())||
                    !source.NativeDockTaskIsCurrent(completion))return;
                var navigation=rooms.ReadApplicationDockNavigation();
                EffectivePins(navigation);
                if(taskDisplayContext!=$"{source.NativeDockTaskEpoch}/{PinScope(navigation)}/{pinRevision}"||
                    !taskDisplay.TryResolve(completion.ContextId,completion.ItemId,completion.WindowId,out var group,out var selected))return;
                switch(completion.Action)
                {
                    case "activate" when selected==null&&group.Windows.Count<=1: Click(group,null);break;
                    case "chooseWindow" when selected!=null: Click(group,selected);break;
                    case "togglePin" when selected==null: TogglePin(group);break;
                    // Opening a window-choice menu has no OS action.
                }
                }
            catch(Exception ex){error="任务区操作失败："+ex.Message;}
        }));
    }
    private void Render()
    {
        // Display publication never changes ownership or author/native input routing.
        try { PublishTaskDisplay(); }
        catch (Exception ex) { taskDisplay.Clear(); error = "任务区数据刷新失败：" + ex.Message; }
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
            {
                var launchClock = System.Diagnostics.Stopwatch.StartNew();
                var launchLog = NLog.LogManager.GetLogger("Dext.ApplicationDock.Launch");
                launchLog.Info("Application launch begin");
                try { catalog.Launch(group.Pin.Target, group.Pin.Arguments, group.Pin.WorkingDirectory)?.Dispose(); }
                finally { launchLog.Info("Application launch call returned after {0} ms", launchClock.ElapsedMilliseconds); }
            }
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
            var navigation = rooms.ReadApplicationDockNavigation();
            EffectivePins(navigation);
            if (!DockModel.CanEditPin(group, PinScope(navigation)))
                throw new InvalidOperationException("页面或固定范围已改变，请重新打开菜单。");
            var local = navigation is not null && deskPins is not null;
            Edit(JsonSerializer.Serialize(new
            {
                operation = group.Pin is not null ? "unpin" : "pin",
                scope = local ? "desk" : "global",
                sessionId = navigation?.SessionId, roomId = navigation?.RoomId, deskId = navigation?.CurrentDeskId,
                target = group.Pin?.Target,
                app = new { name = group.Name, target = group.Pin?.Target ?? group.Windows[0].Target, arguments = "", workingDirectory = "" }
            }));
        }
        catch (Exception ex) { error = ex.Message; Render(); }
    }

    public void Dispose() => dispatcher.Invoke(() =>
    {
        disposed = true;
        AttachTaskHost(null);
        taskDisplay.Clear();
        ownership.Shutdown();
        taskbar.RequestAutomatic(corePid, false);
        timer.Stop();
        window?.Close();
        window = null;
        ownership.Release(DockHost.Application);
    });
}
