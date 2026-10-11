using Dext.Core.Rooms;
using System.Text.Json;
void Check(bool pass,string label) { if(!pass) throw new Exception(label); Console.WriteLine("PASS "+label); }
using var document=JsonDocument.Parse("""{"desks":[{"id":"one","name":"一"},{"id":"two","name":"二"},{"id":"three","name":"三"}]}""");
var manifest=document.RootElement;
var store=new MemoryStore();
using var kernel=new RoomSessionKernel(store);
var snapshot=kernel.Start("test",["one","two","three"],"one");
var nav=RoomDockNavigation.Create(snapshot,manifest);
Check(nav.CurrentName=="一" && nav.CanNavigate,"verified names and active navigation");
Check(nav.MatchesPinEdit(snapshot.SessionId, snapshot.RoomId, "one"),"pin scope uses current stable identities");
Check(!nav.MatchesPinEdit(Guid.NewGuid(), snapshot.RoomId, "one") && !nav.MatchesPinEdit(snapshot.SessionId, "other", "one") && !nav.MatchesPinEdit(snapshot.SessionId, snapshot.RoomId, "two"),"stale session Room and Desk rejected");
Check(nav.Target(-1)=="three" && nav.Target(1)=="two","both wrap directions");
Check(nav.Target(0)==null && nav.Target(2)==null,"invalid direction rejected");
kernel.RequestFromDock(snapshot.SessionId,nav.Target(1)!);
nav=RoomDockNavigation.Create(kernel.Snapshot!,manifest);
Check(nav.CurrentDeskId=="one" && !nav.MatchesPinEdit(snapshot.SessionId,snapshot.RoomId,"one"),"pending transition keeps old list and blocks edits");
Check(nav.CurrentName=="一" && nav.PendingName=="二" && nav.Target(1)=="three","current label is committed and next uses transition target");
kernel.RequestFromDock(snapshot.SessionId,nav.Target(1)!);
Check(kernel.Snapshot!.QueuedDeskId=="three","rapid click follows existing last request queue");
kernel.SetOperable(snapshot.SessionId,false);
nav=RoomDockNavigation.Create(kernel.Snapshot!,manifest);
var reply=kernel.RequestFromDock(snapshot.SessionId,nav.Target(1)!);
Check(reply.Status==RoomCommandStatus.Accepted && reply.Snapshot!.TargetDeskId==null && store.Value!.DeskId==reply.Snapshot.CurrentDeskId,"background navigation commits without animation wait");
Check(kernel.RequestFromDock(Guid.NewGuid(),"one").Status==RoomCommandStatus.Rejected,"stale session cannot navigate");
nav=RoomDockNavigation.Create(snapshot with {Lifecycle=new(RoomLifecycleStage.Desktop,false,true,1)},manifest);
Check(!nav.CanNavigate && nav.Target(1)==null,"locked navigation disabled");
nav=RoomDockNavigation.Create(snapshot with {Lifecycle=new(RoomLifecycleStage.Idle,false,false,1)},manifest);
Check(!nav.CanNavigate,"idle navigation disabled");
nav=RoomDockNavigation.Create(snapshot with {IsActive=false},manifest);
Check(!nav.CanNavigate,"retired navigation disabled");
sealed class MemoryStore:IRoomSessionCheckpointStore {
 public RoomSessionCheckpoint? Value;
 public RoomSessionCheckpoint? Read()=>Value;
 public void Write(RoomSessionCheckpoint value)=>Value=value;
 public void Clear()=>Value=null;
}
