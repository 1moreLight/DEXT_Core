using System.Collections.Concurrent;
using Lively.Services.DesktopSync;
internal static class WatcherChecks
{
 internal static async Task Run()
 {
  var root=Directory.CreateTempSubdirectory("Dext-watch-").FullName;
  var events=new ConcurrentQueue<DesktopWatchBatch>();
  async Task Wait(Func<bool> condition,string label){var until=DateTime.UtcNow.AddSeconds(5);while(DateTime.UtcNow<until){if(condition()){Console.WriteLine("PASS "+label);return;}await Task.Delay(20);}throw new Exception(label);}
  try
  {
   var directory=Directory.CreateDirectory(Path.Combine(root,"desktop")).FullName;
   var file=Path.Combine(directory,"one.txt");var renamed=Path.Combine(directory,"two.txt");
   using(var watcher=new DesktopDirectoryWatcher(()=>new[]{new DesktopFolder("user",directory),new DesktopFolder("public",directory)},events.Enqueue,
       quiet:TimeSpan.FromMilliseconds(60),maximumDelay:TimeSpan.FromMilliseconds(250),healthInterval:TimeSpan.FromSeconds(30)))
   {
    await Wait(()=>events.Any(e=>e.FullRescan),"start requests complete desktop verification");events.Clear();
    await File.WriteAllTextAsync(file,"one");
    await Wait(()=>events.Any(e=>e.Paths.Contains(file)),"real creation invalidates the top-level path");events.Clear();
    File.Move(file,renamed);
    await Wait(()=>events.Any(e=>e.Renames.Any(r=>r.OldPath==file&&r.NewPath==renamed)),"real rename carries both old and new identity paths");events.Clear();
    File.Delete(renamed);
    await Wait(()=>events.Any(e=>e.Paths.Contains(renamed)),"real deletion invalidates the old path");events.Clear();
    var writing=Task.Run(async()=>{for(var i=0;i<25;i++){await File.WriteAllTextAsync(file,i.ToString());await Task.Delay(20);}});
    await Wait(()=>events.Count>0&&!writing.IsCompleted,"continuous writes flush before the burst finishes");await writing;
   }
   await Task.Delay(100);events.Clear();await File.WriteAllTextAsync(file,"after dispose");await Task.Delay(150);
   if(!events.IsEmpty)throw new Exception("Disposed watcher reported a new change");Console.WriteLine("PASS disposed watcher stops future file notifications");
   var missing=Path.Combine(root,"late");events.Clear();
   using(var watcher=new DesktopDirectoryWatcher(()=>new[]{new DesktopFolder("user",missing)},events.Enqueue,
       quiet:TimeSpan.FromMilliseconds(30),maximumDelay:TimeSpan.FromMilliseconds(100),healthInterval:TimeSpan.FromMilliseconds(80)))
   {
    await Wait(()=>events.Any(e=>e.FullRescan),"missing root requests verification without crashing");
    Directory.CreateDirectory(missing);await Task.Delay(150);events.Clear();var lateFile=Path.Combine(missing,"late.txt");await File.WriteAllTextAsync(lateFile,"late");
    await Wait(()=>events.Any(e=>e.Paths.Contains(lateFile)),"unavailable root reconnects when it appears");
    File.Delete(lateFile);Directory.Delete(missing);await Task.Delay(180);events.Clear();
    Directory.CreateDirectory(missing);await Task.Delay(150);events.Clear();await File.WriteAllTextAsync(lateFile,"recreated");
    await Wait(()=>events.Any(e=>e.Paths.Contains(lateFile)),"deleted watch root reconnects after recreation");
   }
  }
  finally{Directory.Delete(root,true);}
 }
}
