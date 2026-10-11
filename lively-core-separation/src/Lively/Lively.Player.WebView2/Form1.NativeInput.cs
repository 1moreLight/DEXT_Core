using Lively.Common.Extensions;
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
                    if(packet.Key!=0&&!packet.UsesOfficialKeyboard)NativeViewController().MoveFocus(Microsoft.Web.WebView2.Core.CoreWebView2MoveFocusReason.Programmatic);
                    var accepted=await nativeFrameMedia.ArmInputAsync(packet);
                    TraceDockSample(packet,"arm="+accepted);
                    if(accepted)nativeAuthorDeadline.Start();return accepted;
                },async()=>{await nativeFrameMedia.RevokeInputAsync();await ReleaseNativeSampleAsync();},
                ForwardNativePointer,CurrentNativePointer,packet=>nativeFrameMedia.ReleasedInputAsync(packet),
                ()=>BeginInvoke((Action)(()=>{if(!IsDisposed&&!Disposing){nativePointerDelivery.LastFailure?.SendError(SendToParent,"Native input delivery failed");Close();}})),prepare:PrepareNativeSampleAsync,dispatched:CompleteNativeSampleAsync);
        }
        private sealed class NativeVisualSample
        {
            internal DextNativePointerPacket Packet;
            internal string Id;
            internal LivelyRoomNativeButton[] Buttons;
            internal LivelyRoomNativeTaskHit TaskHit;
            internal LivelyRoomNativeTaskHit[] TaskTargets;
        }
        private NativeVisualSample nativeVisualSample;
        private void TraceDockSample(DextNativePointerPacket value,string stage)
        {
            if(startArgs.DextDock)SendToParent(new LivelyMessageConsole{Category=ConsoleMessageType.log,
                Message=$"Dock sample kind={value.Kind} sequence={value.GestureId} stage={stage}"});
        }
        private async Task<bool> PrepareNativeSampleAsync(DextNativePointerPacket value)
        {
            if(!value.SampleVisual)return true;
            var stage="current-before";
            try {
            if(!CurrentNativePointer(value)||!IsOfficialDextDocument(webView.CoreWebView2.Source))return false;
            stage="release-previous";
            await ReleaseNativeSampleAsync();
            var id=Guid.NewGuid().ToString("D");
            // One renderer task reads the painted matrices and stops further
            // official animation painting until the native dispatch receipt.
            nativeVisualSample=new NativeVisualSample{Packet=value,Id=id};
            var begin=Newtonsoft.Json.JsonConvert.SerializeObject(new{operation="begin",sampleId=id,runtimeGeneration=value.RuntimeGeneration,
                sessionId=value.SessionId,revision=value.Revision,geometryVersion=value.GeometryVersion,
                taskKeyboard=startArgs.DextDock&&value.Key!=0,taskTab=value.Key==9,reverse=value.Reverse,
                taskPoint=startArgs.DextDock&&value.Key==0?new{x=((double)value.X-value.OriginX)/value.PixelWidth,y=((double)value.Y-value.OriginY)/value.PixelHeight}:null});
            var script="(()=>{const sample=this.dextNativeInputSample&&this.dextNativeInputSample("+begin+");if(!sample)return null;"+
                (value.Kind=="focus"?"return sample;})()":
                    "const receipt="+nativeFrameMedia.OfficialDispatchScript(value)+";if(!receipt||!receipt.armed)return null;sample.dispatchNonce=receipt.documentNonce;return sample;})()");
            stage="script";
            var json=await webView.CoreWebView2.ExecuteScriptAsync(script);
            stage="current-after";
            if(!CurrentNativePointer(value))return false;
            stage="nonce";
            var sample=Newtonsoft.Json.Linq.JObject.Parse(json);
            var nonce=Guid.Empty;
            if((string)sample["sampleId"]!=id||value.Kind!="focus"&&!Guid.TryParseExact((string)sample["dispatchNonce"],"D",out nonce))return false;
            var geometry=new Newtonsoft.Json.Linq.JObject{
                ["type"]="dext:v3-native-request",["protocolVersion"]=1,["requestId"]=id,["method"]="geometry",
                ["runtimeGeneration"]=value.RuntimeGeneration,["sessionId"]=value.SessionId.ToString(),["revision"]=value.Revision,
                ["geometryVersion"]=sample["geometryVersion"],["viewport"]=sample["viewport"],["buttons"]=sample["buttons"],["eventSamples"]=true};
            stage="geometry";
            var parsed=DextNativeInputProtocol.Parse(geometry.ToString(Newtonsoft.Json.Formatting.None),roomRuntime,value.PixelWidth,value.PixelHeight);
            if(parsed==null||parsed.GeometryVersion!=value.GeometryVersion||!DextNativeGeometry.TryCreate(parsed.Buttons,out var entries))return false;
            nativeVisualSample.Buttons=parsed.Buttons;
            stage="task-hit";
            if(startArgs.DextDock&&value.Key==0)
            {
                if(!DextNativeTaskSample.TryParse(sample["taskHit"],out var taskHit))return false;
                nativeVisualSample.TaskHit=taskHit;
            }
            var hit=System.Linq.Enumerable.FirstOrDefault(entries,entry=>value.Key==0?
                entry.Contains(((double)value.X-value.OriginX)/value.PixelWidth,((double)value.Y-value.OriginY)/value.PixelHeight):
                entry.Consumer==value.Consumer&&entry.Button==value.Button&&entry.EntryId==value.EntryId);
            var taskKey=startArgs.DextDock&&value.Consumer==DextNativeTaskSample.Consumer;
            if(startArgs.DextDock&&value.Key!=0)
            {
                if(!DextNativeTaskSample.TryParseTargets(sample["taskTargets"],out var targets))return false;
                nativeVisualSample.TaskTargets=targets;
                if(taskKey&&!System.Linq.Enumerable.Any(targets,target=>target.ItemId==value.Button&&DextNativeTaskSample.EntryId(target)==value.EntryId))return false;
            }
            if(value.SampleKeyboard&&!taskKey&&hit==null)return false;
            if(value.Kind!="focus"&&(!value.SampleKeyboard||!value.UsesOfficialKeyboard))nativeFrameMedia.ExpectInputDispatch(value,hit?.Consumer,nonce);
            stage="dock-edge";
            if (startArgs.DextDock && value.Kind != "focus" &&
                !await nativeFrameMedia.PrepareDockEdgeAsync(value,taskKey?DextNativeTaskSample.Consumer:hit?.Consumer)) return false;
            stage="ready";
            return true;
            } finally { TraceDockSample(value,stage); }
        }
        private async Task CompleteNativeSampleAsync(DextNativePointerPacket value)
        {
            if(!value.SampleVisual)return;
            var own=nativeVisualSample;
            var completionStage="sample-owner";
            try{
                if(own==null||own.Packet!=value)return;
                completionStage="await-dispatch";
                // Official defaults use Core's physical key and do not dispatch
                // a synthetic DOM key. Authored keys still wait for a native receipt.
                if(value.Kind!="focus"&&!IsOfficialTaskMouseSample(value)&&!(value.SampleKeyboard&&value.UsesOfficialKeyboard)&&!await nativeFrameMedia.WaitInputDispatchAsync(value))return;
                completionStage="release";
                var released=await ReleaseNativeSampleAsync();
                completionStage="released="+released+" current="+CurrentNativePointer(value);
                if(!released||!CurrentNativePointer(value))return;
                SendToParent(new LivelyMessageRoomNativeSample{Input=new LivelyMessageRoomNativePointer{
                    RuntimeGeneration=value.RuntimeGeneration,SessionId=value.SessionId,Revision=value.Revision,GeometryVersion=value.GeometryVersion,
                    GestureId=value.GestureId,IssuedAt=value.IssuedAt,InputHandle=value.InputHandle,Kind=value.Kind,
                    OriginX=value.OriginX,OriginY=value.OriginY,PixelWidth=value.PixelWidth,PixelHeight=value.PixelHeight,Dpi=value.Dpi,
                    X=value.X,Y=value.Y,Modifiers=value.Modifiers,SampleMouse=value.SampleMouse,SampleKeyboard=value.SampleKeyboard,
                    Reverse=value.Reverse,Key=value.Key,ScanCode=value.ScanCode,IsExtended=value.IsExtended,Consumer=value.Consumer,Button=value.Button,EntryId=value.EntryId},Buttons=own.Buttons,TaskHit=own.TaskHit,TaskTargets=own.TaskTargets});
                completionStage="sent";
            }finally{TraceDockSample(value,"completion-"+completionStage);if(nativeVisualSample==own)await ReleaseNativeSampleAsync();}
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
        // Native Dock mouse events already reach Chromium. Official tasks resolve
        // the private visual sample against Core's original raw DOWN/UP pair;
        // replaying those events would depend on a duplicate DOM mouse edge.
        private bool IsOfficialTaskMouseSample(DextNativePointerPacket value) =>
            startArgs.DextDock && value.Key == 0 && value.SampleMouse &&
            (value.Kind == "down" || value.Kind == "up") &&
            nativeVisualSample?.Packet == value && nativeVisualSample.TaskHit != null;

        private void ForwardNativePointer(DextNativePointerPacket value)
        {
            if(IsOfficialTaskMouseSample(value))return;
            var input=new IntPtr(value.InputHandle);
            if(!DextNativeInputWindow.IsOwnedChild(Handle,webView.Handle,input,NativePointerPid)){TraceDockSample(value,"forward-unowned");return;}
            TraceDockSample(value,"forward-owned");
            if(value.Key!=0){
                if(value.UsesOfficialKeyboard)return;
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
