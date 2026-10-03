using Dext.Core.Rooms;
using System.Text.Json;

static partial class RoomActionChecks
{
    private static void LayoutChecks(Action<string, Action> check)
    {
        static long Revision(ActionFixture f) => f.Kernel.Snapshot!.Revision;
        static RoomLayoutChange Icon(double x=240,double y=360) => new("icon","icon-1","home",x,y);
        static RoomLayoutChange Widget() => new("widget","widget",null,500,200,300,180);
        static RoomLayoutReply Read(ActionFixture f) => f.Actions.ReadLayout(f.View,f.Peer,f.Session,Revision(f));
        static RoomLayoutReply Save(ActionFixture f,long expected,RoomLayoutChange? change=null) =>
            f.Actions.SaveLayout(f.View,f.Peer,f.Session,Revision(f),expected,change??Icon());

        check("private layout saves icon and shared Widget and reopens independent revision",()=>{
            using var f=new ActionFixture();Eq(0L,Read(f).Layout!.Revision);var original=f.Store.Read().Revision;
            Eq(RoomActionStatus.Accepted,Save(f,0).Status);Eq(RoomActionStatus.Accepted,Save(f,1,Widget()).Status);
            var saved=new RoomPersonalStore(f.PersonalPath).Read();Eq(original+2,saved.Revision);Eq(2L,saved.Rooms[Room].Layout.Revision);
            Eq(new RoomLayoutPosition(240,360),saved.Rooms[Room].Layout.Icons["home"]["icon-1"]);
            Eq(new RoomLayoutRectangle(500,200,300,180),Read(f).Layout!.Components["widget"]);
        });
        check("layout read is detached and contains no target binding grant or authored KV",()=>{
            using var f=new ActionFixture();Save(f,0);var result=Read(f);result.Layout!.Icons.Clear();
            Eq(1,Read(f).Layout!.Icons.Count);
            using var json=JsonDocument.Parse(JsonSerializer.Serialize(result.Layout));
            Eq(true,json.RootElement.EnumerateObject().Select(p=>p.Name).Order().SequenceEqual(new[]{"Components","Icons","Revision"}));
        });
        check("unrelated personal updates do not stale layout and unchanged layout does not write",()=>{
            using var f=new ActionFixture();Save(f,0);f.Store.Update(s=>s.Rooms[Room].Storage["scene"]=new());
            var before=f.Store.Read().Revision;
            Eq(RoomActionStatus.Accepted,Save(f,1).Status);Eq(before,f.Store.Read().Revision);Eq(1L,Read(f).Layout!.Revision);
            Eq(RoomActionStatus.Accepted,Save(f,1,Icon(300,360)).Status);Eq(before+1,f.Store.Read().Revision);
        });
        check("stale layout revision never replaces the committed geometry",()=>{
            using var f=new ActionFixture();Save(f,0);var path=Path.Combine(f.PersonalPath,"personal.json");var bytes=File.ReadAllBytes(path);
            Eq(RoomActionStatus.StaleInput,Save(f,0,Icon(500,500)).Status);Eq(true,bytes.SequenceEqual(File.ReadAllBytes(path)));
            Eq(new RoomLayoutPosition(240,360),Read(f).Layout!.Icons["home"]["icon-1"]);
        });
        check("layout rejects unknown scope items Dock scene and invalid canvas coordinates",()=>{
            using var f=new ActionFixture();var bytes=File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"));
            foreach(var change in new[]{Icon() with{DeskId="focus"},Icon() with{Id="absent"},Icon() with{Width=20},
                Widget() with{Id="scene"},Widget() with{DeskId="home"},Widget() with{Width=null},Widget() with{Kind="dock"},
                Icon(double.NaN),Icon(-1),Icon(1825),Icon(100,977),Widget() with{Width=0},Widget() with{X=1800},Widget() with{Height=double.PositiveInfinity}})
                Eq(RoomActionStatus.Denied,Save(f,0,change).Status);
            Eq(true,bytes.SequenceEqual(File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"))));
        });
        check("declared Dock placement cannot use private desktop Widget save",()=>{
            using var f=new ActionFixture(layoutDock:true);Eq(RoomActionStatus.Denied,Save(f,0,Widget()).Status);
        });
        check("inactive desktop stages pause lock and foreground reject layout save but retain private read",()=>{
            foreach(var condition in new[]{"start","idle","paused","locked","foreground","operable","transition"}){
                using var f=new ActionFixture(mediaSlots:true);f.Lifecycle(RoomLifecycleStage.Desktop);Save(f,0);
                switch(condition){
                    case "start":Eq(RoomProtocolStatus.Accepted,f.Gateway.BeginDocument(f.Coordinator,f.CorePeer,f.Session).Status);break;
                    case "idle":f.Lifecycle(RoomLifecycleStage.Idle);break;
                    case "paused":f.Lifecycle(RoomLifecycleStage.Desktop,true);break;
                    case "locked":f.Lifecycle(RoomLifecycleStage.Desktop,false,true);break;
                    case "foreground":f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));break;
                    case "operable":f.Gateway.SetOperable(f.Coordinator,f.CorePeer,f.Session,false);break;
                    case "transition":f.Gateway.Request(f.View,f.Peer,f.Session,"focus");break;
                }
                Eq(RoomActionStatus.Accepted,Read(f).Status);Eq(1L,Read(f).Layout!.Revision);
                Eq(RoomActionStatus.NotOperable,Save(f,1,Icon(500,500)).Status);Eq(1L,Read(f).Layout!.Revision);
            }
        });
        check("Dock Coordinator wrong peer stale session and old snapshot cannot read or write layout",()=>{
            using var f=new ActionFixture();
            var dockPeer=new RoomSessionPeer("dock");var dock=f.Gateway.Open(dockPeer,new(1,RoomClientRole.Dock,Room)).ConnectionId!.Value;
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadLayout(dock,dockPeer,f.Session,Revision(f)).Status);
            Eq(RoomActionStatus.Forbidden,f.Actions.SaveLayout(dock,dockPeer,f.Session,Revision(f),0,Icon()).Status);
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadLayout(f.Coordinator,f.CorePeer,f.Session,Revision(f)).Status);
            Eq(RoomActionStatus.StaleSession,f.Actions.ReadLayout(f.View,f.Peer,Guid.NewGuid(),Revision(f)).Status);
            Eq(RoomActionStatus.StaleInput,f.Actions.ReadLayout(f.View,f.Peer,f.Session,Revision(f)+1).Status);
            Eq(RoomActionStatus.StaleInput,f.Actions.SaveLayout(f.View,f.Peer,f.Session,Revision(f)+1,0,Icon()).Status);
            Eq(false,f.Actions.ReadLayout(f.View,new("wrong"),f.Session,Revision(f)).Status==RoomActionStatus.Accepted);
        });
        check("closed connection and installation withdrawal cannot save prior layout",()=>{
            using var f=new ActionFixture();Save(f,0);f.Admission.Enabled=false;
            Eq(false,Save(f,1,Icon(500,500)).Status==RoomActionStatus.Accepted);f.Admission.Enabled=true;
            f.Gateway.Close(f.View,f.Peer);Eq(RoomActionStatus.StaleSession,Save(f,1,Icon(500,500)).Status);
            Eq(1L,f.Store.Read().Rooms[Room].Layout.Revision);
        });
        check("blocked layout publication preserves bytes coordinates and both revisions",()=>{
            using var f=new ActionFixture();Save(f,0);var path=Path.Combine(f.PersonalPath,"personal.json");var bytes=File.ReadAllBytes(path);var before=f.Store.Read().Revision;
            using(var held=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read))Eq(RoomActionStatus.StorageUnavailable,Save(f,1,Icon(500,500)).Status);
            Eq(true,bytes.SequenceEqual(File.ReadAllBytes(path)));Eq(before,f.Store.Read().Revision);Eq(1L,Read(f).Layout!.Revision);
        });
        check("concurrent saves of one layout revision have only one winner",()=>{
            using var f=new ActionFixture();
            var results=Task.WhenAll(Task.Run(()=>Save(f,0,Icon(300,300))),Task.Run(()=>Save(f,0,Icon(600,600)))).GetAwaiter().GetResult();
            Eq(1,results.Count(r=>r.Status==RoomActionStatus.Accepted));Eq(1,results.Count(r=>r.Status==RoomActionStatus.StaleInput));Eq(1L,Read(f).Layout!.Revision);
        });
        check("layout projection drops orphan IDs without changing saved state",()=>{
            using var f=new ActionFixture();f.Store.Update(s=>{
                var layout=s.Rooms[Room].Layout;layout.Revision=7;layout.Icons["home"]=new(){{"removed",new(200,200)}};
                layout.Components["removed-widget"]=new(200,200,100,100);
            });
            var read=Read(f);Eq(7L,read.Layout!.Revision);Eq(0,read.Layout.Icons.Count);Eq(0,read.Layout.Components.Count);
            Eq(1,f.Store.Read().Rooms[Room].Layout.Components.Count);
        });
        check("private bridge layout is current and disposed bridge cannot read or save",()=>{
            using var f=new ActionFixture();Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));
            Eq(RoomActionStatus.Accepted,bridge!.NativeSaveLayout(f.Actions,f.Session,Revision(f),0,Icon()).Status);
            Eq(1L,bridge.NativeReadLayout(f.Actions,f.Session,Revision(f)).Layout!.Revision);bridge.Dispose();
            Eq(RoomActionStatus.StaleSession,bridge.NativeReadLayout(f.Actions,f.Session,Revision(f)).Status);
            Eq(RoomActionStatus.StaleSession,bridge.NativeSaveLayout(f.Actions,f.Session,Revision(f),1,Icon(500,500)).Status);Eq(1L,Read(f).Layout!.Revision);
        });
        check("old personal format without layout defaults empty without changing other data",()=>{
            using var f=new ActionFixture();var path=Path.Combine(f.PersonalPath,"personal.json");var json=System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(path))!;
            ((System.Text.Json.Nodes.JsonObject)json["rooms"]![Room]!).Remove("layout");File.WriteAllText(path,json.ToJsonString());
            Eq(0L,Read(f).Layout!.Revision);Eq(0,Read(f).Layout!.Icons.Count);Eq(Target,f.Store.Read().Rooms[Room].Buttons["icon"].TargetId);
            Eq(RoomActionStatus.Accepted,Save(f,0).Status);
        });
        check("copy keeps established binding semantics with fresh layout storage and consent",()=>{
            using var f=new ActionFixture();Save(f,0);const string copy="7265c092-080f-49cb-a001-56495511e9cc";f.Store.CopyRoom(Room,copy);
            var saved=f.Store.Read();Eq(0L,saved.Rooms[copy].Layout.Revision);Eq(0,saved.Rooms[copy].Layout.Icons.Count);
            Eq(0,saved.Rooms[copy].Grants.Count);Eq(0,saved.Rooms[copy].Storage.Count);Eq(Target,saved.Rooms[copy].Buttons["icon"].TargetId);
            f.Store.DeleteRoom(Room);Eq(true,f.Store.Read().Targets.ContainsKey(Target));
        });
        check("null or invalid persisted layout is rejected without clearing prior file",()=>{
            using var f=new ActionFixture();var path=Path.Combine(f.PersonalPath,"personal.json");
            foreach(var invalid in new[]{"null","{\"revision\":-1,\"icons\":{},\"components\":{}}","{\"revision\":0,\"icons\":null,\"components\":{}}"}){
                var state=System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(path))!;state["rooms"]![Room]!["layout"]=System.Text.Json.Nodes.JsonNode.Parse(invalid);
                File.WriteAllText(path,state.ToJsonString());var bytes=File.ReadAllBytes(path);
                Eq(RoomActionStatus.StorageUnavailable,Read(f).Status);Eq(RoomActionStatus.StorageUnavailable,Save(f,0).Status);
                Eq(true,bytes.SequenceEqual(File.ReadAllBytes(path)));
            }
        });
    }
}
