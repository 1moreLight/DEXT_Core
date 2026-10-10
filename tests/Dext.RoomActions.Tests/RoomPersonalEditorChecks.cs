using Dext.Core.Rooms;
using System.Text.Json;
static partial class RoomActionChecks
{
 public static void PersonalEditorChecks(Action<string,Action> check)
 {
  static string Stamp(ActionFixture f)=>f.Kernel.Snapshot!.InstallationStamp;
  static RoomPersonalEditorReply Read(ActionFixture f)=>f.Actions.GetPersonalEditor(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f));
  static RoomPersonalEditorReply Edit(ActionFixture f,object edit)=>f.Actions.EditPersonal(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),JsonSerializer.Serialize(edit));
  static RoomPersonalEditorSnapshot Editor(RoomPersonalEditorReply r){Eq("accepted",r.Status);return r.Editor!;}
  check("desktop sync editor selects one real Desk and disable preserves private slots",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('a',64);
   f.Store.SetDesktopSync(Room,"home",false,new[]{id});
   Editor(Edit(f,new{operation="setDesktopSync",deskId="focus",enabled=true}));
   var saved=new RoomPersonalStore(f.PersonalPath).ReadDesktopSync(Room)!;
   Eq(true,saved.Enabled);Eq("focus",saved.DeskId);Eq(1,saved.Slots.Count);
   var projected=Editor(Read(f)).DesktopSync!;Eq(true,projected.Enabled);Eq("focus",projected.DeskId);Eq(1,projected.ItemCount);
   var revision=f.Store.Read().Revision;
   Editor(Edit(f,new{operation="setDesktopSync",deskId="focus",enabled=true}));
   Eq(revision,f.Store.Read().Revision);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="focus",enabled=false}));
   Eq(false,f.Store.ReadDesktopSync(Room)!.Enabled);Eq(1,f.Store.ReadDesktopSync(Room)!.Slots.Count);
   Eq(true,Editor(Read(f)).Buttons.Single(b=>b.Id=="open").IsBound);
  });
  check("desktop sync editor rejects missing setting or nonexistent Desk without writing",()=>{
   using var f=new ActionFixture();var before=f.Store.Read().Revision;
   foreach(var edit in new object[]{new{operation="setDesktopSync",deskId="missing",enabled=true},
      new{operation="setDesktopSync",deskId="home"},new{operation="setDesktopSync",enabled=true}})
    Eq("denied",Edit(f,edit).Status);
   Eq(before,f.Store.Read().Revision);
  });
  check("Core scan commit preserves current selection and refuses an obsolete scan",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('b',64);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   var revision=Editor(Read(f)).Revision;
   var slots=f.Actions.CommitDesktopScan(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),revision,"home",new[]{id},true);
   Eq(1,slots!.Slots.Count);Eq(1,Editor(Read(f)).DesktopSync!.ItemCount);
   Eq<RoomDesktopSync?>(null,f.Actions.CommitDesktopScan(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),revision,"home",Array.Empty<string>(),true));
   revision=Editor(Read(f)).Revision;
   Editor(Edit(f,new{operation="setDesktopSync",deskId="focus",enabled=true}));
   Eq<RoomDesktopSync?>(null,f.Actions.CommitDesktopScan(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),revision,"home",Array.Empty<string>(),true));
   Eq("focus",f.Store.ReadDesktopSync(Room)!.DeskId);Eq(1,f.Store.ReadDesktopSync(Room)!.Slots.Count);
   revision=Editor(Read(f)).Revision;
   Editor(Edit(f,new{operation="refreshDesktopSync"}));Eq(revision,Editor(Read(f)).Revision);
  });
  check("applying fresh Room enables navigation without granting application launch",()=>{
   using var f=new ActionFixture();f.Store.Update(s=>{s.Rooms.Clear();s.Targets.Clear();});
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","desk.navigate"));
   Editor(Edit(f,new{operation="enableNavigation"}));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","desk.navigate"));
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
   Eq(0,f.Store.Read().Rooms[Room].Buttons.Count);
   Eq(RoomActionStatus.Accepted,f.Invoke("next",f.Input("next").Ticket).Status);
   Eq("focus",f.Kernel.Snapshot!.TargetDeskId);
  });
  check("editor discovers every declared button including unbound and other Desk",()=>{
   using var f=new ActionFixture();var value=Editor(Read(f));
   Eq(6,value.Buttons.Length);Eq(false,value.Buttons.Single(b=>b.Id=="unbound").IsBound);
   Eq("focus",value.Buttons.Single(b=>b.Id=="focus-only").Scope);
   Eq(Target,value.Buttons.Single(b=>b.Id=="open").Personal!.TargetId);
   Eq(@"C:\Windows\System32\notepad.exe",value.Targets.Single(t=>t.Id==Target).Target);
  });
  check("two presentation buttons bind the same stable global target",()=>{
   using var f=new ActionFixture();var id=Guid.NewGuid().ToString();
   Editor(Edit(f,new{operation="upsertTarget",targetId=id,name="Document",kind="file",target=@"C:\Users\Public\document.txt"}));
   foreach(var button in new[]{"open","icon"})Editor(Edit(f,new{operation="setButton",buttonId=button,action="binding.launch",targetId=id,skin="glass"}));
   var value=Editor(Read(f));Eq(2,value.Targets.Single(t=>t.Id==id).UseCount);
   Eq(RoomActionStatus.Accepted,f.Invoke("open",f.Input("open").Ticket).Status);
   Eq(RoomActionStatus.Accepted,f.Invoke("icon",f.Input("icon").Ticket).Status);
   Eq(2,f.Launched.Count);Eq(f.Launched[0],f.Launched[1]);
  });
  check("action and skin persist privately and reset restores author without deleting target",()=>{
   using var f=new ActionFixture();var beforeStamp=Stamp(f);
   Editor(Edit(f,new{operation="setButton",buttonId="open",action="desk.go",deskId="focus",skin="outline"}));
   var reopened=new RoomPersonalStore(f.PersonalPath).Read().Rooms[Room].Buttons["open"];
   Eq("desk.go",reopened.Action);Eq("outline",reopened.Skin);
   var button=Editor(Read(f)).Buttons.Single(b=>b.Id=="open");Eq("binding.launch",button.DefaultAction);Eq("desk.go",button.EffectiveAction);Eq("focus",button.EffectiveDeskId);
   Editor(Edit(f,new{operation="resetButton",buttonId="open"}));
   button=Editor(Read(f)).Buttons.Single(b=>b.Id=="open");Eq("binding.launch",button.EffectiveAction);Eq<RoomPersonalButtonSettings?>(null,button.Personal);
   Eq(true,f.Store.Read().Targets.ContainsKey(Target));Eq(beforeStamp,Stamp(f));
  });
  check("global target update and deletion retain button actions skins and other targets",()=>{
   using var f=new ActionFixture();var other=Guid.NewGuid().ToString();var copyId=Guid.NewGuid().ToString();
   f.Store.Update(state=>{state.Targets[other]=new("Other","url","https://example.org");state.Rooms[copyId]=new();state.Rooms[copyId].Buttons["other"]=new(TargetId:Target,Skin:"glass");});
   Editor(Edit(f,new{operation="setButton",buttonId="icon",action="binding.launch",targetId=Target,skin="classic"}));
   Editor(Edit(f,new{operation="upsertTarget",targetId=Target,name="Notes updated",kind="application",target=@"C:\Windows\System32\notepad.exe",arguments="/a"}));
   Eq("Notes updated",Editor(Read(f)).Targets.Single(t=>t.Id==Target).Name);
   Editor(Edit(f,new{operation="removeTarget",targetId=Target}));
   var state=f.Store.Read();Eq(false,state.Targets.ContainsKey(Target));Eq(true,state.Targets.ContainsKey(other));Eq<string?>(null,state.Rooms[copyId].Buttons["other"].TargetId);Eq("glass",state.Rooms[copyId].Buttons["other"].Skin);
   Eq<string?>(null,state.Rooms[Room].Buttons["icon"].TargetId);Eq("classic",state.Rooms[Room].Buttons["icon"].Skin);Eq("binding.launch",state.Rooms[Room].Buttons["icon"].Action);
   Eq(false,Editor(Read(f)).Buttons.Single(b=>b.Id=="icon").IsBound);
  });
  check("explicit action enables declared consumers without promoting old controls or changing read grants",()=>{
   using var f=new ActionFixture(dataCapabilities:true,storageCapabilities:true,controlCapabilities:true,navigationDynamic:true);
   f.Store.Update(s=>{s.Rooms[Room].ReadGrants["scene"]=new(Stamp(f),new[]{"time.read"});s.Rooms[Room].Grants["scene"]=new("old-stamp",new[]{"audio.control","binding.launch","hardware.read"});});
   var before=f.Store.Read();
   Editor(Edit(f,new{operation="setButton",buttonId="open",action="binding.launch",targetId=Target,skin="glass"}));
   var after=f.Store.Read();Eq(JsonSerializer.Serialize(before.Rooms[Room].ReadGrants),JsonSerializer.Serialize(after.Rooms[Room].ReadGrants));
   Eq(JsonSerializer.Serialize(before.Rooms[Room].Layout),JsonSerializer.Serialize(after.Rooms[Room].Layout));Eq(JsonSerializer.Serialize(before.Rooms[Room].Storage),JsonSerializer.Serialize(after.Rooms[Room].Storage));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","audio.control"));
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","hardware.read"));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","time.read"));
  });
  check("configurator edits paused and publication failure leaves old exact file",()=>{
   using var f=new ActionFixture();f.Lifecycle(RoomLifecycleStage.Desktop,paused:true);
   Editor(Edit(f,new{operation="setButton",buttonId="open",action="binding.launch",targetId=Target,skin="glass"}));
   var file=Path.Combine(f.PersonalPath,"personal.json");var bytes=File.ReadAllBytes(file);
   using(var held=File.Open(file,FileMode.Open,FileAccess.Read,FileShare.Read))Eq("storageUnavailable",Edit(f,new{operation="setButton",buttonId="open",action="desk.next",skin="outline"}).Status);
   Eq(Convert.ToHexString(bytes),Convert.ToHexString(File.ReadAllBytes(file)));
   Eq("glass",Editor(Read(f)).Buttons.Single(b=>b.Id=="open").Personal!.Skin);
  });
  check("identical confirmed edit is a no-op and invalid Desk target preserves confirmed choice",()=>{
   using var f=new ActionFixture();var edit=new{operation="setButton",buttonId="open",action="desk.go",deskId="focus",skin="glass"};
   Editor(Edit(f,edit));var before=f.Store.Read().Revision;Editor(Edit(f,edit));Eq(before,f.Store.Read().Revision);
   Eq("denied",Edit(f,new{operation="setButton",buttonId="open",action="desk.go",deskId="missing",skin="glass"}).Status);
   Eq("focus",Editor(Read(f)).Buttons.Single(b=>b.Id=="open").EffectiveDeskId);Eq(before,f.Store.Read().Revision);
  });
  check("official presentation reads current private skins while paused without returning targets",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setButton",buttonId="open",skin="glass",targetId=Target}));
   f.Lifecycle(RoomLifecycleStage.Desktop,paused:true);
   var reply=f.Actions.ReadPresentation(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision);Eq(RoomActionStatus.Accepted,reply.Status);
   Eq("glass",reply.Presentation!.Skins["open"]);var json=JsonSerializer.Serialize(reply.Presentation);Eq(false,json.Contains(Target));Eq(false,json.Contains("notepad"));
  });
  check("button locator is ephemeral has no action and reports an inactive Desk",()=>{
   using var f=new ActionFixture();var revision=f.Store.Read().Revision;
   Editor(Edit(f,new{operation="locateButton",buttonId="open"}));
   var reply=f.Actions.ReadPresentation(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision);Eq(RoomActionStatus.Accepted,reply.Status);Eq("open",reply.Presentation!.Locator!.ButtonId);
   Eq(revision,f.Store.Read().Revision);Eq(0,f.Launched.Count);
   Eq("notOperable",Edit(f,new{operation="locateButton",buttonId="focus-only"}).Status);
  });
 }
}
