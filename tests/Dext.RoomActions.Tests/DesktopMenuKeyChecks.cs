using Dext.Core.Rooms;
internal static class DesktopMenuKeyChecks
{
 internal static void Run()
 {
  foreach(var key in new[]{93,121})
  foreach(var sampled in new[]{false,true})
  foreach(var consumer in new[]{"official.desktop","official","scene"})
  {
   var session=Guid.NewGuid();var snapshot=new RoomSessionSnapshot(1,session,"room","home",null,null,null,1,true,null){InstallationStamp="stamp"};
   var viewport=new RoomNativeViewport(42,0,0,1000,500,6);var id="desktop-"+new string('a',64);
   RoomNativeButton[] regions=[new(consumer,id,.1,.1,.2,.3,0,"file-entry")];
   var input=new RoomNativeInputAuthority(TimeProvider.System);input.Initialize(1,snapshot);input.PublishGeometry(1,session,1,1,viewport,regions,sampled);
   input.MouseDown(viewport,200,100,true);var mouse=input.State!.Gesture!.Sequence;
   if(sampled)input.SampleMouse(1,session,1,1,mouse,"down",viewport,regions,true);
   input.MouseUp(viewport,200,100,true);if(sampled)input.SampleMouse(1,session,1,1,mouse,"up",viewport,regions,true);
   input.Key(viewport,key,true,false,true,key==93?0:2);
   if(consumer!="official.desktop"){
    if(input.State?.Gesture?.Key==key)throw new Exception("menu key captured an authored button");
    Console.WriteLine($"PASS menu key leaves {consumer} unchanged sampled={sampled}");continue;
   }
   var keyboard=input.State?.Gesture;
   if(keyboard?.Key!=key)throw new Exception("menu key did not create a file command gesture");
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"down",viewport,regions,true,key,consumer,id,"file-entry");
   input.Key(viewport,key,false,false,true,0);
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"up",viewport,regions,true,key,consumer,id,"file-entry");
   if(input.State?.Completed is not{} proof||proof.Key!=key||proof.Modifiers!=(key==93?0:2))throw new Exception("menu key physical pair did not complete");
   Console.WriteLine($"PASS desktop menu key completes a physical pair sampled={sampled}");
  }
 }
}