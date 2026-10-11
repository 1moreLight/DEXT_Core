using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
namespace Lively.Services.DesktopSync;
internal static class DesktopShellShortcut
{
    // The caller owns the STA and staging file; Shell handles final collisions.
    internal static void Create(string target, string stagedPath)
    {
        var link = (IShellLinkW)new ShellLink();
        try
        {
            link.SetPath(target);
            link.SetWorkingDirectory(Path.GetDirectoryName(target) ?? target);
            ((IPersistFile)link).Save(stagedPath, true);
        }
        finally { Marshal.ReleaseComObject(link); }
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
