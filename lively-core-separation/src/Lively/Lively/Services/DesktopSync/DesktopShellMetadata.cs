using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopShellItem(string Id, string Name, string? IconPng);
internal static class DesktopShellMetadata
{
    private static readonly SemaphoreSlim serial = new(1, 1);
    internal static async Task<IReadOnlyList<DesktopShellItem>> ReadAsync(IReadOnlyList<DesktopFileItem> files, CancellationToken cancellation = default)
    {
        await serial.WaitAsync(cancellation).ConfigureAwait(false);
        try
        {
            var completed = new TaskCompletionSource<IReadOnlyList<DesktopShellItem>>(TaskCreationOptions.RunContinuationsAsynchronously);
            var thread = new Thread(() =>
            {
                var initialized = false;
                try
                {
                    cancellation.ThrowIfCancellationRequested();
                    var result = CoInitializeEx(IntPtr.Zero, 2);
                    if (result < 0) Marshal.ThrowExceptionForHR(result);
                    initialized = true;
                    var items = new List<DesktopShellItem>(files.Count);
                    var budget = 2 * 1024 * 1024;
                    foreach (var file in files)
                    {
                        cancellation.ThrowIfCancellationRequested();
                        var item = Read(file);
                        if (item.IconPng is { } png)
                        {
                            if (png.Length > budget) item = item with { IconPng = null };
                            else budget -= png.Length;
                        }
                        items.Add(item);
                    }
                    completed.SetResult(items.AsReadOnly());
                }
                catch (OperationCanceledException) { completed.TrySetCanceled(cancellation); }
                catch (Exception error) { completed.TrySetException(error); }
                finally { if (initialized) CoUninitialize(); }
            }) { IsBackground = true, Name = "Dext desktop Shell metadata" };
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            return await completed.Task.ConfigureAwait(false);
        }
        finally { serial.Release(); }
    }
    private static DesktopShellItem Read(DesktopFileItem file)
    {
        var info = new ShellFileInfo();
        try
        {
            if (SHGetFileInfo(file.FullPath, 0, ref info, (uint)Marshal.SizeOf<ShellFileInfo>(), 0x100 | 0x200) == UIntPtr.Zero)
                return new(file.Id, file.Name, null);
            var name = string.IsNullOrWhiteSpace(info.DisplayName) ? file.Name : info.DisplayName;
            if (info.Icon == IntPtr.Zero) return new(file.Id, name, null);
            using var icon = Icon.FromHandle(info.Icon);
            using var bitmap = icon.ToBitmap();
            using var stream = new MemoryStream();
            bitmap.Save(stream, ImageFormat.Png);
            return new(file.Id, name, stream.Length <= 65536 ? Convert.ToBase64String(stream.ToArray()) : null);
        }
        catch (Exception error) when (error is ExternalException or ArgumentException or IOException)
        { return new(file.Id, file.Name, null); }
        finally { if (info.Icon != IntPtr.Zero) DestroyIcon(info.Icon); }
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ShellFileInfo
    {
        public IntPtr Icon;
        public int IconIndex;
        public uint Attributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, EntryPoint = "SHGetFileInfoW")]
    private static extern UIntPtr SHGetFileInfo(string path, uint attributes, ref ShellFileInfo info, uint size, uint flags);
    [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr icon);
    [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr reserved, uint flags);
    [DllImport("ole32.dll")] private static extern void CoUninitialize();
}
