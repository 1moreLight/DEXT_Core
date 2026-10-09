using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Lively.Services.ApplicationDock;

internal sealed class ApplicationDockWindow : Window
{
    private readonly StackPanel strip = new() { Orientation = Orientation.Horizontal };
    private readonly Dictionary<string, ImageSource> icons = new(StringComparer.OrdinalIgnoreCase);
    private readonly Action<DockGroup, DockTask> click;
    private readonly Action<DockGroup> pin;
    private readonly Func<string, byte[]> icon;
    private readonly TextBlock message = new() { Foreground = Brushes.LightSalmon, FontSize = 11, MaxWidth = 460, TextWrapping = TextWrapping.Wrap };
    private string signature;

    public ApplicationDockWindow(Action<DockGroup, DockTask> click, Action<DockGroup> pin, Func<string, byte[]> icon)
    {
        this.click = click; this.pin = pin; this.icon = icon;
        Title = "Dext 系统应用 Dock";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        SizeToContent = SizeToContent.WidthAndHeight;
        var stack = new StackPanel();
        stack.Children.Add(new ScrollViewer
        {
            Content = strip, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = ScrollBarVisibility.Disabled
        });
        stack.Children.Add(message);
        Content = new Border
        {
            Background = new SolidColorBrush(Color.FromArgb(245, 26, 30, 34)),
            BorderBrush = new SolidColorBrush(Color.FromArgb(120, 160, 177, 186)),
            BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(16),
            Padding = new Thickness(7, 5, 7, 5), Child = stack
        };
        SourceInitialized += (_, _) =>
        {
            var handle = new WindowInteropHelper(this).Handle;
            DockWindows.SetWindowLong(handle, -20, DockWindows.GetWindowLong(handle, -20) | 0x08000000 | 0x80);
        };
        SizeChanged += (_, _) => Position();
        Loaded += (_, _) => Position();
    }

    private void Position()
    {
        var work = SystemParameters.WorkArea;
        MaxWidth = Math.Max(120, work.Width - 32);
        Left = work.Left + Math.Max(0, (work.Width - ActualWidth) / 2);
        Top = work.Bottom - ActualHeight - 8;
    }

    public void Update(IReadOnlyList<DockGroup> groups, long foreground, string error)
    {
        Position();
        message.Text = error ?? "";
        message.Visibility = string.IsNullOrEmpty(error) ? Visibility.Collapsed : Visibility.Visible;
        var next = System.Text.Json.JsonSerializer.Serialize(new { groups, foreground });
        // Never replace the button that owns a physical mouse-down before its mouse-up.
        if (next == signature || Mouse.LeftButton == MouseButtonState.Pressed || Mouse.RightButton == MouseButtonState.Pressed ||
            strip.Children.OfType<Button>().Any(b => b.ContextMenu?.IsOpen == true)) return;
        signature = next;
        strip.Children.Clear();
        if (groups.Count == 0)
        {
            strip.Children.Add(new TextBlock { Text = "在配置器 Dock 页固定应用，或打开一个应用", Foreground = Brushes.LightGray, Margin = new Thickness(12) });
            return;
        }
        foreach (var group in groups)
        {
            var active = group.Windows.Any(w => w.Handle == foreground);
            var panel = new StackPanel { Width = 44 };
            var image = GetIcon(group.Pin?.Target ?? group.Windows[0].Target);
            if (image != null) panel.Children.Add(new Image { Source = image, Width = 34, Height = 34, Margin = new Thickness(5, 3, 5, 3) });
            else panel.Children.Add(new TextBlock { Text = group.Name.Length > 0 ? group.Name[..1] : "?", FontSize = 24, Foreground = Brushes.White, TextAlignment = TextAlignment.Center, Height = 40 });
            panel.Children.Add(new Border
            {
                Width = active ? 22 : 5, Height = 3, CornerRadius = new CornerRadius(2),
                Background = active ? Brushes.Aquamarine : group.Windows.Count > 0 ? Brushes.LightGray : Brushes.Transparent,
                Margin = new Thickness(0, 3, 0, 1)
            });
            var button = new Button
            {
                Content = panel, Background = Brushes.Transparent, BorderThickness = new Thickness(0),
                Padding = new Thickness(2), Margin = new Thickness(1, 0, 1, 0), Focusable = false,
                ToolTip = group.Name + (group.Windows.Count > 0 ? " · " + group.Windows.Count + " 个窗口" : " · 点击启动"),

            };
            button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, group.Name);
            var menu = new ContextMenu();
            foreach (var task in group.Windows)
            {
                var captured = task;
                var item = new MenuItem { Header = task.Title, IsCheckable = true, IsChecked = task.Handle == foreground };
                item.Click += (_, _) => click(group, captured);
                menu.Items.Add(item);
            }
            if (group.Windows.Count > 0) menu.Items.Add(new Separator());
            var pinItem = new MenuItem { Header = group.Pin != null ? "取消固定" : "固定到应用 Dock" };
            pinItem.Click += (_, _) => pin(group);
            menu.Items.Add(pinItem);
            button.ContextMenu = menu;
            button.Click += (_, _) =>
            {
                if (group.Windows.Count > 1) { menu.PlacementTarget = button; menu.IsOpen = true; }
                else click(group, null);
            };
            strip.Children.Add(button);
        }
    }

    private ImageSource GetIcon(string target)
    {
        if (icons.TryGetValue(target, out var cached)) return cached;
        ImageSource source = null;
        try
        {
            var bytes = icon(target);
            if (bytes != null && bytes.Length > 0)
            {
                using var stream = new MemoryStream(bytes);
                var bitmap = new BitmapImage();
                bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = stream; bitmap.EndInit(); bitmap.Freeze();
                source = bitmap;
            }
        }
        catch { }
        if (icons.Count > 256) icons.Clear();
        icons[target] = source;
        return source;
    }
}
