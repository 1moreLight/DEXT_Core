using Lively.Common.Helpers.Pinvoke;
using System;
using System.Drawing;
using System.Runtime.InteropServices;

namespace Lively.Common.Helpers
{
    public static class DextNativeInputWindow
    {
        [DllImport("user32.dll")] private static extern bool IsChild(IntPtr parent,IntPtr child);
        [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr hwnd,ref Point point);
        // A browser anchor belongs to this Player. Chromium descendants may
        // belong to a renderer process; their ancestry binds them to the anchor.
        // Repeated measurements reject a layout change across native queries.
        public static bool TryMeasure(IntPtr root,IntPtr browser,IntPtr input,int playerPid,out Rectangle viewport,out int dpi)
        {
            viewport=default;dpi=0;
            if(!Measure(root,browser,input,playerPid,out var first,out var firstDpi) ||
                !Measure(root,browser,input,playerPid,out var second,out var secondDpi) || first!=second || firstDpi!=secondDpi)return false;
            viewport=first;dpi=firstDpi;return true;
        }
        // Query current native work area, never the cached Screen.WorkingArea.
        public static bool TryReadWorkArea(IntPtr root, out Rectangle workArea)
        {
            workArea = default;
            if (root == IntPtr.Zero) return false;
            var monitor = NativeMethods.MonitorFromWindow(root, 2);
            var info = new WorkAreaInfo { Size = (uint)Marshal.SizeOf(typeof(WorkAreaInfo)) };
            if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info) ||
                info.Work.Right <= info.Work.Left || info.Work.Bottom <= info.Work.Top) return false;
            workArea = Rectangle.FromLTRB(info.Work.Left, info.Work.Top, info.Work.Right, info.Work.Bottom);
            return true;
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct WorkAreaRect { internal int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)]
        private struct WorkAreaInfo
        {
            internal uint Size;
            internal WorkAreaRect Monitor, Work;
            internal uint Flags;
        }
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern bool GetMonitorInfo(IntPtr monitor, ref WorkAreaInfo info);
        public static bool IsOwnedChild(IntPtr root,IntPtr browser,IntPtr input,int pid)=>
            root!=IntPtr.Zero&&browser!=IntPtr.Zero&&input!=IntPtr.Zero&&pid>0&&
            NativeMethods.GetWindowThreadProcessId(root,out int rootPid)!=0&&rootPid==pid&&
            NativeMethods.GetWindowThreadProcessId(browser,out int browserPid)!=0&&browserPid==pid&&
            IsChild(root,browser)&&IsChild(browser,input);
        private static bool Measure(IntPtr root,IntPtr browser,IntPtr input,int pid,out Rectangle viewport,out int dpi)
        {
            viewport=default;dpi=0;
            if(root==IntPtr.Zero || browser==IntPtr.Zero || input==IntPtr.Zero || pid<=0 ||
                NativeMethods.GetWindowThreadProcessId(root,out int rootPid)==0 || rootPid!=pid ||
                NativeMethods.GetWindowThreadProcessId(browser,out int browserPid)==0 || browserPid!=pid ||
                !IsChild(root,browser) || !IsChild(browser,input) ||
                !NativeMethods.GetClientRect(browser,out var web) || !NativeMethods.GetClientRect(input,out var child))return false;
            var origin=new Point();var webOrigin=new Point();
            if(!ClientToScreen(input,ref origin) || !ClientToScreen(browser,ref webOrigin) || origin!=webOrigin ||
                child.Right-child.Left!=web.Right-web.Left || child.Bottom-child.Top!=web.Bottom-web.Top || child.Right<=child.Left || child.Bottom<=child.Top)return false;
            dpi=NativeMethods.GetDpiForWindow(input);if(dpi<=0)return false;
            viewport=new Rectangle(origin.X,origin.Y,child.Right-child.Left,child.Bottom-child.Top);return true;
        }
    }
}
