using System;
using System.Threading.Tasks;
namespace Lively.Services.DesktopSync;
internal static class DesktopShellMenuActivation
{
 // An accepted SetForegroundWindow can complete after its return. Yield the UI
 // dispatcher while confirming; never attach input queues or repeatedly steal focus.
 internal static async Task<bool> Confirm(Func<bool> request,Func<bool> foreground,Func<bool> permitted,Func<Task> yield)
 {
  if(!permitted())return false;
  if(foreground())return true;
  if(!request())return false;
  for(var attempt=0;attempt<10;attempt++){
   if(!permitted())return false;
   if(foreground())return true;
   await yield();
  }
  return permitted()&&foreground();
 }
}
