using Lively.Common.Helpers;
using Lively.Models.Message;
using Newtonsoft.Json.Linq;
internal static class NativeAuthorActionDeliveryChecks
{
    public static void Run(){
        int total=0,passed=0;
        void Check(string name,Action body){total++;try{body();passed++;Console.WriteLine("PASS "+name);}catch(Exception e){Console.WriteLine("FAIL "+name+": "+e.Message);}}
        void Require(bool ok,string why){if(!ok)throw new Exception(why);}
        var session=Guid.NewGuid();var nonce=Guid.NewGuid();
        DextNativePointerPacket Packet(long gesture=7,int key=0)=>new(new LivelyMessageRoomNativePointer{
            RuntimeGeneration=1,SessionId=session,Revision=1,GeometryVersion=3,GestureId=gesture,IssuedAt=0,
            InputHandle=42,Kind="down",PixelWidth=640,PixelHeight=480,Dpi=144,X=200,Y=200,
            Key=key,ScanCode=key==13?28:0,Consumer=key==0?null:"scene",Button=key==0?null:"open",EntryId=key==0?null:"button.open"});
        var scope=new DextNativeInputFrameScope(1,session,1,9,1,nonce,"scene","instance");
        string Raw(string method="actions.activate",string id="r1",JObject? parameters=null)=>new JObject{
            ["type"]="dext:runtime:request",["apiVersion"]=1,["instanceId"]="instance",["sessionId"]=session.ToString(),
            ["token"]="sdk-token",["requestId"]=id,["method"]=method,["params"]=parameters??new JObject{["buttonId"]="open"}}.ToString();
        LivelyMessageRoomNativeRequest Outer(string raw)=>new(){RequestId="n1",Method="authorInput",RuntimeGeneration=1,SessionId=session,Revision=1,
            Consumer="scene",AuthorInstance="instance",SdkRequestJson=raw,GeometryVersion=3,PixelWidth=640,PixelHeight=480};
        foreach(var witnessFirst in new[]{false,true})Check("native author join waits for UP, both arrival orders "+witnessFirst,()=>{
            var sent=new List<LivelyMessageRoomNativeRequest>();var delivery=new DextNativeAuthorActionDelivery(sent.Add,(_,_)=>{},()=>0,1000);
            var packet=Packet();delivery.Begin(packet);var raw=Raw();
            if(witnessFirst)delivery.Witness(scope,raw,7,3);
            delivery.Official(scope,Outer(raw));
            if(!witnessFirst)delivery.Witness(scope,raw,7,3);
            Require(sent.Count==0,"DOWN granted action");delivery.Released(packet);
            Require(sent.Count==1&&sent[0].Method=="activate"&&sent[0].RequestId=="n1"&&sent[0].InputSequence==7&&sent[0].GeometryVersion==3&&sent[0].Consumer=="scene"&&sent[0].Button=="open","exact positive request lost");
            delivery.Released(packet);Require(sent.Count==1,"duplicate release");
        });
        Check("new DOWN cancels pending requests but keeps document request watermarks",()=>{
            var sent=new List<LivelyMessageRoomNativeRequest>();var rejected=new List<string>();
            var d=new DextNativeAuthorActionDelivery(sent.Add,(_,s)=>rejected.Add(s),()=>0,1000);d.Begin(Packet());d.Official(scope,Outer(Raw()));
            d.Begin(Packet(8));Require(rejected.SequenceEqual(new[]{"staleInput"}),"old request not cancelled");
            d.Witness(scope,Raw(),8,3);d.Official(scope,Outer(Raw()));d.Released(Packet(8));Require(sent.Count==0,"old r1 reused");
            var raw=Raw(id:"r2");d.Official(scope,Outer(raw));d.Witness(scope,raw,8,3);Require(sent.Count==1&&sent[0].InputSequence==8,"next request lost");
        });
        Check("native author deadline remains physical DOWN plus 1500ms",()=>{
            long now=0;var sent=new List<LivelyMessageRoomNativeRequest>();var rejected=new List<string>();
            var d=new DextNativeAuthorActionDelivery(sent.Add,(_,s)=>rejected.Add(s),()=>now,1000);d.Begin(Packet());d.Official(scope,Outer(Raw()));d.Witness(scope,Raw(),7,3);
            now=1500;d.Released(Packet());Require(sent.Count==0&&rejected.SequenceEqual(new[]{"expiredInput"}),"UP renewed deadline");
        });
        Check("native document revocation drops matched author work before UP",()=>{
            var sent=new List<LivelyMessageRoomNativeRequest>();var rejected=new List<string>();
            var d=new DextNativeAuthorActionDelivery(sent.Add,(_,s)=>rejected.Add(s),()=>0,1000);d.Begin(Packet());d.Official(scope,Outer(Raw()));d.Witness(scope,Raw(),7,3);
            d.RevokeDocument(scope.FrameId,scope.Epoch,scope.DocumentNonce);d.Released(Packet());
            Require(sent.Count==0&&rejected.SequenceEqual(new[]{"staleInput"}),"retired document dispatch");
        });
        Check("joined navigation and system controls retain their exact typed intent",()=>{
            foreach(var method in new[]{"desk.navigate","media.control","audio.control"}){
                var sent=new List<LivelyMessageRoomNativeRequest>();var d=new DextNativeAuthorActionDelivery(sent.Add,(_,_)=>{},()=>0,1000);d.Begin(Packet());d.Released(Packet());
                var parameters=method=="desk.navigate"?new JObject{["action"]=new JObject{["type"]="desk.go",["deskId"]="focus"}}:
                    method=="media.control"?new JObject{["action"]="pause"}:new JObject{["settings"]=new JObject{["volume"]=.25,["muted"]=true}};
                var raw=Raw(method:method,parameters:parameters);d.Witness(scope,raw,7,3);d.Official(scope,Outer(raw));
                Require(sent.Count==1&&sent[0].InputSequence==7,"typed intent not delivered");
                if(method=="desk.navigate")Require(sent[0].Action?.DeskId=="focus","desk target changed");
                if(method=="media.control")Require(sent[0].MediaAction=="pause","media intent changed");
                if(method=="audio.control")Require(sent[0].Volume==.25&&sent[0].Muted==true,"audio intent changed");
            }
        });
        Check("keyboard selected consumer joins its request only after the matching release",()=>{
            var sent=new List<LivelyMessageRoomNativeRequest>();var d=new DextNativeAuthorActionDelivery(sent.Add,(_,_)=>{},()=>0,1000);
            var packet=Packet(key:13);var raw=Raw();d.Begin(packet);d.Official(scope,Outer(raw));d.Witness(scope,raw,7,3);
            Require(sent.Count==0,"key DOWN executed");d.Released(packet);
            Require(sent.Count==1&&sent[0].InputSequence==7&&sent[0].Consumer=="scene","selected key action lost");
        });
        Check("keyboard focus on scene leaves another consumer inactive",()=>{
            var sent=new List<LivelyMessageRoomNativeRequest>();var refused=new List<string>();
            var d=new DextNativeAuthorActionDelivery(sent.Add,(_,status)=>refused.Add(status),()=>0,1000);
            var packet=Packet(key:13);var raw=Raw();var other=new DextNativeInputFrameScope(1,session,1,10,1,Guid.NewGuid(),"component.shared","instance");
            var request=Outer(raw);request.Consumer=other.Consumer;
            d.Begin(packet);d.Witness(other,raw,7,3);d.Official(other,request);d.Released(packet);
            Require(sent.Count==0&&refused.SequenceEqual(new[]{"inputRequired"}),"inactive consumer received focused key");
        });
        Console.WriteLine($"{passed}/{total} native author action delivery checks passed");if(passed!=total)throw new Exception("Native author action delivery regression");
    }
}