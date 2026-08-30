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

            var exitMenu = new ToolStripMenuItem("退出 Dext");
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
