using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using System;
using System.Threading.Tasks;

namespace Lively.Player.WebView2
{
    public partial class Form1
    {
        private DextNativePointerDelivery nativePointerDelivery;
        private System.Windows.Forms.Timer nativeAuthorDeadline;
        private static readonly int NativePointerPid=ReadPointerPid();
        private static int ReadPointerPid(){using(var process=System.Diagnostics.Process.GetCurrentProcess())return process.Id;}
        private void InitializeNativePointer()
        {
            nativeFrameMedia.InitializeInputActions(SendToParent,RejectNativeAuthor);
            nativeAuthorDeadline=new System.Windows.Forms.Timer{Interval=50};
            nativeAuthorDeadline.Tick+=(sender,args)=>{nativeFrameMedia.ExpireInputActions();if(!nativeFrameMedia.HasInputActions)nativeAuthorDeadline.Stop();};
            nativePointerDelivery=new DextNativePointerDelivery(
                async packet=>{
                    // Establish native control focus before routing to its owned
                    // author frame. Core still owns the physical button focus.
                    if(packet.Key!=0&&packet.Consumer!="official")NativeViewController().MoveFocus(Microsoft.Web.WebView2.Core.CoreWebView2MoveFocusReason.Programmatic);
                    var accepted=await nativeFrameMedia.ArmInputAsync(packet);
                    if(accepted)nativeAuthorDeadline.Start();return accepted;
                },()=>nativeFrameMedia.RevokeInputAsync(),
                ForwardNativePointer,CurrentNativePointer,packet=>nativeFrameMedia.ReleasedInputAsync(packet),
                ()=>BeginInvoke((Action)(()=>{if(!IsDisposed&&!Disposing)Close();})));
        }
        private void RejectNativeAuthor(LivelyMessageRoomNativeRequest request,string status)
        {
            if(IsDisposed||Disposing||!IsOfficialDextDocument(webView.CoreWebView2.Source))return;
            webView.CoreWebView2.PostWebMessageAsJson(Newtonsoft.Json.JsonConvert.SerializeObject(new{
                type="dext:v3-native-response",requestId=request.RequestId,runtimeGeneration=request.RuntimeGeneration,
                sessionId=request.SessionId,revision=request.Revision,status,inputSequence=0,inputConsumed=false
            }));
        }
        private bool CurrentNativePointer(DextNativePointerPacket value)
        {
            if(IsDisposed||Disposing||nativeResources==null||!nativeNetworkReady||runtimeDeliverySuspended||
                !roomRuntime.CanUseInput(value.RuntimeGeneration,value.SessionId,value.Revision))return false;
            var input=new IntPtr(value.InputHandle);
            return DextNativeInputWindow.TryMeasure(Handle,webView.Handle,input,NativePointerPid,out var bounds,out var dpi)&&
                bounds.X==value.OriginX&&bounds.Y==value.OriginY&&bounds.Width==value.PixelWidth&&bounds.Height==value.PixelHeight&&dpi==value.Dpi;
        }
        private void ForwardNativePointer(DextNativePointerPacket value)
        {
            var input=new IntPtr(value.InputHandle);
            if(!DextNativeInputWindow.IsOwnedChild(Handle,webView.Handle,input,NativePointerPid))return;
            if(value.Key!=0){
                if(value.Consumer=="official")return;
                var pressed=value.Kind=="down";
                InputUtil.ForwardMessageKeyboard(input,pressed?0x100:0x101,new IntPtr(value.Key),value.ScanCode,pressed,value.IsExtended);
                return;
            }
            var down=value.Kind=="down";var move=value.Kind=="move";
            var message=down?0x201:move?0x200:0x202;
            InputUtil.ForwardMessageMouse(input,value.X-value.OriginX,value.Y-value.OriginY,message,
                new IntPtr(value.Modifiers|(down||move?1:0)));
        }
    }
}
