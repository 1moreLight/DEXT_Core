using Lively.Services.DesktopSync;
internal static class DesktopFileKeyboardOwnershipChecks
{
 internal static void Run()
 {
  var count=0;
  void Check(string name,Action run){run();count++;Console.WriteLine("PASS "+name);}
  void Require(bool value){if(!value)throw new Exception("Unexpected keyboard ownership");}
  var sent=new List<(string,DesktopFileKeyEdge)>();
  DesktopFileKeyboardOffer Offer(string name="file")=>new(100,(IntPtr)42,0,0,1000,500,
   name=="paste"?"desktop.paste":"desktop-aaa",e=>sent.Add((name,e)));
  bool Enqueue(DesktopFileKeyboardOffer offer,DesktopFileKeyEdge edge){offer.Deliver(edge);return true;}
  DesktopFileKeyEdge Edge(int key=86,bool down=true,int mods=1)=>new(key,down,mods,47,false);
  Check("Windows VK_F2 owns rename while VK_F3 passes through",()=>{
   foreach(var key in new[]{0x71,0x72}){
    sent.Clear();var owner=new DesktopFileKeyboardOwnership();
    Require(owner.Process(Edge(key:key,mods:0),false,1,42,20,20,Offer(),Enqueue)==(key==0x71));
    Require(owner.Process(Edge(key:key,down:false,mods:0),false,2,42,20,20,Offer(),Enqueue)==(key==0x71));
    Require(sent.Count==(key==0x71?2:0));
   }
  });
  Check("owned press suppresses both edges and repeats only deliver once",()=>{
   sent.Clear();var owner=new DesktopFileKeyboardOwnership();var offer=Offer();
   Require(owner.Process(Edge(),false,1,42,20,20,offer,Enqueue));
   Require(owner.Process(Edge(),false,2,42,20,20,offer,Enqueue));
   Require(sent.Count==1);
   Require(owner.Process(Edge(down:false,mods:0),false,3,42,20,20,offer,Enqueue));
   Require(sent.Count==2&&!sent[1].Item2.Down&&sent[1].Item2.Modifiers==1);
  });
  Check("release stays with original owner after focus and offer change",()=>{
   sent.Clear();var owner=new DesktopFileKeyboardOwnership();
   Require(owner.Process(Edge(),false,1,42,20,20,Offer("old"),Enqueue));
   Require(owner.Process(Edge(down:false),false,200,55,2000,20,Offer("new"),Enqueue));
   Require(sent.Count==2&&sent.All(x=>x.Item1=="old"));
  });
  Check("unclaimed held key cannot be stolen when desktop becomes focused",()=>{
   sent.Clear();var owner=new DesktopFileKeyboardOwnership();
   Require(!owner.Process(Edge(),false,1,55,20,20,Offer(),Enqueue));
   Require(!owner.Process(Edge(),false,2,42,20,20,Offer(),Enqueue));
   Require(!owner.Process(Edge(down:false),false,3,42,20,20,Offer(),Enqueue));
   Require(sent.Count==0);
   Require(owner.Process(Edge(),false,4,42,20,20,Offer(),Enqueue));
  });
  Check("expired offer other foreground out of viewport and wrong modifiers pass",()=>{
   foreach(var variant in new[]{0,1,2,4,5}){
    var owner=new DesktopFileKeyboardOwnership();sent.Clear();
    Require(!owner.Process(Edge(mods:variant==4?0:variant==5?5:1),false,variant==0?101:1,variant==1?55:42,variant==2?1000:20,20,Offer(),Enqueue));Require(sent.Count==0);
   }
  });
  Check("paste control accepts paste Enter Space but not copy cut rename",()=>{
   foreach(var key in new[]{13,32,86,67,88,113}){
    var owner=new DesktopFileKeyboardOwnership();
    Require(owner.Process(Edge(key:key,mods:key is 67 or 88 or 86?1:0),false,1,42,20,20,Offer("paste"),Enqueue)==(key is 13 or 32 or 86));
   }
  });
  Check("queue refusal passes original key and its subsequent repeats",()=>{
   var owner=new DesktopFileKeyboardOwnership();
   Require(!owner.Process(Edge(),false,1,42,20,20,Offer(),(_,_)=>false));
   Require(!owner.Process(Edge(),false,2,42,20,20,Offer(),Enqueue));
   Require(!owner.Process(Edge(down:false),false,3,42,20,20,Offer(),Enqueue));
  });
  Check("held key at hook startup stays unclaimed until released",()=>{
   var owner=new DesktopFileKeyboardOwnership();owner.IgnoreHeld(86);
   Require(!owner.Process(Edge(),false,1,42,20,20,Offer(),Enqueue));
   Require(!owner.Process(Edge(down:false),false,2,42,20,20,Offer(),Enqueue));
   Require(owner.Process(Edge(),false,3,42,20,20,Offer(),Enqueue));
  });
  Check("OS on-screen keyboard follows the same focused desktop ownership",()=>{
   var owner=new DesktopFileKeyboardOwnership();
   Require(owner.Process(Edge(),true,1,42,20,20,Offer(),Enqueue));
   Require(owner.Process(Edge(down:false),true,2,42,20,20,Offer(),Enqueue));
  });
  Check("Delete and Shift Delete are owned on files while other modifiers pass",()=>{
   foreach(var modifiers in new[]{0,1,2,3,4,5}){
    var owner=new DesktopFileKeyboardOwnership();sent.Clear();
    var accepted=owner.Process(Edge(key:46,mods:modifiers),false,1,42,20,20,Offer(),Enqueue);
    Require(accepted==(modifiers is 0 or 2));
    if(accepted){Require(owner.Process(Edge(key:46,down:false,mods:0),false,2,42,20,20,Offer(),Enqueue));Require(sent.Count==2&&sent[1].Item2.Modifiers==modifiers);}
   }
  });
  Check("menu key and Shift F10 own only their exact file modifiers",()=>{
   foreach(var key in new[]{93,121})foreach(var mods in new[]{0,1,2,3,4}){
    var owner=new DesktopFileKeyboardOwnership();
    Require(owner.Process(Edge(key:key,mods:mods),false,1,42,20,20,Offer(),Enqueue)==(key==93?mods==0:mods==2));
   }
   var paste=new DesktopFileKeyboardOwnership();Require(!paste.Process(Edge(key:93,mods:0),false,1,42,20,20,Offer("paste"),Enqueue));
  });
  Console.WriteLine($"{count}/{count} desktop keyboard ownership checks passed");
 }
}
