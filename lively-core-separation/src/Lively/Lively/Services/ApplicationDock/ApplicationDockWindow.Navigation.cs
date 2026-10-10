using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Dext.Core.Rooms;

namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockWindow
{
    private RoomDockNavigation navigation;
    private StackPanel navigationStrip;
    private TextBlock deskName;
    private Button previousDesk, nextDesk;

    private StackPanel CreateNavigation(Action<Guid, int> navigate)
    {
        NameScope.SetNameScope(this, new NameScope());
        navigationStrip = new StackPanel { Orientation = Orientation.Horizontal, Visibility = Visibility.Collapsed,
            Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
        Button MakeButton(string label, string name, int direction)
        {
            var button = new Button { Content = label, Width = 32, Height = 40, Focusable = false,
                Background = Brushes.Transparent, Foreground = Brushes.Aquamarine, BorderThickness = new Thickness(0),
                ToolTip = direction < 0 ? "上一页" : "下一页" };
            Guid? pressedSession = null;
            button.PreviewMouseLeftButtonDown += (_, _) => pressedSession = navigation?.SessionId;
            button.Click += (_, _) =>
            {
                var session = pressedSession ?? navigation?.SessionId;
                pressedSession = null;
                if (navigation?.CanNavigate != true || session != navigation.SessionId) return;
                ClosePreview();
                navigate?.Invoke(session.Value, direction);
            };
            // WPF releases capture before Click; retain the down-session until Click or the next down.
            button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, button.ToolTip);
            RegisterName(name, button);
            return button;
        }
        previousDesk = MakeButton("‹", "PreviousDesk", -1);
        nextDesk = MakeButton("›", "NextDesk", 1);
        deskName = new TextBlock { Foreground = Brushes.White, Width = 90, TextAlignment = TextAlignment.Center,
            TextTrimming = TextTrimming.CharacterEllipsis, VerticalAlignment = VerticalAlignment.Center };
        RegisterName("CurrentDesk", deskName);
        navigationStrip.Children.Add(previousDesk);
        navigationStrip.Children.Add(deskName);
        navigationStrip.Children.Add(nextDesk);
        return navigationStrip;
    }

    public void UpdateNavigation(RoomDockNavigation value)
    {
        navigation = value;
        navigationStrip.Visibility = value == null ? Visibility.Collapsed : Visibility.Visible;
        previousDesk.IsEnabled = nextDesk.IsEnabled = value?.CanNavigate == true;
        deskName.Text = value?.CurrentName ?? "";
        deskName.ToolTip = value?.PendingName is { } pending ? $"{value.CurrentName} → {pending}" : value?.CurrentName;
    }
}
