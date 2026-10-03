using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Lively.Common.Helpers
{
    // Constructed from the native frame registry, never from authored JSON.
    public sealed class DextNativeInputFrameScope
    {
        public DextNativeInputFrameScope(long generation,Guid session,long revision,uint frameId,long epoch,Guid documentNonce,string consumer,string instance)
        {Generation=generation;Session=session;Revision=revision;FrameId=frameId;Epoch=epoch;DocumentNonce=documentNonce;Consumer=consumer;Instance=instance;}
        public long Generation {get;}
        public Guid Session {get;}
        public long Revision {get;}
        public uint FrameId {get;}
        public long Epoch {get;}
        public Guid DocumentNonce {get;}
        public string Consumer {get;}
        public string Instance {get;}
    }
    public sealed class DextNativeInputIntent
    {
        internal DextNativeInputIntent(string button=null,string action=null,string desk=null,double? volume=null,bool? muted=null)
        {ButtonId=button;Action=action;DeskId=desk;Volume=volume;Muted=muted;}
        public string ButtonId {get;}
        public string Action {get;}
        public string DeskId {get;}
        public double? Volume {get;}
        public bool? Muted {get;}
    }
    public sealed class DextNativeInputProtectedRequest
    {
        internal DextNativeInputProtectedRequest(string instance,string session,string token,string requestId,long number,string method,DextNativeInputIntent parameters)
        {InstanceId=instance;SessionId=session;Token=token;RequestId=requestId;Number=number;Method=method;Parameters=parameters;}
        public string Type=>"dext:runtime:request";
        public int ApiVersion=>1;
        public string InstanceId {get;}
        public string SessionId {get;}
        public string Token {get;}
        public string RequestId {get;}
        public long Number {get;}
        public string Method {get;}
        public DextNativeInputIntent Parameters {get;}
    }
    public enum DextNativeInputJoinStatus {Pending,Joined,Invalid,StaleScope,Replay,Limit,Mismatch}
    public sealed class DextNativeInputJoinMatch
    {
        internal DextNativeInputJoinMatch(DextNativeInputFrameScope scope,DextNativeInputProtectedRequest request,long gesture,long structure,long firstHalfTimestamp)
        {Scope=scope;Request=request;GestureId=gesture;StructuralVersion=structure;FirstHalfTimestamp=firstHalfTimestamp;}
        public DextNativeInputFrameScope Scope {get;}
        public DextNativeInputProtectedRequest Request {get;}
        public long GestureId {get;}
        public long StructuralVersion {get;}
        public long FirstHalfTimestamp {get;}
    }
    public sealed class DextNativeInputJoinReply
    {
        internal DextNativeInputJoinReply(DextNativeInputJoinStatus status,DextNativeInputJoinMatch match=null){Status=status;Match=match;}
        public DextNativeInputJoinStatus Status {get;}
        public DextNativeInputJoinMatch Match {get;}
    }
    // UI-thread owned correlation only. Native callers must authenticate the
    // frame and guardian transport before SubmitWitness; this class grants no
    // action authority and never finds or creates a physical input proof.
    public sealed class DextNativeInputRequestJoin
    {
        private const long SafeInteger=9007199254740991;
        private const int MaxPending=64,MaxFrames=196,MaxBytes=32768;
        private const long LifetimeMilliseconds=1500;
        private readonly Func<long> clock;
        private readonly Dictionary<uint,FrameState> frames=new Dictionary<uint,FrameState>();
        private int pendingCount;
        private bool revoked;
        private sealed class FrameState
        {
            internal FrameState(DextNativeInputFrameScope scope){Scope=scope;}
            internal DextNativeInputFrameScope Scope;
            internal long OfficialHigh,WitnessHigh;
            internal bool Active=true,DocumentRevoked;
            internal readonly Dictionary<long,Pending> Pending=new Dictionary<long,Pending>();
        }
        private sealed class Pending
        {
            internal Pending(DextNativeInputProtectedRequest request,long gesture,long structure,long firstAt,bool witness)
            {Request=request;Gesture=gesture;Structure=structure;FirstAt=firstAt;Witness=witness;}
            internal readonly DextNativeInputProtectedRequest Request;
            internal readonly long Gesture,Structure,FirstAt;
            internal readonly bool Witness;
        }
        // Inject a monotonic millisecond clock for deterministic deadlines. The
        // join deadline does not replace Core's deadline from physical DOWN.
        public DextNativeInputRequestJoin(Func<long> monotonicMilliseconds=null)
        {clock=monotonicMilliseconds??(()=> (long)(Stopwatch.GetTimestamp()*(1000d/Stopwatch.Frequency)));}
        public int PendingCount=>pendingCount;
        public bool RegisterFrame(DextNativeInputFrameScope scope)
        {
            if(revoked||!ValidScope(scope))return false;
            if(!frames.TryGetValue(scope.FrameId,out var current))
            {
                if(frames.Count>=MaxFrames)return false;
                frames.Add(scope.FrameId,new FrameState(scope));return true;
            }
            if(SameScope(current.Scope,scope))return current.Active;
            var old=current.Scope;
            if(scope.Generation<old.Generation)return false;
            bool sameDocument=scope.Generation==old.Generation&&scope.Session==old.Session&&scope.Epoch==old.Epoch&&scope.DocumentNonce==old.DocumentNonce;
            if(scope.Generation==old.Generation)
            {
                if(scope.Session!=old.Session||scope.Revision<old.Revision||scope.Epoch<old.Epoch)return false;
                if(scope.Epoch==old.Epoch&&!sameDocument||scope.Epoch>old.Epoch&&scope.DocumentNonce==old.DocumentNonce)return false;
            }
            if(sameDocument&&(current.DocumentRevoked||scope.Consumer!=old.Consumer||scope.Instance!=old.Instance))return false;
            Cancel(current);
            // Snapshot revisions preserve the SDK's document-local rN stream.
            // Only a genuinely replaced native document resets those watermarks.
            if(sameDocument){current.Scope=scope;current.Active=true;}
            else frames[scope.FrameId]=new FrameState(scope);
            return true;
        }
        public DextNativeInputJoinReply SubmitOfficial(DextNativeInputFrameScope scope,string json,long gestureId,long structuralVersion)=>
            Submit(scope,json,gestureId,structuralVersion,false);
        public DextNativeInputJoinReply SubmitWitness(DextNativeInputFrameScope scope,string json,long gestureId,long structuralVersion)=>
            Submit(scope,json,gestureId,structuralVersion,true);
        private DextNativeInputJoinReply Submit(DextNativeInputFrameScope scope,string json,long gesture,long structure,bool witness)
        {
            if(revoked||scope==null||!frames.TryGetValue(scope.FrameId,out var frame)||!frame.Active||!SameScope(frame.Scope,scope))return Reply(DextNativeInputJoinStatus.StaleScope);
            var now=clock();Expire(now);
            if(now<0||!Positive(gesture)||!Positive(structure)||!TryParse(json,scope,out var request))return Reply(DextNativeInputJoinStatus.Invalid);
            var number=request.Number;
            if(number<=(witness?frame.WitnessHigh:frame.OfficialHigh))return Reply(DextNativeInputJoinStatus.Replay);
            bool waiting=frame.Pending.TryGetValue(number,out var pending);
            // Each route is ordered like the SDK rN stream; opposite routes may
            // arrive in either order. A seen counterpart with no slot is retired.
            var otherHigh=witness?frame.OfficialHigh:frame.WitnessHigh;
            if(witness)frame.WitnessHigh=number;else frame.OfficialHigh=number;
            if(!waiting&&number<=otherHigh)return Reply(DextNativeInputJoinStatus.Replay);
            if(waiting)
            {
                Remove(frame,number);
                if(pending.Witness==witness||pending.Gesture!=gesture||pending.Structure!=structure||!SameRequest(pending.Request,request))return Reply(DextNativeInputJoinStatus.Mismatch);
                return new DextNativeInputJoinReply(DextNativeInputJoinStatus.Joined,new DextNativeInputJoinMatch(frame.Scope,pending.Request,gesture,structure,pending.FirstAt));
            }
            // Do not advance the opposite route on overflow: older live slots
            // must still accept their first matching counterpart.
            if(pendingCount>=MaxPending)return Reply(DextNativeInputJoinStatus.Limit);
            frame.Pending.Add(number,new Pending(request,gesture,structure,now,witness));pendingCount++;
            return Reply(DextNativeInputJoinStatus.Pending);
        }
        public int Expire()=>Expire(clock());
        private int Expire(long now)
        {
            int removed=0;
            foreach(var frame in frames.Values)
                foreach(var item in frame.Pending.ToArray())
                    if(now<item.Value.FirstAt||now-item.Value.FirstAt>=LifetimeMilliseconds){Remove(frame,item.Key);removed++;}
            return removed;
        }
        public void RevokeFrame(uint frameId)
        {if(frames.TryGetValue(frameId,out var frame)){Cancel(frame);frames.Remove(frameId);}}
        public void RevokeDocument(uint frameId,long epoch,Guid nonce)
        {if(frames.TryGetValue(frameId,out var frame)&&frame.Scope.Epoch==epoch&&frame.Scope.DocumentNonce==nonce){Cancel(frame);frame.Active=false;frame.DocumentRevoked=true;}}
        public void RevokeRevision(long generation,Guid session,long revision)
        {
            foreach(var frame in frames.Values)
                if(frame.Scope.Generation==generation&&frame.Scope.Session==session&&frame.Scope.Revision==revision){Cancel(frame);frame.Active=false;}
        }
        // Terminal for this join instance; callers create a new one for a new
        // native document lifetime. An old callback cannot reactivate this one.
        public void RevokeAll(){revoked=true;frames.Clear();pendingCount=0;}
        private void Remove(FrameState frame,long number){if(frame.Pending.Remove(number))pendingCount--;}
        private void Cancel(FrameState frame){pendingCount-=frame.Pending.Count;frame.Pending.Clear();}
        private static DextNativeInputJoinReply Reply(DextNativeInputJoinStatus status)=>new DextNativeInputJoinReply(status);
        private static bool Positive(long value)=>value>0&&value<=SafeInteger;
        private static bool ValidScope(DextNativeInputFrameScope s)=>s!=null&&Positive(s.Generation)&&s.Session!=Guid.Empty&&Positive(s.Revision)&&s.FrameId!=0&&s.Epoch>=0&&s.Epoch<=SafeInteger&&s.DocumentNonce!=Guid.Empty&&Text(s.Consumer,128)&&Text(s.Instance,160);
        private static bool SameScope(DextNativeInputFrameScope a,DextNativeInputFrameScope b)=>
            a.Generation==b.Generation&&a.Session==b.Session&&a.Revision==b.Revision&&a.FrameId==b.FrameId&&a.Epoch==b.Epoch&&a.DocumentNonce==b.DocumentNonce&&a.Consumer==b.Consumer&&a.Instance==b.Instance;
        private static bool SameRequest(DextNativeInputProtectedRequest a,DextNativeInputProtectedRequest b)=>
            a.InstanceId==b.InstanceId&&a.SessionId==b.SessionId&&a.Token==b.Token&&a.RequestId==b.RequestId&&a.Method==b.Method&&
            a.Parameters.ButtonId==b.Parameters.ButtonId&&a.Parameters.Action==b.Parameters.Action&&a.Parameters.DeskId==b.Parameters.DeskId&&a.Parameters.Volume==b.Parameters.Volume&&a.Parameters.Muted==b.Parameters.Muted;
        private static bool TryParse(string json,DextNativeInputFrameScope scope,out DextNativeInputProtectedRequest request)
        {
            request=null;if(json==null||json.Length>MaxBytes||Encoding.UTF8.GetByteCount(json)>MaxBytes)return false;
            try
            {
                JObject o;
                using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=24,DateParseHandling=DateParseHandling.None})
                {o=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});if(reader.Read())return false;}
                if(!Shape(o,"type","apiVersion","instanceId","sessionId","token","requestId","method","params")||
                    String(o["type"])!="dext:runtime:request"||o["apiVersion"].Type!=JTokenType.Integer||(long)o["apiVersion"]!=1||
                    String(o["instanceId"])!=scope.Instance||!Text(String(o["sessionId"]),128)||!Guid.TryParse(String(o["sessionId"]),out var session)||session!=scope.Session||
                    !Text(String(o["token"]),256)||!RequestNumber(String(o["requestId"]),out var number)||!(o["params"] is JObject p))return false;
                var method=String(o["method"]);DextNativeInputIntent intent;
                switch(method)
                {
                    case "actions.activate":
                        if(!Shape(p,"buttonId")||!StableKey(String(p["buttonId"])))return false;
                        intent=new DextNativeInputIntent(button:String(p["buttonId"]));break;
                    case "desk.navigate":
                        if(!Shape(p,"action")||!(p["action"] is JObject navigation))return false;
                        var type=String(navigation["type"]);var desk=String(navigation["deskId"]);
                        if(type=="desk.go"?!Shape(navigation,"type","deskId")||!StableKey(desk):type!="desk.next"&&type!="desk.previous"||!Shape(navigation,"type"))return false;
                        intent=new DextNativeInputIntent(action:type,desk:desk);break;
                    case "media.control":
                        var action=String(p["action"]);
                        if(!Shape(p,"action")||action!="play"&&action!="pause"&&action!="toggle"&&action!="next"&&action!="previous")return false;
                        intent=new DextNativeInputIntent(action:action);break;
                    case "audio.control":
                        if(!Shape(p,"settings")||!(p["settings"] is JObject settings)||settings.Count<1||settings.Count>2||settings.Properties().Any(item=>item.Name!="volume"&&item.Name!="muted"))return false;
                        double? volume=null;bool? muted=null;
                        if(settings.Property("volume")!=null){if(!Number(settings["volume"],out var v)||v<0||v>1)return false;volume=v;}
                        if(settings.Property("muted")!=null){if(settings["muted"].Type!=JTokenType.Boolean)return false;muted=(bool)settings["muted"];}
                        intent=new DextNativeInputIntent(volume:volume,muted:muted);break;
                    default:return false;
                }
                request=new DextNativeInputProtectedRequest(String(o["instanceId"]),String(o["sessionId"]),String(o["token"]),String(o["requestId"]),number,method,intent);return true;
            }
            catch(Exception e)when(e is JsonException||e is ArgumentException||e is InvalidCastException||e is FormatException||e is OverflowException){return false;}
        }
        private static bool RequestNumber(string text,out long value)
        {
            value=0;if(text==null||text.Length<2||text.Length>17||text[0]!='r'||text[1]<'1'||text[1]>'9')return false;
            for(int i=2;i<text.Length;i++)if(text[i]<'0'||text[i]>'9')return false;
            return long.TryParse(text.Substring(1),NumberStyles.None,CultureInfo.InvariantCulture,out value)&&Positive(value);
        }
        private static bool Text(string value,int max)=>!string.IsNullOrEmpty(value)&&value.Length<=max&&!value.Any(char.IsControl);
        private static bool StableKey(string value)=>Text(value,80)&&value.All(c=>c>='A'&&c<='Z'||c>='a'&&c<='z'||c>='0'&&c<='9'||c=='_'||c=='.'||c=='-');
        private static string String(JToken value)=>value?.Type==JTokenType.String?(string)value:null;
        private static bool Shape(JObject value,params string[] fields)=>value.Count==fields.Length&&fields.All(field=>value.Property(field)!=null);
        private static bool Number(JToken token,out double value)
        {value=0;if(token==null||token.Type!=JTokenType.Integer&&token.Type!=JTokenType.Float)return false;value=(double)token;return !double.IsNaN(value)&&!double.IsInfinity(value);}
    }
}