using Dext.Core.Rooms;
internal static class DesktopSyncChecks
{
 internal static void Run()
 {
  static void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
  var directory=Path.Combine(Path.GetTempPath(),"dext-sync-store-"+Guid.NewGuid().ToString("N"));
  var room=Guid.NewGuid().ToString("D");var copy=Guid.NewGuid().ToString("D");
  var a="desktop-"+new string('a',64);var b="desktop-"+new string('b',64);var c="desktop-"+new string('c',64);
  try
  {
   var store=new RoomPersonalStore(directory);
   Check(store.ReadDesktopSync(room)==null,"old/missing private data does not enable desktop sync");
   store.SetDesktopSync(room,"home",true,new[]{a,b,a});
   var first=store.ReadDesktopSync(room)!;
   Check(first.Enabled&&first.DeskId=="home"&&first.Slots.Count==2&&first.Slots[a]!=first.Slots[b],"first import creates unique private slots");
   store.SetDesktopSync(room,"home",true,new[]{b,a});
   Check(store.ReadDesktopSync(room)!.Slots[a]==first.Slots[a],"repeated scan preserves ordering despite source order change");
   store.SetDesktopSync(room,"home",true,new[]{c},complete:false);
   Check(store.ReadDesktopSync(room)!.Slots.Count==3,"partial scan retains unavailable item positions");
   store.SetDesktopSync(room,"work",true,new[]{a,c});
   var moved=new RoomPersonalStore(directory).ReadDesktopSync(room)!;
   Check(moved.DeskId=="work"&&moved.Slots.Count==2&&moved.Slots[a]==first.Slots[a],"one selected Desk and surviving slots persist across restart");
   store.SetDesktopSync(room,"work",false);
   Check(!store.ReadDesktopSync(room)!.Enabled&&store.ReadDesktopSync(room)!.Slots.Count==2,"disable retains layout for later re-enable");
   store.CopyRoom(room,copy);
   Check(store.ReadDesktopSync(copy)==null,"new Room copy does not silently inherit desktop sync");
   var path=Path.Combine(directory,"personal.json");var before=File.ReadAllBytes(path);var refused=false;
   try{store.Update(state=>state.Rooms[room].DesktopSync!.Slots[c]=-1);}catch(InvalidDataException){refused=true;}
   Check(refused&&before.SequenceEqual(File.ReadAllBytes(path)),"invalid slot update preserves confirmed private file bytes");
   store.DeleteRoom(room);
   Check(store.ReadDesktopSync(room)==null&&store.Read().Rooms.ContainsKey(copy),"Room deletion clears only its own sync settings");
  }
  finally {if(Directory.Exists(directory))Directory.Delete(directory,true);}
 }
}
