using System;
using System.Runtime.InteropServices;

namespace Lively.Services.ApplicationDock;

// DWM keeps the live texture; no screenshot pixels are copied to files or sent through RPC.
internal sealed class DockThumbnail : IDisposable
{
    private IntPtr handle;
    private readonly IntPtr source;
    private DockThumbnail(IntPtr handle, IntPtr source) { this.handle = handle; this.source = source; }

    public static DockThumbnail Create(IntPtr destination, IntPtr source)
    {
        if (source == IntPtr.Zero || destination == IntPtr.Zero || IsIconic(source)) return null;
        if (DwmRegisterThumbnail(destination, source, out var thumbnail) != 0) return null;
        return new DockThumbnail(thumbnail, source);
    }

    public bool Place(int x, int y, int width, int height)
    {
        if (handle == IntPtr.Zero || !IsWindow(source) || IsIconic(source)) return false;
        if (DwmQueryThumbnailSourceSize(handle, out var size) != 0) return false;
        var fit = DockPreviewGeometry.Fit(size.Width, size.Height, width, height);
        if (fit.Width == 0 || fit.Height == 0) return false;
        var properties = new ThumbnailProperties
        {
            Flags = 0x1 | 0x4 | 0x8 | 0x10,
            Destination = new NativeRect { Left = x + fit.Left, Top = y + fit.Top, Right = x + fit.Left + fit.Width, Bottom = y + fit.Top + fit.Height },
            Opacity = 255, Visible = true, ClientOnly = false
        };
        return DwmUpdateThumbnailProperties(handle, ref properties) == 0;
    }

    public void Dispose()
    {
        if (handle == IntPtr.Zero) return;
        DwmUnregisterThumbnail(handle);
        handle = IntPtr.Zero;
    }

    [StructLayout(LayoutKind.Sequential)] private struct NativeRect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct NativeSize { public int Width, Height; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ThumbnailProperties
    {
        public uint Flags;
        public NativeRect Destination, Source;
        public byte Opacity;
        [MarshalAs(UnmanagedType.Bool)] public bool Visible;
        [MarshalAs(UnmanagedType.Bool)] public bool ClientOnly;
    }
    [DllImport("dwmapi.dll")] private static extern int DwmRegisterThumbnail(IntPtr destination, IntPtr source, out IntPtr thumbnail);
    [DllImport("dwmapi.dll")] private static extern int DwmUnregisterThumbnail(IntPtr thumbnail);
    [DllImport("dwmapi.dll")] private static extern int DwmQueryThumbnailSourceSize(IntPtr thumbnail, out NativeSize size);
    [DllImport("dwmapi.dll")] private static extern int DwmUpdateThumbnailProperties(IntPtr thumbnail, ref ThumbnailProperties properties);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
}
