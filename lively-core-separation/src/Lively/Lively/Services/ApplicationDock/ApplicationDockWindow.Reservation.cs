using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Interop;

namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockWindow
{
    private DockAppBar appBar;
    private bool reserveSpace;
    private string reservationFailure;
    private long nextReservationSample;
    public bool ReservationReady => reserveSpace && reservationFailure is null && appBar?.Reservation.Ready == true;
    public string ReservationError => reservationFailure ?? appBar?.Reservation.Error;
    public bool ReservationRegistered => appBar?.Reservation.Registered == true;
    public void SetReservationMode(bool reserve)
    {
        if (reserveSpace == reserve) return;
        reserveSpace = reserve;
        reservationFailure = null;
        nextReservationSample = 0;
        if (!reserve) appBar?.Reservation.Release();
    }
    private void UpdateReservation()
    {
        if (!reserveSpace || !visibilityActive) { appBar?.Reservation.Release(); return; }
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero || ActualHeight <= 0 || ActualWidth <= 0) return;
        var now = Stopwatch.GetTimestamp();
        if (now < nextReservationSample) return;
        nextReservationSample = now + Stopwatch.Frequency / 2;
        try
        {
            appBar ??= new DockAppBar(handle);
            var scale = appBar.Dpi / 96.0;
            appBar.Reservation.Update(true, appBar.Screen, (int)Math.Ceiling(ActualWidth * scale),
                (int)Math.Ceiling((ActualHeight + 8) * scale));
            reservationFailure = null;
        }
        catch (Exception ex)
        {
            reservationFailure = "Dock 占位暂不可用：" + ex.Message;
            appBar?.Reservation.MarkUnavailable(reservationFailure);
        }
    }
    private Rect? ReservedPlacement()
    {
        if (!reserveSpace || appBar?.Reservation.Registered != true || appBar.Reservation.Bounds.Height <= 0) return null;
        var bounds = appBar.Reservation.Bounds;
        var scale = appBar.Dpi / 96.0;
        return new Rect(bounds.Left / scale, bounds.Top / scale, bounds.Width / scale, bounds.Height / scale);
    }
}
