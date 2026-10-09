using Lively.Common.Helpers;
using Newtonsoft.Json.Linq;

internal static class NativeInputRequestJoinChecks
{
    private static readonly Guid Session=Guid.Parse("d390f9c9-8136-4c56-a00b-afabbac4db2c");
    private static readonly Guid Document=Guid.Parse("bb8f4f65-4e57-4f24-a0f7-fcbf3a0ff416");
    public static void Run()
    {
        int passed=0,total=0;
        void Check(string name,Action body){total++;try{body();passed++;Console.WriteLine("PASS "+name);}catch(Exception e){Console.Error.WriteLine("FAIL "+name+": "+e.Message);}}
        void Eq<T>(T expected,T actual){if(!EqualityComparer<T>.Default.Equals(expected,actual))throw new Exception($"Expected {expected}, got {actual}");}
        DextNativeInputFrameScope Scope(uint frame=1,long epoch=1,long revision=1,Guid? nonce=null,string consumer="scene",string instance="scene")=>new(1,Session,revision,frame,epoch,nonce??Document,consumer,instance);
        JObject Request(string id="r1",string method="actions.activate",JObject? parameters=null,string instance="scene")=>new(){["type"]="dext:runtime:request",["apiVersion"]=1,["instanceId"]=instance,["sessionId"]=Session.ToString(),["token"]="sdk-connection",["requestId"]=id,["method"]=method,["params"]=parameters??new JObject{["buttonId"]="open"}};
        foreach(var witnessFirst in new[]{false,true})Check("exact native request joins either arrival order "+witnessFirst,()=>{
            long now=10;var join=new DextNativeInputRequestJoin(()=>now);var scope=Scope();Eq(true,join.RegisterFrame(scope));var raw=Request().ToString();
            var first=witnessFirst?join.SubmitWitness(scope,raw,7,3):join.SubmitOfficial(scope,raw,7,3);Eq(DextNativeInputJoinStatus.Pending,first.Status);Eq(1,join.PendingCount);
            var second=witnessFirst?join.SubmitOfficial(scope,raw,7,3):join.SubmitWitness(scope,raw,7,3);Eq(DextNativeInputJoinStatus.Joined,second.Status);Eq(0,join.PendingCount);
            var match=second.Match!;Eq(7L,match.GestureId);Eq(3L,match.StructuralVersion);Eq(Document,match.Scope.DocumentNonce);Eq("r1",match.Request.RequestId);Eq("open",match.Request.Parameters.ButtonId);
            Eq(DextNativeInputJoinStatus.Replay,join.SubmitOfficial(scope,raw,7,3).Status);Eq(DextNativeInputJoinStatus.Replay,join.SubmitWitness(scope,raw,7,3).Status);
        });
        Check("JSON property order does not alter frozen typed request matching",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);var raw=Request();var reordered=new JObject(raw.Properties().Reverse().Select(p=>new JProperty(p.Name,p.Value.DeepClone())));
            Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(scope,raw.ToString(),7,3).Status);Eq(DextNativeInputJoinStatus.Joined,join.SubmitWitness(scope,reordered.ToString(),7,3).Status);
        });
        foreach(var method in new[]{"actions.activate","desk.next","desk.previous","desk.go","media.play","media.pause","media.toggle","media.next","media.previous","audio.volume","audio.muted","audio.both"})
            Check("closed protected request preserves intent "+method,()=>{
                var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);JObject r;
                if(method.StartsWith("desk."))r=Request(method:"desk.navigate",parameters:new(){["action"]=method=="desk.go"?new JObject{["type"]=method,["deskId"]="focus"}:new JObject{["type"]=method}});
                else if(method.StartsWith("media."))r=Request(method:"media.control",parameters:new(){["action"]=method.Substring(6)});
                else if(method.StartsWith("audio."))r=Request(method:"audio.control",parameters:new(){["settings"]=method=="audio.volume"?new JObject{["volume"]=0}:method=="audio.muted"?new JObject{["muted"]=false}:new JObject{["volume"]=1,["muted"]=true}});
                else r=Request();
                Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(scope,r.ToString(),7,3).Status);var matched=join.SubmitWitness(scope,r.ToString(),7,3);Eq(DextNativeInputJoinStatus.Joined,matched.Status);
                if(method=="desk.go")Eq("focus",matched.Match!.Request.Parameters.DeskId);if(method=="audio.muted")Eq(false,matched.Match!.Request.Parameters.Muted);if(method=="audio.volume")Eq(0d,matched.Match!.Request.Parameters.Volume);
            });
        foreach(var mismatch in new[]{"token","method","button","navigation","volume","muted","gesture","structure"})Check("mismatched half retires exact request "+mismatch,()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);var first=Request();
            if(mismatch=="navigation")first=Request(method:"desk.navigate",parameters:new(){["action"]=new JObject{["type"]="desk.go",["deskId"]="home"}});
            if(mismatch=="volume"||mismatch=="muted")first=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["volume"]=.5,["muted"]=false}});
            var other=(JObject)first.DeepClone();long gesture=7,structure=3;
            switch(mismatch){case "token":other["token"]="other";break;case "method":other["method"]="media.control";other["params"]=new JObject{["action"]="play"};break;case "button":other["params"]!["buttonId"]="other";break;case "navigation":other["params"]!["action"]!["deskId"]="focus";break;case "volume":other["params"]!["settings"]!["volume"]=.6;break;case "muted":other["params"]!["settings"]!["muted"]=true;break;case "gesture":gesture=8;break;case "structure":structure=4;break;}
            Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(scope,first.ToString(),7,3).Status);Eq(DextNativeInputJoinStatus.Mismatch,join.SubmitWitness(scope,other.ToString(),gesture,structure).Status);Eq(0,join.PendingCount);
            Eq(DextNativeInputJoinStatus.Replay,join.SubmitWitness(scope,first.ToString(),7,3).Status);
        });
        Check("a duplicate half neither replaces content nor extends deadline",()=>{
            long now=0;var join=new DextNativeInputRequestJoin(()=>now);var scope=Scope();join.RegisterFrame(scope);var original=Request().ToString();join.SubmitOfficial(scope,original,7,3);
            now=1499;Eq(DextNativeInputJoinStatus.Replay,join.SubmitOfficial(scope,Request(parameters:new(){["buttonId"]="other"}).ToString(),7,3).Status);
            now=1500;Eq(1,join.Expire());Eq(0,join.PendingCount);Eq(DextNativeInputJoinStatus.Replay,join.SubmitWitness(scope,original,7,3).Status);
        });
        Check("pending deadline is fixed from either first half and matching at 1499ms succeeds",()=>{
            long now=50;var join=new DextNativeInputRequestJoin(()=>now);var scope=Scope();join.RegisterFrame(scope);var raw=Request().ToString();join.SubmitWitness(scope,raw,7,3);now=1549;
            Eq(DextNativeInputJoinStatus.Joined,join.SubmitOfficial(scope,raw,7,3).Status);
            now=2000;raw=Request("r2").ToString();join.SubmitWitness(scope,raw,8,3);now=3500;Eq(DextNativeInputJoinStatus.Replay,join.SubmitOfficial(scope,raw,8,3).Status);Eq(0,join.PendingCount);
        });
        Check("both native frames may use r1 without cross-frame matching",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var one=Scope();var two=Scope(frame:2);join.RegisterFrame(one);join.RegisterFrame(two);var raw=Request().ToString();
            Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(one,raw,7,3).Status);Eq(DextNativeInputJoinStatus.Pending,join.SubmitWitness(two,raw,7,3).Status);Eq(2,join.PendingCount);
            Eq(DextNativeInputJoinStatus.Joined,join.SubmitWitness(one,raw,7,3).Status);Eq(DextNativeInputJoinStatus.Joined,join.SubmitOfficial(two,raw,7,3).Status);
        });
        foreach(var revoke in new[]{"frame","document","revision","all","replacement","newRevision"})Check("native scope change cancels old pending request "+revoke,()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);var raw=Request().ToString();join.SubmitOfficial(scope,raw,7,3);
            switch(revoke){case "frame":join.RevokeFrame(1);break;case "document":join.RevokeDocument(1,1,Document);break;case "revision":join.RevokeRevision(1,Session,1);break;case "all":join.RevokeAll();break;case "replacement":Eq(true,join.RegisterFrame(Scope(epoch:2,nonce:Guid.NewGuid())));break;case "newRevision":Eq(true,join.RegisterFrame(Scope(revision:2)));break;}
            Eq(0,join.PendingCount);Eq(DextNativeInputJoinStatus.StaleScope,join.SubmitWitness(scope,raw,7,3).Status);
        });
        Check("late old-document revoke cannot retire the replacement document",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var old=Scope();join.RegisterFrame(old);var current=Scope(epoch:2,nonce:Guid.NewGuid());join.RegisterFrame(current);join.RevokeDocument(1,1,Document);
            Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(current,Request().ToString(),7,3).Status);Eq(DextNativeInputJoinStatus.Joined,join.SubmitWitness(current,Request().ToString(),7,3).Status);
        });
        Check("document revocation cannot be undone by a later snapshot revision",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var old=Scope();join.RegisterFrame(old);join.RevokeDocument(1,1,Document);
            Eq(false,join.RegisterFrame(Scope(revision:2)));Eq(DextNativeInputJoinStatus.StaleScope,join.SubmitOfficial(Scope(revision:2),Request().ToString(),7,3).Status);
            var replaced=Scope(epoch:2,revision:2,nonce:Guid.NewGuid());Eq(true,join.RegisterFrame(replaced));Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(replaced,Request().ToString(),8,4).Status);
        });
        Check("same document revision change retains replay watermarks",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var old=Scope();join.RegisterFrame(old);join.SubmitOfficial(old,Request().ToString(),7,3);var current=Scope(revision:2);join.RegisterFrame(current);
            Eq(DextNativeInputJoinStatus.Replay,join.SubmitOfficial(current,Request().ToString(),8,4).Status);Eq(DextNativeInputJoinStatus.Replay,join.SubmitWitness(current,Request().ToString(),8,4).Status);
            Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(current,Request("r2").ToString(),8,4).Status);
        });
        Check("unregistered and substituted native scopes are not author selectable",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();Eq(DextNativeInputJoinStatus.StaleScope,join.SubmitOfficial(scope,Request().ToString(),7,3).Status);join.RegisterFrame(scope);
            foreach(var fake in new[]{Scope(epoch:2),Scope(revision:2),Scope(nonce:Guid.NewGuid()),Scope(consumer:"official"),Scope(instance:"other")})Eq(DextNativeInputJoinStatus.StaleScope,join.SubmitWitness(fake,Request().ToString(),7,3).Status);
        });
        Check("pending capacity is 64 and expiry frees slots without replay",()=>{
            long now=0;var join=new DextNativeInputRequestJoin(()=>now);var scope=Scope();join.RegisterFrame(scope);
            for(int i=1;i<=64;i++)Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(scope,Request("r"+i).ToString(),7,3).Status);
            Eq(DextNativeInputJoinStatus.Limit,join.SubmitOfficial(scope,Request("r65").ToString(),7,3).Status);Eq(64,join.PendingCount);now=1500;Eq(64,join.Expire());
            Eq(DextNativeInputJoinStatus.Replay,join.SubmitWitness(scope,Request("r65").ToString(),7,3).Status);Eq(DextNativeInputJoinStatus.Pending,join.SubmitOfficial(scope,Request("r66").ToString(),8,3).Status);
        });
        Check("overflow request does not reject already pending opposite halves",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);
            for(int i=1;i<=64;i++)join.SubmitOfficial(scope,Request("r"+i).ToString(),7,3);
            Eq(DextNativeInputJoinStatus.Limit,join.SubmitOfficial(scope,Request("r65").ToString(),7,3).Status);
            Eq(DextNativeInputJoinStatus.Joined,join.SubmitWitness(scope,Request("r1").ToString(),7,3).Status);Eq(63,join.PendingCount);
        });
        Check("revoke all is terminal for this native join instance",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);join.RegisterFrame(Scope());join.RevokeAll();Eq(false,join.RegisterFrame(Scope()));Eq(DextNativeInputJoinStatus.StaleScope,join.SubmitOfficial(Scope(),Request().ToString(),7,3).Status);
        });
        Check("native frame capacity is 196 and revoked slots can be reused",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);for(uint i=1;i<=196;i++)Eq(true,join.RegisterFrame(Scope(frame:i)));Eq(false,join.RegisterFrame(Scope(frame:197)));join.RevokeFrame(1);Eq(true,join.RegisterFrame(Scope(frame:197)));
        });
        Check("parsed request is detached from mutable JSON input",()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);var input=Request();var raw=input.ToString();join.SubmitOfficial(scope,raw,7,3);input["params"]!["buttonId"]="other";
            var reply=join.SubmitWitness(scope,raw,7,3);Eq(DextNativeInputJoinStatus.Joined,reply.Status);var match=reply.Match!;Eq("open",match.Request.Parameters.ButtonId);Eq("sdk-connection",match.Request.Token);
        });
        foreach(var bad in new[]{"rootArray","type","version","fractionVersion","unknown","missing","instance","session","tokenNull","tokenLong","requestZero","requestLeadingZero","requestFraction","requestUnsafe","requestLong","unknownMethod","unknownParam","missingButton","buttonBad","buttonLong","navigationShape","navigationTarget","navigationTargetExtra","mediaIntent","audioEmpty","audioUnknown","audioString","audioOutOfRange","audioNull","mutedNumber","duplicate","duplicateNested","trailing","depth","size","jsonGesture","jsonFrame"})Check("strict native join parser rejects "+bad,()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);var r=Request();string? raw=null;
            switch(bad){case "rootArray":raw="[]";break;case "type":r["type"]="dext:runtime:notify";break;case "version":r["apiVersion"]=2;break;case "fractionVersion":r["apiVersion"]=1.0;break;case "unknown":r["approved"]=true;break;case "missing":r.Remove("token");break;case "instance":r["instanceId"]="other";break;case "session":r["sessionId"]=Guid.NewGuid().ToString();break;case "tokenNull":r["token"]=JValue.CreateNull();break;case "tokenLong":r["token"]=new string('x',257);break;
                case "requestZero":r["requestId"]="r0";break;case "requestLeadingZero":r["requestId"]="r01";break;case "requestFraction":r["requestId"]="r1.2";break;case "requestUnsafe":r["requestId"]="r9007199254740992";break;case "requestLong":r["requestId"]="r10000000000000000";break;case "unknownMethod":r["method"]="storage.set";break;
                case "unknownParam":r["params"]!["entryId"]="forged";break;case "missingButton":((JObject)r["params"]!).Remove("buttonId");break;case "buttonBad":r["params"]!["buttonId"]="../target";break;case "buttonLong":r["params"]!["buttonId"]=new string('a',81);break;
                case "navigationShape":r=Request(method:"desk.navigate",parameters:new(){["action"]="desk.next"});break;case "navigationTarget":r=Request(method:"desk.navigate",parameters:new(){["action"]=new JObject{["type"]="desk.go"}});break;case "navigationTargetExtra":r=Request(method:"desk.navigate",parameters:new(){["action"]=new JObject{["type"]="desk.next",["deskId"]="home"}});break;
                case "mediaIntent":r=Request(method:"media.control",parameters:new(){["action"]="seek"});break;case "audioEmpty":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject()});break;case "audioUnknown":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["path"]="private"}});break;case "audioString":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["volume"]="0.5"}});break;case "audioOutOfRange":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["volume"]=-.1}});break;case "audioNull":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["muted"]=JValue.CreateNull()}});break;case "mutedNumber":r=Request(method:"audio.control",parameters:new(){["settings"]=new JObject{["muted"]=1}});break;
                case "duplicate":raw=r.ToString().Replace("\"apiVersion\": 1","\"apiVersion\": 1, \"apiVersion\": 1");break;case "duplicateNested":raw=r.ToString().Replace("\"buttonId\": \"open\"","\"buttonId\": \"open\", \"buttonId\": \"open\"");break;case "trailing":raw=r+"{}";break;case "depth":raw=new string('[',25)+"0"+new string(']',25);break;case "size":raw=new string(' ',32769);break;case "jsonGesture":r["gestureId"]=7;break;case "jsonFrame":r["nativeFrameId"]=1;break;
            }
            Eq(DextNativeInputJoinStatus.Invalid,join.SubmitOfficial(scope,raw??r.ToString(),7,3).Status);Eq(0,join.PendingCount);
        });
        foreach(var pair in new[]{(0L,3L),(-1L,3L),(7L,0L),(7L,-1L),(9007199254740992L,3L),(7L,9007199254740992L)})Check("positive exact native correlation required "+pair,()=>{
            var join=new DextNativeInputRequestJoin(()=>0);var scope=Scope();join.RegisterFrame(scope);Eq(DextNativeInputJoinStatus.Invalid,join.SubmitWitness(scope,Request().ToString(),pair.Item1,pair.Item2).Status);Eq(0,join.PendingCount);
        });
        Console.WriteLine($"{passed}/{total} native request join checks passed");if(passed!=total)throw new Exception("native request join checks failed");
    }
}