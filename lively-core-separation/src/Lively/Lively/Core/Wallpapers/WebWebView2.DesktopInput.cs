using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Dext.Core.Rooms;
using Lively.Common.Helpers;

namespace Lively.Core.Wallpapers;
public partial class WebWebView2
{
    private static int DesktopInputModifiers()
    {
        var flags = InputUtil.MouseModifiers;
        return ((flags & 8) != 0 ? 1 : 0) | ((flags & 4) != 0 ? 2 : 0);
    }
    private static object DesktopInputDetails(RoomNativeInputProof proof) => new
    {
        contextMenu = proof.ContextMenu, key = proof.Key, modifiers = proof.Modifiers, x = proof.X, y = proof.Y,
        at = proof.IssuedAt * (1000d / Stopwatch.Frequency),
        doubleClickTime = GetDoubleClickTime(),
        doubleClickWidth = Math.Max(1, DesktopGetSystemMetrics(36)),
        doubleClickHeight = Math.Max(1, DesktopGetSystemMetrics(37))
    };
    [DllImport("user32.dll")] private static extern uint GetDoubleClickTime();
    [DllImport("user32.dll", EntryPoint = "GetSystemMetrics")] private static extern int DesktopGetSystemMetrics(int index);
}
