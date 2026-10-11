using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dext.Core.Rooms;
using Lively.Models.Message;
using Lively.Services.DesktopSync;

namespace Lively.Core.Wallpapers;

public partial class WebWebView2
{
    private async Task<(RoomNativeActionReply Reply,object Data)> ExecuteDesktopCopyAsync(NativeAttachment attachment,
        RoomNativeInputState state,LivelyMessageRoomNativeRequest request)
    {
        if(nativeDock)return (new(RoomActionStatus.NotOperable),null);
        if(!attachment.DesktopTransfers.Wait(0))return (new(RoomActionStatus.RateLimited),null);
        RoomNativeActionReply receipt=new(RoomActionStatus.Denied);
        try
        {
            attachment.Input.CheckNativeViewport(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true);
            var cut=request.Method=="desktopCut";
            var prepared=attachment.Bridge.PrepareNativeClipboard(attachment.Actions,attachment.Input,state.Generation,state.Session,state.Revision,
                request.GeometryVersion,request.Consumer,request.Button,request.InputSequence,request.SelectedIds,cut);
            receipt=prepared.Reply;
            if(receipt.Status!=RoomActionStatus.Accepted||prepared.Targets is null)return (receipt,null);
            var initial=attachment.Bridge.NativeReadPresentation(attachment.Actions,state.Session,state.Revision).Presentation?.Desktop;
            if(initial is null)return (new(RoomActionStatus.StaleInput,receipt.InputSequence,receipt.InputConsumed),null);
            bool Permitted()
            {
                if(IsExited||!ReferenceEquals(Volatile.Read(ref roomNativeAttachment),attachment))return false;
                var current=attachment.Input.State;
                if(current is null||current.Generation!=state.Generation||current.Session!=state.Session)return false;
                var view=attachment.Bridge.NativeReadPresentation(attachment.Actions,current.Session,current.Revision).Presentation?.Desktop;
                return view is not null&&view.DeskId==initial.DeskId&&attachment.Bridge.NativeCheckDesktopDrop(attachment.Actions,
                    current.Session,current.Revision,view.ContextId,initial.DeskId)==RoomActionStatus.Accepted;
            }
            var clipboard=await DesktopShellClipboard.PublishAsync(prepared.Targets.Select(target=>target.Target).ToArray(),cut,permitted:Permitted);
            return (receipt,new{clipboardSequence=clipboard.Sequence});
        }
        catch(OperationCanceledException){return (new(RoomActionStatus.Cancelled,receipt.InputSequence,receipt.InputConsumed),null);}
        catch(Exception error)
        {
            Logger.Error(error,"Desktop file clipboard copy failed");
            return (new(RoomActionStatus.StorageUnavailable,receipt.InputSequence,receipt.InputConsumed),null);
        }
        finally{attachment.DesktopTransfers.Release();}
    }
}
