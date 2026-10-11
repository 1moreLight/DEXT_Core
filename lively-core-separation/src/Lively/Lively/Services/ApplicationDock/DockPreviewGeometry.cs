using System;

namespace Lively.Services.ApplicationDock;

internal readonly record struct DockPreviewRect(int Left, int Top, int Width, int Height);

internal static class DockPreviewGeometry
{
    public static (double Center, double Top)? NativeAnchor(int left, int top, int width, uint dpi, double fraction)
    {
        if (width <= 0 || dpi == 0 || !double.IsFinite(fraction)) return null;
        var scale = dpi / 96d;
        return ((left + width * Math.Clamp(fraction, 0, 1)) / scale, top / scale);
    }

    public static DockPreviewRect Fit(int sourceWidth, int sourceHeight, int width, int height)
    {
        if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return default;
        var scale = Math.Min((double)width / sourceWidth, (double)height / sourceHeight);
        var fittedWidth = Math.Max(1, (int)(sourceWidth * scale));
        var fittedHeight = Math.Max(1, (int)(sourceHeight * scale));
        return new((width - fittedWidth) / 2, (height - fittedHeight) / 2, fittedWidth, fittedHeight);
    }
    public static int PageSize(double workWidth) => Math.Clamp((int)((workWidth - 32) / 220), 1, 6);
    public static int ClampPage(int page, int count, int pageSize) =>
        Math.Clamp(page, 0, Math.Max(0, (count - 1) / Math.Max(1, pageSize)));
}
