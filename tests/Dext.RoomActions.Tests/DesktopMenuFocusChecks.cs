using Dext.Core.Rooms;
internal static class DesktopMenuFocusChecks
{
 internal static void Run()
 {
  var count=0;var clock=new Clock();
  void Require(bool ok,string detail){if(!ok)throw new Exception(detail);}
  void Check(string name,Action run){run();count++;Console.WriteLine("PASS "+name);}
  var session=Guid.NewGuid();var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
  var snap=new RoomSessionSnapshot(1,session,"room","home",null,null,null,1,false,null){InstallationStamp="stamp",IsDesktopForeground=false};
  RoomNativeButton[] regions=[new("official.desktop","desktop-a",.1,.1,.2,.3,0,"entry")];
  (RoomNativeInputAuthority Input,RoomNativeInputProof Proof) Create(){
   var input=new RoomNativeInputAuthority(clock);input.Initialize(1,snap);input.PublishGeometry(1,session,1,1,viewport,regions);
   var seq=input.ContextDown(viewport,1,1,1,clock.GetTimestamp(),200,100,"desktop-a","entry",true);
   input.ContextUp(viewport,seq,200,100,true,false);var proof=input.State!.Completed!;
   Require(proof.Validate(snap,"official.desktop","desktop-a",true),"menu admission");
   input.QueueDesktopMenuFocus(1,session,"home",viewport,proof);
   return(input,proof);
  }
  void Publish(RoomNativeInputAuthority input,RoomSessionSnapshot? next=null,RoomNativeViewport? bounds=null,RoomNativeButton[]? buttons=null){
   var current=next??snap with{Revision=2,IsDesktopForeground=true};input.ObserveSnapshot(current);
   input.PublishGeometry(1,session,current.Revision,2,bounds??viewport,buttons??regions);
  }
  Check("menu return waits for foreground geometry then restores focus without action",()=>{
   var (input,proof)=Create();Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"background snapshot cannot restore");
   Publish(input);Require(input.TryRestoreDesktopMenuFocus(viewport,true),"foreground file focus missing");
   Require(input.State!.Focus?.Button=="desktop-a"&&input.State.Completed is null&&input.State.Gesture is null,"focus must not mint input");
   Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"restore one use");
   input.Key(viewport,13,true,false,true);input.Key(viewport,13,false,false,true);
   Require(input.State!.Completed is{Key:13},"fresh physical key works");
  });
  Check("outside application cancels return even when snapshot still says desktop",()=>{
   var (input,_)=Create();Publish(input);Require(!input.TryRestoreDesktopMenuFocus(viewport,false),"application stolen");
   Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"stale intent returned");
  });
  Check("new click or key supersedes menu return",()=>{
   foreach(var keyboard in new[]{false,true}){var (input,_)=Create();
    if(keyboard)input.Key(viewport,9,true,false,false);else input.MouseDown(viewport,900,400,false);
    Publish(input);Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"new input superseded");}
  });
  Check("desk switch lock transition and document retire return intent",()=>{
   foreach(var mode in new[]{0,1,2,3}){var (input,_)=Create();
    var next=mode==0?snap with{CurrentDeskId="other",Revision=2}:mode==1?snap with{Revision=2,Lifecycle=snap.Lifecycle with{Locked=true}}:snap with{Revision=2,TransitionId=Guid.NewGuid()};
    if(mode==3)input.Initialize(2,snap);else input.ObserveSnapshot(next);
    var current=snap with{Revision=3,IsDesktopForeground=true};input.ObserveSnapshot(current);
    input.PublishGeometry(mode==3?2:1,session,3,3,viewport,regions);
    Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"scope change survived");}
  });
  Check("moved viewport and removed file cannot recover stale focus",()=>{
   foreach(var moved in new[]{false,true}){var(input,_)=Create();var bounds=moved?viewport with{X=50}:viewport;
    Publish(input,bounds:bounds,buttons:moved?regions:[]);Require(!input.TryRestoreDesktopMenuFocus(bounds,true),"stale region restored");}
  });
  Check("late geometry expires the return intent",()=>{
   var(input,_)=Create();clock.Now+=2000;Publish(input);Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"expired focus restored");
  });
  Check("new physical gesture while menu was open prevents rearming old focus",()=>{
   var(input,proof)=Create();Publish(input);input.MouseDown(viewport,200,100,true);input.MouseUp(viewport,200,100,true);
   input.QueueDesktopMenuFocus(1,session,"home",viewport,proof);
   Require(!input.TryRestoreDesktopMenuFocus(viewport,true),"old menu overwrote newer input");
  });
  Console.WriteLine($"{count}/{count} desktop menu focus checks passed");
 }
 private sealed class Clock:TimeProvider{public long Now;public override long TimestampFrequency=>1000;public override long GetTimestamp()=>Now;}
}
