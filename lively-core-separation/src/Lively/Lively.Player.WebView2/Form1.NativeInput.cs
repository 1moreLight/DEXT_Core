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
        private static readonly int NativePointerPid=ReadPointerPid();
        private static int ReadPointerPid(){using(var process=System.Diagnostics.Process.GetCurrentProcess())return process.Id;}
        private void InitializeNativePointer()
        {
            nativePointerDelivery=new DextNativePointerDelivery(
                packet=>nativeFrameMedia.ArmInputAsync(packet),()=>nativeFrameMedia.RevokeInputAsync(),
                ForwardNativePointer,CurrentNativePointer,packet=>Task.CompletedTask,
                ()=>BeginInvoke((Action)(()=>{if(!IsDisposed&&!Disposing)Close();})));
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
            var down=value.Kind=="down";var move=value.Kind=="move";
            var message=down?0x201:move?0x200:0x202;
            InputUtil.ForwardMessageMouse(input,value.X-value.OriginX,value.Y-value.OriginY,message,
                new IntPtr(value.Modifiers|(down||move?1:0)));
        }
    }
}
