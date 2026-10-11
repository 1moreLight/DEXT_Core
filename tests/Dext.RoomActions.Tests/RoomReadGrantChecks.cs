using Dext.Core.Rooms;
using System.Text.Json;
static partial class RoomActionChecks
{
 public static void ReadGrantChecks(Action<string,Action> check)
 {
  static string Stamp(ActionFixture f)=>f.Kernel.Snapshot!.InstallationStamp;
  static RoomReadGrantsReply Read(ActionFixture f)=>f.Actions.GetReadGrants(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f));
  static RoomReadGrantsReply Edit(ActionFixture f,string[] capabilities,bool allow,string consumer="scene")=>
    f.Actions.SetReadGrant(f.Coordinator,f.CorePeer,f.Session,Room,Stamp(f),consumer,capabilities,allow);
  static bool Allowed(RoomReadGrantsReply reply,string capability)=>
    reply.Consumers!.Single(c=>c.ConsumerId=="scene").Capabilities.Single(c=>c.Capability==capability).Allowed;
  check("configurator storage grants allow independent read write and survive store reopen",()=>{
   using var f=new ActionFixture(dataCapabilities:true,storageCapabilities:true);
   Eq("accepted",Edit(f,new[]{"storage.read","storage.write"},false).Status);
   Eq(false,Allowed(Read(f),"storage.read"));Eq(false,Allowed(Read(f),"storage.write"));
   Eq("accepted",Edit(f,new[]{"storage.write"},true).Status);
   var rev=f.Kernel.Snapshot!.Revision;
   Eq(RoomActionStatus.Accepted,f.Actions.WriteStorage(f.View,f.Peer,f.Session,rev,"scene","counter",JsonSerializer.SerializeToElement(12)).Status);
   Eq(RoomActionStatus.MissingPermission,f.Actions.ReadStorage(f.View,f.Peer,f.Session,rev,"scene","counter").Status);
   Eq("accepted",Edit(f,new[]{"storage.read"},true).Status);
   Eq(12,f.Actions.ReadStorage(f.View,f.Peer,f.Session,rev,"scene","counter").Value!.Value.GetInt32());
   Eq("accepted",Edit(f,new[]{"storage.write"},false).Status);
   Eq(RoomActionStatus.MissingPermission,f.Actions.WriteStorage(f.View,f.Peer,f.Session,rev,"scene","counter",JsonSerializer.SerializeToElement(99)).Status);
   var reopened=new RoomPersonalStore(f.PersonalPath).Read().Rooms[Room];
   Eq(12,reopened.Storage["scene"]["counter"].GetInt32());
   Eq(true,reopened.Grants["scene"].Capabilities.Contains("storage.read"));
   Eq(false,reopened.Grants["scene"].Capabilities.Contains("storage.write"));
   Eq(true,Allowed(Read(f),"time.read"));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
  });
  check("new storage grant does not promote old installation grants or bypass data endpoint",()=>{
   using var f=new ActionFixture(dataCapabilities:true,storageCapabilities:true);
   f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new("old-installation",new[]{"binding.launch","storage.read","storage.write","time.read"}));
   Eq(false,Allowed(Read(f),"storage.read"));
   Eq("accepted",Edit(f,new[]{"storage.read"},true).Status);
   Eq(false,Allowed(Read(f),"storage.write"));Eq(false,Allowed(Read(f),"time.read"));
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
   Eq(RoomActionStatus.Forbidden,f.Actions.ReadData(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene","storage.read",()=>new("available")).Status);
  });
  check("failed storage grant preserves current grants and stored values",()=>{
   using var f=new ActionFixture(storageCapabilities:true);var file=Path.Combine(f.PersonalPath,"personal.json");
   var bytes=File.ReadAllBytes(file);
   using(var held=File.Open(file,FileMode.Open,FileAccess.Read,FileShare.Read))
    Eq("storageUnavailable",Edit(f,new[]{"storage.write"},false).Status);
   Eq(Convert.ToHexString(bytes),Convert.ToHexString(File.ReadAllBytes(file)));
   Eq(true,Allowed(Read(f),"storage.write"));
  });
  check("configurator read grant enables real time provider and revoke hides it",()=>{
   using var f=new ActionFixture(dataCapabilities:true);
   Eq("accepted",Edit(f,new[]{"time.read","hardware.read","media.read","audio.read"},false).Status);
   Eq(false,Allowed(Read(f),"time.read"));
   Eq(RoomActionStatus.MissingPermission,f.Actions.ReadData(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene","time.read",()=>new("available",JsonSerializer.SerializeToElement(7))).Status);
   Eq("accepted",Edit(f,new[]{"time.read"},true).Status);
   using var source=new RoomNativeDataSource(null,null,null);
   var sample=f.Actions.ReadData(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene","time.read",()=>source.Read("time.read"));
   Eq(RoomActionStatus.Accepted,sample.Status);Eq("available",sample.Sample!.Status);
   if(sample.Sample.Value!.Value.GetProperty("unixMilliseconds").GetInt64()<=0)throw new Exception("actual clock value missing");
   Eq("accepted",Edit(f,new[]{"time.read"},false).Status);
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","time.read"));
  });
  check("editing only read grants preserves targets buttons layout storage and unrelated authorization",()=>{
   using var f=new ActionFixture(dataCapabilities:true,storageCapabilities:true);
   var before=f.Store.Read();var legacy=before.Rooms[Room].Grants["scene"];
   Eq("accepted",Edit(f,new[]{"hardware.read"},false).Status);
   var after=f.Store.Read();
   Eq(JsonSerializer.Serialize(before.Targets),JsonSerializer.Serialize(after.Targets));
   Eq(JsonSerializer.Serialize(before.Rooms[Room].Buttons),JsonSerializer.Serialize(after.Rooms[Room].Buttons));
   Eq(JsonSerializer.Serialize(before.Rooms[Room].Layout),JsonSerializer.Serialize(after.Rooms[Room].Layout));
   Eq(JsonSerializer.Serialize(before.Rooms[Room].Storage),JsonSerializer.Serialize(after.Rooms[Room].Storage));
   Eq(JsonSerializer.Serialize(legacy),JsonSerializer.Serialize(after.Rooms[Room].Grants["scene"]));
   Eq(true,Allowed(Read(f),"time.read"));Eq(false,Allowed(Read(f),"hardware.read"));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
   Eq(RoomActionStatus.Accepted,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","storage.read"));
  });
  check("old installation permissions are not promoted by a new read grant",()=>{
   using var f=new ActionFixture(dataCapabilities:true);
   f.Store.Update(state=>{state.Rooms[Room].Grants["scene"]=new("old-installation",new[]{"binding.launch","time.read","hardware.read"});
    state.Rooms[Room].ReadGrants["scene"]=new("old-installation",new[]{"time.read","hardware.read"});});
   Eq(false,Allowed(Read(f),"time.read"));Eq(false,Allowed(Read(f),"hardware.read"));
   Eq("accepted",Edit(f,new[]{"time.read"},true).Status);
   Eq(true,Allowed(Read(f),"time.read"));Eq(false,Allowed(Read(f),"hardware.read"));
   Eq("old-installation",f.Store.Read().Rooms[Room].Grants["scene"].InstallationStamp);
   Eq(RoomActionStatus.MissingPermission,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","binding.launch"));
   Eq("staleSession",f.Actions.SetReadGrant(f.Coordinator,f.CorePeer,f.Session,Room,"old-installation","scene",new[]{"hardware.read"},true).Status);
  });
  check("configurator can edit while paused but author data keeps lifecycle rules",()=>{
   using var f=new ActionFixture(dataCapabilities:true);f.Lifecycle(RoomLifecycleStage.Desktop,paused:true);
   Eq("accepted",Edit(f,new[]{"time.read"},false).Status);
   Eq("accepted",Edit(f,new[]{"time.read"},true).Status);
   Eq(true,Allowed(Read(f),"time.read"));
   Eq(RoomActionStatus.NotOperable,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"scene","time.read"));
  });
  check("failed read grant publication preserves previous file and effective flags",()=>{
   using var f=new ActionFixture(dataCapabilities:true);var file=Path.Combine(f.PersonalPath,"personal.json");
   var bytes=File.ReadAllBytes(file);
   using(var held=File.Open(file,FileMode.Open,FileAccess.Read,FileShare.Read))
    Eq("storageUnavailable",Edit(f,new[]{"time.read"},false).Status);
   Eq(Convert.ToHexString(bytes),Convert.ToHexString(File.ReadAllBytes(file)));
   Eq(true,Allowed(Read(f),"time.read"));
  });
  check("unchanged grant does not publish and only declared read capabilities are configurable",()=>{
   using var f=new ActionFixture(dataCapabilities:true);
   Eq("accepted",Edit(f,new[]{"time.read"},true).Status);var revision=f.Store.Read().Revision;
   Eq("accepted",Edit(f,new[]{"time.read"},true).Status);Eq(revision,f.Store.Read().Revision);
   Eq("forbidden",Edit(f,new[]{"binding.launch"},true).Status);
   Eq("forbidden",Edit(f,new[]{"time.read"},true,"component.widget").Status);
   Eq("forbidden",f.Actions.GetReadGrants(f.View,f.Peer,f.Session,Room,Stamp(f)).Status);
  });
 }
}
