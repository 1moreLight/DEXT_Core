using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Common.JsonConverters;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Text.Json;

internal static class RuntimeMessageChecks
{
    public static void Run()
    {
        var passed = 0; var total = 0;
        void Check(string name, Action body) { total++; try { body(); passed++; Console.WriteLine("PASS " + name); }
            catch (Exception e) { Console.Error.WriteLine("FAIL " + name + ": " + e.Message); } }
        Check("production Json.NET preserves verified manifest and ordered context then snapshot", () =>
        {
            var f = Fixture(); var messages = new List<IpcMessage>(); long generation = 0;
            var sender = new RoomSessionPlayerMessages(messages.Add, () => ++generation, ["home", "focus"]);
            sender.Initialize(f.Context, f.Snapshot); sender.Snapshot(f.Snapshot);
            Require(messages.Count == 2 && messages[0] is LivelyMessageRoomRuntime && messages[1] is LivelyMessageRoomSessionSnapshot,
                "context precedes full snapshot");
            var state = new DextRoomRuntimeState();
            var context = (LivelyMessageRoomRuntime)Roundtrip(messages[0]);
            Require(state.Initialize(context), "receiver accepts valid context");
            Require(state.AcceptSnapshot((LivelyMessageRoomSessionSnapshot)Roundtrip(messages[1])), "snapshot same generation");
            var replay = state.Replay();
            Require((string?)replay[0]["manifest"]?["name"] == "\u65e5\u671f2026-10-03T01:02:03Z" &&
                (string?)replay[0]["manifest"]?["components"]?[0]?["config"]?["date"] == "2026-10-03T01:02:03Z", "JSON values, Unicode and dates preserved");
            Require(!replay[0].ToString().Contains("ValueKind"), "JsonElement was not serialized as CLR metadata");
            Require((long?)replay[0]["runtimeGeneration"] == 1 && (long?)replay[1]["runtimeGeneration"] == 1, "same runtime generation");
            replay[0]["manifest"]!["name"] = "mutated";
            Require((string?)state.Replay()[0]["manifest"]?["name"] != "mutated", "outside payload mutation does not change cached context");
        });
        Check("runtime generation rejects old contexts snapshots and revokes after refresh", () =>
        {
            var f = Fixture(); var messages = new List<IpcMessage>(); long generation = 0;
            var sender = new RoomSessionPlayerMessages(messages.Add, () => ++generation, ["home", "focus"]);
            sender.Initialize(f.Context, f.Snapshot); sender.Snapshot(f.Snapshot);
            var first = (LivelyMessageRoomRuntime)messages[0]; var old = (LivelyMessageRoomSessionSnapshot)messages[1];
            sender.Revoke(); var revoke = (LivelyMessageRoomRuntimeRevoke)messages[2];
            sender.Initialize(f.Context, f.Snapshot); sender.Snapshot(f.Snapshot);
            var state = new DextRoomRuntimeState(); Require(state.Initialize(first), "first context");
            Require(state.Revoke(revoke), "first revoke");
            Require(!state.Initialize(first) && !state.AcceptSnapshot(old), "retired generation never revives");
            Require(state.Initialize((LivelyMessageRoomRuntime)messages[3]), "new generation");
            Require(!state.Revoke(revoke) && !state.AcceptSnapshot(old), "late old traffic cannot affect refreshed runtime");
            Require(state.AcceptSnapshot((LivelyMessageRoomSessionSnapshot)messages[4]), "fresh snapshot accepted");
        });
        Check("pause replay contains only the latest snapshot or an explicit revoke", () =>
        {
            var f=Fixture();var state=new DextRoomRuntimeState();var context=ContextMessage(f.Context,f.Snapshot,1);
            Require(state.Initialize(context), "context");
            for (var revision=1;revision<=3;revision++)
            { var snap=RoomSessionPlayerMessage.Create(f.Snapshot with { Revision=revision },["home","focus"]);snap.RuntimeGeneration=1;Require(state.AcceptSnapshot(snap),"new snapshot"); }
            Require(state.Replay().Count==2 && (long?)state.Replay()[1]["revision"]==3,"only last full revision replayed");
            Require(state.Invalidate("navigation"),"navigation invalidates");
            Require(state.Replay().Count==1 && (string?)state.Replay()[0]["type"]=="dext:v3-runtime-revoked","pending revoke survives suspension");
            Require(!state.Initialize(context),"navigation retains generation tombstone");
        });
        foreach(var kind in new[]{"wrongSession","wrongRoom","wrongStamp","oldRevision","unknownDesk","legacyDowngrade"})
            Check("native receiver rejects mismatched snapshot: "+kind,()=>
            {
                var f=Fixture();var state=new DextRoomRuntimeState();state.Initialize(ContextMessage(f.Context,f.Snapshot,1));
                var snap=RoomSessionPlayerMessage.Create(f.Snapshot,["home","focus"]);snap.RuntimeGeneration=1;Require(state.AcceptSnapshot(snap),"valid first snapshot");
                snap.Revision++;
                switch(kind){case "wrongSession":snap.SessionId=Guid.NewGuid();break;case "wrongRoom":snap.RoomId=Guid.NewGuid().ToString();break;
                    case "wrongStamp":snap.InstallationStamp="other";break;case "oldRevision":snap.Revision=1;break;case "unknownDesk":snap.CurrentDeskId="absent";break;case "legacyDowngrade":snap.RuntimeGeneration=0;break;}
                Require(!state.AcceptSnapshot(snap),"mismatch rejected");Require((long?)state.Replay()[1]["revision"]==1,"cached authoritative state unchanged");
            });
        foreach(var kind in new[]{"badJson","duplicateKey","wrongRoom","badHash","missingResource","oversize","wrongVersion","badDeskShape","badDeskNull"})
            Check("native receiver rejects malformed context without discarding its last valid context: "+kind,()=>
            {
                var f=Fixture();var state=new DextRoomRuntimeState();state.Initialize(ContextMessage(f.Context,f.Snapshot,1));
                var next=ContextMessage(f.Context,f.Snapshot,2);
                switch(kind){case "badJson":next.ManifestJson="[";break;case "duplicateKey":next.ManifestJson=next.ManifestJson.Replace("\"version\":3","\"version\":3,\"version\":3");break;
                    case "wrongRoom":next.RoomId=Guid.NewGuid().ToString();break;case "badHash":next.Resources[0].Sha256="x";break;case "missingResource":next.Resources=[];break;
                    case "oversize":next.ManifestJson=new string(' ',1024*1024+1);break;case "wrongVersion":next.ProtocolVersion=2;break;
                    case "badDeskShape":next.ManifestJson=next.ManifestJson.Replace("{\"id\":\"home\"}","1");break;
                    case "badDeskNull":next.ManifestJson=next.ManifestJson.Replace("{\"id\":\"home\"}","null");break;}
                Require(!state.Initialize(next),"malformed context rejected");Require((long?)state.Replay()[0]["runtimeGeneration"]==1,"old valid context unchanged");
            });
        Check("inactive native snapshot revokes while legacy snapshot retains null transport generation",()=>
        {
            var f=Fixture();var state=new DextRoomRuntimeState();state.Initialize(ContextMessage(f.Context,f.Snapshot,1));
            var snap=RoomSessionPlayerMessage.Create(f.Snapshot with{IsActive=false,IsOperable=false},["home","focus"]);snap.RuntimeGeneration=1;
            Require(state.AcceptSnapshot(snap),"inactive accepted as revocation");Require((string?)state.Replay()[0]["type"]=="dext:v3-runtime-revoked","inactive clears context");
            var legacy=new DextRoomRuntimeState();snap.RuntimeGeneration=0;Require(legacy.AcceptSnapshot(snap),"legacy full snapshot unaffected");
            Require((string?)legacy.Replay()[0]["type"]=="dext:v3-session","legacy snapshot kind");
        });
        Check("native input callbacks invalidate before each public transport delivery",()=>{
            var f=Fixture();var order=new List<string>();long generation=0;
            var sender=new RoomSessionPlayerMessages(_=>order.Add("send"),()=>++generation,["home","focus"],
                (g,s)=>order.Add("initialize:"+g),s=>order.Add("snapshot"),()=>order.Add("revoke"));
            sender.Initialize(f.Context,f.Snapshot);sender.Snapshot(f.Snapshot);sender.Revoke();
            Require(order.SequenceEqual(new[]{"initialize:1","send","snapshot","send","revoke","send"}),"leaf facts must precede page delivery");
            order.Clear();sender.Initialize(null,f.Snapshot);Require(order.FirstOrDefault()=="revoke","legacy context revokes native input");
        });
        Console.WriteLine($"{passed}/{total} runtime message checks passed");if(passed!=total)throw new Exception("runtime message checks failed");
    }
    internal static IpcMessage Roundtrip(IpcMessage value)=>JsonConvert.DeserializeObject<IpcMessage>(JsonConvert.SerializeObject(value),new IpcMessageConverter())!;
    internal static (RoomRuntimeContext Context,RoomSessionSnapshot Snapshot) Fixture()
    {
        var room="231db51a-19db-4a3a-9c06-dbb9b3db86f9";
        using var manifest=JsonDocument.Parse("""
            {"version":3,"apiVersion":1,"id":"231db51a-19db-4a3a-9c06-dbb9b3db86f9","name":"\u65e5\u671f2026-10-03T01:02:03Z","startDesk":"home",
             "resources":["scene/index.html"],"desks":[{"id":"home"},{"id":"focus"}],
             "components":[{"id":"clock","config":{"date":"2026-10-03T01:02:03Z","empty":null}}]}
            """);
        using var inventory=JsonDocument.Parse("[{\"path\":\"scene/index.html\",\"sha256\":\""+new string('a',64)+"\",\"size\":12}]");
        var context=RoomRuntimeContext.FromVerifiedManifest(manifest.RootElement,inventory.RootElement,"wire-installation");
        var snap=new RoomSessionSnapshot(1,Guid.NewGuid(),room,"home",null,null,null,1,true,null){InstallationStamp=context.InstallationStamp,Lifecycle=new(RoomLifecycleStage.Desktop,false,false,1)};
        return(context,snap);
    }
    internal static LivelyMessageRoomRuntime ContextMessage(RoomRuntimeContext context,RoomSessionSnapshot snapshot,long generation)
    {
        var messages=new List<IpcMessage>();var sender=new RoomSessionPlayerMessages(messages.Add,()=>generation,["home","focus"]);
        sender.Initialize(context,snapshot);return(LivelyMessageRoomRuntime)messages.Single();
    }
    private static void Require(bool ok,string detail){if(!ok)throw new Exception(detail);}
}
