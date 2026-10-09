using System;
using System.Threading;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

// Hung Windows calls keep their permits after the caller times out. The global
// bound survives Player/Room replacement; admission never waits on the UI thread.
internal sealed class RoomNativeControlQueue
{
    private static readonly SemaphoreSlim Global = new(4,4);
    private readonly SemaphoreSlim attachment = new(1,1);
    private readonly TimeSpan timeout;
    public RoomNativeControlQueue(TimeSpan? timeout=null)
    {
        this.timeout=timeout??TimeSpan.FromSeconds(4);
        if(this.timeout<=TimeSpan.Zero)throw new ArgumentOutOfRangeException(nameof(timeout));
    }
    public async Task<RoomNativeActionReply> RunAsync(Func<CancellationToken,Task<RoomNativeActionReply>> execute,
        Func<RoomNativeActionReply> unavailable)
    {
        if(!attachment.Wait(0))return new(RoomActionStatus.ControlUnavailable);
        if(!Global.Wait(0)){attachment.Release();return new(RoomActionStatus.ControlUnavailable);}
        var cancellation=new CancellationTokenSource(timeout);
        var job=Task.Run(async()=>{
            try{cancellation.Token.ThrowIfCancellationRequested();return await execute(cancellation.Token);}
            catch(Exception){return unavailable();}
            finally{cancellation.Dispose();Global.Release();attachment.Release();}
        });
        try{return await job.WaitAsync(timeout);}
        catch(TimeoutException){return unavailable();}
    }
}
