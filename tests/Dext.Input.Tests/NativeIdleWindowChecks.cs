using System.Drawing;
using System.Runtime.InteropServices;
using Lively.Common.Helpers;

internal static class NativeIdleWindowChecks
{
    public static void Run()
    {
        Native.SetProcessDpiAwarenessContext(new IntPtr(-4));
        var parent=Native.CreateWindowExW(0,"STATIC","idle-parent",0x80000000,-5000,-5000,800,600,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
        var child=Native.CreateWindowExW(0,"STATIC","idle-player",0x50000000,17,23,400,300,parent,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
        DextNativeIdleWindow? lease=null;
        try
        {
            Require(parent!=IntPtr.Zero && child!=IntPtr.Zero,"fixture windows");
            var pid=Environment.ProcessId;var original=Read(child);var style=Native.GetWindowLongPtrW(child,-16);var extended=Native.GetWindowLongPtrW(child,-20);
            Require(!DextNativeIdleWindow.TryPresent(child,pid+1,new Rectangle(-4000,-3000,640,480),out lease) && lease==null && Read(child)==original,"wrong PID rejected before mutation");
            Require(DextNativeIdleWindow.TryPresent(child,pid,new Rectangle(-4000,-3000,640,480),out lease) && lease!.IsPresented,"existing child presented without replacement");
            Require(Native.GetParent(child)==IntPtr.Zero && Read(child)==new Rectangle(-4000,-3000,640,480),"negative origin/full size");
            var restored=lease!.TryRestore();Console.WriteLine($"RESTORE ok={restored} parent={Native.GetParent(child)} expected={parent} rect={Read(child)} expected={original} style={Native.GetWindowLongPtrW(child,-16).ToInt64():X}/{style.ToInt64():X} ex={Native.GetWindowLongPtrW(child,-20).ToInt64():X}/{extended.ToInt64():X}");
            Require(restored && !lease.IsPresented && Native.GetParent(child)==parent && Read(child)==original && Native.GetWindowLongPtrW(child,-16)==style && Native.GetWindowLongPtrW(child,-20)==extended,"restore parent/style/exstyle/bounds exactly");
            Require(lease.TryRestore(),"repeated restore is harmless");
            Console.WriteLine("PASS native idle same-HWND/PID presentation, negative bounds, exact and idempotent restoration");
            var popup=Native.CreateWindowExW(0,"STATIC","legacy-desktop-player",0x90000000,17,23,400,300,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
            DextNativeIdleWindow? popupLease=null;
            try
            {
                Native.SetWindowPos(popup,new IntPtr(-1),0,0,0,0,0x13);
                Console.WriteLine($"POPUP initial topmost style={Native.GetWindowLongPtrW(popup,-20).ToInt64():X}");
                Native.SetWindowPos(popup,new IntPtr(-2),0,0,0,0,0x13);
                WindowUtil.TrySetParent(popup,parent);Native.SetWindowPos(popup,IntPtr.Zero,17,23,400,300,0x14);
                var before=Read(popup);var beforeStyle=Native.GetWindowLongPtrW(popup,-16);
                Console.WriteLine($"POPUP before parent={Native.GetParent(popup)} ancestor={Native.GetAncestor(popup,1)} expected={parent} style={beforeStyle.ToInt64():X} rect={before}");
                var popupPresented=DextNativeIdleWindow.TryPresent(popup,pid,new Rectangle(-4000,-3000,640,480),out popupLease,out var popupDiagnostic);
                Console.WriteLine("POPUP "+popupDiagnostic);
                Require(popupPresented,"traditional WorkerW attached popup style accepted");
                Require(popupLease!.TryRestore() && Native.GetAncestor(popup,1)==parent && Read(popup)==before && Native.GetWindowLongPtrW(popup,-16)==beforeStyle,"traditional attached popup style restored");
                Console.WriteLine("PASS native idle traditional parented-popup and child-style desktop layouts");
            }
            finally {popupLease?.TryRestore();Native.DestroyWindow(popup);}
            Require(DextNativeIdleWindow.TryPresent(child,pid,new Rectangle(-4000,-3000,640,480),out lease),"second presentation");
            Native.DestroyWindow(parent);parent=IntPtr.Zero;
            Require(!lease!.TryRestore() && !Native.IsWindowVisible(child),"lost desktop parent hides owned Player and rejects restoration");
            Console.WriteLine("PASS native idle ownership rejection and lost-parent fail-closed hiding");
        }
        finally { lease?.TryRestore();if(child!=IntPtr.Zero)Native.DestroyWindow(child);if(parent!=IntPtr.Zero)Native.DestroyWindow(parent); }
    }
    public static void RunPlayer(IntPtr window,int pid)
    {
        var original=Read(window);var style=Native.GetWindowLongPtrW(window,-16);var ex=Native.GetWindowLongPtrW(window,-20);
        var originalParent=Native.GetParent(window);IntPtr parent=IntPtr.Zero;DextNativeIdleWindow? lease=null;
        var previousContext=Native.SetThreadDpiAwarenessContext(Native.GetWindowDpiAwarenessContext(window));
        try { parent=Native.CreateWindowExW(0,"STATIC","idle-desktop-fixture",0x80000000,-5000,-5000,1000,800,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero); }
        finally { Native.SetThreadDpiAwarenessContext(previousContext); }
        try
        {
            Require(originalParent==IntPtr.Zero && parent!=IntPtr.Zero,"isolated Player and parent");
            foreach(var childStyle in new[]{true,false})
            {
                Native.SetWindowLongPtrW(window,-16,new IntPtr(childStyle ? (style.ToInt64()&~0x80000000L)|0x40000000L : (style.ToInt64()&~0x40000000L)|0x80000000L));
                WindowUtil.TrySetParent(window,parent);Require(Native.GetAncestor(window,1)==parent,"fixture attaches actual Player");
                Require(Native.SetWindowPos(window,IntPtr.Zero,31,43,640,480,0x14),"fixture layout");
                var attached=Read(window);var attachedStyle=Native.GetWindowLongPtrW(window,-16);var attachedEx=Native.GetWindowLongPtrW(window,-20);var attachedDpi=Native.GetDpiForWindow(window);
                var present=DextNativeIdleWindow.TryPresent(window,pid,new Rectangle(-4000,-3000,640,480),out lease,out var diagnostic);
                Require(present && lease!.IsPresented,"actual Player same window idle: "+diagnostic);
                var restoreOk=lease!.TryRestore();
                var restoredParent=Native.GetAncestor(window,1);var restoredBounds=Read(window);var restoredStyle=Native.GetWindowLongPtrW(window,-16);var restoredEx=Native.GetWindowLongPtrW(window,-20);var restoredDpi=Native.GetDpiForWindow(window);
                Require(restoreOk && restoredParent==parent && restoredBounds==attached && restoredStyle==attachedStyle && restoredEx==attachedEx && restoredDpi==attachedDpi,
                    $"actual Player parent/style/bounds/DPI restoration: ok={restoreOk}, parent={restoredParent}/{parent}, bounds={restoredBounds}/{attached}, style={restoredStyle.ToInt64():X}/{attachedStyle.ToInt64():X}, ex={restoredEx.ToInt64():X}/{attachedEx.ToInt64():X}, dpi={restoredDpi}/{attachedDpi}");
                Console.WriteLine($"PASS actual ReleasePlayer same-HWND/PID idle roundtrip, childStyle={childStyle}, exact parent/style/bounds and DPI {attachedDpi}");
            }
        }
        finally
        {
            lease?.TryRestore();Native.ShowWindow(window,0);WindowUtil.TrySetParent(window,originalParent);Native.SetWindowLongPtrW(window,-16,style);Native.SetWindowLongPtrW(window,-20,ex);
            Native.SetWindowPos(window,IntPtr.Zero,original.X,original.Y,original.Width,original.Height,0x34);Native.ShowWindow(window,4);
            if(parent!=IntPtr.Zero)Native.DestroyWindow(parent);
        }
    }
    private static Rectangle Read(IntPtr h){Require(Native.GetWindowRect(h,out var r),"window bounds");return Rectangle.FromLTRB(r.Left,r.Top,r.Right,r.Bottom);}
    private static void Require(bool b,string s){if(!b)throw new Exception(s);}
    private static class Native
    {
        [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
        [DllImport("user32.dll")]public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr CreateWindowExW(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr p,IntPtr menu,IntPtr instance,IntPtr param);
        [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
        [DllImport("user32.dll")]public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr h);
        [DllImport("user32.dll")]public static extern uint GetDpiForWindow(IntPtr h);
        [DllImport("user32.dll")]public static extern IntPtr SetWindowLongPtrW(IntPtr h,int index,IntPtr value);
        [DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
        [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int show);
        [DllImport("user32.dll")]public static extern bool DestroyWindow(IntPtr h);
        [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")]public static extern IntPtr GetParent(IntPtr h);
        [DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr h,uint flags);
        [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect r);
        [DllImport("user32.dll")]public static extern IntPtr GetWindowLongPtrW(IntPtr h,int index);
    }
}
