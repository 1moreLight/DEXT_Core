using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows.Automation;

internal static class FusionNativePreviewProbe
{
    internal static async Task Run(Func<JsonElement> app,Func<JsonElement> theme,int corePid)
    {
        GetCursorPos(out var cursor);var foreground=GetForegroundWindow();
        using var first=await FusionActionWindow.Create("Dext Native Preview First");
        using var second=await FusionActionWindow.Create("Dext Native Preview Second");
        IntPtr Find(int pid,string title=null){IntPtr found=IntPtr.Zero;EnumWindows((w,_)=>{
            GetWindowThreadProcessId(w,out var owner);if(owner!=pid)return true;
            var text=new StringBuilder(256);GetWindowText(w,text,text.Capacity);
            if((title==null&&GetWindowRect(w,out var r)&&r.Right-r.Left>300)||(title!=null&&text.ToString()==title))found=w;
            return true;},IntPtr.Zero);return found;}
        JsonElement Field(JsonElement value,string name)=>value.EnumerateObject().Single(p=>p.Name.Equals(name,StringComparison.OrdinalIgnoreCase)).Value;
        string groupName=null;
        AutomationElement Button(IntPtr window,string name)=>AutomationElement.FromHandle(window).FindFirst(TreeScope.Descendants,
            new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button),new PropertyCondition(AutomationElement.NameProperty,name)));
        async Task Click(AutomationElement button){if(button==null)throw new Exception("UIA button not found");var r=button.Current.BoundingRectangle;
            if(r.IsEmpty||r.Width<=0||r.Height<=0)throw new Exception("UIA button not visible");await FusionActionWindow.ClickPoint((int)(r.X+r.Width/2),(int)(r.Y+r.Height/2));}
        try
        {
            await FusionActionWindow.Wait(()=>{
                foreach(var group in app().GetProperty("groups").EnumerateArray())
                    if(Field(group,"windows").EnumerateArray().Count(w=>Field(w,"processId").GetInt32()==Environment.ProcessId)==2){groupName=Field(group,"name").GetString();return true;}
                return false;
            },"Two owned windows not grouped",15);
            var dock=Find(theme().GetProperty("runtime").GetProperty("playerPid").GetInt32());
            if(dock==IntPtr.Zero||!GetWindowRect(dock,out var dockBounds))throw new Exception("Dock not found");
            SetCursorPos((dockBounds.Left+dockBounds.Right)/2,dockBounds.Bottom-1);
            await FusionActionWindow.Wait(()=>IsWindowVisible(dock),"Dock did not reveal");
            await FusionActionWindow.Wait(()=>{
                var taskbar=app().GetProperty("taskbar");
                var settled=taskbar.GetProperty("hidden").GetBoolean()||taskbar.GetProperty("mode").GetString()=="visible";
                return settled&&Button(dock,groupName)?.Current.IsEnabled==true;
            },"Task button not enabled after taskbar settles",15);
            await Task.Delay(1000);
            await Click(Button(dock,groupName));
            IntPtr preview=IntPtr.Zero;
            await FusionActionWindow.Wait(()=>{preview=Find(corePid,"Dext 窗口预览");return preview!=IntPtr.Zero&&IsWindowVisible(preview);},"Native preview did not open");
            Console.WriteLine("PASS actual task click opens Core native preview");
            var choice=Button(preview,"Dext Native Preview Second");
            if(choice==null)throw new Exception("Second window card missing");
            var bounds=choice.Current.BoundingRectangle;SetCursorPos((int)(bounds.X+bounds.Width/2),(int)(bounds.Y+bounds.Height/2));
            await Task.Delay(1600);
            if(!IsWindowVisible(preview)||!IsWindowVisible(dock))throw new Exception("Preview hover failed to keep Dock expanded");
            Console.WriteLine("PASS native preview hover keeps auto-hidden Dock expanded");
            await Click(choice);
            await FusionActionWindow.Wait(()=>GetForegroundWindow()==second.Handle,"Native preview selected wrong window");
            await FusionActionWindow.Wait(()=>!IsWindowVisible(preview),"Native preview remained after selection");
            Console.WriteLine("PASS native second-window card activates exact owned window and closes preview");
        }
        finally {SetCursorPos(cursor.X,cursor.Y);SetForegroundWindow(foreground);}
    }
    [StructLayout(LayoutKind.Sequential)]private struct Point{public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    private delegate bool Callback(IntPtr window,IntPtr parameter);
    [DllImport("user32.dll")]private static extern bool EnumWindows(Callback callback,IntPtr parameter);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll")]private static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")]private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(IntPtr window);
}
