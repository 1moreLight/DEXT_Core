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
                var currentScope = "desk-a";
                var pinEdits = 0;
                window = new ApplicationDockWindow((group, _) => dispatched = group, group => { if (DockModel.CanEditPin(group, currentScope)) pinEdits++; }, _ => null);
                var pin = new DockPin("Test", @"C:\Test.exe", "", "");
                var idle = DockModel.Group(new[] { pin }, Array.Empty<DockTask>());
                window.Update(idle, 0, null);
                var root = (StackPanel)((Border)window.Content).Child;
                var strip = (StackPanel)((ScrollViewer)((Panel)root.Children[0]).Children[1]).Content;
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

                var scoped = idle.Select(g => g with { PinScope = "desk-a" }).ToArray();
                window.Update(scoped, 0, null);
                var oldScopedButton = strip.Children.OfType<Button>().Single();
                var oldPinMenu = oldScopedButton.ContextMenu.Items.OfType<MenuItem>().Last();
                currentScope = "desk-b";
                window.Update(scoped.Select(g => g with { PinScope = "desk-b" }).ToArray(), 0, null);
                var newScopedButton = strip.Children.OfType<Button>().Single();
                Require(!ReferenceEquals(oldScopedButton,newScopedButton), "page scope refreshes idle menus even when app list is identical");
                oldPinMenu.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
                Require(pinEdits == 0, "old menu cannot change new Desk or global pins");
                newScopedButton.ContextMenu.Items.OfType<MenuItem>().Last().RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
                Require(pinEdits == 1, "new page menu remains usable");
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
