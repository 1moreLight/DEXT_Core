using Dext.Core.Rooms;
static partial class RoomActionChecks
{
    static void SourceInputChecks(Action<string,Action> check)
    {
        var viewport=new RoomNativeViewport((nint)10,100,200,1000,1000,8);
        RoomSessionPlayerBridge Start(ActionFixture f,out RoomNativeInputAuthority input){
            input=f.Actions.CreateNativeInput();input.Initialize(1,f.Kernel.Snapshot!);
            f.Lifecycle(RoomLifecycleStage.Desktop);
            Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,input.ObserveSnapshot,out var bridge));
            Eq(RoomProtocolStatus.Accepted,f.Gateway.Request(f.View,f.Peer,f.Session,"focus").Status);
            Eq(true,bridge!.PublishNativeGeometry(input,1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,Array.Empty<RoomNativeButton>(),true));return bridge;
        }
        long Sample(ActionFixture f,RoomSessionPlayerBridge bridge,RoomNativeInputAuthority input,string consumer,string button){
            var revision=f.Kernel.Snapshot!.Revision;input.MouseDown(viewport,300,400,true);var sequence=input.State!.Gesture!.Sequence;
            input.MouseUp(viewport,300,400,true);var entries=new[]{new RoomNativeButton(consumer,button,.1,.1,.2,.2,0,"button."+button)};
            Eq(true,bridge.SampleNativeGeometry(input,1,f.Session,revision,1,sequence,"down",viewport,entries,true));
            Eq(true,bridge.SampleNativeGeometry(input,1,f.Session,revision,1,sequence,"up",viewport,entries,true));return sequence;
        }
        foreach(var consumer in new[]{"scene","official","component.widget","slot.background.home"})check("visible source sampled input launches once "+consumer,()=>{
            using var f=new ActionFixture(mediaSlots:true,sourceScoped:true);using var bridge=Start(f,out var input);
            var sequence=Sample(f,bridge,input,consumer,"open");var revision=f.Kernel.Snapshot!.Revision;
            var result=bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,consumer,"open",sequence);
            Eq(RoomActionStatus.Accepted,result.Status);Eq(true,result.InputConsumed);Eq(1,f.Launched.Count);
            Eq(RoomActionStatus.StaleInput,bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,consumer,"open",sequence).Status);
            Eq(RoomActionStatus.Forbidden,f.Input("open",consumer).Status);
        });
        foreach(var key in new[]{13,32})check("sampled visible source key launches once "+key,()=>{
            using var f=new ActionFixture(sourceScoped:true);using var bridge=Start(f,out var input);
            Sample(f,bridge,input,"scene","open");var revision=f.Kernel.Snapshot!.Revision;
            input.Key(viewport,key,true,false,true);var sequence=input.State!.Gesture!.Sequence;
            input.Key(viewport,key,false,false,true);Eq(null,input.State!.Completed);
            var entries=new[]{new RoomNativeButton("scene","open",.35,.2,.2,.2,0,"button.open")};
            Eq(true,bridge.SampleNativeGeometry(input,1,f.Session,revision,1,sequence,"down",viewport,entries,true,key,"scene","open","button.open"));
            entries[0]=entries[0] with{X=.45};
            Eq(true,bridge.SampleNativeGeometry(input,1,f.Session,revision,1,sequence,"up",viewport,entries,true,key,"scene","open","button.open"));
            Eq(true,input.State!.Completed!.SampledVisual);Eq(false,input.State.Completed.SampledMouse);
            var result=bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,"scene","open",sequence);
            Eq(RoomActionStatus.Accepted,result.Status);Eq(true,result.InputConsumed);Eq(1,f.Launched.Count);
            Eq(RoomActionStatus.StaleInput,bridge.ActivateNative(f.Actions,input,1,f.Session,revision,1,"scene","open",sequence).Status);
        });
        check("visible source metadata exposes actions without granting data or storage",()=>{
            using var f=new ActionFixture(storageCapabilities:true,sourceScoped:true);using var bridge=Start(f,out var input);
            Eq(RoomActionStatus.Accepted,f.Actions.ReadButtons(f.View,f.Peer,f.Session,"component.widget").Status);
            var caps=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"component.widget",f.Kernel.Snapshot!.Revision);
            Eq(RoomActionStatus.Accepted,caps.Status);Eq(RoomActionStatus.Accepted,caps.Capabilities!["binding.launch"]);
            Eq(RoomActionStatus.NotOperable,caps.Capabilities!["storage.read"]);
            Eq(RoomActionStatus.Forbidden,f.Actions.AuthorizeCapability(f.View,f.Peer,f.Session,"component.widget","storage.read"));
        });
        check("source navigation uses the existing target as its queue base",()=>{
            using var f=new ActionFixture(sourceScoped:true);using var bridge=Start(f,out var input);var sequence=Sample(f,bridge,input,"scene","next");
            var result=bridge.NavigateNative(f.Actions,input,1,f.Session,f.Kernel.Snapshot!.Revision,1,"scene",new("desk.next"),sequence);
            Eq(RoomActionStatus.Queued,result.Status);Eq("home",f.Kernel.Snapshot!.QueuedDeskId);Eq(true,result.InputConsumed);
        });
        check("source media control consumes its sampled gesture once",()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true,sourceScoped:true);using var bridge=Start(f,out var input);
            var sequence=Sample(f,bridge,input,"component.widget","dynamic");var calls=0;
            var result=bridge.ControlNativeAsync(f.Actions,input,1,f.Session,f.Kernel.Snapshot!.Revision,1,"component.widget",new("media.control","next"),
                _=>{calls++;return Task.FromResult(true);},sequence).GetAwaiter().GetResult();
            Eq(RoomActionStatus.Accepted,result.Status);Eq(true,result.InputConsumed);Eq(1,calls);
        });
        check("source exit confirmation retains only its original transition pair after modal pause",()=>{
            using var f=new ActionFixture(sourceScoped:true);using var bridge=Start(f,out var input);var sequence=Sample(f,bridge,input,"scene","exit");
            var result=bridge.ActivateNative(f.Actions,input,1,f.Session,f.Kernel.Snapshot!.Revision,1,"scene","exit",sequence);
            Eq(RoomActionStatus.RequiresConfirmation,result.Status);Eq(true,result.InputConsumed);
            f.Lifecycle(RoomLifecycleStage.Desktop,paused:true);Eq("focus",f.Kernel.Snapshot!.CurrentDeskId);
            Eq(RoomActionStatus.Accepted,bridge.ConfirmNativeExit(f.Actions,input,1,result.Exit!,true).Status);
        });
    }
}
