using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Lively.Models.Message;

internal static class NativeFrameMediaMessageChecks
{
    public static void Run()
    {
        var f=RuntimeMessageChecks.Fixture();var state=new DextRoomRuntimeState();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
        context.ManifestJson=JsonConvert.SerializeObject(new{version=3,apiVersion=1,id=f.Snapshot.RoomId,resources=Array.Empty<string>(),roomScene=new{entry="scene.html"},
            components=new[]{new{id="shared"},new{id="other"}},start=new{type="html",src="start.html"},idle=new{type="html",src="idle.html"},
            desks=new[]{new{id="home",components=new[]{"shared"},background=new{type="html",src="home.html"}},new{id="focus",components=new[]{"shared","other"},background=new{type="html",src="focus.html"}}}});
        context.Resources=Array.Empty<LivelyRoomRuntimeResource>();Require(state.Initialize(context),"valid fixture context");
        var message=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=1,CurrentDeskId="home"},["home","focus"]);message.RuntimeGeneration=1;
        Require(state.AcceptSnapshot(message),"valid fixture snapshot");
        var wire=new JObject{["type"]="dext:v3-frame-policy",["protocolVersion"]=1,["runtimeGeneration"]=1,["sessionId"]=context.SessionId.ToString(),["revision"]=1,
            ["frameName"]="dext-native-"+Guid.NewGuid().ToString(),["consumer"]="component.shared",["active"]=true};
        Require(DextNativeFrameMediaPolicy.Parse(wire.ToString(Formatting.None),state)!=null,"official strict policy");
        foreach(var field in new[]{"revision","runtimeGeneration"}){var old=(JObject)wire.DeepClone();old[field]=0;Require(DextNativeFrameMediaPolicy.Parse(old.ToString(),state)==null,"old scope "+field);}
        foreach(var field in new[]{"extra","token"}){var extra=(JObject)wire.DeepClone();extra[field]="author";Require(DextNativeFrameMediaPolicy.Parse(extra.ToString(),state)==null,"extra authority "+field);}
        var wrong=(JObject)wire.DeepClone();wrong["active"]="true";Require(DextNativeFrameMediaPolicy.Parse(wrong.ToString(),state)==null,"strict boolean");
        wrong=(JObject)wire.DeepClone();wrong["frameName"]="authored";Require(DextNativeFrameMediaPolicy.Parse(wrong.ToString(),state)==null,"private frame name");
        Require(state.CanRenderMedia("scene")&&state.CanRenderMedia("component.shared")&&state.CanRenderMedia("slot.background.home")&&!state.CanRenderMedia("component.other")&&!state.CanRenderMedia("slot.start"),"active desktop consumers only");
        message.Revision=2;message.TargetDeskId="focus";message.TransitionId=Guid.NewGuid();Require(state.AcceptSnapshot(message),"transition scope");
        Require(state.CanRenderMedia("component.other")&&state.CanRenderMedia("slot.background.focus"),"current plus target graphics, no queued grants");
        Require(DextNativeFrameMediaPolicy.Parse(wire.ToString(),state)==null,"old top policy after Core revision");
        message.Revision=3;message.Lifecycle.PlaybackPaused=true;Require(state.AcceptSnapshot(message)&&!state.CanRenderMedia("scene"),"trusted pause wins");
        message.Revision=4;message.Lifecycle.PlaybackPaused=false;message.Lifecycle.Stage="idle";Require(state.AcceptSnapshot(message)&&state.CanRenderMedia("slot.idle")&&!state.CanRenderMedia("component.shared"),"idle isolated");
        message.Revision=5;message.Lifecycle.Locked=true;Require(state.AcceptSnapshot(message)&&!state.CanRenderMedia("slot.idle"),"lock always pauses");
        Require(state.Invalidate("navigation")&&!state.CanRenderMedia("scene"),"revoke default paused");
        var source=DextNativeFrameMediaPolicy.BuildScript();Require(source.Contains("__dextNativeMediaPolicyV1")&&!source.Contains("__DEXT_MEDIA_POLICY_TOKEN__"),"embedded script private token replaced");
        Console.WriteLine("PASS native media messages: strict scope/shape, source+target membership, phase/pause/lock/revoke, embedded private script");
        static void Require(bool value,string reason){if(!value)throw new Exception(reason);}
    }
}
