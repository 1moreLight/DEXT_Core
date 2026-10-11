using Lively.Services.DesktopSync;
internal static class MenuActivationChecks
{
 internal static async Task Run(){
  int ticks=0,requests=0;
  var ok=await DesktopShellMenuActivation.Confirm(()=>{requests++;return true;},()=>ticks>=2,()=>true,()=>{ticks++;return Task.CompletedTask;});
  if(!ok||requests!=1)throw new Exception("Accepted asynchronous activation was cancelled before the owner became foreground");
  Console.WriteLine("PASS delayed activation confirmed without repeated focus requests");
  ticks=0;
  if(await DesktopShellMenuActivation.Confirm(()=>false,()=>false,()=>true,()=>{ticks++;return Task.CompletedTask;})||ticks!=0)throw new Exception("Denied activation must not retry");
  Console.WriteLine("PASS denied activation does not retry");
  ticks=0;
  if(await DesktopShellMenuActivation.Confirm(()=>true,()=>false,()=>ticks<1,()=>{ticks++;return Task.CompletedTask;}))throw new Exception("Retired context accepted");
  Console.WriteLine("PASS retired context cancels pending activation");
  ticks=0;
  if(await DesktopShellMenuActivation.Confirm(()=>true,()=>false,()=>true,()=>{ticks++;return Task.CompletedTask;})||ticks>20)throw new Exception("Unconfirmed activation unbounded");
  Console.WriteLine("PASS activation wait is bounded");
 }
}
