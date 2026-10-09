using System;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using Lively.Services.ApplicationDock;

internal static class DockButtonSnapshotTests
{
    public static void Run()
    {
        Exception failure = null;
        var thread = new Thread(() =>
        {
            ApplicationDockWindow window = null;
            try
            {
                DockGroup dispatched = null;
                window = new ApplicationDockWindow((group, _) => dispatched = group, _ => { }, _ => null);
                var pin = new DockPin("Test", @"C:\Test.exe", "", "");
                var idle = DockModel.Group(new[] { pin }, Array.Empty<DockTask>());
                window.Update(idle, 0, null);
                var root = (StackPanel)((Border)window.Content).Child;
                var strip = (StackPanel)((ScrollViewer)root.Children[0]).Content;
                // Retain the same button as a press or open preview does in the real window.
                var retainedButton = strip.Children.OfType<Button>().Single();
                var task = new DockTask(123, 9, "New window", pin.Target);
                window.Update(DockModel.Group(new[] { pin }, new[] { task }), 0, null);
                retainedButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Require(dispatched?.Windows.Count == 1 && dispatched.Windows[0] == task,
                    "retained button dispatches latest running window instead of relaunching idle pin");

                dispatched = null;
                window.Update(DockModel.Group(new[] { pin }, new[] { task, task with { Handle = 124 } }), 0, null);
                retainedButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Require(dispatched == null, "retained button does not dispatch obsolete single-window action after another window opens");

                window.Update(Array.Empty<DockGroup>(), 0, null);
                retainedButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Require(dispatched == null, "removed app cannot dispatch from a retained button");
            }
            catch (Exception ex) { failure = ex; }
            finally { window?.Close(); }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start(); thread.Join();
        if (failure != null) throw new Exception("Dock button snapshot regression", failure);
    }
    private static void Require(bool condition, string label)
    {
        if (!condition) throw new Exception(label);
        Console.WriteLine("PASS " + label);
    }
}
