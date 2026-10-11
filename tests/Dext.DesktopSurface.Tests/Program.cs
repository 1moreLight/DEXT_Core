using System.Runtime.InteropServices;
using Lively.Services.DesktopSync;
internal static class Program
{
    [STAThread] static int Main() { try { Run(); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; } }
    static void Run()
    {
        using var shell = new Form { Location = new(-20000,-20000), Size = new(900,700), ShowInTaskbar = false };
        using var view = new Panel { Bounds = new(0,0,800,600) };
        using var background = new Panel { Bounds = new(5,7,800,600) };
        using var player = new Panel { Bounds = new(11,13,500,350) };
        shell.Controls.Add(background); shell.Controls.Add(view); background.Controls.Add(player);
        var root = shell.Handle; var shellView = view.Handle; var back = background.Handle; var hwnd = player.Handle;
        var pid = Environment.ProcessId;
        GetWindowRect(hwnd,out var before);
        Check(!DesktopSurfaceWindow.TryRaise(hwnd,pid+1,shellView,out _), "foreign identity refused");
        Check(DesktopSurfaceWindow.TryRaise(hwnd,pid,shellView,out var lease), "raise existing window");
        Check(GetParent(hwnd)==root && GetWindow(shellView,0)==hwnd,"above shell sibling");
        GetWindowRect(hwnd,out var after); Check(before.Equals(after),"screen coordinates preserved");
        Check(lease!.IsPresented,"lease confirms current layer");
        Check(lease.TryRestore() && GetParent(hwnd)==back,"original parent restored");
        GetWindowRect(hwnd,out after); Check(before.Equals(after),"restore coordinates");
        Check(lease.TryRestore(),"idempotent restore");
        background.Controls.Remove(player); shell.Controls.Add(player); view.BringToFront();
        var previous=GetWindow(hwnd,3);
        Check(DesktopSurfaceWindow.TryRaise(hwnd,pid,shellView,out lease),"same parent raise");
        Check(lease!.TryRestore() && GetWindow(hwnd,3)==previous,"same parent order restored");
        Check(DesktopSurfaceWindow.TryRaise(hwnd,pid,shellView,out lease),"lease before destruction");
        player.Dispose(); Check(lease!.TryRestore(),"closed player releases lease");
        Console.WriteLine("PASS 12 desktop surface checks; hidden HWNDs only, no Explorer drag or touch claim");
    }
    static void Check(bool value,string name){if(!value)throw new Exception(name);Console.WriteLine("PASS "+name);}
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
    [DllImport("user32.dll")] static extern nint GetParent(nint h);
    [DllImport("user32.dll")] static extern nint GetWindow(nint h,uint cmd);
    [DllImport("user32.dll")] static extern bool GetWindowRect(nint h,out Rect rect);
}

