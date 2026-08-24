using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Text;

namespace Lively.Services
{
    /// <summary>
    /// Enumerates installed applications from Start Menu shortcuts and launches them.
    /// Shortcut resolution/icon extraction/Explorer-hosted launch ported from DeskBox (GPL-3).
    /// </summary>
    internal class AppCatalogService
    {
        private const int IconSize = 48;

        public record AppEntry(string Name, string Target, string Arguments, string WorkingDirectory, byte[] IconPng, string Source);

        public IEnumerable<AppEntry> GetInstalledApps()
        {
            var dirs = new[]
            {
                Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
            };

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var dir in dirs.Where(Directory.Exists))
            {
                foreach (var lnk in EnumerateLnksSafe(dir))
                {
                    AppEntry entry = null;
                    try
                    {
                        entry = ResolveShortcut(lnk);
                    }
                    catch
                    {
                        // dead/broken shortcut, skip
                    }

                    if (entry == null)
                        continue;

                    // dedup by target+args (same app registered in both start menus)
                    if (!seen.Add(entry.Target + "|" + entry.Arguments))
                        continue;

                    yield return entry;
                }
            }
        }

        private static IEnumerable<string> EnumerateLnksSafe(string root)
        {
            var pending = new Stack<string>();
            pending.Push(root);
            while (pending.Count > 0)
            {
                var dir = pending.Pop();
                string[] files = null;
                try
                {
                    files = Directory.GetFiles(dir, "*.lnk");
                    foreach (var sub in Directory.GetDirectories(dir))
                        pending.Push(sub);
                }
                catch
                {
                    continue; // access denied etc, skip whole dir
                }

                foreach (var f in files)
                    yield return f;
            }
        }

        public void Launch(string target, string arguments, string workingDirectory)
        {
            if (string.IsNullOrWhiteSpace(workingDirectory) && !Path.IsPathRooted(target))
                workingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.System);

