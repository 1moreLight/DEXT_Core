using Lively.Services.DesktopSync;
using Lively.Common.Helpers;
using Lively.Models.Message;
internal static class DesktopFileContextOwnershipChecks
{
 internal static void Run()
 {
  var count=0;var sent=new List<(string Owner,DesktopFileContextEdge Edge)>();
  void Require(bool ok){if(!ok)throw new Exception("Unexpected desktop right button ownership");}
  void Check(string name,Action run){sent.Clear();run();Console.WriteLine("PASS "+name);count++;}
  DextNativeGeometryEntry[] Regions(string consumer="official.desktop",string button="desktop-a"){
   Require(DextNativeGeometry.TryCreate(new[]{new LivelyRoomNativeButton{Consumer=consumer,Button=button,X=.1,Y=.1,Width=.2,Height=.3,TabIndex=0}},out var result));return result;
  }
  DesktopFileContextOffer Offer(string owner="old",DextNativeGeometryEntry[]? regions=null)=>new(1000,42,-1000,100,1000,500,6,regions??Regions(),e=>sent.Add((owner,e)));
  bool Enqueue(DesktopFileContextOffer offer,DesktopFileContextEdge edge){offer.Deliver(edge);return true;}
  Check("file claims down and up once at physical coordinates",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();
   Require(own.Process(0x204,-850,200,1,42,false,offer,Enqueue));
   Require(own.Process(0x204,-850,200,2,42,false,offer,Enqueue));Require(sent.Count==1);
   Require(own.Process(0x205,-848,202,50,42,false,offer,Enqueue));
   Require(sent.Count==2&&!sent[1].Edge.Down&&!sent[1].Edge.Cancelled&&sent[1].Edge.X==-848&&sent[0].Edge.Button=="desktop-a");
   Require(!own.Process(0x205,-848,202,51,42,false,offer,Enqueue));
  });
  Check("ordinary left movement wheel and middle buttons always pass",()=>{
   foreach(var message in new[]{0x200,0x201,0x202,0x207,0x208,0x20a,0x20b,0x20c}){
    var own=new DesktopFileContextOwnership(1000);Require(!own.Process(message,-850,200,1,42,false,Offer(),Enqueue));
   }Require(sent.Count==0);
  });
  Check("topmost author or non-file control blocks a file behind it",()=>{
   foreach(var top in new[]{Regions("scene","button"),Regions("official.desktop","desktop.paste"),Regions("official-task","task")}){
    var own=new DesktopFileContextOwnership(1000);var offer=Offer(regions:top.Concat(Regions()).ToArray());
    Require(!own.Process(0x204,-850,200,1,42,false,offer,Enqueue));
   }Require(sent.Count==0);
  });
  Check("stale offer covering root and outside geometry pass",()=>{
   foreach(var variant in new[]{0,1,2,3}){
    var own=new DesktopFileContextOwnership(1000);
    Require(!own.Process(0x204,variant==2?-950:-850,200,variant==0?1001:1,variant==1?77:42,false,variant==3?null:Offer(),Enqueue));
   }Require(sent.Count==0);
  });
  Check("release retained by original owner after offer and window change",()=>{
   var own=new DesktopFileContextOwnership(1000);Require(own.Process(0x204,-850,200,1,42,false,Offer(),Enqueue));
   Require(own.Process(0x205,-850,200,20,77,false,Offer("new"),Enqueue));
   Require(sent.Count==2&&sent.All(x=>x.Owner=="old")&&sent[1].Edge.Cancelled);
  });
  Check("right drag out and back cancels menu but never consumes movement",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();
   Require(own.Process(0x204,-850,200,1,42,false,offer,Enqueue));
   Require(!own.Process(0x200,-830,200,5,42,false,offer,Enqueue));
   Require(!own.Process(0x200,-850,200,8,42,false,offer,Enqueue));
   Require(own.Process(0x205,-850,200,20,42,false,offer,Enqueue));Require(sent[1].Edge.Cancelled);
  });
  Check("interleaved left press passes and cancels owned right",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();own.Process(0x204,-850,200,1,42,false,offer,Enqueue);
   Require(!own.Process(0x201,-850,200,5,42,false,offer,Enqueue));
   Require(own.Process(0x205,-850,200,20,42,false,offer,Enqueue));Require(sent[1].Edge.Cancelled);
  });
  Check("unowned startup press is never stolen until original up",()=>{
   var own=new DesktopFileContextOwnership(1000);own.IgnoreHeld();var offer=Offer();
   Require(!own.Process(0x204,-850,200,1,42,false,offer,Enqueue));Require(!own.Process(0x205,-850,200,20,42,false,offer,Enqueue));
   Require(sent.Count==0);Require(own.Process(0x204,-850,200,21,42,false,offer,Enqueue));
  });
  Check("queue refusal keeps whole physical pair with Explorer",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();
   Require(!own.Process(0x204,-850,200,1,42,false,offer,(_,_)=>false));
   Require(!own.Process(0x204,-850,200,2,42,false,offer,Enqueue));
   Require(!own.Process(0x205,-850,200,20,42,false,offer,Enqueue));Require(sent.Count==0);
  });
  Check("touch promoted and injected messages cannot release physical owner",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();
   Require(!own.Process(0x204,-850,200,1,42,true,offer,Enqueue));Require(sent.Count==0);
   Require(own.Process(0x204,-850,200,2,42,false,offer,Enqueue));
   Require(!own.Process(0x205,-850,200,3,42,true,offer,Enqueue));Require(sent.Count==1);
   Require(own.Process(0x205,-850,200,20,42,false,offer,Enqueue));Require(!sent[1].Edge.Cancelled);
  });
  Check("long physical hold and failed up queue do not leak orphan release",()=>{
   var own=new DesktopFileContextOwnership(1000);var offer=Offer();own.Process(0x204,-850,200,1,42,false,offer,Enqueue);
   Require(own.Process(0x205,-850,200,1501,42,false,offer,Enqueue));Require(sent[1].Edge.Cancelled);
   own.Process(0x204,-850,200,20,42,false,offer,Enqueue);
   Require(own.Process(0x205,-850,200,30,42,false,offer,(_,_)=>throw new Exception("queue closed")));
   Require(!own.Process(0x205,-850,200,31,42,false,offer,Enqueue));
  });
  Check("offer retains immutable geometry snapshot",()=>{
   var regions=Regions();var offer=Offer(regions:regions);regions[0]=Regions("scene","button")[0];
   var own=new DesktopFileContextOwnership(1000);Require(own.Process(0x204,-850,200,1,42,false,offer,Enqueue));
  });
  Check("clipped polygon excludes its empty bounding-box corners",()=>{
   var points=new[]{new LivelyRoomNativePoint{X=.1,Y=.1},new LivelyRoomNativePoint{X=.3,Y=.1},new LivelyRoomNativePoint{X=.1,Y=.4}};
   Require(DextNativeGeometry.TryCreate(new[]{new LivelyRoomNativeButton{Consumer="official.desktop",Button="desktop-a",EntryId="file",X=.1,Y=.1,Width=.2,Height=.3,TabIndex=0,Polygons=new[]{points}}},out var regions));
   var offer=Offer(regions:regions);var miss=new DesktopFileContextOwnership(1000);
   Require(!miss.Process(0x204,-710,290,1,42,false,offer,Enqueue));
   var hit=new DesktopFileContextOwnership(1000);Require(hit.Process(0x204,-850,200,1,42,false,offer,Enqueue));
  });
  Check("overlapping physical buttons do not start a context capture",()=>{
   var own=new DesktopFileContextOwnership(1000);
   Require(!own.Process(0x204,-850,200,1,42,false,Offer(),Enqueue,otherButtonHeld:true));Require(sent.Count==0);
  });
  Console.WriteLine($"{count}/{count} desktop context ownership checks passed");
 }
}
