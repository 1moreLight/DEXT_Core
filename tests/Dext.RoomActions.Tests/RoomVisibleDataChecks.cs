using Dext.Core.Rooms;
using System.Text.Json;
using Lively.Common.Services;
using Lively.Models.Services;

static partial class RoomActionChecks
{
    public static void VisibleDataChecks(Action<string,Action> check)
    {
        var reads=new[]{"time.read","hardware.read","media.read","audio.read"};
        check("visible desktop reads continue behind a small foreground window",()=>{
            using var f=new ActionFixture(dataCapabilities:true,storageCapabilities:true);
            f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));
            var snapshot=f.Kernel.Snapshot!;
            Eq(false,snapshot.IsOperable);
            var caps=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene",snapshot.Revision);
            var captures=0;
            foreach(var capability in reads){
                Eq(RoomActionStatus.Accepted,caps.Capabilities![capability]);
                var value=f.Actions.ReadData(f.View,f.Peer,f.Session,snapshot.Revision,"scene",capability,()=>{
                    captures++;return new("available",JsonSerializer.SerializeToElement(new{value=42}));
                });
                Eq(RoomActionStatus.Accepted,value.Status);Eq("available",value.Sample!.Status);
            }
            Eq(4,captures);
            Eq(RoomActionStatus.NotOperable,caps.Capabilities!["binding.launch"]);
            Eq(RoomActionStatus.NotOperable,caps.Capabilities["storage.read"]);
        });
        foreach(var locked in new[]{false,true})check("visible desktop reads still stop on "+(locked?"lock":"pause"),()=>{
            using var f=new ActionFixture(dataCapabilities:true);
            f.Lifecycle(RoomLifecycleStage.Desktop,!locked,locked);
            var captures=0;
            foreach(var capability in reads){
                var reply=f.Actions.ReadData(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene",capability,()=>{
                    captures++;return new("available",JsonSerializer.SerializeToElement(42));
                });
                Eq(RoomActionStatus.NotOperable,reply.Status);
            }
            Eq(0,captures);
        });
        check("visible desktop read revocation applies while another window is foreground",()=>{
            using var f=new ActionFixture(dataCapabilities:true);
            f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));
            f.Store.Update(state=>state.Rooms[Room].Grants.Clear());
            var captures=0;
            var reply=f.Actions.ReadData(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene","media.read",()=>{
                captures++;return new("available",JsonSerializer.SerializeToElement(42));
            });
            Eq(RoomActionStatus.MissingPermission,reply.Status);Eq(0,captures);
        });
        check("visible desktop hardware monitor continues without input operability",()=>{
            var hardware=new VisibleHardware();
            using var source=new RoomNativeDataSource(null,null,()=>hardware);
            source.Read("hardware.read");
            source.ObserveSnapshot(new(1,Guid.NewGuid(),"room","home",null,null,null,2,false,null){IsDesktopForeground=false});
            hardware.Emit(new(){IsAvailable=true,CurrentCpu=17,TotalRam=16000,CurrentRamAvail=8000});
            var data=source.Read("hardware.read");
            Eq("available",data.Status);Eq(17f,data.Value!.Value.GetProperty("cpuPercent").GetSingle());Eq(0,hardware.Stops);
        });
    }
    sealed class VisibleHardware:IHardwareUsageService
    {
        public event EventHandler<HardwareUsageEventArgs>? HWMonitor;
        public int Stops;
        public void Start(){}
        public void Stop()=>Interlocked.Increment(ref Stops);
        public void Emit(HardwareUsageEventArgs sample)=>HWMonitor?.Invoke(this,sample);
    }
}
