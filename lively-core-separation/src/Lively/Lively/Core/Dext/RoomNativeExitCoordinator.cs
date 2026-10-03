using System;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

// Core-only orchestration. The author receives neither the decision callback
// nor the confirmation capability. No gateway/authority lock spans native UI.
internal sealed class RoomNativeExitCoordinator
{
    private static readonly SemaphoreSlim Dialog = new(1,1);
    internal async Task<RoomActionReply> RunAsync(Func<bool> isCurrent,Func<Task<bool>> ask,
        Func<bool,RoomActionReply> complete,Func<Task> exit)
    {
        if(!Dialog.Wait(0))return complete(false);
        var completed=false;
        try {
            if(!isCurrent()) {complete(false);completed=true;return new(RoomActionStatus.StaleInput);}
            bool approved;
            try {approved=await ask();}
            catch {approved=false;}
            if(!isCurrent()) {complete(false);completed=true;return new(RoomActionStatus.StaleInput);}
            var reply=complete(approved);completed=true;
            if(reply.Status==RoomActionStatus.Accepted)await exit();
            return reply;
        }
        finally {
            try {if(!completed)complete(false);}
            finally {Dialog.Release();}
        }
    }
}
