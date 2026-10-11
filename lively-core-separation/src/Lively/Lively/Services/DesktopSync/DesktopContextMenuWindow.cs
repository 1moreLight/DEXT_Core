using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;

namespace Lively.Services.DesktopSync;

// One zero-size native owner on the Core UI STA. Keep it alive for Shell-owned
// modeless property sheets; it has no taskbar entry and no desktop hit area.
internal static class DesktopContextMenuWindow
{
    private static HwndSource owner;
    private static DesktopShellContextMenu active;
    private static Exception messageError;

    internal static async Task<string> ShowAsync(IReadOnlyList<string> paths, int x, int y, Func<bool> permitted, Func<IntPtr> desktopTarget, Action returnedToDesktop, bool background = false)
    {
        var app = Application.Current;
        if (app is null || app.Dispatcher.HasShutdownStarted) return "cancelled";
        return await (await app.Dispatcher.InvokeAsync(() => Show(paths, x, y, permitted, desktopTarget, returnedToDesktop, background)));
    }
    private static async Task<string> Show(IReadOnlyList<string> paths, int x, int y, Func<bool> permitted, Func<IntPtr> desktopTarget, Action returnedToDesktop, bool background = false)
    {
        if (!permitted()) return "cancelled";
        if (active is not null) throw new InvalidOperationException("A desktop context menu is already open.");
        if (owner is null)
        {
            owner = new HwndSource(new HwndSourceParameters("Dext Desktop File Menu")
            {
                WindowStyle = unchecked((int)0x90000000), ExtendedWindowStyle = 0x80,
                PositionX = x, PositionY = y, Width = 0, Height = 0
            }); // WS_POPUP | WS_VISIBLE; WS_EX_TOOLWINDOW.
            owner.AddHook(OwnerMessage);
            Application.Current.Exit += (_, _) => { owner?.Dispose(); owner = null; };
        }
        try
        {
            using var menu = background ? DesktopShellContextMenu.CreateBackground(owner.Handle) : DesktopShellContextMenu.Create(paths, owner.Handle);
            active = menu; messageError = null;
            if (!permitted()) return "cancelled";
            // A foreground owner makes Escape and outside clicks dismiss the
            // native popup instead of forwarding into the underlying desktop.
            var requested = false;
            var activated = await DesktopShellMenuActivation.Confirm(
                () => requested = ActivateMenuOwner(owner.Handle),
                () => GetForegroundWindow() == owner.Handle, permitted, () => Task.Delay(15));
            NLog.LogManager.GetCurrentClassLogger().Info($"Desktop menu activation | requested={requested} | confirmed={activated}");
            if (!activated) return "cancelled";
            var command = menu.Track(owner.Handle, x, y, permitted);
            NLog.LogManager.GetCurrentClassLogger().Info($"Desktop menu tracked | selected={command != 0}");
            if (messageError is not null) throw new InvalidOperationException("Shell menu message failed.", messageError);
            return command == 0 ? "cancelled" : menu.Dispatch(command, owner.Handle, x, y, permitted);
        }
        finally
        {
            active = null; messageError = null;
            if (owner is not null)
            {
                PostMessage(owner.Handle, 0, IntPtr.Zero, IntPtr.Zero);
                if (GetForegroundWindow() == owner.Handle)
                {
                    var target = desktopTarget?.Invoke() ?? IntPtr.Zero;
                    if (target != IntPtr.Zero && IsWindow(target) && SetForegroundWindow(target) && GetForegroundWindow() == target && permitted())
                        returnedToDesktop?.Invoke();
                }
            }
        }
    }
    private static IntPtr OwnerMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (active is null) return IntPtr.Zero;
        try
        {
            if (active.HandleMessage((uint)message, (UIntPtr)wParam, lParam, out var result)) { handled = true; return result; }
        }
        catch (Exception error) { messageError = error; EndMenu(); }
        return IntPtr.Zero;
    }
    // The physical right pair is consumed by our desktop hook, so Windows may
    // still assign the last-input foreground queue to Explorer. Join it only
    // for this user-requested activation; never keep queues joined while tracking.
    private static bool ActivateMenuOwner(IntPtr target)
    {
        if (SetForegroundWindow(target)) return true;
        var foreground = GetForegroundWindow();
        var currentThread = GetCurrentThreadId();
        var foregroundThread = GetWindowThreadProcessId(foreground, out _);
        if (foreground == IntPtr.Zero || foregroundThread == 0 || foregroundThread == currentThread) return false;
        // Do not join a hung application's input queue.
        if (SendMessageTimeout(foreground, 0, IntPtr.Zero, IntPtr.Zero, 2, 100, out _) == IntPtr.Zero) return false;
        if (!AttachThreadInput(currentThread, foregroundThread, true)) return false;
        try { return SetForegroundWindow(target); }
        finally { AttachThreadInput(currentThread, foregroundThread, false); }
    }
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool AttachThreadInput(uint current, uint foreground, bool attach);
    [DllImport("user32.dll")] private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EndMenu();
}
