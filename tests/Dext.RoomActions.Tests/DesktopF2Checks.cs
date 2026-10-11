using Dext.Core.Rooms;
internal static class DesktopF2Checks
{
 internal static void Run()
 {
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
   input.Key(viewport,113,true,false,true);
   if(consumer!="official.desktop"){
    if(input.State?.Gesture?.Key==113)throw new Exception("F2 captured an authored button");
    Console.WriteLine($"PASS F2 leaves {consumer} unchanged sampled={sampled}");continue;
   }
   var keyboard=input.State?.Gesture;
   if(keyboard?.Key!=113)throw new Exception("F2 did not create a file command gesture");
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"down",viewport,regions,true,113,consumer,id,"file-entry");
   input.Key(viewport,113,false,false,true);
   if(sampled)input.SampleKeyboard(1,session,1,1,keyboard.Sequence,"up",viewport,regions,true,113,consumer,id,"file-entry");
   if(input.State?.Completed is not{Key:113})throw new Exception("F2 physical pair did not complete");
   Console.WriteLine($"PASS desktop F2 completes a physical pair sampled={sampled}");
  }
 }
}