using Dext.Core.Rooms;
internal static class DesktopContextInputChecks
{
 internal static void Run()
 {
  var count=0;
  void Require(bool ok){if(!ok)throw new Exception("Unexpected native desktop context input");}
  void Check(string name,Action run){run();count++;Console.WriteLine("PASS "+name);}
  var session=Guid.NewGuid();var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
  var snap=new RoomSessionSnapshot(1,session,"room","home",null,null,null,1,false,null){InstallationStamp="stamp",IsDesktopForeground=false};
  var regions=new[]{new RoomNativeButton("official.desktop","desktop-a",.1,.1,.2,.3,0,"entry")};
  RoomNativeInputAuthority Create(RoomSessionSnapshot? snapshot=null,bool sampled=false){
   var input=new RoomNativeInputAuthority(TimeProvider.System);var current=snapshot??snap;
   input.Initialize(1,current);input.PublishGeometry(1,session,current.Revision,1,viewport,regions,sampled);return input;
  }
  long Down(RoomNativeInputAuthority input,bool native=true)=>input.ContextDown(viewport,1,1,1,TimeProvider.System.GetTimestamp(),200,100,"desktop-a","entry",native);
  Check("first right click completes while another application remains foreground",()=>{
   var input=Create();Require(input.CaptureContextGeometry(viewport)?.Length==1);
   var seq=Down(input);Require(seq>0&&input.State!.Completed is null);
   input.ContextUp(viewport,seq,202,102,true,false);var proof=input.State!.Completed;
   Require(proof is{ContextMenu:true,Key:0,X:202,Y:102}&&proof.Validate(snap,"official.desktop","desktop-a"));
   Require(proof!.Validate(snap,"official.desktop","desktop-a",true));Require(!proof.Validate(snap,"official.desktop","desktop-a"));
  });
  Check("background ordinary move and foreground check preserve right pair and receipt",()=>{
   var input=Create();var seq=Down(input);input.CheckNativeViewport(viewport,false);input.MouseMove(viewport,201,100,false);
   input.ContextUp(viewport,seq,201,100,true,false);var proof=input.State!.Completed;Require(proof?.ContextMenu==true);
   input.CheckNativeViewport(viewport,false);input.MouseMove(viewport,201,100,false);Require(input.State!.Completed==proof);
  });
  Check("ordinary background left click cannot gain a context proof",()=>{
   var input=Create();input.MouseDown(viewport,200,100,false);input.MouseUp(viewport,200,100,false);Require(input.State!.Completed is null);
  });
  Check("interleaved left click retires right intent",()=>{
   var input=Create();var seq=Down(input);input.MouseDown(viewport,200,100,false);input.ContextUp(viewport,seq,200,100,true,false);Require(input.State!.Completed is null);
  });
  Check("geometry revision replacement cancels the original right release",()=>{
   var input=Create();var seq=Down(input);input.PublishGeometry(1,session,1,2,viewport,regions);input.ContextUp(viewport,seq,200,100,true,false);Require(input.State!.Completed is null);
  });
  Check("moved viewport and lost native desktop cancel the pair",()=>{
   foreach(var mode in new[]{0,1,2}){
    var input=Create();var seq=Down(input);input.ContextUp(mode==0?viewport with{X=50}:viewport,seq,200,100,mode!=1,mode==2);Require(input.State!.Completed is null);
   }
  });
  Check("locked paused transitioning and sampled geometries are ineligible",()=>{
   foreach(var mode in new[]{0,1,2,3}){
    var snapshot=mode==0?snap with{Lifecycle=snap.Lifecycle with{Locked=true}}:mode==1?snap with{Lifecycle=snap.Lifecycle with{PlaybackPaused=true}}:mode==2?snap with{TransitionId=Guid.NewGuid()}:snap;
    var input=Create(snapshot,mode==3);Require(input.CaptureContextGeometry(viewport) is null);Require(Down(input)==0);
   }
  });
  Check("expired or mismatched original down cannot be reissued",()=>{
   var input=Create();Require(input.ContextDown(viewport,1,1,1,TimeProvider.System.GetTimestamp()-TimeProvider.System.TimestampFrequency*2,200,100,"desktop-a","entry",true)==0);
   Require(input.ContextDown(viewport,1,1,1,TimeProvider.System.GetTimestamp(),200,100,"desktop-b","entry",true)==0);
   Require(Down(input,false)==0);Require(input.State!.Completed is null);
  });
  Console.WriteLine($"{count}/{count} native desktop context checks passed");
 }
}
