using Dext.Core.Rooms;
using Lively.Models.Message;
using Lively.Services.DesktopSync;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Core.Wallpapers;

public partial class WebWebView2
{
    private async Task<(RoomNativeActionReply Reply, object Data)> ExecuteDesktopMenuAsync(NativeAttachment attachment,
        RoomNativeInputState state, LivelyMessageRoomNativeRequest request)
    {
        if (nativeDock) return (new(RoomActionStatus.NotOperable), null);
        if (!attachment.DesktopTransfers.Wait(0)) return (new(RoomActionStatus.RateLimited), null);
        RoomNativeActionReply receipt = new(RoomActionStatus.Denied);
        try
        {
            var viewport = ReadNativeViewport();
            attachment.Input.CheckNativeViewport(viewport, NativeInputIsForeground?.Invoke() == true);
            var proof = attachment.Input.GetProof(state.Generation, request.GeometryVersion, request.Consumer, request.Button, request.InputSequence);
            if (proof is null || viewport is null) return (new(RoomActionStatus.StaleInput), null);
            var prepared = attachment.Bridge.PrepareNativeMenu(attachment.Actions, attachment.Input, state.Generation, state.Session, state.Revision,
                request.GeometryVersion, request.Consumer, request.Button, request.InputSequence, request.SelectedIds);
            receipt = prepared.Reply;
            if (receipt.Status != RoomActionStatus.Accepted || prepared.Targets is null) return (receipt, null);
            var initial = attachment.Bridge.NativeReadPresentation(attachment.Actions, state.Session, state.Revision).Presentation?.Desktop;
            if (initial is null) return (new(RoomActionStatus.StaleInput, receipt.InputSequence, receipt.InputConsumed), null);
            bool Permitted()
            {
                if (IsExited || !ReferenceEquals(Volatile.Read(ref roomNativeAttachment), attachment)) return false;
                var current = attachment.Input.State;
                if (current is null || current.Generation != state.Generation || current.Session != state.Session) return false;
                var view = attachment.Bridge.NativeReadPresentation(attachment.Actions, current.Session, current.Revision).Presentation?.Desktop;
                return view is not null && view.DeskId == initial.DeskId && attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions,
                    current.Session, current.Revision, view.ContextId, initial.DeskId) == RoomActionStatus.Accepted;
            }
            // Use the proven native file geometry in physical pixels. The page
            // cannot nominate a screen point or a path for the menu owner.
            var x = checked(viewport.X + Math.Clamp((int)Math.Round((proof.Button.X + proof.Button.Width / 2) * viewport.Width), 0, viewport.Width - 1));
            var y = checked(viewport.Y + Math.Clamp((int)Math.Round((proof.Button.Y + proof.Button.Height) * viewport.Height), 0, viewport.Height - 1));
            var paths = prepared.Targets.Select(target => target.Target).ToArray();
            var verb = await DesktopContextMenuWindow.ShowAsync(paths, x, y, Permitted);
            if (verb == "cancelled" || !Permitted()) return (new(RoomActionStatus.Cancelled, receipt.InputSequence, receipt.InputConsumed), null);
            if (verb is "copy" or "cut")
            {
                var clipboard = await DesktopShellClipboard.PublishAsync(paths, verb == "cut", permitted: Permitted);
                return (receipt, new { verb, clipboardSequence = clipboard.Sequence });
            }
            if (verb == "rename")
            {
                if (paths.Length != 1) return (new(RoomActionStatus.NotOperable, receipt.InputSequence, receipt.InputConsumed), new { verb });
                var renamed = await DesktopRenameDialog.ShowAsync(paths[0], Permitted);
                return (new(renamed ? RoomActionStatus.Accepted : RoomActionStatus.Cancelled, receipt.InputSequence, receipt.InputConsumed), new { verb });
            }
            if (verb == "delete")
            {
                var result = await DesktopShellActions.DeleteToRecycleBinAsync(paths, owner: Handle, permitted: Permitted);
                return (new(result.Aborted ? RoomActionStatus.Cancelled : RoomActionStatus.Accepted, receipt.InputSequence, receipt.InputConsumed),
                    new { verb, aborted = result.Aborted, items = result.Items.Select(item => new { name = System.IO.Path.GetFileName(item.Source), status = item.Status, hresult = item.HResult }).ToArray() });
            }
            return (receipt, new { verb });
        }
        catch (OperationCanceledException) { return (new(RoomActionStatus.Cancelled, receipt.InputSequence, receipt.InputConsumed), null); }
        catch (Exception error)
        {
            Logger.Error(error, "Desktop context menu failed");
            return (new(RoomActionStatus.StorageUnavailable, receipt.InputSequence, receipt.InputConsumed), null);
        }
        finally { attachment.DesktopTransfers.Release(); }
    }
}
