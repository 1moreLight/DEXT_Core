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

    internal static async Task<string> ShowAsync(IReadOnlyList<string> paths, int x, int y, Func<bool> permitted)
    {
        var app = Application.Current;
        if (app is null || app.Dispatcher.HasShutdownStarted) return "cancelled";
        return await app.Dispatcher.InvokeAsync(() => Show(paths, x, y, permitted));
    }
    private static string Show(IReadOnlyList<string> paths, int x, int y, Func<bool> permitted)
    {
        if (!permitted()) return "cancelled";
        if (active is not null) throw new InvalidOperationException("A desktop context menu is already open.");
        var previous = GetForegroundWindow();
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
            using var menu = DesktopShellContextMenu.Create(paths, owner.Handle);
            active = menu; messageError = null;
            if (!permitted()) return "cancelled";
            // A foreground owner makes Escape and outside clicks dismiss the
            // native popup instead of forwarding into the underlying desktop.
            if (!SetForegroundWindow(owner.Handle) || GetForegroundWindow() != owner.Handle) return "cancelled";
            var command = menu.Track(owner.Handle, x, y, permitted);
            if (messageError is not null) throw new InvalidOperationException("Shell menu message failed.", messageError);
            return command == 0 ? "cancelled" : menu.Dispatch(command, owner.Handle, x, y, permitted);
        }
        finally
        {
            active = null; messageError = null;
            if (owner is not null)
            {
                PostMessage(owner.Handle, 0, IntPtr.Zero, IntPtr.Zero);
                if (GetForegroundWindow() == owner.Handle && IsWindow(previous)) SetForegroundWindow(previous);
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
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EndMenu();
}
