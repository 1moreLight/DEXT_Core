using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;

namespace Lively.Services.ApplicationDock;

internal sealed class DockPreviewWindow : Window
{
    private sealed class Card
    {
        public DockTask Task;
        public Border Surface;
        public TextBlock Fallback;
        public DockThumbnail Thumbnail;
    }
    private readonly List<Card> cards = new();
    private readonly StackPanel row = new() { Orientation = Orientation.Horizontal };
    private readonly Button previous = new() { Content = "上一组", Focusable = false };
    private readonly Button next = new() { Content = "下一组", Focusable = false };
    private readonly TextBlock caption = new() { Foreground = Brushes.White, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 8, 0), MaxWidth = 140, TextTrimming = TextTrimming.CharacterEllipsis };
    private readonly Action<DockGroup, DockTask> activate;
    private DockGroup group;
    private int page, pageSize;
    private string signature;
    public string GroupKey => group?.Key;

    public DockPreviewWindow(Action<DockGroup, DockTask> activate)
    {
        this.activate = activate;
        Title = "Dext 窗口预览";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        // Keep a regular top-level composition target: layered WPF windows cannot host this DWM view.
        Background = new SolidColorBrush(Color.FromRgb(28, 32, 37));
        SizeToContent = SizeToContent.WidthAndHeight;
        var root = new StackPanel { Margin = new Thickness(8) };
        root.Children.Add(row);
        var navigation = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 6, 0, 0) };
        navigation.Children.Add(previous); navigation.Children.Add(caption); navigation.Children.Add(next);
        root.Children.Add(navigation); Content = root;
        previous.Click += (_, _) => { page--; Rebuild(); Reposition(); };
        next.Click += (_, _) => { page++; Rebuild(); Reposition(); };
        SourceInitialized += (_, _) =>
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            DockWindows.SetWindowLong(hwnd, -20, DockWindows.GetWindowLong(hwnd, -20) | 0x08000000 | 0x80);
        };
        LocationChanged += (_, _) => RefreshThumbnails();
        SizeChanged += (_, _) => RefreshThumbnails();
        Closed += (_, _) => ReleaseThumbnails();
    }

    // Caller supplies an admitted Player HWND and owns scope/lifecycle validation.
    // Physical client coordinates are read here; author CSS cannot position a native window.
    public bool ShowForNative(DockGroup value, IntPtr owner, double horizontalFraction)
    {
        var anchor = ReadNativeAnchor(owner, horizontalFraction);
        if (anchor == null) { HidePreview(); return false; }
        new WindowInteropHelper(this).Owner = owner;
        ShowFor(value, anchor.Value.Center, anchor.Value.Top);
        return IsVisible;
    }

    public bool FollowNativeAnchor(IntPtr owner, double horizontalFraction)
    {
        var anchor = ReadNativeAnchor(owner, horizontalFraction);
        if (anchor == null) { HidePreview(); return false; }
        FollowAnchor(anchor.Value.Center, anchor.Value.Top);
        return IsVisible;
    }

    private static (double Center, double Top)? ReadNativeAnchor(IntPtr owner, double fraction)
    {
        if (owner == IntPtr.Zero || !NativeIsWindowVisible(owner) ||
            !NativeGetClientRect(owner, out var bounds)) return null;
        var origin = new NativePoint();
        if (!NativeClientToScreen(owner, ref origin)) return null;
        return DockPreviewGeometry.NativeAnchor(origin.X, origin.Y, bounds.Right - bounds.Left, NativeGetDpiForWindow(owner), fraction);
    }
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct NativePoint { public int X, Y; }
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct NativeRect { public int Left, Top, Right, Bottom; }
    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint="IsWindowVisible")]
    private static extern bool NativeIsWindowVisible(IntPtr hwnd);
    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint="GetClientRect")]
    private static extern bool NativeGetClientRect(IntPtr hwnd, out NativeRect rect);
    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint="ClientToScreen")]
    private static extern bool NativeClientToScreen(IntPtr hwnd, ref NativePoint point);
    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint="GetDpiForWindow")]
    private static extern uint NativeGetDpiForWindow(IntPtr hwnd);

    private double anchorCenter, anchorTop;
    public void ShowFor(DockGroup value, double centerInDip, double dockTop)
    {
        anchorCenter = centerInDip;
        anchorTop = dockTop;
        page = group?.Key == value.Key ? page : 0;
        group = value;
        pageSize = DockPreviewGeometry.PageSize(SystemParameters.WorkArea.Width);
        if (value.Windows.Count == 0) { HidePreview(); return; }
        Rebuild();
        Reposition();
        if (!IsVisible) Show();
        UpdateLayout();
        Reposition();
        RefreshThumbnails();
    }

    public void FollowAnchor(double centerInDip, double dockTop)
    {
        if (!IsVisible) return;
        anchorCenter = centerInDip;
        anchorTop = dockTop;
        Reposition();
    }
    public void UpdateGroup(DockGroup value)
    {
        if (!IsVisible) return;
        if (value == null || value.Windows.Count == 0) { HidePreview(); return; }
        group = value;
        var updatedPageSize = DockPreviewGeometry.PageSize(SystemParameters.WorkArea.Width);
        var updated = System.Text.Json.JsonSerializer.Serialize(value.Windows);
        if ((signature != updated || updatedPageSize != pageSize) && Mouse.LeftButton != MouseButtonState.Pressed)
        {
            pageSize = updatedPageSize;
            Rebuild(); Reposition();
        }
        RefreshThumbnails();
    }

    private void Rebuild()
    {
        ReleaseThumbnails(); row.Children.Clear();
        signature = System.Text.Json.JsonSerializer.Serialize(group.Windows);
        page = DockPreviewGeometry.ClampPage(page, group.Windows.Count, pageSize);
        var width = Math.Min(204, Math.Max(64, SystemParameters.WorkArea.Width - 48));
        foreach (var task in group.Windows.Skip(page * pageSize).Take(pageSize))
        {
            var fallback = new TextBlock
            {
                Text = "预览不可用 · 点击切换", Foreground = Brushes.LightGray,
                HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center,
                TextWrapping = TextWrapping.Wrap, FontSize = 11
            };
            var surface = new Border { Width = width, Height = 120, Background = Brushes.Black, Child = fallback };
            var stack = new StackPanel();
            stack.Children.Add(surface);
            stack.Children.Add(new TextBlock
            {
                Text = task.Title, Foreground = Brushes.White, Width = width,
                TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 7, 0, 0)
            });
            var button = new Button
            {
                Content = stack, Padding = new Thickness(5), Margin = new Thickness(2, 0, 2, 0),
                Background = Brushes.Transparent, BorderBrush = Brushes.DimGray, BorderThickness = new Thickness(1),
                Focusable = false, ToolTip = task.Title
            };
            button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, task.Title);
            button.Click += (_, _) =>
            {
                var selectedGroup = group;
                HidePreview();
                activate(selectedGroup, task);
            };
            row.Children.Add(button);
            cards.Add(new Card { Task = task, Surface = surface, Fallback = fallback });
        }
        previous.IsEnabled = page > 0;
        next.IsEnabled = (page + 1) * pageSize < group.Windows.Count;
        caption.Text = group.Name + " · " + (page + 1) + "/" + Math.Max(1, (group.Windows.Count + pageSize - 1) / pageSize);
        UpdateLayout();
        RefreshThumbnails();
    }

    private void Reposition()
    {
        var work = SystemParameters.WorkArea;
        Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
        Left = Math.Clamp(anchorCenter - DesiredSize.Width / 2, work.Left, Math.Max(work.Left, work.Right - DesiredSize.Width));
        Top = Math.Max(work.Top, anchorTop - DesiredSize.Height - 6);
    }

    private void RefreshThumbnails()
    {
        if (!IsVisible) return;
        var destination = new WindowInteropHelper(this).Handle;
        if (destination == IntPtr.Zero) return;
        var origin = PointToScreen(new Point(0, 0));
        var dpi = VisualTreeHelper.GetDpi(this);
        foreach (var card in cards)
        {
            if (!card.Surface.IsLoaded) continue;
            card.Thumbnail ??= DockThumbnail.Create(destination, new IntPtr(card.Task.Handle));
            var point = card.Surface.PointToScreen(new Point(0, 0));
            var shown = card.Thumbnail?.Place(
                (int)Math.Round(point.X - origin.X), (int)Math.Round(point.Y - origin.Y),
                (int)Math.Round(card.Surface.ActualWidth * dpi.DpiScaleX),
                (int)Math.Round(card.Surface.ActualHeight * dpi.DpiScaleY)) == true;
            card.Fallback.Visibility = shown ? Visibility.Hidden : Visibility.Visible;
            if (!shown) { card.Thumbnail?.Dispose(); card.Thumbnail = null; }
        }
    }

    private void ReleaseThumbnails()
    {
        foreach (var card in cards) card.Thumbnail?.Dispose();
        cards.Clear();
    }
    public void HidePreview()
    {
        ReleaseThumbnails();
        Hide();
    }
}
