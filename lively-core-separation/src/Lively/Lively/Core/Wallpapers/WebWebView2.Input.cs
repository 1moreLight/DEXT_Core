using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Newtonsoft.Json;
using System;
using System.Linq;
using System.Threading;

namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private sealed record NativeAttachment(RoomSessionPlayerBridge Bridge,RoomNativeInputAuthority Input,RoomActionAuthority Actions);
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
        private void HandleNativeRequest(LivelyMessageRoomNativeRequest request)
        {
            var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;
            if(state==null || request.ProtocolVersion!=1 || string.IsNullOrEmpty(request.RequestId) || request.RequestId.Length>128 ||
                request.RuntimeGeneration!=state.Generation || request.SessionId!=state.Session || request.Revision!=state.Revision)return;
            var status=RoomActionStatus.Denied;object buttons=null;
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
                        var copy=entries.Select(b=>new RoomNativeButton(b.Consumer,b.Button,b.X,b.Y,b.Width,b.Height,b.TabIndex)).ToArray();
                        status=a.Bridge.PublishNativeGeometry(a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,viewport,copy)?RoomActionStatus.Accepted:RoomActionStatus.StaleInput;
                    }
                    break;
                case "buttons":
                    var list=a.Bridge.NativeButtons(a.Actions,state.Session,request.Consumer);status=list.Status;
                    buttons=list.Buttons?.Select(b=>new{id=b.Id,name=b.Name,scope=b.Scope,action=b.Action,isBound=b.IsBound}).ToArray();break;
                case "activate":
                    a.Input.CheckNativeViewport(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true);
                    status=a.Bridge.ActivateNative(a.Actions,a.Input,state.Generation,state.Session,state.Revision,request.GeometryVersion,request.Consumer,request.Button).Status;break;
            }
            // Authority calls and IPC happen after releasing the attachment/leaf
            // locks. Navigation may already have advanced the snapshot revision.
            SendNative(a,state,new{type="dext:v3-native-response",requestId=request.RequestId,runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,
                status=char.ToLowerInvariant(status.ToString()[0])+status.ToString().Substring(1),buttons});
        }
        private void SendNative(NativeAttachment a,RoomNativeInputState state,object payload)
        {
            if(!ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a))return;
            var current=a.Input.State;if(current==null || current.Generation!=state.Generation || current.Session!=state.Session)return;
            SendMessage(new LivelyMessageRoomNativeResponse{RuntimeGeneration=state.Generation,SessionId=state.Session,PayloadJson=JsonConvert.SerializeObject(payload)});
        }
        private void NotifyNative(NativeAttachment a,RoomNativeInputState before,bool activate)
        {
            var state=a.Input.State;if(state==null)return;
            if(before?.Focus!=state.Focus)SendNative(a,state,new{type="dext:v3-native-event",kind="focus",runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,geometryVersion=state.GeometryVersion,consumer=state.Focus?.Consumer,button=state.Focus?.Button});
            if(activate && state.Completed is{} proof && !ReferenceEquals(before?.Completed,proof))
                SendNative(a,state,new{type="dext:v3-native-event",kind="activate",runtimeGeneration=state.Generation,sessionId=state.Session,revision=state.Revision,geometryVersion=state.GeometryVersion,consumer=proof.Button.Consumer,button=proof.Button.Button});
        }
        internal void NativeMouseDown(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseDown(v??MissingViewport,x,y,foreground&&v!=null);NotifyNative(a,before,false);
        }
        internal void NativeMouseMove(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseMove(v??MissingViewport,x,y,foreground&&v!=null);NotifyNative(a,before,false);
        }
        internal void NativeMouseUp(int x,int y,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null)return;var before=a.Input.State;var v=ReadNativeViewport();
            a.Input.CheckNativeViewport(v,foreground);a.Input.MouseUp(v??MissingViewport,x,y,foreground&&v!=null);NotifyNative(a,before,false);
        }
        internal bool NativeKey(int key,bool down,bool reverse,bool foreground)
        {
            var a=Volatile.Read(ref roomNativeAttachment);if(a==null || key!=9 && key!=13 && key!=32)return false;
            var before=a.Input.State;var v=ReadNativeViewport();a.Input.CheckNativeViewport(v,foreground);
            a.Input.Key(v??MissingViewport,key,down,reverse,foreground&&v!=null);NotifyNative(a,before,true);
            return before!=null;
        }
    }
}
