using Dext.Core.Rooms;
using Lively.Services;

internal static class NativeDataLiveProbe
{
    public static async Task Run()
    {
        // Read-only device sampling with the same production factory. No user
        // Room, consent, desktop, system volume or playback is changed.
        using var source=RoomNativeDataSource.ForWindows(new SystemControlService());
        var time=source.Read("time.read");if(time.Status!="available"||!DateTimeOffset.TryParse(time.Value!.Value.GetProperty("utc").GetString(),out var utc)||Math.Abs((DateTimeOffset.UtcNow-utc).TotalSeconds)>5)throw new Exception("actual time sample");
        var audio=source.Read("audio.read");if(audio.Status!="available")throw new Exception("actual audio status: "+audio.Status);
        var volume=audio.Value!.Value;var level=volume.GetProperty("level").GetDouble();if(!double.IsFinite(level)||level<0||level>1||volume.TryGetProperty("deviceId",out _))throw new Exception("actual audio shape");
        var service=new SystemControlService();var original=service.GetVolume();
        try{service.SetVolume(0,!original.Muted,new CancellationToken(true));throw new Exception("cancelled native volume dispatched");}catch(OperationCanceledException){}
        var after=service.GetVolume();if(after.Level!=original.Level||after.Muted!=original.Muted||after.DeviceId!=original.DeviceId)throw new Exception("cancelled native control changed endpoint");
        Console.WriteLine("PASS expired Windows volume request rejects before device mutation");
        var media=source.Read("media.read");if(media.Status!="available"&&media.Status!="missing")throw new Exception("actual media status: "+media.Status);
        RoomDataSample hardware=new("missing");var stop=DateTime.UtcNow.AddSeconds(12);
        while(DateTime.UtcNow<stop){hardware=source.Read("hardware.read");if(hardware.Status=="available")break;await Task.Delay(100);}
        if(hardware.Status!="available"||hardware.Value!.Value.GetProperty("totalMemoryMB").GetInt64()<=0)throw new Exception("actual hardware status: "+hardware.Status);
        var snapshot=new RoomSessionSnapshot(1,Guid.NewGuid(),"room","home",null,null,null,1,true,null){Lifecycle=new(RoomLifecycleStage.Desktop,true,false,1)};
        source.ObserveSnapshot(snapshot);if(source.Read("hardware.read").Status!="missing")throw new Exception("actual paused hardware source");
        Console.WriteLine("PASS actual Windows production data sources: UTC, healthy hardware, bounded audio without device identity, media="+media.Status+", paused hardware missing; read-only sampling, no installed-Core claim");
    }
}
