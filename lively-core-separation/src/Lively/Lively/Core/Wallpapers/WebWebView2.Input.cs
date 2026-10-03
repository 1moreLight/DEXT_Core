using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Threading.Tasks;
using System;
using System.Linq;
using System.Threading;
using Lively.Grpc.Common.Proto.Desktop;

namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private sealed record NativeAttachment(RoomSessionPlayerBridge Bridge,RoomNativeInputAuthority Input,RoomActionAuthority Actions,RoomNativeDataSource Data)
        {
            // Never wait for admission on the Core/UI event thread. At most 16
            // consumer storage operations are in flight per private attachment.
            internal SemaphoreSlim StorageRequests { get; } = new(16,16);
            internal RoomNativeControlQueue Controls { get; } = new();
            internal RoomNativeInputGesture PointerGesture { get; set; }
            internal RoomNativeInputGesture KeyGesture { get; set; }
            internal RoomNativeButton KeyFocus { get; set; }
            internal int KeyScanCode { get; set; }
            internal bool KeyExtended { get; set; }
        }
        private NativeAttachment roomNativeAttachment;
        private IntPtr nativeBrowserHandle;
        internal Func<bool> NativeInputIsForeground { private get; set; }
        internal bool RoomDocumentInvalidated => Volatile.Read(ref roomNativeAttachment) is{} a && a.Input.State==null;
        internal bool HasNativeInput => Volatile.Read(ref roomNativeAttachment)?.Input.State!=null;
        private static readonly RoomNativeViewport MissingViewport=new(IntPtr.Zero,0,0,0,0,1);
        internal RoomNativeViewport ReadNativeViewport()
        {
            if(!IsLoaded || IsExited || Pid is not{} pid ||
                !DextNativeInputWindow.TryMeasure(Handle,nativeBrowserHandle,InputHandle,pid,out var bounds,out var dpi))return null;
            return new(InputHandle,bounds.X,bounds.Y,bounds.Width,bounds.Height,Math.Clamp((int)Math.Ceiling(4.0*dpi/96),4,256),dpi);
        }
        private void HandleNativeSample(LivelyMessageRoomNativeSample sample)
        {
            var a=Volatile.Read(ref roomNativeAttachment);var before=a?.Input.State;
            if(before==null || sample?.Input==null || sample.Buttons==null || sample.Buttons.Length>4096)return;
            DextNativePointerPacket packet;
            try{packet=new(sample.Input);}catch(ArgumentException){return;}
            if(!packet.SampleVisual || packet.Kind!="down"&&packet.Kind!="up"&&packet.Kind!="focus")return;
            var measured=ReadNativeViewport();var foreground=NativeInputIsForeground?.Invoke()==true;
            a.Input.CheckNativeViewport(measured,foreground);
            if(measured==null || measured.Handle.ToInt64()!=packet.InputHandle || measured.X!=packet.OriginX || measured.Y!=packet.OriginY ||
                measured.Width!=packet.PixelWidth || measured.Height!=packet.PixelHeight || measured.Dpi!=packet.Dpi ||
                sample.Buttons.Any(b=>b==null))return;
            var copy=sample.Buttons.Select(b=>new RoomNativeButton(b.Consumer,b.Button,b.X,b.Y,b.Width,b.Height,b.TabIndex,b.EntryId,b.Polygons)).ToArray();
            if(a.Bridge.SampleNativeGeometry(a.Input,packet.RuntimeGeneration,packet.SessionId,packet.Revision,packet.GeometryVersion,
                packet.GestureId,packet.Kind,measured,copy,foreground,packet.Key,packet.Consumer,packet.Button,packet.EntryId,packet.Reverse))NotifyNative(a,before,packet.Kind!="focus");
        }
        private async Task HandleNativeRequest(LivelyMessageRoomNativeRequest request)
        {
            var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;
            if(state==null || request.ProtocolVersion!=1 || string.IsNullOrEmpty(request.RequestId) || request.RequestId.Length>128 ||
                request.RuntimeGeneration!=state.Generation || request.SessionId!=state.Session || request.Revision!=state.Revision)return;
            var status=RoomActionStatus.Denied;object buttons=null,capabilities=null,data=null;JToken layout=null;JToken storageValue=null;RoomNativeActionReply actionReply=null;
            switch(request.Method)
            {
                case "startupComplete":
                    var completion=a.Bridge.CompleteStartup(state.Session,request.LifecycleRevision);
                    status=completion.Status switch {RoomProtocolStatus.Accepted=>RoomActionStatus.Accepted,RoomProtocolStatus.StorageUnavailable=>RoomActionStatus.StorageUnavailable,
                        RoomProtocolStatus.Forbidden=>RoomActionStatus.Forbidden,_=>RoomActionStatus.StaleInput};break;
                case "invalidateGeometry":
                    status=a.Input.InvalidateGeometry(state.Generation,state.Session,state.Revision)?RoomActionStatus.Accepted:RoomActionStatus.StaleInput;break;
                case "geometry":
                    var viewport=ReadNativeViewport();
                    if(viewport!=null && request.PixelWidth==viewport.Width && request.PixelHeight==viewport.Height && request.Buttons is{} entries && entries.Length<=4096 && entries.All(b=>b!=null))
                    {
                        var copy=entries.Select(b=>new RoomNativeButton(b.Consumer,b.Button,b.X,b.Y,b.Width,b.Height,b.TabIndex,b.EntryId,b.Polygons)).ToArray();
                        status=a.Bridge.PublishNativeGeometry(a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,viewport,copy,request.SampleMouse)?RoomActionStatus.Accepted:RoomActionStatus.StaleInput;
                    }
                    break;
                case "buttons":
                    var list=a.Bridge.NativeButtons(a.Actions,state.Session,request.Consumer);status=list.Status;
                    buttons=list.Buttons?.Select(b=>new{id=b.Id,name=b.Name,scope=b.Scope,action=b.Action,isBound=b.IsBound}).ToArray();break;
                case "capabilities":
                    var declared=a.Bridge.NativeCapabilities(a.Actions,state.Session,state.Revision,request.Consumer);status=declared.Status;
                    capabilities=declared.Capabilities?.ToDictionary(entry=>entry.Key,entry=>WireStatus(entry.Value),StringComparer.Ordinal);break;
                case "data":
                    if(!a.Data.TryBeginRead())break;
                    try {
                        var read=await Task.Run(()=>a.Bridge.NativeData(a.Actions,state.Session,state.Revision,request.Consumer,request.Capability,()=>a.Data.Read(request.Capability)));
                        status=read.Status;
                        if(read.Sample is{} sample){var value=new JObject{["status"]=sample.Status};
                            if(sample.Value is{} json){using(var reader=new JsonTextReader(new StringReader(json.GetRawText())){DateParseHandling=DateParseHandling.None})value["value"]=JToken.ReadFrom(reader);}
                            data=value;
                        }
                    }finally{a.Data.EndRead();}break;
                case "layoutRead":
                case "layoutSave":
                    if(!a.StorageRequests.Wait(0))break;
                    try {
                        var saving=request.Method=="layoutSave";
                        var measured=saving?ReadNativeViewport():null;
                        if(saving && (request.LayoutChange==null || measured==null || request.PixelWidth!=measured.Width ||
                            request.PixelHeight!=measured.Height || NativeInputIsForeground?.Invoke()!=true)){status=RoomActionStatus.NotOperable;break;}
                        var read=await Task.Run(()=> {
                            if(!saving)return a.Bridge.NativeReadLayout(a.Actions,state.Session,state.Revision);
                            var c=request.LayoutChange;
                            return a.Bridge.NativeSaveLayout(a.Actions,state.Session,state.Revision,request.LayoutRevision,new(c.Kind,c.Id,c.DeskId,c.X,c.Y,c.Width,c.Height));
                        });
                        status=read.Status;
                        if(status==RoomActionStatus.Accepted && read.Layout!=null) {
                            layout=JObject.Parse(System.Text.Json.JsonSerializer.Serialize(read.Layout,new System.Text.Json.JsonSerializerOptions{PropertyNamingPolicy=System.Text.Json.JsonNamingPolicy.CamelCase}));
                            if(saving)a.Input.InvalidateGeometry(state.Generation,state.Session,state.Revision);
                        }
                    }finally{a.StorageRequests.Release();}break;
                case "storageGet":
                    if(!a.StorageRequests.Wait(0))break;
                    try {
                        var stored=await Task.Run(()=>a.Bridge.NativeReadStorage(a.Actions,state.Session,state.Revision,request.Consumer,request.Key));
                        status=stored.Status;
                        if(status==RoomActionStatus.Accepted) {
                            using var reader=new JsonTextReader(new StringReader(stored.Value?.GetRawText()??"null")){DateParseHandling=DateParseHandling.None};
                            storageValue=JToken.ReadFrom(reader);
                        }
                    }finally{a.StorageRequests.Release();}break;
                case "storageSet":
                    if(request.ValueJson==null || System.Text.Encoding.UTF8.GetByteCount(request.ValueJson)>32768 || !a.StorageRequests.Wait(0))break;
                    try {
                        var written=await Task.Run(()=> {
                            using var document=System.Text.Json.JsonDocument.Parse(request.ValueJson,new System.Text.Json.JsonDocumentOptions{MaxDepth=24});
                            return a.Bridge.NativeWriteStorage(a.Actions,state.Session,state.Revision,request.Consumer,request.Key,document.RootElement);
                        });
                        status=written.Status;
                    }catch(System.Text.Json.JsonException){status=RoomActionStatus.Denied;}
                    finally{a.StorageRequests.Release();}break;
                case "mediaControl":
                case "audioControl":
                    RoomNativeInputProof attempted=null;
                    RoomNativeActionReply Unavailable(){var proof=Volatile.Read(ref attempted);return new(RoomActionStatus.ControlUnavailable,proof?.Sequence??0,proof?.IsConsumed??false);}
                    actionReply=await a.Controls.RunAsync(async token=>{
                        token.ThrowIfCancellationRequested();
                        a.Input.CheckNativeViewport(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true);
                        return await a.Bridge.ControlNativeAsync(a.Actions,a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,request.Consumer,
                            new RoomSystemControl(request.Method=="mediaControl"?"media.control":"audio.control",request.MediaAction,request.Volume,request.Muted),
                            control=>DispatchNativeControl(control,token),request.InputSequence,proof=>Interlocked.Exchange(ref attempted,proof));
                    },Unavailable);
                    status=actionReply.Status;break;
                case "activate":
                    a.Input.CheckNativeViewport(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true);
                    actionReply=a.Bridge.ActivateNative(a.Actions,a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,request.Consumer,request.Button,request.InputSequence);
                    status=actionReply.Status;break;
                case "navigate":
                    a.Input.CheckNativeViewport(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true);
                    if(request.Action!=null){
                        actionReply=a.Bridge.NavigateNative(a.Actions,a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,request.Consumer,
                            new RoomButtonAction(request.Action.Type,request.Action.DeskId),request.InputSequence);
                        status=actionReply.Status;
                    }break;
            }
            // Authority calls and IPC happen after releasing the attachment/leaf
            // locks. Navigation may already have advanced the snapshot revision.
            SendNative(a,state,new{type="dext:v3-native-response",requestId=request.RequestId,runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,
                status=WireStatus(status),inputSequence=actionReply?.InputSequence??0,inputConsumed=actionReply?.InputConsumed??false,buttons,capabilities,data,value=storageValue,layout},request.Method);
            if(actionReply is{Status:RoomActionStatus.RequiresConfirmation,Exit:{} confirmation})
                _=ConfirmNativeExitAsync(a,state,confirmation);
        }
        private async Task ConfirmNativeExitAsync(NativeAttachment a,RoomNativeInputState state,RoomExitConfirmation confirmation)
        {
            bool Current() => !IsExited && ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a) &&
                a.Input.State is{} current && current.Generation==state.Generation && current.Session==state.Session;
            try {
                await new RoomNativeExitCoordinator().RunAsync(Current,async ()=>{
                    var app=System.Windows.Application.Current;
                    if(app==null || app.Dispatcher.HasShutdownStarted)return false;
                    // Send the private consumption receipt before our native
                    // dialog takes focus and changes the playback snapshot.
                    await Task.Delay(100);
                    return await app.Dispatcher.InvokeAsync(()=>Current() &&
                        System.Windows.MessageBox.Show("是否退出 Dext？桌面、播放器与配置器将关闭，回到普通 Windows 桌面。",
                            "Dext 退出确认",System.Windows.MessageBoxButton.YesNo,System.Windows.MessageBoxImage.Question,
                            System.Windows.MessageBoxResult.No)==System.Windows.MessageBoxResult.Yes);
                },approved=>a.Bridge.ConfirmNativeExit(a.Actions,a.Input,state.Generation,confirmation,approved),App.QuitProductAsync);
            }
            catch { a.Bridge.ConfirmNativeExit(a.Actions,a.Input,state.Generation,confirmation,false); }
        }
        private async Task<bool> DispatchNativeControl(RoomSystemControl control,CancellationToken token)
        {
            token.ThrowIfCancellationRequested();
            if(control.Capability=="audio.control"){systemControlService.SetVolume(control.Volume,control.Muted,token);return true;}
            var action=control.Action switch {
                "play"=>SystemMediaAction.Play,"pause"=>SystemMediaAction.Pause,"toggle"=>SystemMediaAction.TogglePlayPause,
                "next"=>SystemMediaAction.Next,"previous"=>SystemMediaAction.Previous,_=>(SystemMediaAction?)null
            };
            return action is{} value && await systemControlService.ControlMediaAsync(value,token);
        }
        private RoomNativeDataSource CreateNativeDataSource() => RoomNativeDataSource.ForWindows(systemControlService);

        private static string WireStatus(RoomActionStatus status) => char.ToLowerInvariant(status.ToString()[0])+status.ToString().Substring(1);
        private void SendNative(NativeAttachment a,RoomNativeInputState state,object payload,string method=null)
        {
            if(!ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a))return;
            var current=a.Input.State;if(current==null || current.Generation!=state.Generation || current.Session!=state.Session)return;
            SendMessage(new LivelyMessageRoomNativeResponse{Method=method,RuntimeGeneration=state.Generation,SessionId=state.Session,PayloadJson=JsonConvert.SerializeObject(payload)});
        }
        private void NotifyNative(NativeAttachment a,RoomNativeInputState before,bool activate)
        {
            var state=a.Input.State;if(state==null)return;
            if(before?.Focus!=state.Focus)SendNative(a,state,new{type="dext:v3-native-event",kind="focus",runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,geometryVersion=state.GeometryVersion,consumer=state.Focus?.Consumer,button=state.Focus?.Button,entryId=state.Focus?.EntryId});
            if(activate && state.Completed is{} proof && !ReferenceEquals(before?.Completed,proof))
                SendNative(a,state,new{type="dext:v3-native-event",kind="activate",runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,geometryVersion=state.GeometryVersion,inputSequence=proof.Sequence,consumer=proof.Button.Consumer,button=proof.Button.Button,entryId=proof.Button.EntryId});
        }
        internal void NativeMouseDown(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseDown(v??MissingViewport,x,y,foreground&&v!=null);
            var after=a.Input.State;
            if(after?.Gesture is{Key:0,Released:false} gesture&&gesture.Sequence!=before?.Gesture?.Sequence){
                a.PointerGesture=gesture;SendNativePointer(gesture,"down",x,y);
            }
            NotifyNative(a,before,false);
        }
        internal void NativeMouseMove(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseMove(v??MissingViewport,x,y,foreground&&v!=null);
            if(a.PointerGesture is{} gesture){
                var valid=a.Input.State?.Gesture?.Sequence==gesture.Sequence;
                SendNativePointer(gesture,valid?"move":"cancel",x,y);
                if(!valid)a.PointerGesture=null;
            }
            NotifyNative(a,before,false);
        }
        internal void NativeMouseUp(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseUp(v??MissingViewport,x,y,foreground&&v!=null);
            if(a.PointerGesture is{} gesture){a.PointerGesture=null;SendNativePointer(gesture,"up",x,y);}
            NotifyNative(a,before,true);
        }
        private void SendNativePointer(RoomNativeInputGesture gesture,string kind,int x,int y)
        {
            var v=gesture.Viewport;
            SendMessage(new LivelyMessageRoomNativePointer{
                RuntimeGeneration=gesture.Generation,SessionId=gesture.Session,Revision=gesture.Revision,GeometryVersion=gesture.GeometryVersion,
                GestureId=gesture.Sequence,IssuedAt=gesture.IssuedAt,InputHandle=v.Handle.ToInt64(),Kind=kind,
                OriginX=v.X,OriginY=v.Y,PixelWidth=v.Width,PixelHeight=v.Height,Dpi=v.Dpi,X=x,Y=y,Modifiers=InputUtil.MouseModifiers,SampleMouse=gesture.SampleMouse});
        }
        internal bool NativeKey(int key,bool down,bool reverse,bool foreground,int scanCode=0,bool extended=false)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null || key!=9 && key!=13 && key!=32)return false;
            var before=a.Input.State;var v=ReadNativeViewport();a.Input.CheckNativeViewport(v,foreground);
            a.Input.Key(v??MissingViewport,key,down,reverse,foreground&&v!=null);
            var after=a.Input.State;
            if(down&&key==9&&after?.Gesture is{Key:9} tab&&tab.Sequence!=before?.Gesture?.Sequence){
                a.KeyGesture=null;a.KeyFocus=null;SendNativeFocus(tab);
            }
            if(down&&key!=9&&after?.Gesture is{Released:false} gesture&&gesture.Key==key&&gesture.Sequence!=before?.Gesture?.Sequence&&after.Focus is{} focus){
                a.KeyGesture=gesture;a.KeyFocus=focus;a.KeyScanCode=scanCode;a.KeyExtended=extended;
                SendNativeKey(gesture,focus,"down",scanCode,extended);
            }
            if(!down&&a.KeyGesture is{} previous&&previous.Key==key){
                var releasedFocus=a.KeyFocus;a.KeyGesture=null;a.KeyFocus=null;
                SendNativeKey(previous,releasedFocus,"up",a.KeyScanCode,a.KeyExtended);
            }
            NotifyNative(a,before,true);return before!=null;
        }
        private void SendNativeFocus(RoomNativeInputGesture gesture)
        {
            var v=gesture.Viewport;
            SendMessage(new LivelyMessageRoomNativePointer{
                RuntimeGeneration=gesture.Generation,SessionId=gesture.Session,Revision=gesture.Revision,GeometryVersion=gesture.GeometryVersion,
                GestureId=gesture.Sequence,IssuedAt=gesture.IssuedAt,InputHandle=v.Handle.ToInt64(),Kind="focus",
                OriginX=v.X,OriginY=v.Y,PixelWidth=v.Width,PixelHeight=v.Height,Dpi=v.Dpi,X=v.X,Y=v.Y,Key=9,Reverse=gesture.Reverse});
        }
        private void SendNativeKey(RoomNativeInputGesture gesture,RoomNativeButton focus,string kind,int scanCode,bool extended)
        {
            if(focus==null)return;var v=gesture.Viewport;
            SendMessage(new LivelyMessageRoomNativePointer{
                RuntimeGeneration=gesture.Generation,SessionId=gesture.Session,Revision=gesture.Revision,GeometryVersion=gesture.GeometryVersion,
                GestureId=gesture.Sequence,IssuedAt=gesture.IssuedAt,InputHandle=v.Handle.ToInt64(),Kind=kind,
                OriginX=v.X,OriginY=v.Y,PixelWidth=v.Width,PixelHeight=v.Height,Dpi=v.Dpi,X=v.X,Y=v.Y,
                SampleKeyboard=gesture.SampleKeyboard,Key=gesture.Key,ScanCode=scanCode,IsExtended=extended,Consumer=focus.Consumer,Button=focus.Button,EntryId=focus.EntryId??focus.Button});
        }
    }
}
