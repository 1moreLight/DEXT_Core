using Dext.Core.Rooms;
using Lively.Common.Services;
using Lively.Models.Services;
using System.Text.Json;
using Lively.Services;
using Lively.Grpc.Common.Proto.Desktop;

internal static class RoomNativeDataSourceChecks
{
    public static void Run(Action<string,Action> check)
    {
        void Require(bool value){if(!value)throw new Exception("native source state");}
        RoomDataSample Value(object value)=>new("available",JsonSerializer.SerializeToElement(value));
        RoomSessionSnapshot Snapshot(bool paused=false)=>new(1,Guid.NewGuid(),"room","home",null,null,null,1,true,null){Lifecycle=new(RoomLifecycleStage.Desktop,paused,false,1)};
        check("native time value is current UTC and carries no Core implementation identity",()=>{
            using var source=new RoomNativeDataSource(null,null,null,new Clock());var sample=source.Read("time.read");
            Require(sample.Status=="available"&&sample.Value!.Value.GetProperty("utc").GetString()=="2026-10-03T00:00:00.0000000+00:00");
            Require(sample.Value.Value.GetProperty("unixMilliseconds").GetInt64()==1790985600000);
        });
        check("native hardware has one lazy source and detached healthy samples",()=>{
            var hardware=new Hardware();var factories=0;using var source=new RoomNativeDataSource(null,null,()=>{factories++;return hardware;});
            Require(factories==0&&source.Read("hardware.read").Status=="missing");Require(source.Read("hardware.read").Status=="missing"&&factories==1&&hardware.Starts==1);
            var value=new HardwareUsageEventArgs{IsAvailable=true,CurrentCpu=25,CurrentRamAvail=8000,TotalRam=16000,NameCpu="CPU"};hardware.Emit(value);value.CurrentCpu=90;
            var sample=source.Read("hardware.read");Require(sample.Status=="available"&&sample.Value!.Value.GetProperty("cpuPercent").GetSingle()==25);
            Require(!sample.Value.Value.TryGetProperty("NameNetCard",out _));
        });
        check("failed or nonfinite hardware never fabricates an available zero reading",()=>{
            var hardware=new Hardware();using var source=new RoomNativeDataSource(null,null,()=>hardware);source.Read("hardware.read");
            hardware.Emit(new(){IsAvailable=false});Require(source.Read("hardware.read").Status=="missing");
            hardware.Emit(new(){IsAvailable=true,CurrentCpu=float.NaN});Require(source.Read("hardware.read").Status=="error");
        });
        check("native hardware stops on suspended Core facts and restarts from a new source",()=>{
            var services=new List<Hardware>();using var source=new RoomNativeDataSource(null,null,()=>{var service=new Hardware();services.Add(service);return service;});source.Read("hardware.read");
            source.ObserveSnapshot(Snapshot(true));Require(source.Read("hardware.read").Status=="missing");Require(SpinWait.SpinUntil(()=>services[0].Stops==1,TimeSpan.FromSeconds(5)));
            source.ObserveSnapshot(Snapshot());source.Read("hardware.read");Require(services.Count==2&&services[1].Starts==1);
            services[0].Emit(new(){IsAvailable=true,CurrentCpu=99});Require(source.Read("hardware.read").Status=="missing");
        });
        check("native data owns its monitor and accepts no callbacks after disposal",()=>{
            var hardware=new Hardware();var source=new RoomNativeDataSource(null,null,()=>hardware);source.Read("hardware.read");source.Dispose();source.Dispose();
            hardware.Emit(new(){IsAvailable=true,CurrentCpu=99});Require(hardware.Stops==1&&source.Read("hardware.read").Status=="error"&&!source.TryBeginRead());
        });
        check("native media/audio providers return explicit availability and safe errors",()=>{
            using var source=new RoomNativeDataSource(()=>new("missing"),()=>throw new IOException("C:/private"),null);
            Require(source.Read("media.read").Status=="missing"&&source.Read("audio.read").Status=="error"&&source.Read("invented").Status=="unsupported");
            using var data=new RoomNativeDataSource(()=>Value(new{title="Track"}),()=>Value(new{level=.5,muted=true}),null);
            Require(data.Read("media.read").Value!.Value.GetProperty("title").GetString()=="Track");Require(data.Read("audio.read").Value!.Value.GetProperty("muted").GetBoolean());
        });
        check("Windows data projection exposes no audio device identity or rooted media source path",()=>{
            var control=new SystemControl();using var source=RoomNativeDataSource.ForWindows(control);
            var media=source.Read("media.read");var audio=source.Read("audio.read");var json=JsonSerializer.Serialize(new{media,audio});
            Require(media.Status=="available"&&media.Value!.Value.GetProperty("title").GetString()=="Track");
            Require(!json.Contains("private")&&!json.Contains("DeviceId")&&!json.Contains("deviceId"));Require(control.Writes==0);
        });
        check("native data bounds outstanding reads and releases a retired owner safely",()=>{
            var source=new RoomNativeDataSource(null,null,null);for(var i=0;i<16;i++)Require(source.TryBeginRead());Require(!source.TryBeginRead());source.EndRead();Require(source.TryBeginRead());
            source.Dispose();for(var i=0;i<16;i++)source.EndRead();Require(!source.TryBeginRead());
        });
    }
    private sealed class SystemControl:ISystemControlService
    {
        public int Writes;
        public Task<SystemMediaSnapshot> GetMediaAsync(CancellationToken token)=>Task.FromResult(new SystemMediaSnapshot{HasSession=true,Title="Track",SourceAppId=@"C:\private\player.exe"});
        public SystemVolumeSnapshot GetVolume()=>new(){Level=.5,Muted=true,DeviceId=@"C:\private\device",DeviceName="private device"};
        public Task<bool> ControlMediaAsync(SystemMediaAction action,CancellationToken token){Writes++;throw new Exception("unexpected write");}
        public SystemVolumeSnapshot SetVolume(double? level,bool? muted){Writes++;throw new Exception("unexpected write");}
    }
    private sealed class Clock:TimeProvider{public override DateTimeOffset GetUtcNow()=>DateTimeOffset.Parse("2026-10-03T00:00:00Z");}
    private sealed class Hardware:IHardwareUsageService
    {
        public event EventHandler<HardwareUsageEventArgs>? HWMonitor;private int starts,stops;public int Starts=>Volatile.Read(ref starts);public int Stops=>Volatile.Read(ref stops);
        public void Start()=>Interlocked.Increment(ref starts);public void Stop()=>Interlocked.Increment(ref stops);public void Emit(HardwareUsageEventArgs value)=>HWMonitor?.Invoke(this,value);
    }
}
