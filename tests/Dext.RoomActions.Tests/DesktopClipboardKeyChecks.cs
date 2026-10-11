using Dext.Core.Rooms;
internal static class DesktopClipboardKeyChecks
{
 internal static void Run()
 {
  var count=0;
  foreach(var sampled in new[]{false,true})
  foreach(var key in new[]{67,88,86})
  {
   var session=Guid.NewGuid();var snapshot=new RoomSessionSnapshot(1,session,"room","home",null,null,null,1,true,null){InstallationStamp="stamp"};
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);var id="desktop-"+new string('a',64);
   var regions=new[]{new RoomNativeButton("official.desktop",id,.1,.1,.2,.3,0,"desktop.scan/"+id)};
   var input=new RoomNativeInputAuthority(TimeProvider.System);input.Initialize(1,snapshot);input.PublishGeometry(1,session,1,1,viewport,regions,sampled);
   input.MouseDown(viewport,200,100,true);var mouse=input.State!.Gesture!.Sequence;
   if(sampled)input.SampleMouse(1,session,1,1,mouse,"down",viewport,regions,true);
   input.MouseUp(viewport,200,100,true);if(sampled)input.SampleMouse(1,session,1,1,mouse,"up",viewport,regions,true);
   input.Key(viewport,key,true,false,true,0);
   if(input.State?.Gesture?.Key==key)throw new Exception("ordinary letter became a clipboard command");
   input.Key(viewport,key,false,false,true,0);
   input.Key(viewport,key,true,false,true,1);
   var keyboard=input.State?.Gesture;
   if(keyboard?.Key!=key)throw new Exception("Ctrl shortcut did not create a native gesture");
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"down",viewport,regions,true,key,"official.desktop",id,"desktop.scan/"+id);
   input.Key(viewport,key,false,false,true,0); // Ctrl may be released before the letter.
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"up",viewport,regions,true,key,"official.desktop",id,"desktop.scan/"+id);
   if(input.State?.Completed is not{} proof||proof.Key!=key||proof.Modifiers!=1)throw new Exception("clipboard proof lost its press modifiers");
   count++;Console.WriteLine($"PASS Ctrl+{key} sampled={sampled} preserves native press modifiers");
  }
  Console.WriteLine($"{count}/{count} desktop clipboard key checks passed");
 }
}
