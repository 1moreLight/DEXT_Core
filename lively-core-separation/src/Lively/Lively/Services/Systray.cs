using Lively.Common;
using Lively.Common.Helpers;
using Lively.Common.Services;
using Lively.Core;
using Lively.Core.Suspend;
using Lively.Models.Enums;
using Lively.Themes;
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace Lively.Services
{
    public sealed class Systray : ISystray
    {
        private readonly NotifyIcon notifyIcon;
        private readonly IPlayback playback;
        private readonly ToolStripMenuItem pauseMenu;
        private bool disposed;

        public Systray(IUserSettingsService userSettings, IDesktopCore desktopCore, IPlayback playback)
        {
            this.playback = playback;
            notifyIcon = new NotifyIcon
            {
                Icon = LoadProductIcon(),
                Text = Constants.ApplicationType.Name,
                Visible = userSettings.Settings.SysTrayIcon,
                ContextMenuStrip = new ContextMenuStrip
                {
                    Padding = new Padding(0),
                    Margin = new Padding(0),
                },
            };

            pauseMenu = new ToolStripMenuItem("暂停壁纸");
            pauseMenu.Click += (_, _) =>
            {
                playback.WallpaperPlaybackPolicy = playback.WallpaperPlaybackPolicy == PlaybackPolicy.automatic
                    ? PlaybackPolicy.alwaysPaused
                    : PlaybackPolicy.automatic;
            };
            notifyIcon.ContextMenuStrip.Items.Add(pauseMenu);

            var closeMenu = new ToolStripMenuItem("关闭壁纸");
            closeMenu.Click += (_, _) => desktopCore.CloseAllWallpapers();
            notifyIcon.ContextMenuStrip.Items.Add(closeMenu);

            var openConfiguratorMenu = new ToolStripMenuItem("打开配置器");
            openConfiguratorMenu.Click += (_, _) => OpenConfigurator();
            notifyIcon.ContextMenuStrip.Items.Add(openConfiguratorMenu);

            var exitMenu = new ToolStripMenuItem("退出 Dext Core（壁纸将关闭）");
            exitMenu.Click += (_, _) => App.QuitApp();
            notifyIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());
            notifyIcon.ContextMenuStrip.Items.Add(exitMenu);

            playback.PlaybackPolicyChanged += PlaybackPolicyChanged;
            SetTheme(userSettings.Settings.ApplicationTheme);
            UpdatePauseMenu(playback.WallpaperPlaybackPolicy);
        }

        public void Visibility(bool visible) => notifyIcon.Visible = visible;

        public void ShowBalloonNotification(int timeout, string title, string msg) =>
            notifyIcon.ShowBalloonTip(timeout, title, msg, ToolTipIcon.None);

        public void SetTheme(AppTheme theme)
        {
            theme = theme == AppTheme.Auto ? ThemeUtil.GetWindowsTheme() : theme;
            if (theme == AppTheme.Light)
            {
                notifyIcon.ContextMenuStrip.ForeColor = Color.Black;
                ToolStripManager.Renderer = new ToolStripRendererLight();
            }
            else
            {
                notifyIcon.ContextMenuStrip.ForeColor = Color.AliceBlue;
                ToolStripManager.Renderer = new ToolStripRendererDark();
            }
        }

        private void PlaybackPolicyChanged(object sender, PlaybackPolicy policy) => UpdatePauseMenu(policy);

        private void OpenConfigurator()
        {
            var exe = FindConfiguratorExe();
            if (exe != null)
            {
                Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true });
                return;
            }

#if DEXT_V3_RELEASE
            notifyIcon.ShowBalloonTip(3000, Constants.ApplicationType.Name, "发布目录缺少 dext-configurator.exe，请重新解压完整 Dext 产品。", ToolTipIcon.Warning);
            return;
#else
            var repoRoot = new DirectoryInfo(AppContext.BaseDirectory);
            while (repoRoot != null && !File.Exists(Path.Combine(repoRoot.FullName, "tauri-ui", "package.json")))
                repoRoot = repoRoot.Parent;

            if (repoRoot == null)
            {
                notifyIcon.ShowBalloonTip(3000, Constants.ApplicationType.Name, "未找到配置器（tauri-ui）", ToolTipIcon.Warning);
                return;
            }

            notifyIcon.ShowBalloonTip(5000, Constants.ApplicationType.Name, "未找到配置器构建产物，已开始构建（npm run tauri build），完成后请重试", ToolTipIcon.Info);
            Process.Start(new ProcessStartInfo("cmd.exe", "/c npm run tauri build")
            {
                WorkingDirectory = Path.Combine(repoRoot.FullName, "tauri-ui"),
                UseShellExecute = false,
                CreateNoWindow = true,
            });
#endif
        }

        private static string FindConfiguratorExe()
        {
            var colocated = Path.Combine(AppContext.BaseDirectory, "dext-configurator.exe");
            if (File.Exists(colocated)) return colocated;
#if DEXT_V3_RELEASE
            return null;
#else
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            for (; dir != null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "tauri-ui", "src-tauri", "target", "release", "dext-configurator.exe");
                if (File.Exists(candidate))
                    return candidate;
            }
            return null;
#endif
        }

        private void UpdatePauseMenu(PlaybackPolicy policy)
        {
            var paused = policy == PlaybackPolicy.alwaysPaused;
            pauseMenu.Checked = paused;
            pauseMenu.Text = paused ? "继续壁纸" : "暂停壁纸";
        }

        private static Icon LoadProductIcon()
        {
            try
            {
                return Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule.FileName)
                    ?? Properties.Icons.appicon;
            }
            catch
            {
                return Properties.Icons.appicon;
            }
        }

        public void Dispose()
        {
            if (disposed)
                return;
            disposed = true;
            playback.PlaybackPolicyChanged -= PlaybackPolicyChanged;
            notifyIcon.Visible = false;
            notifyIcon.Dispose();
        }
    }
}
