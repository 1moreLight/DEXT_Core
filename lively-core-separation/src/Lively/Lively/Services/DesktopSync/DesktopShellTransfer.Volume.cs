using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Lively.Services.DesktopSync;
internal static class DesktopDropVolume
{
    // Compare volume identities, not drive letters: mount points can cross
    // volumes, and two paths may refer to the same mounted volume.
    internal static bool SameVolume(string source, string destination)
    {
        var left = Identity(source);
        var right = Identity(destination);
        return left is not null && right is not null && string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    }
    private static string? Identity(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path)) return null;
        var mount = new StringBuilder(32768);
        if (!GetVolumePathNameW(path, mount, mount.Capacity)) return null;
        var identity = new StringBuilder(128);
        if (GetVolumeNameForVolumeMountPointW(mount.ToString(), identity, identity.Capacity)) return identity.ToString();
        // Network providers need not expose a volume GUID. Unknown identity
        // defaults to copy rather than assuming that a move is appropriate.
        return null;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumePathNameW(string path, StringBuilder volumePath, int length);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumeNameForVolumeMountPointW(string mount, StringBuilder volumeName, int length);
}