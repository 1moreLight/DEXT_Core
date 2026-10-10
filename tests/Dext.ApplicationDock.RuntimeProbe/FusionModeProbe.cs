using System.Runtime.InteropServices;
using System.Text.Json;

internal static class FusionModeProbe
{
    internal static async Task Run(Func<JsonElement> app,Func<JsonElement> theme,Action<object> edit,Func<bool> ready)
    {
        GetCursorPos(out var cursor);
        Rect Work(){if(!SystemParametersInfo(0x30,0,out var r,0))throw new Exception("Cannot read work area");return r;}
        IntPtr Window(){var pid=theme().GetProperty("runtime").GetProperty("playerPid").GetInt32();IntPtr found=IntPtr.Zero;
            EnumWindows((w,_)=>{GetWindowThreadProcessId(w,out var owner);if(owner==pid&&GetWindowRect(w,out var r)&&r.Right-r.Left>300&&r.Bottom-r.Top>30)found=w;return true;},IntPtr.Zero);return found;}
        async Task Wait(Func<bool> f,string label){await FusionActionWindow.Wait(f,label,45);Console.WriteLine("PASS "+label);}
        bool Mode(string name)=>ready()&&app().GetProperty("presentationState").GetProperty("mode").GetString()==name;
        try
        {
            edit(new{operation="reserveSpace",reserveSpace=false});
            edit(new{operation="autoHide",autoHide=false});
            SetCursorPos(20,20);
            await Wait(()=>Mode("overlay")&&theme().GetProperty("runtime").GetProperty("overlayAvailable").GetBoolean()&&IsWindowVisible(Window()),"overlay ready and visible away from Dock");
            var baseline=Work();var overlay=Window();
            await Task.Delay(1500);
            if(!IsWindowVisible(overlay)||theme().GetProperty("runtime").GetProperty("appBarOccupied").GetBoolean())throw new Exception("Overlay hid or reserved AppBar");
            Console.WriteLine("PASS overlay stays visible without AppBar");
            edit(new{operation="reserveSpace",reserveSpace=true});
            await Wait(()=>Mode("reserve")&&theme().GetProperty("runtime").GetProperty("appBarOccupied").GetBoolean()&&Work().Bottom<baseline.Bottom,"reserve occupies real Windows work area");
            edit(new{operation="reserveSpace",reserveSpace=false});
            edit(new{operation="autoHide",autoHide=true});
            await Wait(()=>Mode("autohide")&&Work().Bottom==baseline.Bottom,"autohide releases reserved work area");
            SetCursorPos(20,20);
            await Wait(()=>Window()!=IntPtr.Zero&&!IsWindowVisible(Window()),"autohide hides after pointer leaves");
            var work=Work();SetCursorPos((work.Left+work.Right)/2,work.Bottom-1);
            await Wait(()=>IsWindowVisible(Window()),"autohide reveals at screen edge");
        }
        finally {SetCursorPos(cursor.X,cursor.Y);}
    }
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    private delegate bool Callback(IntPtr window,IntPtr parameter);
    [DllImport("user32.dll")]private static extern bool EnumWindows(Callback callback,IntPtr parameter);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")]private static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")]private static extern bool SystemParametersInfo(uint action,uint param,out Rect value,uint flags);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern bool GetCursorPos(out Point point);
}
