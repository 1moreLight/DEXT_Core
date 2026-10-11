using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dext.Core.Rooms;
using Lively.Models.Message;
using Lively.Services.DesktopSync;

namespace Lively.Core.Wallpapers;

public partial class WebWebView2
{
    private async Task<(RoomActionStatus Status, object Data)> ExecuteDesktopDropAsync(
        NativeAttachment attachment, RoomNativeInputState state, LivelyMessageRoomNativeRequest request)
    {
        var drop = request.DesktopDrop;
        var viewport = ReadNativeViewport();
        if (nativeDock || drop?.Files is not { Length: > 0 and <= 256 } ||
            !double.IsFinite(drop.X) || !double.IsFinite(drop.Y) || drop.X < 0 || drop.X > 1 || drop.Y < 0 || drop.Y > 1 ||
            drop.Modifiers < 0 || drop.Modifiers > 7 || drop.Page < 0 || drop.Page > 4095 || viewport is null ||
            request.PixelWidth != viewport.Width || request.PixelHeight != viewport.Height)
            return (RoomActionStatus.Denied, null);
        if (!attachment.DesktopTransfers.Wait(0)) return (RoomActionStatus.RateLimited, null);
        try
        {
            var initial = attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions, state.Session,
                state.Revision, request.DesktopContextId, drop.DeskId);
            if (initial != RoomActionStatus.Accepted) return (initial, null);
            var initialView = attachment.Bridge.NativeReadPresentation(attachment.Actions, state.Session, state.Revision).Presentation?.Desktop;
            if (initialView?.ContextId != request.DesktopContextId || initialView.Items is null) return (RoomActionStatus.StaleInput, null);
            var originalIds = initialView.Items.Select(item => item.Id).ToHashSet(StringComparer.Ordinal);
            var width = Math.Clamp(viewport.Width * 96.0 / viewport.Dpi, 64, 16384);
            var height = Math.Clamp(viewport.Height * 96.0 / viewport.Dpi, 64, 16384);
            var columns = Math.Max(1, (int)Math.Floor((width - 64) / 112));
            var rows = Math.Max(1, (int)Math.Floor((height - 64) / 120));
            var capacity = Math.Min(4096, Math.Max(1, columns * rows - 2));
            var column = Math.Clamp((int)Math.Floor((drop.X * width - 32) / 112), 0, columns - 1);
            var row = Math.Clamp((int)Math.Floor((drop.Y * height - 32) / 120), 0, rows - 1);
            var slot = Math.Min(4095, drop.Page * capacity + Math.Min(capacity - 1, row * columns + column));
            var entered = false;
            bool Permitted()
            {
                if (IsExited || !ReferenceEquals(Volatile.Read(ref roomNativeAttachment), attachment)) return false;
                var current = attachment.Input.State;
                if (current is null || current.Generation != state.Generation || current.Session != state.Session) return false;
                if (!entered)
                {
                    // Recheck the exact original presentation at STA admission.
                    entered = attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions, state.Session,
                        state.Revision, request.DesktopContextId, drop.DeskId) == RoomActionStatus.Accepted;
                    return entered;
                }
                // Our own writes can refresh the desktop context. Continue only
                // while the same session and sync Desk remain eligible.
                var view = attachment.Bridge.NativeReadPresentation(attachment.Actions, current.Session, current.Revision);
                return view.Status == RoomActionStatus.Accepted && view.Presentation?.Desktop is { } desktop &&
                    desktop.DeskId == drop.DeskId && attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions,
                        current.Session, current.Revision, desktop.ContextId, drop.DeskId) == RoomActionStatus.Accepted;
            }
            var destination = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory,
                Environment.SpecialFolderOption.DoNotVerify);
            var result = await DesktopShellTransfer.RunAsync(drop.Files, destination, drop.AllowedEffects,
                drop.Modifiers, default, true, Handle, Permitted);
            var newIds = result.Items.Where(item => item.Status == "completed" && item.Destination is not null)
                .Select(item => DesktopDirectoryScanner.IdentityForPath(item.Destination!))
                .Where(id => !originalIds.Contains(id)).Distinct(StringComparer.Ordinal).ToArray();
            var placement = RoomActionStatus.Accepted;
            if (newIds.Length > 0)
                placement = await Task.Run(() => ReferenceEquals(Volatile.Read(ref roomNativeAttachment), attachment)
                    ? attachment.Bridge.NativePlaceDesktopDrop(attachment.Actions, state.Session, drop.DeskId, newIds, slot, columns, capacity)
                    : RoomActionStatus.StaleSession);
            // Correlate actual Shell completion with this request; a watcher-only
            // desktop update must not be mistaken for the Dext transfer route.
            Logger.Info("DesktopDrop " + Newtonsoft.Json.JsonConvert.SerializeObject(new {
                stage = "transfer", session = state.Session, request = request.RequestId, player = Pid,
                aborted = result.Aborted, placement = WireStatus(placement), newIds,
                outcomes = result.Items.Select(item => new { status = item.Status, hresult = item.HResult }).ToArray()
            }));
            // Absolute source/destination paths remain in Core. The directory
            // watcher publishes actual successful items through the normal scan.
            var data = new
            {
                aborted = result.Aborted, placementStatus = WireStatus(placement),
                items = result.Items.Select(item => new
                {
                    name = Path.GetFileName(item.Source), status = item.Status, hresult = item.HResult
                }).ToArray()
            };
            return (result.Aborted ? RoomActionStatus.Cancelled : RoomActionStatus.Accepted, data);
        }
        catch (OperationCanceledException) { return (RoomActionStatus.Cancelled, null); }
        catch (Exception error)
        {
            Logger.Error(error, "Desktop drop transfer failed");
            return (RoomActionStatus.StorageUnavailable, null);
        }
        finally { attachment.DesktopTransfers.Release(); }
    }
}