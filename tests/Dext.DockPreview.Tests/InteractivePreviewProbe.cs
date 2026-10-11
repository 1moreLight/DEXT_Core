using System;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Lively.Services.ApplicationDock;

internal static class InteractivePreviewProbe
{
    public static void Run(int fixturePid)
    {
        var thread = new Thread(() =>
        {
            var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
            var status = new TextBlock { Text = "Controlled preview fixture", Margin = new Thickness(16), TextWrapping = TextWrapping.Wrap };
            var observer = new Window { Title = "DEXT preview probe observer", Width = 420, Height = 160,
                Left = 450, Top = 100, ShowActivated = false, Content = status };
            var dock = new ApplicationDockWindow((group, selected) =>
            {
                var action = selected == null ? DockModel.Action(group, DockWindows.Foreground) : DockAction.Activate;
                var task = selected ?? group.Windows.FirstOrDefault();
                var accepted = task != null && DockWindows.Perform(task, action == DockAction.Minimize);
                status.Text = action + " " + task?.Title + " accepted=" + accepted + " foreground=" + DockWindows.Foreground;
            }, _ => { }, _ => null);
            var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            timer.Tick += (_, _) => dock.Update(DockModel.Group(Array.Empty<DockPin>(),
                DockWindows.Enumerate().Where(task => task.ProcessId == fixturePid).ToArray()), DockWindows.Foreground, null);
            var lifetime = new DispatcherTimer { Interval = TimeSpan.FromMinutes(5) };
            lifetime.Tick += (_, _) => app.Shutdown();
            observer.Closed += (_, _) => app.Shutdown();
            app.Exit += (_, _) => { timer.Stop(); lifetime.Stop(); dock.Close(); };
            observer.Show(); dock.Show(); timer.Start(); lifetime.Start();
            app.Run();
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start(); thread.Join();
    }
}
