using System;
using System.Runtime.InteropServices;

namespace Lively.Services.DesktopSync;

// UI-thread lease on an existing Player. This creates no windows, changes no
// Explorer settings and never makes the Player a top-level/topmost window.
public sealed class DesktopSurfaceWindow
{
    private const uint NoActivate = 0x10;
    private readonly IntPtr window, parent, previous, shellView, shellParent;
    private readonly int pid, parentPid, shellPid;
    private readonly uint thread, parentThread, shellThread;
    private bool restored;

    private DesktopSurfaceWindow(IntPtr window, int pid, IntPtr shellView)
    {
        this.window=window; this.pid=pid; this.shellView=shellView;
        parent=Native.GetParent(window); previous=Native.GetWindow(window,3);
        shellParent=Native.GetParent(shellView);
        thread=Native.GetWindowThreadProcessId(window,out _);
        parentThread=Native.GetWindowThreadProcessId(parent,out parentPid);
        shellThread=Native.GetWindowThreadProcessId(shellView,out shellPid);
    }
    public bool ContainsWindow(IntPtr handle) => IsPresented && (handle==window || Native.IsChild(window,handle));
    public bool IsPresented => !restored && Owned(window,pid,thread) &&
        Owned(shellView,shellPid,shellThread) && Native.GetParent(window)==shellParent &&
        Native.GetParent(shellView)==shellParent && IsAbove(window,shellView);

    public static bool TryRaise(IntPtr window,int pid,IntPtr shellView,out DesktopSurfaceWindow? lease)
    {
        lease=null;
        if(!Owned(window,pid,0) || shellView==window || !Native.IsWindow(shellView) ||
            Native.GetParent(window)==IntPtr.Zero || Native.GetParent(shellView)==IntPtr.Zero) return false;
        var candidate=new DesktopSurfaceWindow(window,pid,shellView);
        if(candidate.MoveTo(candidate.shellParent,IntPtr.Zero) && candidate.IsPresented)
        { lease=candidate;return true; }
        // Non-null failure means the caller must close its own Player: never
        // leave a failed restore covering the shell desktop.
        if(!candidate.TryRestore())lease=candidate;
        return false;
    }
    public bool TryRestore()
    {
        if(restored)return true;
        if(!Owned(window,pid,thread)){restored=true;return true;}
        if(!Owned(parent,parentPid,parentThread))return false;
        // A former sibling can legitimately close. Restore below the Shell view
        // when it is still in our original container; otherwise at the bottom.
        var after=previous==IntPtr.Zero ? IntPtr.Zero : Native.IsWindow(previous) && Native.GetParent(previous)==parent
            ? previous : Native.GetParent(shellView)==parent ? shellView : new IntPtr(1);
        if(!MoveTo(parent,after))return false;
        restored=true;return true;
    }
    private bool MoveTo(IntPtr targetParent,IntPtr after)
    {
        if(!Native.GetWindowRect(window,out var rect))return false;
        var point=new Point { X=rect.Left,Y=rect.Top };
        if(!Native.ScreenToClient(targetParent,ref point))return false;
        if(Native.GetParent(window)!=targetParent)
        {
            Native.SetLastError(0);
            if(Native.SetParent(window,targetParent)==IntPtr.Zero && Marshal.GetLastWin32Error()!=0)return false;
        }
        return Native.SetWindowPos(window,after,point.X,point.Y,rect.Right-rect.Left,rect.Bottom-rect.Top,NoActivate) &&
            Native.GetParent(window)==targetParent;
    }
    private static bool IsAbove(IntPtr window,IntPtr sibling)
    {
        for(var h=Native.GetWindow(sibling,3);h!=IntPtr.Zero;h=Native.GetWindow(h,3))if(h==window)return true;
        return false;
    }
    private static bool Owned(IntPtr h,int pid,uint thread)
    {
        if(h==IntPtr.Zero||!Native.IsWindow(h))return false;
        var actualThread=Native.GetWindowThreadProcessId(h,out var actualPid);
        return actualPid==pid && actualThread!=0 && (thread==0||actualThread==thread);
    }
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int X,Y; }
    private static class Native
    {
        [DllImport("kernel32.dll")] internal static extern void SetLastError(uint value);
        [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr h);
        [DllImport("user32.dll")] internal static extern bool IsChild(IntPtr parent,IntPtr child);
        [DllImport("user32.dll")] internal static extern IntPtr GetParent(IntPtr h);
        [DllImport("user32.dll")] internal static extern IntPtr GetWindow(IntPtr h,uint cmd);
        [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr h,out int pid);
        [DllImport("user32.dll")] internal static extern bool GetWindowRect(IntPtr h,out Rect rect);
        [DllImport("user32.dll")] internal static extern bool ScreenToClient(IntPtr h,ref Point point);
        [DllImport("user32.dll",SetLastError=true)] internal static extern IntPtr SetParent(IntPtr h,IntPtr parent);
        [DllImport("user32.dll",SetLastError=true)] internal static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
    }
}
