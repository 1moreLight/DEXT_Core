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
        if (nativeDock || drop?.Files is not { Length: > 0 and <= 256 } ||
            !double.IsFinite(drop.X) || !double.IsFinite(drop.Y) || drop.X < 0 || drop.X > 1 || drop.Y < 0 || drop.Y > 1 ||
            drop.Modifiers < 0 || drop.Modifiers > 7 || ReadNativeViewport() is null)
            return (RoomActionStatus.Denied, null);
        if (!attachment.DesktopTransfers.Wait(0)) return (RoomActionStatus.RateLimited, null);
        try
        {
            var initial = attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions, state.Session,
                state.Revision, request.DesktopContextId, drop.DeskId);
            if (initial != RoomActionStatus.Accepted) return (initial, null);
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
            // Absolute source/destination paths remain in Core. The directory
            // watcher publishes actual successful items through the normal scan.
            var data = new
            {
                aborted = result.Aborted,
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