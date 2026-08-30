using Lively.Common.Services;
using System;

namespace Lively.Services
{
    /// <summary>
    /// Dext uses its Tauri configurator as the only UI. The legacy Lively WinUI
    /// process is deliberately never started from Core.
    /// </summary>
    public sealed class RunnerService : IRunnerService
    {
        private static readonly NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();

        public IntPtr HwndUI => IntPtr.Zero;
        public bool IsVisibleUI => false;

        public void ShowUI() => LogDisabled("show UI");
        public void CloseUI() { }
        public void RestartUI(string startArgs = null) => LogDisabled("restart UI");
        public void SetBusyUI(bool isBusy) { }
        public void ShowCustomisWallpaperePanel() => LogDisabled("show wallpaper customization");
        public void ShowAppUpdatePage() => LogDisabled("show upstream update page");
        public void SaveRectUI() { }
        public void Dispose() { }

        private static void LogDisabled(string action) =>
            Logger.Warn($"Ignoring request to {action}: Dext Configurator is the only supported UI.");
    }
}
