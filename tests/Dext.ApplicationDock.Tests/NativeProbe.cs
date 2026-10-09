using System.Diagnostics;
using System.Runtime.InteropServices;
using Lively.Services.ApplicationDock;

static class NativeProbe
{
    public static void RunFixture()
    {
        var thread = new Thread(() =>
        {
            using var first = new PassiveForm { Text = "DEXT controlled Dock window A", Width = 320, Height = 140, Left = 80, Top = 80 };
            using var second = new PassiveForm { Text = "DEXT controlled Dock window B", Width = 320, Height = 140, Left = 100, Top = 240 };
            first.Show(); second.Show();
            var lifetime = new System.Windows.Forms.Timer { Interval = 30000 };
            lifetime.Tick += (_, _) => System.Windows.Forms.Application.ExitThread();
            lifetime.Start();
            System.Windows.Forms.Application.Run();
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start(); thread.Join();
    }
    public static void Run()
    {
        using var child = Process.Start(new ProcessStartInfo(Environment.ProcessPath!, "--fixture") { UseShellExecute = false });
        if (child == null) throw new Exception("Cannot start fixture.");
        try
        {
            IReadOnlyList<DockTask> found = Array.Empty<DockTask>();
            var deadline = DateTime.UtcNow.AddSeconds(8);
            while (DateTime.UtcNow < deadline)
            {
                found = DockWindows.Enumerate().Where(w => w.ProcessId == child.Id).ToArray();
                if (found.Count == 2) break;
                Thread.Sleep(100);
            }
            if (found.Count != 2) throw new Exception("Expected two actual native windows, got " + found.Count);
            Console.WriteLine("PASS actual Windows enumeration finds both controlled windows");
            var groups = DockModel.Group(Array.Empty<DockPin>(), found);
            if (groups.Count != 1 || groups[0].Windows.Count != 2) throw new Exception("Native windows did not group.");
            Console.WriteLine("PASS actual two-window application groups once");
            if (!DockWindows.Perform(found[0], true)) throw new Exception("Minimize dispatch rejected.");
            deadline = DateTime.UtcNow.AddSeconds(2);
            while (!IsIconic(new IntPtr(found[0].Handle)) && DateTime.UtcNow < deadline) Thread.Sleep(25);
            if (!IsIconic(new IntPtr(found[0].Handle))) throw new Exception("Window did not minimize.");
            if (!DockWindows.Enumerate().Any(w => w.Handle == found[0].Handle)) throw new Exception("Minimized window disappeared.");
            Console.WriteLine("PASS actual minimize and minimized-window inclusion");
            child.Kill(); child.WaitForExit(3000);
            if (DockWindows.Perform(found[0], false)) throw new Exception("Closed window was accepted.");
            if (DockWindows.Enumerate().Any(w => w.ProcessId == child.Id)) throw new Exception("Closed windows persisted.");
            Console.WriteLine("PASS closed-window removal and stale action rejection");
        }
        finally { if (!child.HasExited) { child.Kill(); child.WaitForExit(3000); } }
    }
    private sealed class PassiveForm : System.Windows.Forms.Form { protected override bool ShowWithoutActivation => true; }
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
}