            if (ExplorerShellLaunchService.TryOpen(target, workingDirectory, "open", out _))
                return;

            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = target,
                Arguments = arguments ?? string.Empty,
                UseShellExecute = true,
                WorkingDirectory = string.IsNullOrEmpty(workingDirectory)
                    ? Path.GetDirectoryName(Path.GetFullPath(target))
                    : workingDirectory,
            };
            System.Diagnostics.Process.Start(startInfo);
        }

        private AppEntry ResolveShortcut(string lnkPath)
        {
            var info = ShortcutResolver.Resolve(lnkPath);
            if (info == null || string.IsNullOrEmpty(info.TargetPath))
                return null;

            var iconFile = string.IsNullOrEmpty(info.IconLocation) ? info.TargetPath : info.IconLocation;
            var iconIndex = string.IsNullOrEmpty(info.IconLocation) ? 0 : info.IconIndex;
            var icon = TryExtractIcon(iconFile, iconIndex);

            return new AppEntry(
                Path.GetFileNameWithoutExtension(lnkPath),
                info.TargetPath,
                info.Arguments ?? string.Empty,
                info.WorkingDirectory ?? string.Empty,
                icon,
                lnkPath);
        }

        private static byte[] TryExtractIcon(string iconFile, int iconIndex)
        {
            IntPtr hIcon = IntPtr.Zero;
            try
            {
                if (SHDefExtractIcon(iconFile, iconIndex, 0, out hIcon, IntPtr.Zero, IconSize) != 0 || hIcon == IntPtr.Zero)
                    return Array.Empty<byte>();

                using var icon = Icon.FromHandle(hIcon);
                using var bmp = icon.ToBitmap();
                using var ms = new MemoryStream();
                bmp.Save(ms, ImageFormat.Png);
                return ms.ToArray();
            }
            catch
            {
                return Array.Empty<byte>();
            }
            finally
            {
                if (hIcon != IntPtr.Zero)
                    DestroyIcon(hIcon);
            }
        }

        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr hIcon);

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern uint SHDefExtractIcon(string iconFile, int iconIndex, uint flags, out IntPtr hIconLarge, IntPtr hIconSmall, uint size);

        // --- ported from DeskBox ShortcutHelper.cs (GPL-3) ---

        private static class ShortcutResolver
        {
            public record ShortcutInfo(string TargetPath, string Arguments, string WorkingDirectory, string IconLocation, int IconIndex);

            public static ShortcutInfo Resolve(string lnkPath)
            {
                if (!File.Exists(lnkPath))
                    return null;

                var shellLink = (IShellLinkW)new ShellLink();
                try
                {
                    ((IPersistFile)shellLink).Load(lnkPath, 0);
                    shellLink.Resolve(IntPtr.Zero, SLR_FLAGS.SLR_NO_UI | SLR_FLAGS.SLR_NOSEARCH);

                    var path = new StringBuilder(260);
                    var fd = new WIN32_FIND_DATAW();
                    shellLink.GetPath(path, path.Capacity, ref fd, SLGP_FLAGS.SLGP_RAWPATH);

                    var args = new StringBuilder(1024);
                    shellLink.GetArguments(args, args.Capacity);

                    var workDir = new StringBuilder(260);
                    shellLink.GetWorkingDirectory(workDir, workDir.Capacity);

                    var iconPath = new StringBuilder(260);
                    shellLink.GetIconLocation(iconPath, iconPath.Capacity, out var iconIndex);

                    return new ShortcutInfo(path.ToString(), args.ToString(), workDir.ToString(), iconPath.ToString(), iconIndex);
                }
                finally
                {
                    _ = Marshal.ReleaseComObject(shellLink);
                }
            }

            [ComImport]
            [Guid("00021401-0000-0000-C000-000000000046")]
            private class ShellLink { }

            [ComImport]
            [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
            [Guid("000214F9-0000-0000-C000-000000000046")]
            private interface IShellLinkW
            {
                void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, ref WIN32_FIND_DATAW pfd, SLGP_FLAGS fFlags);
                void GetIDList(out IntPtr ppidl);
                void SetIDList(IntPtr pidl);
                void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
                void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
                void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
                void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
                void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
                void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
                void GetHotkey(out ushort pwHotkey);
                void SetHotkey(ushort wHotkey);
                void GetShowCmd(out int piShowCmd);
                void SetShowCmd(int iShowCmd);
                void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
                void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
                void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
                void Resolve(IntPtr hwnd, SLR_FLAGS fFlags);
                void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
            }

            [Flags]
            private enum SLR_FLAGS : uint
            {
                SLR_NO_UI = 0x0001,
                SLR_NOSEARCH = 0x0010,
            }

            [Flags]
            private enum SLGP_FLAGS : uint
            {
                SLGP_SHORTPATH = 0x0001,
                SLGP_RAWPATH = 0x0004,
            }

            [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
            private struct WIN32_FIND_DATAW
            {
                public uint dwFileAttributes;
                public System.Runtime.InteropServices.ComTypes.FILETIME ftCreationTime;
                public System.Runtime.InteropServices.ComTypes.FILETIME ftLastAccessTime;
                public System.Runtime.InteropServices.ComTypes.FILETIME ftLastWriteTime;
                public uint nFileSizeHigh;
                public uint nFileSizeLow;
                public uint dwReserved0;
                public uint dwReserved1;

                [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
                public string cFileName;

                [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)]
                public string cAlternateFileName;
            }
        }
    }

    /// <summary>
    /// Delegates shell launches to the running Explorer desktop process so launched
    /// apps are not children of Lively and inherit the user shell environment.
    /// Ported from DeskBox ExplorerShellLaunchService.cs (GPL-3).
    /// </summary>
    internal static class ExplorerShellLaunchService
    {
        private const int ShellWindowClassDesktop = 8;
        private const int ShellWindowFindNeedDispatch = 1;
        private const int ShowNormal = 1;

        public static bool TryOpen(string path, string workingDirectory, string verb, out string error)
        {
            error = null;
            object localShell = null;
            object shellWindows = null;
            object desktopWindow = null;
            object desktopDocument = null;
            object explorerHostedShell = null;

            try
            {
                var shellApplicationType = Type.GetTypeFromProgID("Shell.Application");
                if (shellApplicationType == null)
                {
                    error = "Shell.Application is unavailable.";
                    return false;
                }

                localShell = Activator.CreateInstance(shellApplicationType);
                dynamic shell = localShell;
                shellWindows = shell.Windows();

                object desktopLocation = null;
                object desktopRoot = 0;
                int desktopHwnd = 0;
                dynamic windows = shellWindows;
                desktopWindow = windows.FindWindowSW(
                    ref desktopLocation, ref desktopRoot, ShellWindowClassDesktop, ref desktopHwnd, ShellWindowFindNeedDispatch);
                if (desktopWindow == null)
                {
                    error = "Could not locate the Explorer desktop window.";
                    return false;
                }

                dynamic desktop = desktopWindow;
                desktopDocument = desktop.Document;
                dynamic document = desktopDocument;
                explorerHostedShell = document.Application;
                dynamic explorerShell = explorerHostedShell;
                explorerShell.ShellExecute(path, string.Empty, workingDirectory ?? string.Empty, verb, ShowNormal);
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
            finally
            {
                ReleaseComObject(explorerHostedShell);
                ReleaseComObject(desktopDocument);
                ReleaseComObject(desktopWindow);
                ReleaseComObject(shellWindows);
                ReleaseComObject(localShell);
            }
        }

        private static void ReleaseComObject(object value)
        {
            if (value == null || !Marshal.IsComObject(value))
                return;

            try
            {
                _ = Marshal.ReleaseComObject(value);
            }
            catch { }
        }
    }
}
