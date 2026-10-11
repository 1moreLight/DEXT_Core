using Lively.Services.DesktopSync;
using System.Collections.Concurrent;
using System.Diagnostics;
internal static class DesktopFileContextHookChecks
{
 internal static void Run()
 {
  // No offer is ever published: every mouse event passes through untouched.
  for(var cycle=0;cycle<2;cycle++){
   var errors=new ConcurrentQueue<Exception>();
   using var hook=new DesktopFileContextHook((_,_)=>throw new Exception("No target may be offered by lifecycle check"),errors.Enqueue);
   var until=Stopwatch.StartNew();
   while(!hook.Active&&errors.IsEmpty&&until.ElapsedMilliseconds<3000)Thread.Sleep(10);
   if(!hook.Active)throw new Exception("Hook failed to install",errors.TryDequeue(out var error)?error:null);
   hook.Dispose();
   if(hook.Active||!errors.IsEmpty)throw new Exception("Hook failed to retire");
   Console.WriteLine($"PASS inactive-target native hook start/stop cycle {cycle+1}");
  }
 }
}
