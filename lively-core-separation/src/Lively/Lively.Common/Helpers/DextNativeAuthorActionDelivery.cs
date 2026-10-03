using Lively.Models.Message;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
namespace Lively.Common.Helpers
{
    // Correlates private native document facts with the original SDK request.
    // Core still decides the exact consumer/button, permissions and one-time use.
    public sealed class DextNativeAuthorActionDelivery
    {
        private sealed class Entry
        {
            internal DextNativeInputFrameScope Scope;
            internal LivelyMessageRoomNativeRequest Outer;
            internal long Number;
            internal DextNativeInputJoinMatch Match;
        }
        private readonly Action<LivelyMessageRoomNativeRequest> ready;
        private readonly Action<LivelyMessageRoomNativeRequest,string> rejected;
        private readonly Func<long> clock;
        private readonly long frequency;
        private readonly DextNativeInputRequestJoin join=new DextNativeInputRequestJoin();
        private readonly Dictionary<string,Entry> entries=new Dictionary<string,Entry>();
        private DextNativePointerPacket current;
        private bool released;
        public DextNativeAuthorActionDelivery(Action<LivelyMessageRoomNativeRequest> ready,
            Action<LivelyMessageRoomNativeRequest,string> rejected,Func<long> clock=null,long frequency=0)
        {
            this.ready=ready??throw new ArgumentNullException(nameof(ready));
            this.rejected=rejected??throw new ArgumentNullException(nameof(rejected));
            this.clock=clock??Stopwatch.GetTimestamp;this.frequency=frequency==0?Stopwatch.Frequency:frequency;
            if(this.frequency<=0)throw new ArgumentOutOfRangeException(nameof(frequency));
        }
        public bool HasCurrent=>current!=null;
        public void Begin(DextNativePointerPacket packet){Cancel();current=packet;}
        public void Released(DextNativePointerPacket packet)
        {
            if(!Same(packet))return;
            if(Expired()){Expire();return;}
            released=true;Flush();
        }
        public void Official(DextNativeInputFrameScope scope,LivelyMessageRoomNativeRequest request)
        {
            Expire();
            if(!Current(scope)||request==null||request.Method!="authorInput"||request.RuntimeGeneration!=scope.Generation||
                request.SessionId!=scope.Session||request.Revision!=scope.Revision||request.GeometryVersion!=current.GeometryVersion||
                request.Consumer!=scope.Consumer||request.AuthorInstance!=scope.Instance){
                if(request!=null)rejected(request,"inputRequired");return;
            }
            if(entries.Count>=64){rejected(request,"rateLimited");return;}
            if(!join.RegisterFrame(scope)){rejected(request,"staleInput");return;}
            var reply=join.SubmitOfficial(scope,request.SdkRequestJson,current.GestureId,current.GeometryVersion);
            if(reply.Status!=DextNativeInputJoinStatus.Pending&&reply.Status!=DextNativeInputJoinStatus.Joined){
                rejected(request,"staleInput");return;
            }
            var id=(string)JObject.Parse(request.SdkRequestJson)["requestId"];
            var key=Key(scope.FrameId,id);
            if(entries.ContainsKey(key)){rejected(request,"staleInput");return;}
            // Detach the mutable transport object before waiting for native UP.
            entries.Add(key,new Entry{Scope=scope,Number=long.Parse(id.Substring(1),System.Globalization.CultureInfo.InvariantCulture),
                Outer=new LivelyMessageRoomNativeRequest{RequestId=request.RequestId,Method="authorInput",RuntimeGeneration=scope.Generation,
                    SessionId=scope.Session,Revision=scope.Revision,Consumer=scope.Consumer,PixelWidth=request.PixelWidth,PixelHeight=request.PixelHeight},
                Match=reply.Match});
            Flush();
        }
        public void Witness(DextNativeInputFrameScope scope,string raw,long gesture,long structure)
        {
            Expire();
            if(!Current(scope)||gesture!=current.GestureId||structure!=current.GeometryVersion||!join.RegisterFrame(scope))return;
            var result=join.SubmitWitness(scope,raw,gesture,structure);
            if(result.Status==DextNativeInputJoinStatus.Joined){
                var key=Key(scope.FrameId,result.Match.Request.RequestId);
                if(entries.TryGetValue(key,out var entry))entry.Match=result.Match;
            }
            Flush();
        }
        public void RevokeDocument(uint frame,long epoch,Guid nonce)
        {
            join.RevokeDocument(frame,epoch,nonce);
            foreach(var item in entries.Where(e=>e.Value.Scope.FrameId==frame&&e.Value.Scope.Epoch==epoch&&e.Value.Scope.DocumentNonce==nonce).ToArray())
                Reject(item.Key,item.Value,"staleInput");
        }
        public void RevokeFrame(uint frame)
        {
            join.RevokeFrame(frame);
            foreach(var item in entries.Where(e=>e.Value.Scope.FrameId==frame).ToArray())Reject(item.Key,item.Value,"staleInput");
        }
        public void Cancel()
        {
            current=null;released=false;join.CancelPending();
            foreach(var item in entries.ToArray())Reject(item.Key,item.Value,"staleInput");
        }
        public void Expire()
        {
            join.Expire();
            if(current==null||!Expired())return;
            current=null;released=false;join.CancelPending();
            foreach(var item in entries.ToArray())Reject(item.Key,item.Value,"expiredInput");
        }
        private bool Current(DextNativeInputFrameScope scope)=>current!=null&&scope!=null&&current.RuntimeGeneration==scope.Generation&&
            current.SessionId==scope.Session&&current.Revision==scope.Revision&&(current.Key==0||current.Consumer==scope.Consumer);
        private bool Same(DextNativePointerPacket packet)=>current!=null&&packet!=null&&packet.GestureId==current.GestureId&&
            packet.GeometryVersion==current.GeometryVersion&&packet.IssuedAt==current.IssuedAt&&
            packet.RuntimeGeneration==current.RuntimeGeneration&&packet.SessionId==current.SessionId&&packet.Revision==current.Revision&&
            packet.InputHandle==current.InputHandle;
        private bool Expired(){var seconds=((decimal)clock()-current.IssuedAt)/frequency;return seconds<0||seconds>=1.5m;}
        private static string Key(uint frame,string request)=>frame.ToString(System.Globalization.CultureInfo.InvariantCulture)+":"+request;
        private void Reject(string key,Entry entry,string status){if(entries.Remove(key))rejected(entry.Outer,status);}
        private void Flush()
        {
            if(!released||current==null)return;
            if(Expired()){Expire();return;}
            foreach(var item in entries.Where(e=>e.Value.Match!=null).OrderBy(e=>e.Value.Number).ToArray()){
                if(!entries.Remove(item.Key))continue;
                var entry=item.Value;var match=entry.Match;var intent=match.Request.Parameters;
                var result=entry.Outer;result.GeometryVersion=match.StructuralVersion;result.InputSequence=match.GestureId;
                switch(match.Request.Method){
                    case "actions.activate":result.Method="activate";result.Button=intent.ButtonId;break;
                    case "desk.navigate":result.Method="navigate";result.Action=new LivelyRoomNativeNavigation{Type=intent.Action,DeskId=intent.DeskId};break;
                    case "media.control":result.Method="mediaControl";result.MediaAction=intent.Action;break;
                    case "audio.control":result.Method="audioControl";result.Volume=intent.Volume;result.Muted=intent.Muted;break;
                    default:rejected(result,"unsupported");continue;
                }
                ready(result);
            }
        }
    }
}