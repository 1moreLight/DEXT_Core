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
                },async()=>{await nativeFrameMedia.RevokeInputAsync();await ReleaseNativeSampleAsync();},
                ForwardNativePointer,CurrentNativePointer,packet=>nativeFrameMedia.ReleasedInputAsync(packet),
                ()=>BeginInvoke((Action)(()=>{if(!IsDisposed&&!Disposing)Close();})),prepare:PrepareNativeSampleAsync,dispatched:CompleteNativeSampleAsync);
        }
        private sealed class NativeVisualSample
        {
            internal DextNativePointerPacket Packet;
            internal string Id;
            internal LivelyRoomNativeButton[] Buttons;
        }
        private NativeVisualSample nativeVisualSample;
        private async Task<bool> PrepareNativeSampleAsync(DextNativePointerPacket value)
        {
            if(!value.SampleMouse)return true;
            if(!CurrentNativePointer(value)||!IsOfficialDextDocument(webView.CoreWebView2.Source))return false;
            await ReleaseNativeSampleAsync();
            var id=Guid.NewGuid().ToString("D");
            // One renderer task reads the painted matrices and stops further
            // official animation painting until the native dispatch receipt.
            nativeVisualSample=new NativeVisualSample{Packet=value,Id=id};
            var begin=Newtonsoft.Json.JsonConvert.SerializeObject(new{operation="begin",sampleId=id,runtimeGeneration=value.RuntimeGeneration,
                sessionId=value.SessionId,revision=value.Revision,geometryVersion=value.GeometryVersion});
            var script="(()=>{const sample=this.dextNativeInputSample&&this.dextNativeInputSample("+begin+");if(!sample)return null;"+
                "const receipt="+nativeFrameMedia.OfficialDispatchScript(value)+";if(!receipt||!receipt.armed)return null;sample.dispatchNonce=receipt.documentNonce;return sample;})()";
            var json=await webView.CoreWebView2.ExecuteScriptAsync(script);
            if(!CurrentNativePointer(value))return false;
            var sample=Newtonsoft.Json.Linq.JObject.Parse(json);
            if((string)sample["sampleId"]!=id||!Guid.TryParseExact((string)sample["dispatchNonce"],"D",out var nonce))return false;
            var geometry=new Newtonsoft.Json.Linq.JObject{
                ["type"]="dext:v3-native-request",["protocolVersion"]=1,["requestId"]=id,["method"]="geometry",
                ["runtimeGeneration"]=value.RuntimeGeneration,["sessionId"]=value.SessionId.ToString(),["revision"]=value.Revision,
                ["geometryVersion"]=sample["geometryVersion"],["viewport"]=sample["viewport"],["buttons"]=sample["buttons"],["eventSamples"]=true};
            var parsed=DextNativeInputProtocol.Parse(geometry.ToString(Newtonsoft.Json.Formatting.None),roomRuntime,value.PixelWidth,value.PixelHeight);
            if(parsed==null||parsed.GeometryVersion!=value.GeometryVersion||!DextNativeGeometry.TryCreate(parsed.Buttons,out var entries))return false;
            nativeVisualSample.Buttons=parsed.Buttons;
            var hit=System.Linq.Enumerable.FirstOrDefault(entries,entry=>entry.Contains(((double)value.X-value.OriginX)/value.PixelWidth,((double)value.Y-value.OriginY)/value.PixelHeight));
            nativeFrameMedia.ExpectInputDispatch(value,hit?.Consumer,nonce);return true;
        }
        private async Task CompleteNativeSampleAsync(DextNativePointerPacket value)
        {
            if(!value.SampleMouse)return;
            var own=nativeVisualSample;
            try{
                if(own==null||own.Packet!=value||!await nativeFrameMedia.WaitInputDispatchAsync(value))return;
                var released=await ReleaseNativeSampleAsync();
                if(!released||!CurrentNativePointer(value))return;
                SendToParent(new LivelyMessageRoomNativeSample{Input=new LivelyMessageRoomNativePointer{
                    RuntimeGeneration=value.RuntimeGeneration,SessionId=value.SessionId,Revision=value.Revision,GeometryVersion=value.GeometryVersion,
                    GestureId=value.GestureId,IssuedAt=value.IssuedAt,InputHandle=value.InputHandle,Kind=value.Kind,
                    OriginX=value.OriginX,OriginY=value.OriginY,PixelWidth=value.PixelWidth,PixelHeight=value.PixelHeight,Dpi=value.Dpi,
                    X=value.X,Y=value.Y,Modifiers=value.Modifiers,SampleMouse=true},Buttons=own.Buttons});
            }finally{if(nativeVisualSample==own)await ReleaseNativeSampleAsync();}
        }
        private async Task<bool> ReleaseNativeSampleAsync()
        {
            var own=nativeVisualSample;nativeVisualSample=null;if(own==null)return false;
            if(IsDisposed||Disposing||!IsOfficialDextDocument(webView.CoreWebView2.Source))return false;
            var command=Newtonsoft.Json.JsonConvert.SerializeObject(new{operation="end",sampleId=own.Id});
            return await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeInputSample&&this.dextNativeInputSample("+command+")")=="true";
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
