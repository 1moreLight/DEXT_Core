using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;

namespace Lively.Services.DesktopSync;

internal static class DesktopRenameDialog
{
    internal static async Task<bool> ShowAsync(string source, Func<bool> permitted)
    {
        var app = Application.Current;
        if (app is null || app.Dispatcher.HasShutdownStarted) return false;
        return await app.Dispatcher.InvokeAsync(() => Show(source, permitted));
    }

    private static bool Show(string source, Func<bool> permitted)
    {
        if (!permitted()) return false;
        using var cancellation = new CancellationTokenSource();
        var name = Path.GetFileName(source);
        var window = new Window { Title = "重命名", Width = 440, SizeToContent = SizeToContent.Height,
            ResizeMode = ResizeMode.NoResize, WindowStartupLocation = WindowStartupLocation.CenterScreen,
            ShowInTaskbar = true };
        var panel = new StackPanel { Margin = new Thickness(20) };
        var input = new TextBox { Text = name, MaxLength = 255, Margin = new Thickness(0, 8, 0, 8) };
        var error = new TextBlock { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 12) };
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var save = new Button { Content = "确定", IsDefault = true, MinWidth = 80, Margin = new Thickness(0, 0, 8, 0) };
        var cancel = new Button { Content = "取消", MinWidth = 80 };
        panel.Children.Add(new TextBlock { Text = "输入新名称" });
        panel.Children.Add(input); panel.Children.Add(error);
        buttons.Children.Add(save); buttons.Children.Add(cancel); panel.Children.Add(buttons); window.Content = panel;
        var busy = false; var renamed = false; var closeRequested = false;
        void Cancel()
        {
            closeRequested = true; cancellation.Cancel();
            if (!busy) window.Close();
            else { cancel.IsEnabled = false; error.Text = "正在取消…"; }
        }
        cancel.Click += (_, _) => Cancel();
        window.PreviewKeyDown += (_, e) => { if (e.Key == Key.Escape) { e.Handled = true; Cancel(); } };
        window.Closing += (_, e) => { if (busy) { e.Cancel = true; Cancel(); } };
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(250) };
        timer.Tick += (_, _) => { if (!permitted()) Cancel(); };
        window.Closed += (_, _) => timer.Stop();
        window.Loaded += (_, _) =>
        {
            input.Focus();
            var extension = Directory.Exists(source) ? "" : Path.GetExtension(name);
            input.Select(0, Math.Max(1, name.Length - extension.Length)); timer.Start();
        };
        save.Click += async (_, _) =>
        {
            if (busy || closeRequested) return;
            if (!permitted()) { Cancel(); return; }
            busy = true; save.IsEnabled = false; input.IsEnabled = false; error.Text = "";
            try
            {
                var result = await DesktopShellActions.RenameAsync(source, input.Text,
                    new WindowInteropHelper(window).Handle, cancellation.Token, true, permitted);
                var item = result.Items.FirstOrDefault();
                if (item?.Status is "completed" or "unchanged") { renamed = true; closeRequested = true; }
                else if (result.Aborted) closeRequested = true;
                else error.Text = item?.Status == "conflict" ? "此位置已有同名项目，请输入其他名称。" : "无法改名，请检查文件是否被占用或是否有访问权限。";
            }
            catch (OperationCanceledException) { closeRequested = true; }
            catch (ArgumentException) { error.Text = "请输入有效的文件名，不要包含路径或末尾的空格、句点。"; }
            catch (Exception) { error.Text = "改名失败，请稍后重试。"; }
            finally
            {
                busy = false;
                if (closeRequested) window.Close();
                else { save.IsEnabled = true; input.IsEnabled = true; input.Focus(); }
            }
        };
        try { window.ShowDialog(); return renamed; }
        finally { timer.Stop(); cancellation.Cancel(); }
    }
}
