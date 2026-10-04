using System;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace Lively.Player.WebView2
{
    internal static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main()
        {
            // ERROR_FILE_NOT_FOUND
            // Ref: <https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499->
            if (!IsWebView2Available())
                Environment.Exit(2);

            var dockProbe = Array.IndexOf(Environment.GetCommandLineArgs(), "--dext-dock-probe") >= 0;
            if (dockProbe) DextDockWindowHost.UsePerMonitorDpi();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (dockProbe)
                Environment.ExitCode = DextDockProbeForm.Run(System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Skip(Environment.GetCommandLineArgs(), 1)));
            else
                Application.Run(new Form1());
        }

        private static bool IsWebView2Available()
        {
            try
            {
                return !string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString());
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
