using System.IO;
using System.Windows;
using System.Xml.Linq;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        var markup = XDocument.Load(Path.Combine(AppContext.BaseDirectory, "CoreApp.xaml"));
        var configured = markup.Root!.Attribute("ShutdownMode")?.Value;
        var app = new Application();
        if (configured is not null) app.ShutdownMode = Enum.Parse<ShutdownMode>(configured);
        var cleanupFinished = false;
        var exitedBeforeCleanup = false;
        Exception error = null;
        Task cleanup = null;
        app.Exit += (_, _) => exitedBeforeCleanup = !cleanupFinished;
        app.Startup += (_, _) =>
        {
            // Invisible, unfocused owned test window: exercises WPF last-window semantics only.
            var dock = new Window {Width=1,Height=1,Left=-32000,Top=-32000,
                Opacity=0,ShowActivated=false,ShowInTaskbar=false,WindowStyle=WindowStyle.None};
            dock.Show();
            cleanup = Task.Run(() =>
            {
                try
                {
                    app.Dispatcher.Invoke(dock.Close);
                    // Other Core services still need the dispatcher after Dock disposal.
                    // Give the queued last-window shutdown a deterministic chance to run.
                    Thread.Sleep(100);
                    if (app.Dispatcher.HasShutdownStarted)
                        throw new InvalidOperationException("Dispatcher shut down before remaining Core services were disposed.");
                    app.Dispatcher.Invoke(() => cleanupFinished = true);
                    app.Dispatcher.Invoke(app.Shutdown);
                }
                catch(Exception failure)
                {
                    error = failure;
                    if (!app.Dispatcher.HasShutdownStarted)
                        app.Dispatcher.BeginInvoke(new Action(app.Shutdown));
                }
            });
        };
        app.Run();
        if (cleanup?.Wait(3000) != true || error is not null || exitedBeforeCleanup || !cleanupFinished)
        {
            Console.Error.WriteLine($"FAIL Core shutdown ordering: mode={app.ShutdownMode}, exitBeforeCleanup={exitedBeforeCleanup}, error={error?.Message}");
            return 1;
        }
        Console.WriteLine("PASS actual Core App.xaml keeps dispatcher alive until services finish and explicit shutdown runs");
        return 0;
    }
}
