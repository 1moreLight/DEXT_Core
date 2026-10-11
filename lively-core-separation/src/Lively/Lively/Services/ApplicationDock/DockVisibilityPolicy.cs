namespace Lively.Services.ApplicationDock;

// Time supplied from Stopwatch; no native input interception or UI object replacement.
internal sealed class DockVisibilityPolicy
{
    private long? awaySince;
    public static bool AtRevealEdge(double x, double y, double left, double width, double screenBottom) =>
        x >= left && x <= left + width && y >= screenBottom - 3 && y <= screenBottom;
    public static bool IsFullscreen(bool coversMonitor, bool maximized, bool hasCaption) =>
        coversMonitor && !(maximized && hasCaption);
    public static bool TaskbarReady(bool active, bool nativeWindowCreated, bool locked) =>
        active && nativeWindowCreated && !locked;
    public bool Update(bool autoHide, bool blocked, bool pointerInsideOrEdge, bool interacting, long milliseconds)
    {
        if (blocked) { awaySince = null; return false; }
        if (!autoHide || pointerInsideOrEdge || interacting) { awaySince = null; return true; }
        awaySince ??= milliseconds;
        return milliseconds - awaySince.Value < 700;
    }
}
