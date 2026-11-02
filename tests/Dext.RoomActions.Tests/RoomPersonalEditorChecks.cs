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
  check("context polling does not read private file but dispatch still rechecks it",()=>{
   using var f=new ActionFixture();f.Store.SetDesktopSync(Room,"home",true,Array.Empty<string>());
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("poll","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   using(var held=new FileStream(Path.Combine(f.PersonalPath,"personal.json"),FileMode.Open,FileAccess.ReadWrite,FileShare.None)){
    Eq("poll",f.Actions.CaptureDesktopMenuScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision)?.ContextId);
    Eq(RoomActionStatus.StorageUnavailable,f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"poll","home"));
   }
   f.Actions.ClearDesktopPresentation();Eq<RoomDesktopMenuScope?>(null,f.Actions.CaptureDesktopMenuScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision));
  });
  check("background paste follows refresh on same Desk but stops when sync is disabled",()=>{
   using var f=new ActionFixture();f.Store.SetDesktopSync(Room,"home",true,Array.Empty<string>());
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("before","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   Eq(RoomActionStatus.Accepted,f.Actions.CheckDesktopTransferScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"home"));
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("after","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   Eq(RoomActionStatus.NotOperable,f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"before","home"));
   Eq(RoomActionStatus.Accepted,f.Actions.CheckDesktopTransferScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"home"));
   Eq(RoomActionStatus.NotOperable,f.Actions.CheckDesktopTransferScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"other"));
   f.Store.SetDesktopSync(Room,"home",false);
   Eq(RoomActionStatus.NotOperable,f.Actions.CheckDesktopTransferScope(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"home"));
  });
  check("synced desktop file layout persists and disabled sync rejects movement",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('a',64);
   f.Store.SetDesktopSync(Room,"home",true,new[]{id});
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",new[]{new RoomDesktopViewItem(id,"File.txt","file",0,null)},0,false));
   var change=new RoomLayoutChange("icon",id,"home",240,360);
   var reply=f.Actions.SaveLayout(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,0,change);
   Eq(RoomActionStatus.Accepted,reply.Status);Eq(new RoomLayoutPosition(240,360),reply.Layout!.Icons["home"][id]);
   var read=f.Actions.ReadLayout(f.View,f.Peer,f.Session,f.Kernel.Snapshot.Revision);
   Eq(new RoomLayoutPosition(240,360),read.Layout!.Icons["home"][id]);
   f.Store.SetDesktopSync(Room,"home",false);
   Eq(RoomActionStatus.Denied,f.Actions.SaveLayout(f.View,f.Peer,f.Session,f.Kernel.Snapshot.Revision,1,change with{X=300}).Status);
  });
  check("empty desktop paste command accepts only native activation in the current enabled scope",()=>{
   using var f=new ActionFixture();const string id="desktop.paste";
   f.Store.SetDesktopSync(Room,"home",true,Array.Empty<string>());
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("empty","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.empty/"+id)});
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   var proof=input.State!.Completed!;
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeDesktopPaste(f.View,f.Peer,f.Session,proof));Eq(true,proof.IsConsumed);
   Eq(RoomActionStatus.StaleInput,f.Actions.AuthorizeDesktopPaste(f.View,f.Peer,f.Session,proof));
   foreach(var key in new[]{13,32,86}){
    input.Key(viewport,key,true,false,true,key==86?1:0);input.Key(viewport,key,false,false,true,0);
    Eq(key,input.State!.Completed!.Key);
    Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeDesktopPaste(f.View,f.Peer,f.Session,input.State.Completed));
   }
   f.Store.SetDesktopSync(Room,"home",false);
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   Eq(RoomActionStatus.NotOperable,f.Actions.AuthorizeDesktopPaste(f.View,f.Peer,f.Session,input.State!.Completed!));
   Eq(0,f.Launched.Count);
  });
  check("Menu key and Shift F10 prepare current files once without launching",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('d',64);
   f.Store.SetDesktopSync(Room,"home",true,new[]{id});
   var target=new PersonalTarget("File.txt","file",@"C:\Temp\File.txt");
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",new[]{new RoomDesktopViewItem(id,"File.txt","file",0,null)},0,false),new Dictionary<string,PersonalTarget>{{id,target}});
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.scan/"+id)});
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   input.Key(viewport,121,true,false,true,0);input.Key(viewport,121,false,false,true,0);
   Eq(RoomActionStatus.NotOperable,f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,input.State!.Completed!,new[]{id}).Status);
   input.Key(viewport,121,true,false,true,2);input.Key(viewport,121,false,false,true,0);
   Eq(121,input.State!.Completed!.Key);
   var proof=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.InvokeDesktop(f.View,f.Peer,f.Session,proof).Status);
   var prepared=f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,proof,new[]{id});
   Eq(RoomActionStatus.Accepted,prepared.Status);Eq(target,prepared.Targets!.Single());Eq(true,proof.IsConsumed);
   Eq(RoomActionStatus.StaleInput,f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,proof,new[]{id}).Status);Eq(0,f.Launched.Count);
   input.Key(viewport,93,true,false,true,0);input.Key(viewport,93,false,false,true,0);
   Eq(93,input.State!.Completed!.Key);
   Eq(RoomActionStatus.Accepted,f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,input.State.Completed,new[]{id}).Status);
  });
  check("right pointer proof prepares menu once without permitting file launch",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('e',64);
   f.Store.SetDesktopSync(Room,"home",true,new[]{id});var target=new PersonalTarget("File.txt","file",@"C:\Temp\File.txt");
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",new[]{new RoomDesktopViewItem(id,"File.txt","file",0,null)},0,false),new Dictionary<string,PersonalTarget>{{id,target}});
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);var v=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,v,new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.scan/"+id)});
   var sequence=input.ContextDown(v,1,f.Kernel.Snapshot.Revision,1,f.Clock.GetTimestamp(),200,100,id,"desktop.scan/"+id,true);
   input.ContextUp(v,sequence,200,100,true,false);var proof=input.State!.Completed!;
   Eq(true,proof.ContextMenu);Eq(RoomActionStatus.NotOperable,f.Actions.InvokeDesktop(f.View,f.Peer,f.Session,proof).Status);
   var reply=f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,proof,new[]{id});Eq(RoomActionStatus.Accepted,reply.Status);Eq(target,reply.Targets!.Single());
   Eq(RoomActionStatus.StaleInput,f.Actions.PrepareDesktopMenu(f.View,f.Peer,f.Session,proof,new[]{id}).Status);Eq(0,f.Launched.Count);
  });
  check("Delete prepares the selected files once and Shift Delete cannot prepare deletion",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('d',64);
   f.Store.SetDesktopSync(Room,"home",true,new[]{id});
   var target=new PersonalTarget("File.txt","file",@"C:\Temp\File.txt");
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",new[]{new RoomDesktopViewItem(id,"File.txt","file",0,null)},0,false),new Dictionary<string,PersonalTarget>{{id,target}});
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.scan/"+id)});
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   input.Key(viewport,46,true,false,true,2);input.Key(viewport,46,false,false,true,0);
   Eq(46,input.State!.Completed!.Key);Eq(2,input.State.Completed.Modifiers);
   Eq(RoomActionStatus.NotOperable,f.Actions.PrepareDesktopDelete(f.View,f.Peer,f.Session,input.State.Completed,new[]{id}).Status);
   Eq(false,input.State.Completed.IsConsumed);
   input.Key(viewport,46,true,false,true,0);input.Key(viewport,46,false,false,true,0);
   var proof=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.InvokeDesktop(f.View,f.Peer,f.Session,proof).Status);
   var prepared=f.Actions.PrepareDesktopDelete(f.View,f.Peer,f.Session,proof,new[]{id});
   Eq(RoomActionStatus.Accepted,prepared.Status);Eq(target,prepared.Targets!.Single());Eq(true,proof.IsConsumed);
   Eq(RoomActionStatus.StaleInput,f.Actions.PrepareDesktopDelete(f.View,f.Peer,f.Session,proof,new[]{id}).Status);Eq(0,f.Launched.Count);
  });
  check("F2 resolves current desktop file without launching and consumes its proof",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('a',64);
   f.Store.SetDesktopSync(Room,"home",true,new[]{id});
   var target=new PersonalTarget("Notes.txt","file",@"C:\Temp\Notes.txt");
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",new[]{new RoomDesktopViewItem(id,"Notes.txt","file",0,null)},0,false),new Dictionary<string,PersonalTarget>{{id,target}});
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.scan/"+id)});
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   var mouse=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.PrepareDesktopRename(f.View,f.Peer,f.Session,mouse).Status);
   input.Key(viewport,113,true,false,true);input.Key(viewport,113,false,false,true);
   var proof=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.InvokeDesktop(f.View,f.Peer,f.Session,proof).Status);
   Eq(false,proof.IsConsumed);
   var prepared=f.Actions.PrepareDesktopRename(f.View,f.Peer,f.Session,proof);
   Eq(RoomActionStatus.Accepted,prepared.Status);Eq(target,prepared.Target);Eq(0,f.Launched.Count);Eq(true,proof.IsConsumed);
   Eq(RoomActionStatus.StaleInput,f.Actions.PrepareDesktopRename(f.View,f.Peer,f.Session,proof).Status);
  });
  check("native Enter opens all current selected files once with one consumed proof",()=>{
   using var f=new ActionFixture();var ids=new[]{"desktop-"+new string('a',64),"desktop-"+new string('b',64)};
   f.Store.SetDesktopSync(Room,"home",true,ids);
   var targets=ids.Select((id,i)=>new PersonalTarget("File"+i,"file",@"C:\Temp\File"+i+".txt")).ToArray();
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new RoomDesktopView("scan","home",ids.Select((id,i)=>new RoomDesktopViewItem(id,"File"+i,"file",i,null)).ToArray(),0,false),ids.Select((id,i)=>(id,i)).ToDictionary(x=>x.id,x=>targets[x.i]));
   var input=new RoomNativeInputAuthority(f.Clock);input.Initialize(1,f.Kernel.Snapshot!);
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
   input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,new[]{new RoomNativeButton("official.desktop",ids[1],.1,.1,.2,.3,0,"desktop.scan/"+ids[1])});
   input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   input.Key(viewport,13,true,false,true);input.Key(viewport,13,false,false,true);
   var proof=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.OpenDesktopSelection(f.View,f.Peer,f.Session,proof,new[]{ids[1],"desktop-missing"}).Status);
   Eq(0,f.Launched.Count);Eq(false,proof.IsConsumed);
   Eq(RoomActionStatus.Accepted,f.Actions.OpenDesktopSelection(f.View,f.Peer,f.Session,proof,ids).Status);
   Eq(2,f.Launched.Count);Eq(targets[0],f.Launched[0]);Eq(targets[1],f.Launched[1]);Eq(true,proof.IsConsumed);
   Eq(RoomActionStatus.StaleInput,f.Actions.OpenDesktopSelection(f.View,f.Peer,f.Session,proof,ids).Status);Eq(2,f.Launched.Count);
   input.Key(viewport,13,true,false,true);input.Key(viewport,13,false,false,true);
   var next=input.State!.Completed!;
   Eq(RoomActionStatus.Cancelled,f.Actions.OpenDesktopSelection(f.View,f.Peer,f.Session,next,ids,()=>f.Launched.Count<3).Status);
   Eq(3,f.Launched.Count);Eq(targets[0],f.Launched[2]);
   input.Key(viewport,67,true,false,true,1);input.Key(viewport,67,false,false,true,0);
   var copyProof=input.State!.Completed!;
   Eq(RoomActionStatus.NotOperable,f.Actions.PrepareDesktopClipboard(f.View,f.Peer,f.Session,copyProof,ids,true).Status);
   Eq(false,copyProof.IsConsumed);
   var copy=f.Actions.PrepareDesktopClipboard(f.View,f.Peer,f.Session,copyProof,ids,false);
   Eq(RoomActionStatus.Accepted,copy.Status);Eq(2,copy.Targets!.Length);Eq(targets[1],copy.Targets[1]);Eq(3,f.Launched.Count);
   input.Key(viewport,88,true,false,true,1);input.Key(viewport,88,false,false,true,0);
   var cut=f.Actions.PrepareDesktopClipboard(f.View,f.Peer,f.Session,input.State!.Completed!,ids,true);
   Eq(RoomActionStatus.Accepted,cut.Status);Eq(2,cut.Targets!.Length);Eq(3,f.Launched.Count);
   input.Key(viewport,86,true,false,true,1);input.Key(viewport,86,false,false,true,0);
   var pasteProof=input.State!.Completed!;
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeDesktopPaste(f.View,f.Peer,f.Session,pasteProof));
   Eq(true,pasteProof.IsConsumed);Eq(3,f.Launched.Count);




  });
  check("completed drop placement persists and disabled Desk rejects late placement",()=>{
   using var f=new ActionFixture();var id="desktop-"+new string('e',64);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   Eq(RoomActionStatus.Accepted,f.Actions.PlaceDesktopDrop(f.View,f.Peer,f.Session,"home",new[]{id},19,4,10));
   Eq(19,new RoomPersonalStore(f.PersonalPath).ReadDesktopSync(Room)!.Slots[id]);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=false}));var revision=f.Store.Read().Revision;
   Eq(RoomActionStatus.NotOperable,f.Actions.PlaceDesktopDrop(f.View,f.Peer,f.Session,"home",new[]{id},2,4,10));
   Eq(revision,f.Store.Read().Revision);Eq(19,f.Store.ReadDesktopSync(Room)!.Slots[id]);
  });  check("desktop sync editor selects one real Desk and disable preserves private slots",()=>{
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
  check("Core scan commit carries rename slots through private storage",()=>{
   using var f=new ActionFixture();var old="desktop-"+new string('a',64);var renamed="desktop-"+new string('b',64);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   f.Actions.CommitDesktopScan(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),Editor(Read(f)).Revision,"home",new[]{old},true);
   var slot=f.Store.ReadDesktopSync(Room)!.Slots[old];
   var next=f.Actions.CommitDesktopScan(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),Editor(Read(f)).Revision,"home",new[]{renamed},true,new Dictionary<string,string>{{old,renamed}});
   Eq(slot,next!.Slots[renamed]);Eq(false,next.Slots.ContainsKey(old));Eq(slot,f.Store.ReadDesktopSync(Room)!.Slots[renamed]);
  });
  check("desktop surface spans Room desks while file drops stay on the synced desk",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("drop-view","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   RoomActionStatus Surface()=>f.Actions.CheckDesktopSurface(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision);
   Eq(RoomActionStatus.Accepted,Surface());
   Eq(RoomProtocolStatus.Accepted,f.Gateway.Request(f.View,f.Peer,f.Session,"focus").Status);
   Eq(RoomActionStatus.Accepted,Surface());
   Eq(true,f.Kernel.Complete(f.Session,f.Kernel.Snapshot!.TransitionId!.Value));
   Eq(RoomActionStatus.Accepted,Surface());
   Eq(RoomActionStatus.NotOperable,f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"drop-view","focus"));
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=false}));Eq(RoomActionStatus.NotOperable,Surface());
  });
  check("desktop drop checks current sync page while Explorer owns foreground",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("drop-view","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   RoomActionStatus Drop(string context="drop-view",string desk="home")=>f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,context,desk);
   Eq(RoomActionStatus.Accepted,Drop());
   f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(true,false,false));
   Eq(RoomActionStatus.Accepted,Drop());
   Eq(RoomActionStatus.NotOperable,Drop("old-view"));Eq(RoomActionStatus.NotOperable,Drop(desk:"focus"));
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=false}));Eq(RoomActionStatus.NotOperable,Drop());
  });
  check("desktop drop refuses locked desktop and stale snapshot",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("drop-view","home",Array.Empty<RoomDesktopViewItem>(),0,false));
   var before=f.Kernel.Snapshot!.Revision;f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,true,true));
   Eq(RoomActionStatus.StaleInput,f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,before,"drop-view","home"));
   Eq(RoomActionStatus.NotOperable,f.Actions.CheckDesktopDrop(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"drop-view","home"));
  });
  check("official desktop presentation transfers icons once and clears disabled or replaced contexts",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   var item=new RoomDesktopViewItem("desktop-"+new string('a',64),"File.txt","file",0,null);
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),new("context","home",new[]{item},0,false));
   RoomDesktopView? View(string? cached=null)=>f.Actions.ReadPresentation(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,cached).Presentation!.Desktop;
   Eq(1,View()!.Items!.Count);Eq<IReadOnlyList<RoomDesktopViewItem>?>(null,View("context")!.Items);Eq("context",View("context")!.ContextId);
   Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=false}));Eq<RoomDesktopView?>(null,View());
   Editor(Edit(f,new{operation="setDesktopSync",deskId="focus",enabled=true}));Eq<RoomDesktopView?>(null,View());
   f.Actions.ClearDesktopPresentation();Eq<RoomDesktopView?>(null,View());
  });
  check("real desktop native pairing opens the mapped file once and old contexts stop opening",()=>{
   using var f=new ActionFixture();Editor(Edit(f,new{operation="setDesktopSync",deskId="home",enabled=true}));
   var id="desktop-"+new string('c',64);var view=new RoomDesktopView("scan1","home",new[]{new RoomDesktopViewItem(id,"File.txt","file",0,null)},0,false);
   f.Actions.PublishDesktopPresentation(f.Session,Room,Stamp(f),view,new Dictionary<string,PersonalTarget>{{id,new("File.txt","file",@"C:\Users\Public\Desktop\File.txt")}});
   var input=f.Actions.CreateNativeInput();input.Initialize(1,f.Kernel.Snapshot!);
   Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,input.ObserveSnapshot,out var bridge));
   using(bridge){
    var viewport=new RoomNativeViewport((nint)10,100,200,1000,1000,8);var revision=f.Kernel.Snapshot!.Revision;
    var entries=new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.2,0,"desktop.scan1/"+id)};
    Eq(true,bridge!.PublishNativeGeometry(input,1,f.Session,revision,1,viewport,entries,actions:f.Actions));
    input.MouseDown(viewport,300,400,true);input.MouseUp(viewport,300,400,true);var sequence=input.State!.Completed!.Sequence;
    Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,"official.desktop",id,sequence).Status);
    Eq(1,f.Launched.Count);Eq(@"C:\Users\Public\Desktop\File.txt",f.Launched[0].Target);
    Eq(RoomActionStatus.StaleInput,bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,"official.desktop",id,sequence).Status);
    f.Actions.ClearDesktopPresentation();Eq(false,bridge.PublishNativeGeometry(input,1,f.Session,revision,2,viewport,entries,actions:f.Actions));
   }
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
  check("editor lists long-press layout and restore clears that L2 item",()=>{
   using var f=new ActionFixture();
   f.Store.Update(s=>{
    if(!s.Rooms.TryGetValue(Room,out var data))s.Rooms[Room]=data=new RoomPersonalData();
    data.Layout.Icons["home"]=new(){["icon-a"]=new(12,34)};
    data.Layout.Components["widget-a"]=new(1,2,30,40);
   });
   var layout=Editor(Read(f)).Layout!;
   Eq(true,layout.Any(item=>item.Kind=="icon"&&item.Id=="icon-a"&&item.DeskId=="home"&&item.X==12&&item.Y==34));
   Eq(true,layout.Any(item=>item.Kind=="component"&&item.Id=="widget-a"));
   Editor(Edit(f,new{operation="resetLayoutItem",kind="icon",id="icon-a",deskId="home"}));
   Eq(false,Editor(Read(f)).Layout!.Any(item=>item.Id=="icon-a"));
   Eq(false,f.Store.Read().Rooms[Room].Layout.Icons.ContainsKey("home"));
   Editor(Edit(f,new{operation="resetLayoutItem",kind="component",id="widget-a",deskId=(string?)null}));
   Eq(0,Editor(Read(f)).Layout!.Length);
  });
 }
}
