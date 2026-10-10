using System;

namespace Lively.Services.ApplicationDock;

internal readonly record struct DockBounds(int Left, int Top, int Right, int Bottom)
{
    public int Width => Right - Left;
    public int Height => Bottom - Top;
}
internal interface IDockReservationPlatform
{
    bool Register();
    DockBounds Reserve(DockBounds requested);
    DockBounds WorkArea { get; }
    void Remove();
}
internal sealed class DockReservation(IDockReservationPlatform platform)
{
    public bool Registered { get; private set; }
    public bool Ready { get; private set; }
    public DockBounds Bounds { get; private set; }
    public string? Error { get; private set; }
    private DockBounds requested;
    public void MarkUnavailable(string reason) { Ready = false; Error = reason; }
    public void Invalidate() => requested = default;
    public void ExplorerRestarted() { Registered = Ready = false; Bounds = requested = default; }
    public void Update(bool wanted, DockBounds screen, int width, int height)
    {
        if (!wanted) { Release(); return; }
        try
        {
            if (screen.Width <= 0 || screen.Height <= 0 || height <= 0 || height >= screen.Height)
                throw new InvalidOperationException("没有足够的屏幕工作区供 Dock 占位。");
            width = Math.Clamp(width, 1, screen.Width);
            var left = screen.Left + (screen.Width - width) / 2;
            var next = new DockBounds(left, screen.Bottom - height, left + width, screen.Bottom);
            if (!Registered)
            {
                if (!platform.Register()) throw new InvalidOperationException("Windows 未接受 Dock 占位注册。");
                Registered = true;
            }
            var work = platform.WorkArea;
            Ready = Bounds.Width > 0 && work.Height > 0 && work.Bottom <= Bounds.Top;
            if (next != requested || !Ready)
            {
                Bounds = platform.Reserve(next);
                requested = next;
                work = platform.WorkArea;
            }
            Ready = Bounds.Width > 0 && Bounds.Height > 0 && Bounds.Top >= screen.Top &&
                Bounds.Bottom <= screen.Bottom && work.Height > 0 && work.Bottom <= Bounds.Top;
            Error = Ready ? null : "正在等待 Windows 确认 Dock 工作区占位。";
        }
        catch (Exception ex) { Ready = false; Error = ex.Message; }
    }
    public void Release()
    {
        if (Registered) platform.Remove();
        Registered = Ready = false;
        Bounds = requested = default;
        Error = null;
    }
}
