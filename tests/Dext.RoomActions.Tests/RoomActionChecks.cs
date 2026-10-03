using Dext.Core.Rooms;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

static partial class RoomActionChecks
{
    private const string Room = "d390f9c9-8136-4c56-a00b-afabbac4db2c";
    private const string Target = "ee0760c2-a1e3-4094-b002-81b6ab22a7d5";
    static void Eq<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}, got {actual}"); }
    public static void Run(Action<string, Action> check)
    {
        LayoutChecks(check);

        check("timed-out Windows control retains attachment admission until actual terminal",()=>{
            var queue=new RoomNativeControlQueue(TimeSpan.FromMilliseconds(50));var release=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);using var started=new ManualResetEventSlim();
            var terminal=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);int calls=0;
            try{
                var result=queue.RunAsync(async token=>{Interlocked.Increment(ref calls);started.Set();await release.Task;terminal.SetResult();return new(RoomActionStatus.Accepted,7,true);},()=>new(RoomActionStatus.ControlUnavailable,7,true));
                Eq(true,started.Wait(TimeSpan.FromSeconds(2)));var timeout=result.GetAwaiter().GetResult();Eq(RoomActionStatus.ControlUnavailable,timeout.Status);Eq(true,timeout.InputConsumed);
                var busy=queue.RunAsync(token=>{calls++;return Task.FromResult(new RoomNativeActionReply(RoomActionStatus.Accepted));},()=>new(RoomActionStatus.ControlUnavailable)).GetAwaiter().GetResult();
                Eq(RoomActionStatus.ControlUnavailable,busy.Status);Eq(0L,busy.InputSequence);Eq(1,calls);
            }finally{release.TrySetResult();terminal.Task.Wait(TimeSpan.FromSeconds(2));}
            Eq(true,SpinWait.SpinUntil(()=>queue.RunAsync(token=>Task.FromResult(new RoomNativeActionReply(RoomActionStatus.Accepted)),()=>new(RoomActionStatus.ControlUnavailable)).GetAwaiter().GetResult().Status==RoomActionStatus.Accepted,TimeSpan.FromSeconds(2)));
        });
        check("global Windows admission bounds hung jobs across replacement attachments",()=>{
            var queues=Enumerable.Range(0,5).Select(_=>new RoomNativeControlQueue(TimeSpan.FromMilliseconds(70))).ToArray();
            var release=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);using var started=new CountdownEvent(4);using var terminal=new CountdownEvent(4);int calls=0;
            try{
                var jobs=queues.Take(4).Select(q=>q.RunAsync(async token=>{Interlocked.Increment(ref calls);started.Signal();await release.Task;terminal.Signal();return new(RoomActionStatus.Accepted);},()=>new(RoomActionStatus.ControlUnavailable))).ToArray();
                Eq(true,started.Wait(TimeSpan.FromSeconds(2)));Task.WhenAll(jobs).GetAwaiter().GetResult();
                Eq(RoomActionStatus.ControlUnavailable,queues[4].RunAsync(token=>{calls++;return Task.FromResult(new RoomNativeActionReply(RoomActionStatus.Accepted));},()=>new(RoomActionStatus.ControlUnavailable)).GetAwaiter().GetResult().Status);Eq(4,calls);
            }finally{release.TrySetResult();terminal.Wait(TimeSpan.FromSeconds(2));}
        });
        RoomNativeInputAuthority Native(ActionFixture f) {
            var input=f.Actions.CreateNativeInput();input.Initialize(1,f.Kernel.Snapshot!);return input;
        }
        var viewport=new RoomNativeViewport((nint)10,100,200,1000,1000,8);
        RoomNativeButton[] Entries()=>new[]{new RoomNativeButton("scene","open",.1,.1,.2,.2,0)};
        void Geometry(ActionFixture f,RoomNativeInputAuthority input,long version=1,long generation=1) =>
            Eq(true,input.PublishGeometry(generation,f.Session,f.Kernel.Snapshot!.Revision,version,viewport,Entries()));
        RoomNativeInputProof Pair(ActionFixture f,RoomNativeInputAuthority input) {
            input.MouseDown(viewport,300,400,true);input.MouseUp(viewport,300,400,true);
            return input.GetProof(1,1,"scene","open")??throw new Exception("native pair missing");
        }
        RoomInputReply Ticket(ActionFixture f,RoomNativeInputProof proof)=>f.Actions.IssueHostInput(f.View,f.Peer,f.Session,"scene","open",proof);
        foreach(var wake in new[]{0,13,32})check("wake input held edge cannot become activation on repeat "+wake,()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);n.CheckNativeViewport(viewport,false);
            if(wake==0)n.MouseDown(viewport,300,400,false);else n.Key(viewport,wake,true,false,false);
            Geometry(f,n,2);n.Key(viewport,9,true,false,true);n.Key(viewport,9,false,false,true);
            if(wake==0){n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);}
            else {n.Key(viewport,wake,true,false,true);n.Key(viewport,wake,false,false,true);}
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,2,"scene","open"));
            if(wake==0){n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);}
            else {n.Key(viewport,wake,true,false,true);n.Key(viewport,wake,false,false,true);}
            Eq(true,n.GetProof(1,2,"scene","open")!=null);
        });
        void NavigationPair(ActionFixture f,RoomNativeInputAuthority input,string consumer="scene",string button="next",long version=1) {
            Eq(true,input.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,version,viewport,new[]{new RoomNativeButton(consumer,button,.1,.1,.2,.2,0)}));
            input.MouseDown(viewport,300,400,true);input.MouseUp(viewport,300,400,true);
        }
        RoomSessionPlayerBridge NavigationBridge(ActionFixture f,RoomNativeInputAuthority input) {
            Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,input.ObserveSnapshot,out var bridge));return bridge!;
        }
        check("native completion sequences are monotonic across mouse keyboard geometry and generation",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);var first=Pair(f,n);
            Eq(1L,first.Sequence);n.Key(viewport,13,true,false,true);n.Key(viewport,13,false,false,true);var second=n.GetProof(1,1,"scene","open")!;
            Eq(2L,second.Sequence);Geometry(f,n,2);n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);Eq(3L,n.GetProof(1,2,"scene","open")!.Sequence);
            n.Initialize(2,f.Kernel.Snapshot!);Geometry(f,n,1,2);n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);Eq(4L,n.GetProof(2,1,"scene","open")!.Sequence);
        });
        check("delayed default sequence cannot consume a later input on the same button",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);Geometry(f,n);var first=Pair(f,n);var second=Pair(f,n);
            var stale=bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open",first.Sequence);
            Eq(RoomActionStatus.StaleInput,stale.Status);Eq(false,stale.InputConsumed);Eq(0,f.Launched.Count);
            var accepted=bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open",second.Sequence);
            Eq(RoomActionStatus.Accepted,accepted.Status);Eq(second.Sequence,accepted.InputSequence);Eq(true,accepted.InputConsumed);Eq(1,f.Launched.Count);
            Eq(RoomActionStatus.StaleInput,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open",second.Sequence).Status);Eq(1,f.Launched.Count);
        });
        check("navigation receipt identifies consumed completion before private notification",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);var sequence=n.State!.Completed!.Sequence;
            var reply=bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next"));
            Eq(RoomActionStatus.Accepted,reply.Status);Eq(sequence,reply.InputSequence);Eq(true,reply.InputConsumed);
        });
        check("navigation mismatch receipt leaves exact input for personal/default fallback",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);var sequence=n.State!.Completed!.Sequence;
            var denied=bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.previous"),sequence);
            Eq(RoomActionStatus.Denied,denied.Status);Eq(sequence,denied.InputSequence);Eq(false,denied.InputConsumed);
            Eq(true,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","next",sequence).InputConsumed);
        });
        foreach(var media in new[]{"play","pause","toggle","next","previous"})check("native media controls consume one declared input "+media,()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var calls=0;
            var request=new RoomSystemControl("media.control",media);
            var reply=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",request,c=>{Eq(request,c);calls++;return Task.FromResult(true);}).GetAwaiter().GetResult();
            Eq(RoomActionStatus.Accepted,reply.Status);Eq(1L,reply.InputSequence);Eq(true,reply.InputConsumed);Eq(1,calls);
            Eq(RoomActionStatus.InputRequired,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",request,c=>{calls++;return Task.FromResult(true);}).GetAwaiter().GetResult().Status);Eq(1,calls);
        });
        foreach(var patch in new[]{new RoomSystemControl("audio.control",Volume:0),new RoomSystemControl("audio.control",Volume:1),new RoomSystemControl("audio.control",Muted:true),new RoomSystemControl("audio.control",Muted:false),new RoomSystemControl("audio.control",Volume:.25,Muted:true)})check("native audio typed patch "+patch,()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");
            Eq(RoomActionStatus.Accepted,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",patch,c=>{Eq(patch,c);return Task.FromResult(true);}).GetAwaiter().GetResult().Status);
        });
        foreach(var request in new[]{new RoomSystemControl("media.control","execute"),new RoomSystemControl("media.control","play",Volume:.3),new RoomSystemControl("audio.control"),new RoomSystemControl("audio.control","play",Volume:.3),new RoomSystemControl("audio.control",Volume:double.NaN),new RoomSystemControl("audio.control",Volume:-.1),new RoomSystemControl("audio.control",Volume:1.1),new RoomSystemControl("binding.launch","play")})check("invalid system control does not consume proof "+request,()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var calls=0;
            var reply=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",request,c=>{calls++;return Task.FromResult(true);}).GetAwaiter().GetResult();
            Eq(RoomActionStatus.Denied,reply.Status);Eq(false,reply.InputConsumed);Eq(0,calls);Eq(true,n.State!.Completed!=null);
        });
        foreach(var failure in new[]{"grant","consumer","expired","geometry","generation","paused","locked","foreground","disposed"})check("native system control rejects changed current facts "+failure,()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var calls=0;var consumer="scene";var expected=RoomActionStatus.StaleInput;
            switch(failure){
                case "grant":f.Store.Update(s=>s.Rooms[Room].Grants.Remove("scene"));expected=RoomActionStatus.MissingPermission;break;
                case "consumer":consumer="component.widget";expected=RoomActionStatus.InputRequired;break;
                case "expired":f.Clock.Advance(TimeSpan.FromSeconds(2));expected=RoomActionStatus.ExpiredInput;break;
                case "geometry":n.InvalidateGeometry(1,f.Session,1);expected=RoomActionStatus.InputRequired;break;
                case "generation":n.Initialize(2,f.Kernel.Snapshot!);break;
                case "paused":f.Lifecycle(RoomLifecycleStage.Desktop,paused:true);break;
                case "locked":f.Lifecycle(RoomLifecycleStage.Desktop,locked:true);break;
                case "foreground":f.Gateway.SetOperable(f.Coordinator,f.CorePeer,f.Session,false);break;
                case "disposed":bridge.Dispose();expected=RoomActionStatus.StaleSession;break;
            }
            Eq(expected,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,consumer,new("media.control","play"),c=>{calls++;return Task.FromResult(true);}).GetAwaiter().GetResult().Status);Eq(0,calls);
        });
        check("author system control cannot replace current personal binding and leaves exact fallback",()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);f.Store.Update(s=>s.Rooms[Room].Buttons["dynamic"]=new(TargetId:Target));
            var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var sequence=n.State!.Completed!.Sequence;var calls=0;
            var denied=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","play"),c=>{calls++;return Task.FromResult(true);},sequence).GetAwaiter().GetResult();
            Eq(RoomActionStatus.Denied,denied.Status);Eq(false,denied.InputConsumed);Eq(0,calls);Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","dynamic",sequence).Status);Eq(1,f.Launched.Count);
        });
        check("author control cannot replace authored navigation default",()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);var calls=0;
            Eq(RoomActionStatus.Denied,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("audio.control",Volume:.5),c=>{calls++;return Task.FromResult(true);}).GetAwaiter().GetResult().Status);
            Eq(0,calls);Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","next").Status);
        });
        foreach(var error in new[]{"false","exception","cancel"})check("system failures expose safe status and preserve actual consumed edge "+error,()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var calls=0;
            var reply=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","play"),c=>{calls++;if(error=="exception")throw new IOException("private path");if(error=="cancel")return Task.FromCanceled<bool>(new CancellationToken(true));return Task.FromResult(false);}).GetAwaiter().GetResult();
            Eq(RoomActionStatus.ControlUnavailable,reply.Status);Eq(true,reply.InputConsumed);Eq(1,calls);
        });
        check("system control callback runs outside all authority locks and current consent is rechecked",()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");
            var reply=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","play"),async c=>{
                var check=Task.Run(()=>f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene").Status);
                Eq(RoomActionStatus.Accepted,await check.WaitAsync(TimeSpan.FromSeconds(2)));return true;
            }).GetAwaiter().GetResult();Eq(RoomActionStatus.Accepted,reply.Status);
        });
        check("rapid new real system inputs are rate limited without consuming the next proof",()=>{
            using var f=new ActionFixture(navigationDynamic:true,controlCapabilities:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");var calls=0;
            Task<bool> Send(RoomSystemControl c){calls++;return Task.FromResult(true);}
            Eq(RoomActionStatus.Accepted,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","play"),Send).GetAwaiter().GetResult().Status);
            n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);
            var limited=bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","pause"),Send).GetAwaiter().GetResult();Eq(RoomActionStatus.RateLimited,limited.Status);Eq(false,limited.InputConsumed);Eq(1,calls);
            f.Clock.Advance(TimeSpan.FromMilliseconds(100));Eq(RoomActionStatus.Accepted,bridge.ControlNativeAsync(f.Actions,n,1,f.Session,1,1,"scene",new("media.control","pause"),Send).GetAwaiter().GetResult().Status);Eq(2,calls);
        });

        RoomExitConfirmation ExitPermit(ActionFixture f,RoomSessionPlayerBridge bridge,RoomNativeInputAuthority native){
            NavigationPair(f,native,"scene","exit");
            var reply=bridge.ActivateNative(f.Actions,native,1,f.Session,1,1,"scene","exit");
            Eq(RoomActionStatus.RequiresConfirmation,reply.Status);Eq(true,reply.InputConsumed);
            return reply.Exit??throw new Exception("missing private confirmation");
        }
        foreach(var outcome in new[]{"cancel","confirm","stale","revoke","uiFailure"})check("Core native confirmation coordinator "+outcome,()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            var current=true;var prompts=0;var exits=0;var coordinator=new RoomNativeExitCoordinator();
            Task<bool> Ask(){prompts++;if(outcome=="stale")current=false;
                if(outcome=="revoke")f.Store.Update(state=>state.Rooms[Room].Grants.Clear());
                if(outcome=="uiFailure")throw new InvalidOperationException("private UI error");
                return Task.FromResult(outcome!="cancel");}
            var result=coordinator.RunAsync(()=>current,Ask,approved=>bridge.ConfirmNativeExit(f.Actions,n,1,permit,approved),
                ()=>{exits++;return Task.CompletedTask;}).GetAwaiter().GetResult();
            Eq(1,prompts);Eq(outcome=="confirm"?1:0,exits);
            Eq(outcome switch{"confirm"=>RoomActionStatus.Accepted,"stale"=>RoomActionStatus.StaleInput,"revoke"=>RoomActionStatus.MissingPermission,_=>RoomActionStatus.Cancelled},result.Status);
            Eq(RoomActionStatus.Denied,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);
        });
        check("Core confirmation serializes pending native dialogs and discards busy permits",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            using var other=new ActionFixture();var on=Native(other);using var ob=NavigationBridge(other,on);var op=ExitPermit(other,ob,on);
            var entered=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);var release=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);var prompts=0;
            var pending=new RoomNativeExitCoordinator().RunAsync(()=>true,()=>{entered.SetResult();return release.Task;},v=>bridge.ConfirmNativeExit(f.Actions,n,1,permit,v),()=>throw new Exception("cancel must not exit"));
            try{entered.Task.Wait(TimeSpan.FromSeconds(2));
                Eq(RoomActionStatus.Cancelled,new RoomNativeExitCoordinator().RunAsync(()=>true,()=>{prompts++;return Task.FromResult(true);},v=>ob.ConfirmNativeExit(other.Actions,on,1,op,v),()=>throw new Exception("busy must not exit")).GetAwaiter().GetResult().Status);
                Eq(0,prompts);Eq(RoomActionStatus.Denied,ob.ConfirmNativeExit(other.Actions,on,1,op,true).Status);
            }finally{release.TrySetResult(false);}
            Eq(RoomActionStatus.Cancelled,pending.GetAwaiter().GetResult().Status);
        });
        check("native exit needs no author confirmation fields and cancellation consumes its private permit",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            Eq(RoomActionStatus.Cancelled,bridge.ConfirmNativeExit(f.Actions,n,1,permit,false).Status);
            Eq(RoomActionStatus.Denied,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);Eq(0,f.Launched.Count);
        });
        check("trusted native exit confirmation tolerates its own pause foreground and unrelated private revision",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            f.Kernel.SetRuntimeFacts(f.Session,new(true,false,false));n.ObserveSnapshot(f.Kernel.Snapshot!);f.Store.Update(state=>state.Targets[Target]=new("Changed","application",@"C:\Windows\System32\calc.exe"));
            Eq(RoomActionStatus.Accepted,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);
            Eq(RoomActionStatus.Denied,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);Eq(0,f.Launched.Count);
        });
        foreach(var change in new[]{"grant","binding","installation","closed","locked","stage","document"})check("native confirmed exit rechecks current "+change,()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            if(change=="grant")f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=state.Rooms[Room].Grants["scene"] with{Capabilities=Array.Empty<string>()});
            if(change=="binding")f.Store.Update(state=>state.Rooms[Room].Buttons["exit"]=new("binding.launch",TargetId:Target));
            if(change=="installation")f.Admission.ReplaceInstallation();if(change=="closed")bridge.Dispose();
            if(change=="locked")f.Kernel.SetRuntimeFacts(f.Session,new(true,true,false));
            if(change=="stage")f.Kernel.SetHostStage(f.Session,RoomLifecycleStage.Idle);
            if(change=="document")n.Initialize(2,f.Kernel.Snapshot!);else n.ObserveSnapshot(f.Kernel.Snapshot!);
            var expected=change switch{"grant"=>RoomActionStatus.MissingPermission,"binding"=>RoomActionStatus.Denied,"closed"=>RoomActionStatus.StaleSession,"installation"=>RoomActionStatus.Denied,"locked"=>RoomActionStatus.NotOperable,"stage"=>RoomActionStatus.Forbidden,_=>RoomActionStatus.StaleInput};
            Eq(expected,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);Eq(0,f.Launched.Count);
        });
        check("private exit continuation is absent from both JSON serializers",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,"scene","exit");
            var reply=bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","exit");Eq(true,reply.Exit!=null);
            Eq(false,JsonSerializer.Serialize(reply).Contains("Exit"));Eq(false,Newtonsoft.Json.JsonConvert.SerializeObject(reply).Contains("Exit"));
            var direct=new RoomActionReply(RoomActionStatus.RequiresConfirmation,reply.Exit);Eq(false,JsonSerializer.Serialize(direct).Contains("Exit"));Eq(false,Newtonsoft.Json.JsonConvert.SerializeObject(direct).Contains("Exit"));
        });
        check("confirmation cannot cross private authority or connection",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);var permit=ExitPermit(f,bridge,n);
            using var other=new ActionFixture();Eq(RoomActionStatus.Denied,other.Actions.ConfirmExit(other.View,other.Peer,permit,true).Status);
            Eq(RoomActionStatus.Denied,f.Actions.ConfirmExit(Guid.NewGuid(),f.Peer,permit,true).Status);
            Eq(RoomActionStatus.Accepted,bridge.ConfirmNativeExit(f.Actions,n,1,permit,true).Status);
        });
        foreach(var type in new[]{"desk.next","desk.previous","desk.go"})check("native authored navigation matches current configured action "+type,()=>{
            using var f=new ActionFixture();if(type!="desk.next")f.Store.Update(state=>state.Rooms[Room].Buttons["next"]=new(type,type=="desk.go"?"focus":null));
            var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);var action=new RoomButtonAction(type,type=="desk.go"?"focus":null);
            Eq(RoomActionStatus.Accepted,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",action).Status);
            Eq("home",f.Kernel.Snapshot!.CurrentDeskId);Eq("focus",f.Kernel.Snapshot.TargetDeskId);Eq(0,f.Launched.Count);
            Eq(RoomActionStatus.StaleInput,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",action).Status);
        });
        check("authored navigation cannot create physical input or borrow another consumer",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);
            Eq(RoomActionStatus.InputRequired,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);
            NavigationPair(f,n);Eq(RoomActionStatus.InputRequired,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"component.widget",new("desk.next")).Status);
            Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Accepted,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);
        });
        check("mismatched navigation leaves configured default for one legitimate fallback",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);
            Eq(RoomActionStatus.Denied,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.previous")).Status);Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","next").Status);Eq("focus",f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.StaleInput,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);
        });
        check("authored navigation cannot override a user's bound application",()=>{
            using var f=new ActionFixture();f.Store.Update(state=>state.Rooms[Room].Buttons["next"]=new("binding.launch",TargetId:Target));
            var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);
            Eq(RoomActionStatus.Denied,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);Eq(0,f.Launched.Count);Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","next").Status);Eq(1,f.Launched.Count);
            Eq(RoomActionStatus.InputRequired,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);Eq(1,f.Launched.Count);
        });
        foreach(var failure in new[]{"grant","expired","geometry","generation","disposed","paused","locked","foreground"})check("native authored navigation rejects changed admission "+failure,()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);
            var expected=RoomActionStatus.StaleInput;
            switch(failure) {
                case "grant":f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new(f.Kernel.Snapshot!.InstallationStamp,new[]{"binding.launch"}));expected=RoomActionStatus.MissingPermission;break;
                case "expired":f.Clock.Advance(TimeSpan.FromSeconds(2));expected=RoomActionStatus.ExpiredInput;break;
                case "geometry":n.InvalidateGeometry(1,f.Session,1);expected=RoomActionStatus.InputRequired;break;
                case "generation":n.Initialize(2,f.Kernel.Snapshot!);break;
                case "disposed":bridge.Dispose();expected=RoomActionStatus.StaleSession;break;
                case "paused":f.Lifecycle(RoomLifecycleStage.Desktop,true);break;
                case "locked":f.Lifecycle(RoomLifecycleStage.Desktop,false,true);break;
                case "foreground":f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));break;
            }
            Eq(expected,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);Eq(0,f.Launched.Count);
        });
        check("an unconfigured declared button can request granted dynamic navigation",()=>{
            using var f=new ActionFixture(navigationDynamic:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");
            Eq(RoomActionStatus.Accepted,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.go","focus")).Status);
            Eq("home",f.Kernel.Snapshot!.CurrentDeskId);Eq("focus",f.Kernel.Snapshot.TargetDeskId);Eq(0,f.Launched.Count);
        });
        check("target-only private binding on an unconfigured button stays authoritative",()=>{
            using var f=new ActionFixture(navigationDynamic:true);f.Store.Update(state=>state.Rooms[Room].Buttons["dynamic"]=new(TargetId:Target));
            var metadata=f.Actions.ReadButtons(f.View,f.Peer,f.Session,"scene").Buttons!.Single(b=>b.Id=="dynamic");Eq("binding.launch",metadata.Action);Eq(true,metadata.IsBound);
            var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");
            Eq(RoomActionStatus.Denied,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.go","focus")).Status);Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","dynamic").Status);Eq(1,f.Launched.Count);
            Eq(RoomActionStatus.InputRequired,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);Eq(1,f.Launched.Count);
        });
        check("dynamic navigation rejects unknown targets without spending the native proof",()=>{
            using var f=new ActionFixture(navigationDynamic:true);var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n,button:"dynamic");
            Eq(RoomActionStatus.Denied,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.go","missing")).Status);Eq<string?>(null,f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Accepted,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.go","focus")).Status);
        });
        check("typed authored navigation rejects malformed variants without consuming default input",()=>{
            using var f=new ActionFixture();var n=Native(f);using var bridge=NavigationBridge(f,n);NavigationPair(f,n);
            foreach(var action in new[]{new RoomButtonAction("binding.launch"),new("desk.next","focus"),new("desk.go"),new("desk.go","missing")})
                Eq(RoomActionStatus.Denied,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",action).Status);
            Eq(RoomActionStatus.Accepted,bridge.NavigateNative(f.Actions,n,1,f.Session,1,1,"scene",new("desk.next")).Status);
        });
        RoomStorageReply Read(ActionFixture f,string key="notes",string consumer="scene",long? revision=null)=>
            f.Actions.ReadStorage(f.View,f.Peer,f.Session,revision??f.Kernel.Snapshot!.Revision,consumer,key);
        RoomActionReply Write(ActionFixture f,string json="{\"items\":[1,true,null]}",string key="notes",string consumer="scene",long? revision=null) {
            using var value=JsonDocument.Parse(json);return f.Actions.WriteStorage(f.View,f.Peer,f.Session,revision??f.Kernel.Snapshot!.Revision,consumer,key,value.RootElement);
        }
        check("consumer JSON storage persists detached values and missing keys return null",()=>{
            using var f=new ActionFixture(storageCapabilities:true);Eq(RoomActionStatus.Accepted,Read(f).Status);Eq<JsonElement?>(null,Read(f).Value);
            Eq(RoomActionStatus.Accepted,Write(f).Status);var read=Read(f);Eq("{\"items\":[1,true,null]}",read.Value!.Value.GetRawText());
            var reopened=new RoomPersonalStore(f.PersonalPath).Read();Eq(3,reopened.Rooms[Room].Storage["scene"]["notes"].GetProperty("items").GetArrayLength());
            reopened.Rooms[Room].Storage.Clear();Eq(3,Read(f).Value!.Value.GetProperty("items").GetArrayLength());
            Eq(RoomActionStatus.Accepted,Write(f,"null").Status);Eq(JsonValueKind.Null,Read(f).Value!.Value.ValueKind);
        });
        check("consumer storage namespaces isolate identical keys and Room copies",()=>{
            using var f=new ActionFixture(storageCapabilities:true);Eq(RoomActionStatus.Accepted,Write(f,"1").Status);
            Eq<JsonElement?>(null,Read(f,consumer:"component.widget").Value);Eq(RoomActionStatus.Accepted,Write(f,"2",consumer:"component.widget").Status);
            Eq(1,Read(f).Value!.Value.GetInt32());Eq(2,Read(f,consumer:"component.widget").Value!.Value.GetInt32());
            const string copy="7265c092-080f-49cb-a001-56495511e9cc";f.Store.CopyRoom(Room,copy);Eq(0,f.Store.Read().Rooms[copy].Storage.Count);
            f.Store.DeleteRoom(Room);Eq(false,f.Store.Read().Rooms.ContainsKey(Room));Eq(true,f.Store.Read().Targets.ContainsKey(Target));
        });
        check("storage authorization is current and each direction has its own grant",()=>{
            using var f=new ActionFixture(storageCapabilities:true);var stamp=f.Kernel.Snapshot!.InstallationStamp;
            f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new(stamp,new[]{"storage.write"}));Eq(RoomActionStatus.Accepted,Write(f).Status);Eq(RoomActionStatus.MissingPermission,Read(f).Status);
            f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new(stamp,new[]{"storage.read"}));Eq(RoomActionStatus.Accepted,Read(f).Status);var revision=f.Store.Read().Revision;
            Eq(RoomActionStatus.MissingPermission,Write(f).Status);Eq(revision,f.Store.Read().Revision);
            f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new("old-installation",new[]{"storage.read","storage.write"}));Eq(RoomActionStatus.MissingPermission,Read(f).Status);Eq(RoomActionStatus.MissingPermission,Write(f).Status);
            using var undeclared=new ActionFixture();Eq(RoomActionStatus.Forbidden,Write(undeclared).Status);Eq(RoomActionStatus.Forbidden,Read(undeclared).Status);
        });
        check("wrong peer role session owner and stale revision cannot read or write storage",()=>{
            using var f=new ActionFixture(storageCapabilities:true);var revision=f.Kernel.Snapshot!.Revision;var before=File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"));
            Eq(RoomActionStatus.Denied,f.Actions.ReadStorage(f.View,new("other"),f.Session,revision,"scene","notes").Status);
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadStorage(f.Coordinator,f.CorePeer,f.Session,revision,"scene","notes").Status);
            Eq(RoomActionStatus.StaleSession,f.Actions.ReadStorage(f.View,f.Peer,Guid.NewGuid(),revision,"scene","notes").Status);
            Eq(RoomActionStatus.UnknownConsumer,Write(f,consumer:"invented").Status);Eq(RoomActionStatus.StaleInput,Write(f,revision:revision+1).Status);
            Eq(RoomActionStatus.StaleInput,Read(f,revision:revision+1).Status);Eq(true,before.SequenceEqual(File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"))));
        });
        foreach(var fact in new[]{"pause","lock","foreground"})check("storage respects current runtime "+fact,()=>{
            using var f=new ActionFixture(storageCapabilities:true);if(fact=="foreground")f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));else f.Lifecycle(RoomLifecycleStage.Desktop,fact=="pause",fact=="lock");
            var revision=f.Store.Read().Revision;Eq(RoomActionStatus.NotOperable,Read(f).Status);Eq(RoomActionStatus.NotOperable,Write(f).Status);Eq(revision,f.Store.Read().Revision);
        });
        check("storage quotas invalid values and invalid keys preserve committed bytes",()=>{
            using var f=new ActionFixture(storageCapabilities:true);Eq(RoomActionStatus.Accepted,Write(f).Status);var before=File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"));
            Eq(RoomActionStatus.Denied,Write(f,JsonSerializer.Serialize(new string('x',32768))).Status);
            Eq(RoomActionStatus.Denied,Write(f,JsonSerializer.Serialize(Enumerable.Repeat(0,4097))).Status);
            Eq(RoomActionStatus.Denied,Write(f,key:"../personal").Status);Eq(RoomActionStatus.Denied,Write(f,key:new string('a',81)).Status);
            var nested="0";for(var i=0;i<26;i++)nested="["+nested+"]";Eq(RoomActionStatus.Denied,Write(f,nested).Status);
            Eq(RoomActionStatus.Denied,f.Actions.WriteStorage(f.View,f.Peer,f.Session,f.Kernel.Snapshot!.Revision,"scene","notes",default).Status);
            Eq(true,before.SequenceEqual(File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"))));
            for(var i=0;i<127;i++)Eq(RoomActionStatus.Accepted,Write(f,"0",key:"k"+i).Status);before=File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"));
            Eq(RoomActionStatus.Denied,Write(f,"0",key:"overflow").Status);Eq(true,before.SequenceEqual(File.ReadAllBytes(Path.Combine(f.PersonalPath,"personal.json"))));
            using var quota=new ActionFixture(storageCapabilities:true);Eq(RoomActionStatus.Accepted,Write(quota,JsonSerializer.Serialize(new string('x',32000)),key:"one").Status);
            Eq(RoomActionStatus.Accepted,Write(quota,JsonSerializer.Serialize(new string('x',32000)),key:"two").Status);before=File.ReadAllBytes(Path.Combine(quota.PersonalPath,"personal.json"));
            Eq(RoomActionStatus.Denied,Write(quota,JsonSerializer.Serialize(new string('x',2000)),key:"three").Status);Eq(true,before.SequenceEqual(File.ReadAllBytes(Path.Combine(quota.PersonalPath,"personal.json"))));
        });
        check("blocked private storage publication returns safe failure and retains old value",()=>{
            using var f=new ActionFixture(storageCapabilities:true);Eq(RoomActionStatus.Accepted,Write(f,"1").Status);var path=Path.Combine(f.PersonalPath,"personal.json");var before=File.ReadAllBytes(path);
            using(var locked=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read))Eq(RoomActionStatus.StorageUnavailable,Write(f,"2").Status);
            Eq(true,before.SequenceEqual(File.ReadAllBytes(path)));Eq(1,Read(f).Value!.Value.GetInt32());
        });
        check("private storage wait rechecks revocation before preparing a write",()=>{
            using var f=new ActionFixture(storageCapabilities:true);using var editing=new ManualResetEventSlim();using var release=new ManualResetEventSlim();using var admitted=new ManualResetEventSlim();
            var edit=Task.Run(()=>{try{f.Store.Update(_=>{editing.Set();release.Wait();throw new OperationCanceledException();});}catch(OperationCanceledException){}});if(!editing.Wait(TimeSpan.FromSeconds(5)))throw new Exception("edit barrier");
            f.Admission.OnAdmit=()=>admitted.Set();var write=Task.Run(()=>Write(f));
            try{if(!admitted.Wait(TimeSpan.FromSeconds(5)))throw new Exception("admit barrier");f.Admission.Enabled=false;}finally{release.Set();}
            if(!Task.WaitAll(new Task[]{edit,write},TimeSpan.FromSeconds(5)))throw new Exception("storage authority deadlock");Eq(false,write.Result.Status==RoomActionStatus.Accepted);Eq(0,f.Store.Read().Rooms[Room].Storage.Count);
        });
        check("pre-storage format1 snapshots remain readable and malformed storage is never cleared",()=>{
            using var f=new ActionFixture(storageCapabilities:true);var path=Path.Combine(f.PersonalPath,"personal.json");var document=JsonNode.Parse(File.ReadAllText(path))!;
            foreach(var entry in document["rooms"]!.AsObject())entry.Value!.AsObject().Remove("storage");File.WriteAllText(path,document.ToJsonString());
            Eq(RoomActionStatus.Accepted,Read(f).Status);Eq<JsonElement?>(null,Read(f).Value);Eq(RoomActionStatus.Accepted,Write(f,"1").Status);
            document=JsonNode.Parse(File.ReadAllText(path))!;document["rooms"]![Room]!["storage"]=null;File.WriteAllText(path,document.ToJsonString());var before=File.ReadAllBytes(path);
            Eq(RoomActionStatus.StorageUnavailable,Read(f).Status);Eq(RoomActionStatus.StorageUnavailable,Write(f).Status);Eq(true,before.SequenceEqual(File.ReadAllBytes(path)));
        });
        check("private storage bridge closes authority after document lease disposal",()=>{
            using var f=new ActionFixture(storageCapabilities:true);Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));
            var revision=f.Kernel.Snapshot!.Revision;using var value=JsonDocument.Parse("{\"notes\":1}");
            Eq(RoomActionStatus.Accepted,bridge!.NativeWriteStorage(f.Actions,f.Session,revision,"scene","notes",value.RootElement).Status);
            Eq(1,bridge.NativeReadStorage(f.Actions,f.Session,revision,"scene","notes").Value!.Value.GetProperty("notes").GetInt32());bridge.Dispose();
            Eq(RoomActionStatus.StaleSession,bridge.NativeReadStorage(f.Actions,f.Session,revision,"scene","notes").Status);
            Eq(RoomActionStatus.StaleSession,bridge.NativeWriteStorage(f.Actions,f.Session,revision,"scene","notes",value.RootElement).Status);
        });
        RoomDataSample Sample(string json="{\"utc\":\"2026-10-03T00:00:00Z\"}") { using var d=JsonDocument.Parse(json);return new("available",d.RootElement.Clone()); }
        RoomDataReply Data(ActionFixture f,Func<RoomDataSample> capture,string capability="time.read",string consumer="scene",long? revision=null) =>
            f.Actions.ReadData(f.View,f.Peer,f.Session,revision??f.Kernel.Snapshot!.Revision,consumer,capability,capture);
        check("consumer data returns detached JSON only after current declaration and consent",()=>{
            using var f=new ActionFixture(dataCapabilities:true);using var doc=JsonDocument.Parse("{\"utc\":\"2026-10-03T00:00:00Z\"}");
            var reply=Data(f,()=>new("available",doc.RootElement));Eq(RoomActionStatus.Accepted,reply.Status);Eq("available",reply.Sample!.Status);
            doc.Dispose();Eq("2026-10-03T00:00:00Z",reply.Sample.Value!.Value.GetProperty("utc").GetString());
        });
        check("capability metadata cannot authorize later data after a private grant edit",()=>{
            using var f=new ActionFixture(dataCapabilities:true);var metadata=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene");var revision=f.Kernel.Snapshot!.Revision;
            Eq(RoomActionStatus.Accepted,metadata.Capabilities!["time.read"]);f.Store.Update(state=>state.Rooms[Room].Grants.Clear());var read=false;
            var reply=Data(f,()=>{read=true;return Sample();});Eq(RoomActionStatus.MissingPermission,reply.Status);Eq(false,read);Eq(revision,f.Kernel.Snapshot!.Revision);Eq<RoomDataSample?>(null,reply.Sample);
        });
        check("data sampling is outside authority locks and rechecks a reentrant grant revocation",()=>{
            using var f=new ActionFixture(dataCapabilities:true);var reply=Data(f,()=>{f.Store.Update(state=>state.Rooms[Room].Grants.Clear());return Sample();});
            Eq(RoomActionStatus.MissingPermission,reply.Status);Eq<RoomDataSample?>(null,reply.Sample);
        });
        check("data from an old revision is dropped after lifecycle changes during capture",()=>{
            using var f=new ActionFixture(dataCapabilities:true);var reply=Data(f,()=>{f.Lifecycle(RoomLifecycleStage.Desktop,true);return Sample();});
            Eq(RoomActionStatus.StaleInput,reply.Status);Eq<RoomDataSample?>(null,reply.Sample);
        });
        check("consumer data rejects wrong peer session role and owner before capture",()=>{
            using var f=new ActionFixture(dataCapabilities:true);var reads=0;RoomDataSample Capture(){reads++;return Sample();}var revision=f.Kernel.Snapshot!.Revision;
            Eq(RoomActionStatus.Denied,f.Actions.ReadData(f.View,new("other"),f.Session,revision,"scene","time.read",Capture).Status);
            Eq(RoomActionStatus.StaleSession,f.Actions.ReadData(f.View,f.Peer,Guid.NewGuid(),revision,"scene","time.read",Capture).Status);
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadData(f.Coordinator,f.CorePeer,f.Session,revision,"scene","time.read",Capture).Status);
            Eq(RoomActionStatus.UnknownConsumer,Data(f,Capture,consumer:"invented").Status);Eq(RoomActionStatus.StaleInput,Data(f,Capture,revision:revision+1).Status);
            Eq(RoomActionStatus.Forbidden,Data(f,Capture,capability:"binding.launch").Status);Eq(0,reads);
        });
        check("undeclared data and an old installation consent do not invoke the provider",()=>{
            using var f=new ActionFixture();var reads=0;RoomDataSample Capture(){reads++;return Sample();}
            Eq(RoomActionStatus.Forbidden,Data(f,Capture).Status);
            f.Store.Update(state=>state.Rooms[Room].Grants["scene"]=new("old-installation",new[]{"hardware.read"}));
            Eq(RoomActionStatus.MissingPermission,Data(f,Capture,"hardware.read").Status);Eq(0,reads);
        });
        foreach(var fact in new[]{"pause","lock","foreground"})check("consumer data does not capture during "+fact,()=>{
            using var f=new ActionFixture(dataCapabilities:true);
            if(fact=="foreground")f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false));else f.Lifecycle(RoomLifecycleStage.Desktop,fact=="pause",fact=="lock");
            var reads=0;var reply=Data(f,()=>{reads++;return Sample();});Eq(RoomActionStatus.NotOperable,reply.Status);Eq(0,reads);Eq<RoomDataSample?>(null,reply.Sample);
        });
        check("failed unavailable and malformed sources expose only safe readout state",()=>{
            using var f=new ActionFixture(dataCapabilities:true);
            var failed=Data(f,()=>throw new IOException("C:/private/secret"));Eq(RoomActionStatus.Accepted,failed.Status);Eq("error",failed.Sample!.Status);Eq(false,JsonSerializer.Serialize(failed).Contains("private"));
            foreach(var status in new[]{"missing","unsupported","error"}) {var reply=Data(f,()=>new(status,Sample().Value));Eq(status,reply.Sample!.Status);Eq<JsonElement?>(null,reply.Sample.Value);}
            Eq("error",Data(f,()=>new("invented",Sample().Value)).Sample!.Status);Eq("error",Data(f,()=>new("available")).Sample!.Status);
            Eq("error",Data(f,()=>Sample(JsonSerializer.Serialize(new{pad=new string('x',33000)}))).Sample!.Status);
            var nested="0";for(var i=0;i<26;i++)nested="["+nested+"]";Eq("error",Data(f,()=>Sample(nested)).Sample!.Status);
        });
        check("data cannot publish after admission withdrawal during capture",()=>{
            using var f=new ActionFixture(dataCapabilities:true);var reply=Data(f,()=>{f.Admission.Enabled=false;return Sample();});
            Eq(false,reply.Status==RoomActionStatus.Accepted);Eq<RoomDataSample?>(null,reply.Sample);
        });
        check("private data bridge rejects disposed lease even while capture is pending",()=>{
            using var f=new ActionFixture(dataCapabilities:true);Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));
            var revision=f.Kernel.Snapshot!.Revision;var reply=bridge!.NativeData(f.Actions,f.Session,revision,"scene","time.read",()=>{bridge.Dispose();return Sample();});
            Eq(false,reply.Status==RoomActionStatus.Accepted);Eq<RoomDataSample?>(null,reply.Sample);
            var reads=0;Eq(RoomActionStatus.StaleSession,bridge.NativeData(f.Actions,f.Session,revision,"scene","time.read",()=>{reads++;return Sample();}).Status);Eq(0,reads);
        });
        check("media data stays within current stage and exact declared consumer",()=>{
            using var f=new ActionFixture(mediaSlots:true,dataCapabilities:true);var reads=0;RoomDataSample Capture(){reads++;return Sample();}
            Eq(RoomActionStatus.Forbidden,Data(f,Capture).Status);Eq(RoomActionStatus.Accepted,Data(f,Capture,consumer:"slot.start").Status);
            f.Lifecycle(RoomLifecycleStage.Idle);Eq(RoomActionStatus.Forbidden,Data(f,Capture,consumer:"slot.start").Status);Eq(RoomActionStatus.Accepted,Data(f,Capture,consumer:"slot.idle").Status);Eq(2,reads);
        });
        check("capability metadata reports only verified declarations and current personal consent",()=>{
            using var f=new ActionFixture();var reply=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene");
            Eq(RoomActionStatus.Accepted,reply.Status);Eq(4,reply.Capabilities!.Count);
            Eq(RoomActionStatus.Accepted,reply.Capabilities["binding.launch"]);
            Eq(RoomActionStatus.MissingPermission,reply.Capabilities["hardware.read"]);
            Eq(false,reply.Capabilities.ContainsKey("storage.read"));
            var json=JsonSerializer.Serialize(reply);Eq(false,json.Contains(Target));Eq(false,json.Contains("notepad"));
            Eq(false,json.Contains("InstallationStamp"));Eq(false,json.Contains("PrivateRevision"));
            f.Store.Update(s=>s.Rooms[Room].Grants.Clear());
            Eq(RoomActionStatus.Accepted,reply.Capabilities["binding.launch"]);
            Eq(RoomActionStatus.MissingPermission,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene").Capabilities!["binding.launch"]);
        });
        check("capability metadata is immutable and stable in declared-key order",()=>{
            using var f=new ActionFixture();var reply=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene");
            Eq("binding.launch,desk.navigate,dext.exit,hardware.read",string.Join(",",reply.Capabilities!.Keys));
            if(reply.Capabilities is IDictionary<string,RoomActionStatus> writable){
                try{writable["binding.launch"]=RoomActionStatus.Denied;throw new Exception("metadata was mutable");}catch(NotSupportedException){}
            }
        });
        check("old installation grants do not authorize capability metadata",()=>{
            using var f=new ActionFixture();f.Store.Update(s=>s.Rooms[Room].Grants["scene"]=new("wrong-installation",new[]{"hardware.read","binding.launch"}));
            var reply=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene");Eq(RoomActionStatus.Accepted,reply.Status);
            Eq(true,reply.Capabilities!.Values.All(v=>v==RoomActionStatus.MissingPermission));
        });
        check("capability query rejects unknown consumer, peer, session and coordinator",()=>{
            using var f=new ActionFixture();
            Eq(RoomActionStatus.UnknownConsumer,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"invented").Status);
            Eq(RoomActionStatus.Denied,f.Actions.ReadCapabilities(f.View,new("another-player"),f.Session,"scene").Status);
            Eq(RoomActionStatus.StaleSession,f.Actions.ReadCapabilities(f.View,f.Peer,Guid.NewGuid(),"scene").Status);
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadCapabilities(f.Coordinator,f.CorePeer,f.Session,"scene").Status);
            f.Admission.Enabled=false;Eq< IReadOnlyDictionary<string,RoomActionStatus>? >(null,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene").Capabilities);
        });
        foreach(var fact in new[]{"pause","lock","foreground"})check("capability metadata suspends current consumption on "+fact,()=>{
            using var f=new ActionFixture();
            if(fact=="foreground")Eq(RoomProtocolStatus.Accepted,f.Gateway.SetRuntimeFacts(f.Coordinator,f.CorePeer,f.Session,new(false,false,false)).Status);
            else f.Lifecycle(RoomLifecycleStage.Desktop,fact=="pause",fact=="lock");
            var reply=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene");Eq(RoomActionStatus.Accepted,reply.Status);
            Eq(true,reply.Capabilities!.Values.All(v=>v==RoomActionStatus.NotOperable));
        });
        check("capability metadata follows the current media phase without scene inheritance",()=>{
            using var f=new ActionFixture(mediaSlots:true);
            Eq(RoomActionStatus.Forbidden,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene").Status);
            var start=f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"slot.start");Eq(RoomActionStatus.Accepted,start.Status);Eq(1,start.Capabilities!.Count);
            Eq(RoomActionStatus.Accepted,start.Capabilities["binding.launch"]);
            f.Lifecycle(RoomLifecycleStage.Idle);Eq(RoomActionStatus.Forbidden,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"slot.start").Status);
            Eq(RoomActionStatus.Accepted,f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"slot.idle").Capabilities!["binding.launch"]);
        });
        check("capability query rechecks the complete grant after waiting for a private edit",()=>{
            using var f=new ActionFixture();using var editing=new ManualResetEventSlim();using var release=new ManualResetEventSlim();using var admitted=new ManualResetEventSlim();
            var edit=Task.Run(()=>f.Store.Update(s=>{editing.Set();if(!release.Wait(TimeSpan.FromSeconds(5)))throw new Exception("edit timeout");
                var grant=s.Rooms[Room].Grants["scene"];s.Rooms[Room].Grants["scene"]=new(grant.InstallationStamp,new[]{"hardware.read"});}));
            Task<RoomCapabilitiesReply>? query=null;
            try{if(!editing.Wait(TimeSpan.FromSeconds(5)))throw new Exception("edit missing");f.Admission.OnAdmit=()=>admitted.Set();
                query=Task.Run(()=>f.Actions.ReadCapabilities(f.View,f.Peer,f.Session,"scene"));if(!admitted.Wait(TimeSpan.FromSeconds(5)))throw new Exception("query missing");
            }finally{release.Set();edit.GetAwaiter().GetResult();}
            if(query==null||!query.Wait(TimeSpan.FromSeconds(5)))throw new Exception("capability query deadlock");
            Eq(RoomActionStatus.Accepted,query.Result.Capabilities!["hardware.read"]);Eq(RoomActionStatus.MissingPermission,query.Result.Capabilities["binding.launch"]);
        });
        check("native capability query binds to the exact Core revision",()=>{
            using var f=new ActionFixture();var revision=f.Kernel.Snapshot!.Revision;
            Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));
            using(bridge){f.Lifecycle(RoomLifecycleStage.Desktop,true);
                var old=bridge!.NativeCapabilities(f.Actions,f.Session,revision,"scene");Eq(RoomActionStatus.StaleInput,old.Status);Eq(true,old.Capabilities==null);
                Eq(RoomActionStatus.NotOperable,bridge.NativeCapabilities(f.Actions,f.Session,f.Kernel.Snapshot!.Revision,"scene").Capabilities!["binding.launch"]);}
        });
        check("visible Dock capability metadata keeps pause exception without bypassing lock",()=>{
            using var f=new ActionFixture();var peer=new RoomSessionPeer("dock");var lease=f.Gateway.Open(peer,new(1,RoomClientRole.Dock,Room)).ConnectionId!.Value;
            f.Lifecycle(RoomLifecycleStage.Desktop,true);
            Eq(RoomActionStatus.Accepted,f.Actions.ReadCapabilities(lease,peer,f.Session,"official").Capabilities!["binding.launch"]);
            f.Lifecycle(RoomLifecycleStage.Desktop,true,true);
            Eq(RoomActionStatus.NotOperable,f.Actions.ReadCapabilities(lease,peer,f.Session,"official").Capabilities!["binding.launch"]);
        });
        check("private capability bridge rejects disposal and observes grant revocation",()=>{
            using var f=new ActionFixture();Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));
            using(bridge){Eq(RoomActionStatus.Accepted,bridge!.NativeCapabilities(f.Actions,f.Session,f.Kernel.Snapshot!.Revision,"scene").Capabilities!["binding.launch"]);
                f.Store.Update(s=>s.Rooms[Room].Grants.Clear());Eq(RoomActionStatus.MissingPermission,bridge.NativeCapabilities(f.Actions,f.Session,f.Kernel.Snapshot!.Revision,"scene").Capabilities!["binding.launch"]);}
            Eq(RoomActionStatus.StaleSession,bridge!.NativeCapabilities(f.Actions,f.Session,f.Kernel.Snapshot!.Revision,"scene").Status);
        });
        check("private Player bridge authorizes only declared current geometry and its native pair",()=>{
            using var f=new ActionFixture();var n=f.Actions.CreateNativeInput();long generation=0;
            Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,n.ObserveSnapshot,out var bridge,
                (_,snapshot)=>n.Initialize(++generation,snapshot),n.Revoke));using(bridge){
                Eq(false,bridge!.PublishNativeGeometry(n,1,f.Session,1,1,viewport,[Entries()[0] with{Consumer="invented"}]));
                Eq(false,bridge.PublishNativeGeometry(n,1,f.Session,1,1,viewport,[Entries()[0] with{Button="focus-only"}]));
                Eq(true,bridge.PublishNativeGeometry(n,1,f.Session,1,1,viewport,Entries()));
                Eq(RoomActionStatus.InputRequired,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open").Status);
                Pair(f,n);Eq(RoomActionStatus.InputRequired,bridge.ActivateNative(f.Actions,n,1,f.Session,1,2,"scene","open").Status);
                Eq(RoomActionStatus.Accepted,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open").Status);
                Eq(RoomActionStatus.InputRequired,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open").Status);Eq(1,f.Launched.Count);
                Eq(RoomProtocolStatus.Accepted,bridge.Refresh());Eq(2L,n.State!.Generation);
                Eq(RoomActionStatus.StaleInput,bridge.ActivateNative(f.Actions,n,1,f.Session,1,1,"scene","open").Status);
            }
            Eq(RoomActionStatus.StaleSession,bridge!.ActivateNative(f.Actions,n,2,f.Session,1,1,"scene","open").Status);
        });
        check("private Player geometry publish never waits while gateway observer owns its gate",()=>{
            using var f=new ActionFixture();var n=Native(f);
            Eq(RoomProtocolStatus.Accepted,RoomSessionPlayerBridge.Connect(f.Gateway,f.Peer,Room,_=>{},out var bridge));using(bridge){
                using var entered=new ManualResetEventSlim();using var release=new ManualResetEventSlim();
                var holder=Task.Run(()=>f.Gateway.TryWithActionContext(f.View,f.Peer,f.Session,(status,context)=>{entered.Set();if(!release.Wait(TimeSpan.FromSeconds(5)))throw new Exception("barrier");return true;},out bool result));
                try{if(!entered.Wait(TimeSpan.FromSeconds(5)))throw new Exception("missing gate");var publish=Task.Run(()=>bridge!.PublishNativeGeometry(n,1,f.Session,1,1,viewport,Entries()));
                    if(!publish.Wait(TimeSpan.FromSeconds(2)))throw new Exception("geometry blocked on gateway");Eq(false,publish.Result);
                }finally{release.Set();holder.Wait();}
            }
        });
        check("native input requires matching completed down/up and consumes only once",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            n.MouseUp(viewport,300,400,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            n.MouseDown(viewport,300,400,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            n.MouseUp(viewport,300,400,true);var proof=n.GetProof(1,1,"scene","open")!;
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"component.widget","open"));
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","icon"));
            var ticket=Ticket(f,proof);Eq(RoomActionStatus.Accepted,ticket.Status);Eq(RoomActionStatus.Accepted,f.Invoke("open",ticket.Ticket).Status);
            Eq(RoomActionStatus.StaleInput,Ticket(f,proof).Status);Eq(1,f.Launched.Count);
        });
        foreach(var change in new[]{"outside","drag","viewport","dpi","foreground","geometry","generation","revoke"})
        check("native old down is rejected after "+change,()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);n.MouseDown(viewport,300,400,true);
            if(change=="drag")n.MouseMove(viewport,340,400,true);
            if(change=="geometry")Geometry(f,n,2);
            if(change=="generation")n.Initialize(2,f.Kernel.Snapshot!);
            if(change=="revoke")n.Revoke();
            n.MouseUp(change=="viewport"?viewport with{Width=900}:change=="dpi"?viewport with{Dpi=120}:viewport,change=="outside"?600:300,400,change!="foreground");
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
        });
        check("native geometry is copied and topmost entry owns overlap",()=>{
            using var f=new ActionFixture();var n=Native(f);var entries=new[]{new RoomNativeButton("official","icon",.1,.1,.2,.2,1),Entries()[0]};
            Eq(true,n.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,viewport,entries));entries[0]=Entries()[0];
            n.MouseDown(viewport,300,400,true);n.MouseUp(viewport,300,400,true);
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            if(n.GetProof(1,1,"official","icon")==null)throw new Exception("frontmost entry missing");
            Eq(false,n.PublishGeometry(1,f.Session,f.Kernel.Snapshot.Revision,2,viewport,new[]{Entries()[0] with{Width=double.NaN}}));
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"official","icon"));
        });
        check("native Enter Space and Tab use controlled focus and ignore repeat downs",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);
            n.Key(viewport,13,true,false,true);n.Key(viewport,13,false,false,true);
            Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            n.Key(viewport,9,true,false,true);n.Key(viewport,9,false,false,true);Eq("open",n.FocusedButton?.Button);
            foreach(var key in new[]{13,32}){
                n.Key(viewport,key,true,false,true);n.Key(viewport,key,true,false,true);n.Key(viewport,key,false,false,true);
                var proof=n.GetProof(1,1,"scene","open")!;var ticket=Ticket(f,proof);Eq(RoomActionStatus.Accepted,f.Invoke("open",ticket.Ticket).Status);
                n.Key(viewport,key,false,false,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
            }Eq(2,f.Launched.Count);
        });
        check("native proof expiry starts at physical down instead of authored request",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);var proof=Pair(f,n);
            f.Clock.Advance(TimeSpan.FromSeconds(2));Eq(RoomActionStatus.ExpiredInput,Ticket(f,proof).Status);Eq(0,f.Launched.Count);
        });
        foreach(var change in new[]{"geometry","generation","revoke"})
        check("native proof rechecks "+change+" after ticket issuance",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);var ticket=Ticket(f,Pair(f,n));
            if(change=="geometry")Geometry(f,n,2);else if(change=="generation")n.Initialize(2,f.Kernel.Snapshot!);else n.Revoke();
            Eq(RoomActionStatus.StaleInput,f.Invoke("open",ticket.Ticket).Status);Eq(0,f.Launched.Count);
        });
        check("native geometry change during private-state wait prevents dispatch without deadlock",()=>{
            using var f=new ActionFixture();var n=Native(f);Geometry(f,n);var ticket=Ticket(f,Pair(f,n));
            using var editing=new ManualResetEventSlim();using var release=new ManualResetEventSlim();using var admitted=new ManualResetEventSlim();
            var edit=Task.Run(()=>{try{f.Store.Update(_=>{editing.Set();if(!release.Wait(TimeSpan.FromSeconds(5)))throw new Exception("barrier timeout");throw new OperationCanceledException();});}catch(OperationCanceledException){}});
            Task<RoomActionReply>? action=null;
            try {if(!editing.Wait(TimeSpan.FromSeconds(5)))throw new Exception("edit missing");f.Admission.OnAdmit=()=>admitted.Set();action=Task.Run(()=>f.Invoke("open",ticket.Ticket));
                if(!admitted.Wait(TimeSpan.FromSeconds(5)))throw new Exception("admission missing");Geometry(f,n,2);
            }finally{release.Set();edit.GetAwaiter().GetResult();}
            if(action==null||!action.Wait(TimeSpan.FromSeconds(5)))throw new Exception("native lock inversion");Eq(RoomActionStatus.StaleInput,action.Result.Status);Eq(0,f.Launched.Count);
        });
        check("each media phase activates only its own consumer and declared buttons", () => {
            using var f = new ActionFixture(mediaSlots: true);
            Eq(RoomLifecycleStage.Starting, f.Kernel.Snapshot!.Lifecycle.Stage);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", null, "scene").Status);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", null, "slot.background.home").Status);
            Eq(RoomActionStatus.Forbidden, f.Invoke("icon", null, "slot.start").Status);
            var start = f.Input("open", "slot.start"); Eq(RoomActionStatus.Accepted, start.Status);
            Eq(RoomActionStatus.Accepted, f.Invoke("open", start.Ticket, "slot.start").Status);
            f.Lifecycle(RoomLifecycleStage.Desktop);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", null, "slot.start").Status);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", null, "slot.idle").Status);
            var background = f.Input("open", "slot.background.home"); Eq(RoomActionStatus.Accepted, background.Status);
            Eq(RoomActionStatus.Accepted, f.Invoke("open", background.Ticket, "slot.background.home").Status);
            f.Lifecycle(RoomLifecycleStage.Idle);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", null, "slot.background.home").Status);
            var idle = f.Input("open", "slot.idle"); Eq(RoomActionStatus.Accepted, idle.Status);
            Eq(RoomActionStatus.Accepted, f.Invoke("open", idle.Ticket, "slot.idle").Status);
            Eq(3, f.Launched.Count);
        });
        check("media slots neither inherit scene declarations nor installation grants", () => {
            using var f = new ActionFixture(mediaSlots: true);
            var buttons = f.Actions.ReadButtons(f.View, f.Peer, f.Session, "slot.start");
            Eq(RoomActionStatus.Accepted, buttons.Status); Eq(1, buttons.Buttons!.Length); Eq("open", buttons.Buttons[0].Id);
            Eq(RoomActionStatus.Forbidden, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, "slot.start", "hardware.read"));
            f.Store.Update(state => state.Rooms[Room].Grants.Remove("slot.start"));
            Eq(RoomActionStatus.MissingPermission, f.Invoke("open", f.Input("open", "slot.start").Ticket, "slot.start").Status);
            f.Store.Update(state => state.Rooms[Room].Grants["slot.start"] = new("another-installation", new[] { "binding.launch" }));
            Eq(RoomActionStatus.MissingPermission, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, "slot.start", "binding.launch"));
            Eq(0, f.Launched.Count);
        });
        foreach (var phase in new[] { RoomLifecycleStage.Starting, RoomLifecycleStage.Desktop, RoomLifecycleStage.Idle })
            check("media activation and capability consumption suspend with native facts: " + phase, () => {
                using var f = new ActionFixture(mediaSlots: true);
                var consumer = phase == RoomLifecycleStage.Starting ? "slot.start" : phase == RoomLifecycleStage.Idle ? "slot.idle" : "slot.background.home";
                f.Lifecycle(phase);
                Eq(RoomActionStatus.InputRequired, f.Invoke("open", null, consumer).Status);
                foreach (var (paused, locked) in new[] { (true, false), (false, true), (true, true) })
                {
                    f.Lifecycle(phase, paused, locked);
                    Eq(RoomActionStatus.NotOperable, f.Input("open", consumer).Status);
                    Eq(RoomActionStatus.NotOperable, f.Invoke("open", null, consumer).Status);
                    Eq(RoomActionStatus.NotOperable, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, consumer, "binding.launch"));
                }
                f.Lifecycle(phase);
                var input = f.Input("open", consumer); Eq(RoomActionStatus.Accepted, input.Status);
                var revision = f.Kernel.Snapshot!.Revision;
                f.Gateway.SetOperable(f.Coordinator, f.CorePeer, f.Session, false);
                if (f.Kernel.Snapshot!.Revision <= revision) throw new Exception("foreground loss did not invalidate current activation revision");
                Eq(RoomActionStatus.NotOperable, f.Input("open", consumer).Status);
                f.Gateway.SetOperable(f.Coordinator, f.CorePeer, f.Session, true);
                Eq(RoomActionStatus.StaleInput, f.Invoke("open", input.Ticket, consumer).Status);
                Eq(0, f.Launched.Count);
            });
        check("Dock cannot activate while locked or impersonate a media consumer", () => {
            using var f = new ActionFixture(mediaSlots: true); f.Lifecycle(RoomLifecycleStage.Desktop);
            var peer = new RoomSessionPeer("dock");
            var lease = f.Gateway.Open(peer, new(1, RoomClientRole.Dock, Room)).ConnectionId!.Value;
            Eq(RoomActionStatus.Forbidden, f.Actions.IssueHostInput(lease, peer, f.Session, "slot.background.home", "open").Status);
            var input = f.Actions.IssueHostInput(lease, peer, f.Session, "official", "open"); Eq(RoomActionStatus.Accepted, input.Status);
            f.Lifecycle(RoomLifecycleStage.Desktop, false, true);
            Eq(RoomActionStatus.NotOperable, f.Actions.IssueHostInput(lease, peer, f.Session, "official", "open").Status);
            Eq(RoomActionStatus.NotOperable, f.Actions.InvokeButton(lease, peer, f.Session, "official", "open", input.Ticket).Status);
            Eq(0, f.Launched.Count);
        });
        check("outgoing background and prior idle visits cannot reuse activation", () => {
            using var f = new ActionFixture(mediaSlots: true); f.Lifecycle(RoomLifecycleStage.Desktop);
            var input = f.Input("open", "slot.background.home"); Eq(RoomActionStatus.Accepted, input.Status);
            var moving = f.Gateway.Request(f.View, f.Peer, f.Session, "focus"); Eq(RoomProtocolStatus.Accepted, moving.Status);
            Eq(RoomActionStatus.Forbidden, f.Invoke("open", input.Ticket, "slot.background.home").Status);
            Eq(RoomActionStatus.Forbidden, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, "slot.background.home", "binding.launch"));
            Eq(RoomActionStatus.InputRequired, f.Invoke("open", null, "slot.background.focus").Status);
            f.Lifecycle(RoomLifecycleStage.Idle);
            input = f.Input("open", "slot.idle"); Eq(RoomActionStatus.Accepted, input.Status);
            f.Lifecycle(RoomLifecycleStage.Desktop); f.Lifecycle(RoomLifecycleStage.Idle);
            Eq(RoomActionStatus.StaleInput, f.Invoke("open", input.Ticket, "slot.idle").Status); Eq(0, f.Launched.Count);
        });
        check("same private target can serve authored button and ordinary icon", () => {
            using var f = new ActionFixture();
            foreach (var id in new[] { "open", "icon" }) Eq(RoomActionStatus.Accepted, f.Invoke(id, f.Input(id).Ticket).Status);
            Eq(2, f.Launched.Count);
            foreach (var target in f.Launched) { Eq(@"C:\Windows\System32\notepad.exe", target.Target); Eq("/a", target.Arguments); Eq(@"C:\Windows", target.WorkingDirectory); }
        });
        check("scripted and forged tickets never launch", () => {
            using var f = new ActionFixture(); Eq(RoomActionStatus.InputRequired, f.Invoke("open", null).Status);
            Eq(RoomActionStatus.StaleInput, f.Invoke("open", Guid.NewGuid()).Status); Eq(0, f.Launched.Count);
        });
        check("ticket is button-bound and single-use", () => {
            using var f = new ActionFixture(); var input = f.Input("open"); Eq(RoomActionStatus.StaleInput, f.Invoke("icon", input.Ticket).Status);
            input = f.Input("open"); Eq(RoomActionStatus.Accepted, f.Invoke("open", input.Ticket).Status);
            Eq(RoomActionStatus.StaleInput, f.Invoke("open", input.Ticket).Status); Eq(1, f.Launched.Count);
        });
        check("tickets expire using monotonic host time", () => {
            using var f = new ActionFixture(); var input = f.Input("open"); f.Clock.Advance(TimeSpan.FromSeconds(2));
            Eq(RoomActionStatus.ExpiredInput, f.Invoke("open", input.Ticket).Status); Eq(0, f.Launched.Count);
        });
        check("private edit invalidates prior activation instead of launching new target", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            f.Store.Update(s => s.Targets[Target] = new PersonalTarget("Changed", "application", @"C:\Windows\System32\calc.exe"));
            Eq(RoomActionStatus.StaleInput, f.Invoke("open", input.Ticket).Status); Eq(0, f.Launched.Count);
        });
        check("revocation and content-bound consent are checked on every action", () => {
            using var f = new ActionFixture(); var input = f.Input("open"); f.Store.Update(s => s.Rooms[Room].Grants.Clear());
            Eq(RoomActionStatus.MissingPermission, f.Invoke("open", input.Ticket).Status);
            f.Store.Update(s => s.Rooms[Room].Grants["scene"] = new("wrong-installation", new[] { "binding.launch" }));
            Eq(RoomActionStatus.MissingPermission, f.Invoke("open", null).Status); Eq(0, f.Launched.Count);
        });
        check("unknown bindings consumers and undeclared capabilities fail safely", () => {
            using var f = new ActionFixture(); Eq(RoomActionStatus.MissingBinding, f.Invoke("unbound", f.Input("unbound").Ticket).Status);
            Eq(RoomActionStatus.UnknownConsumer, f.Actions.ReadButtons(f.View, f.Peer, f.Session, "invented").Status);
            Eq(RoomActionStatus.Forbidden, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, "component.widget", "hardware.read"));
            Eq(RoomActionStatus.MissingPermission, f.Actions.AuthorizeCapability(f.View, f.Peer, f.Session, "scene", "hardware.read"));
        });
        check("forged transport and wrong consumer cannot steal activation", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            Eq(RoomActionStatus.Denied, f.Actions.InvokeButton(f.View, new("forged"), f.Session, "scene", "open", input.Ticket).Status);
            Eq(RoomActionStatus.StaleInput, f.Actions.InvokeButton(f.View, f.Peer, f.Session, "component.widget", "open", input.Ticket).Status); Eq(0, f.Launched.Count);
        });
        check("Desk scope and component membership follow authorized target Desk", () => {
            using var f = new ActionFixture(); Eq(RoomActionStatus.Forbidden, f.Invoke("focus-only", null).Status);
            Eq(RoomActionStatus.Accepted, f.Invoke("next", f.Input("next").Ticket).Status); Eq("focus", f.Kernel.Snapshot!.TargetDeskId);
            Eq(RoomActionStatus.Forbidden, f.Actions.ReadButtons(f.View, f.Peer, f.Session, "component.widget").Status);
            Eq(RoomActionStatus.InputRequired, f.Invoke("focus-only", null).Status);
        });
        check("paused sessions and coordinator cannot activate view privileges", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            Eq(RoomActionStatus.Forbidden, f.Actions.IssueHostInput(f.Coordinator, f.CorePeer, f.Session, "scene", "open").Status);
            f.Gateway.SetOperable(f.Coordinator, f.CorePeer, f.Session, false);
            Eq(RoomActionStatus.NotOperable, f.Invoke("open", input.Ticket).Status); Eq(0, f.Launched.Count);
        });
        check("stale closed and revoked sessions cannot reuse tickets", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            Eq(RoomActionStatus.StaleSession, f.Actions.InvokeButton(f.View, f.Peer, Guid.NewGuid(), "scene", "open", input.Ticket).Status);
            f.Gateway.Close(f.View, f.Peer); Eq(RoomActionStatus.StaleSession, f.Invoke("open", input.Ticket).Status);
            using var revoked = new ActionFixture(); input = revoked.Input("open"); revoked.Admission.Enabled = false;
            Eq(RoomActionStatus.Denied, revoked.Invoke("open", input.Ticket).Status); Eq(0, revoked.Launched.Count);
        });
        check("public state and failure hide target arguments and private exception text", () => {
            using var f = new ActionFixture(); var state = f.Actions.ReadButtons(f.View, f.Peer, f.Session, "scene"); Eq(RoomActionStatus.Accepted, state.Status);
            if (!state.Buttons!.Any(b => b.Id == "open" && b.IsBound)) throw new Exception("Missing public binding status");
            var fail = new RoomActionAuthority(f.Gateway, f.Store, _ => throw new IOException(@"C:\secret\private.txt /private-args"), f.Clock);
            var input = fail.IssueHostInput(f.View, f.Peer, f.Session, "scene", "open");
            var result = fail.InvokeButton(f.View, f.Peer, f.Session, "scene", "open", input.Ticket); Eq(RoomActionStatus.LaunchFailed, result.Status);
            var json = JsonSerializer.Serialize(state) + JsonSerializer.Serialize(result);
            if (json.Contains("C:") || json.Contains("notepad.exe") || json.Contains("/a") || json.Contains("private-args")) throw new Exception("Private data leaked");
        });
        check("Dock launch keeps equal permission while desktop is paused", () => {
            using var f = new ActionFixture(); var peer = new RoomSessionPeer("dock");
            var lease = f.Gateway.Open(peer, new(1, RoomClientRole.Dock, Room)).ConnectionId!.Value;
            f.Gateway.SetOperable(f.Coordinator, f.CorePeer, f.Session, false);
            var input = f.Actions.IssueHostInput(lease, peer, f.Session, "official", "open");
            Eq(RoomActionStatus.Accepted, input.Status);
            Eq(RoomActionStatus.Accepted, f.Actions.InvokeButton(lease, peer, f.Session, "official", "open", input.Ticket).Status);
            f.Store.Update(s => s.Rooms[Room].Grants.Remove("official"));
            input = f.Actions.IssueHostInput(lease, peer, f.Session, "official", "open");
            Eq(RoomActionStatus.MissingPermission, f.Actions.InvokeButton(lease, peer, f.Session, "official", "open", input.Ticket).Status); Eq(1, f.Launched.Count);
        });
        foreach (var change in new[] { "close", "stop", "pause", "idle", "lock", "unbind", "replace" })
        {
            var invalidation = change;
            check("pending private read rechecks " + invalidation + " before dispatch", () => {
                using var f = new ActionFixture(); var input = f.Input("open");
                using var editing = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
                using var admitted = new ManualResetEventSlim();
                var edit = Task.Run(() => { try { f.Store.Update(_ => {
                    editing.Set(); if (!release.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Edit barrier timeout");
                    throw new OperationCanceledException("fixture abort, no private revision change");
                }); } catch (OperationCanceledException) { } });
                Task<RoomActionReply>? invoke = null;
                try
                {
                    if (!editing.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Private edit did not begin");
                    f.Admission.OnAdmit = () => admitted.Set();
                    invoke = Task.Run(() => f.Invoke("open", input.Ticket));
                    if (!admitted.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not read context");
                    switch (invalidation)
                    {
                        case "close": f.Gateway.Close(f.View, f.Peer); break;
                        case "stop": f.Gateway.Stop(f.Coordinator, f.CorePeer, f.Session); break;
                        case "pause": f.Gateway.SetOperable(f.Coordinator, f.CorePeer, f.Session, false); break;
                        case "idle": f.Lifecycle(RoomLifecycleStage.Idle); break;
                        case "lock": f.Lifecycle(RoomLifecycleStage.Desktop, false, true); break;
                        case "unbind": f.Admission.Enabled = false; break;
                        case "replace": f.Admission.ReplaceInstallation(); break;
                    }
                }
                finally { release.Set(); edit.GetAwaiter().GetResult(); }
                if (invoke is null || !invoke.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not finish");
                if (invoke.Result.Status == RoomActionStatus.Accepted) throw new Exception("Revoked pending action was accepted");
                Eq(0, f.Launched.Count);
            });
        }
        foreach (var change in new[] { "grant", "target", "revision" })
        {
            var editKind = change;
            check("private " + editKind + " change before commit prevents old dispatch", () => {
                using var f = new ActionFixture(); var input = f.Input("open");
                using var clockEntered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
                f.Clock.BeforeTimestamp = () => { clockEntered.Set(); if (!release.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Clock barrier timeout"); };
                var invoke = Task.Run(() => f.Invoke("open", input.Ticket));
                try
                {
                    if (!clockEntered.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not check time");
                    f.Store.Update(s => {
                        if (editKind == "grant") s.Rooms[Room].Grants.Clear();
                        if (editKind == "target") s.Targets[Target] = new PersonalTarget("Changed", "application", @"C:\Windows\System32\calc.exe");
                    });
                }
                finally { release.Set(); }
                if (!invoke.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not finish");
                if (invoke.Result.Status == RoomActionStatus.Accepted) throw new Exception("Private edit was ignored by pending action");
                Eq(0, f.Launched.Count);
            });
        }
        check("dispatch callback runs outside action and shared authorization locks", () => {
            using var f = new ActionFixture();
            var actions = new RoomActionAuthority(f.Gateway, f.Store, _ => {
                var concurrent = Task.Run(() => {
                    Eq(RoomActionStatus.Accepted, f.Actions.ReadButtons(f.View, f.Peer, f.Session, "scene").Status);
                    f.Store.Update(s => s.Rooms[Room].Grants.Clear());
                    f.Gateway.Close(f.View, f.Peer);
                });
                if (!concurrent.Wait(TimeSpan.FromSeconds(3))) throw new Exception("Dispatch retained an authorization lock");
            }, f.Clock);
            var input = actions.IssueHostInput(f.View, f.Peer, f.Session, "scene", "open");
            Eq(RoomActionStatus.Accepted, actions.InvokeButton(f.View, f.Peer, f.Session, "scene", "open", input.Ticket).Status);
        });
        check("waiting for private state cannot extend the native input lifetime", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            using var editing = new ManualResetEventSlim(); using var admitted = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            var edit = Task.Run(() => { try { f.Store.Update(_ => { editing.Set(); release.Wait(); throw new OperationCanceledException(); }); } catch (OperationCanceledException) { } });
            Task<RoomActionReply>? invoke = null;
            try
            {
                if (!editing.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Edit did not begin");
                f.Admission.OnAdmit = () => admitted.Set(); invoke = Task.Run(() => f.Invoke("open", input.Ticket));
                if (!admitted.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not begin");
                f.Clock.Advance(TimeSpan.FromSeconds(2));
            }
            finally { release.Set(); edit.GetAwaiter().GetResult(); }
            Eq(RoomActionStatus.ExpiredInput, invoke!.GetAwaiter().GetResult().Status); Eq(0, f.Launched.Count);
        });
        check("snapshot observer may read actions while a private wait is released", () => {
            using var f = new ActionFixture(); var input = f.Input("open");
            using var editing = new ManualResetEventSlim(); using var admitted = new ManualResetEventSlim();
            using var observing = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            var edit = Task.Run(() => { try { f.Store.Update(_ => { editing.Set(); release.Wait(); throw new OperationCanceledException(); }); } catch (OperationCanceledException) { } });
            Task<RoomActionReply>? invoke = null; Task? observer = null;
            try
            {
                if (!editing.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Edit did not begin");
                f.Admission.OnAdmit = () => admitted.Set(); invoke = Task.Run(() => f.Invoke("open", input.Ticket));
                if (!admitted.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Invocation did not begin");
                observer = Task.Run(() => {
                    var result = f.Gateway.Subscribe(f.View, f.Peer, _ => {
                        observing.Set(); Eq(RoomActionStatus.Accepted, f.Actions.ReadButtons(f.View, f.Peer, f.Session, "scene").Status);
                    }, out var subscription);
                    Eq(RoomProtocolStatus.Accepted, result.Status); subscription!.Dispose();
                });
                if (!observing.Wait(TimeSpan.FromSeconds(5))) throw new Exception("Observer did not begin");
            }
            finally { release.Set(); edit.GetAwaiter().GetResult(); }
            if (!Task.WaitAll(new Task[] { invoke!, observer! }, TimeSpan.FromSeconds(5))) throw new Exception("Observer/private state lock order deadlocked");
            Eq(RoomActionStatus.Accepted, invoke!.Result.Status); Eq(1, f.Launched.Count);
        });
        check("authored exit requests require Dext-owned confirmation", () => {
            using var f = new ActionFixture(); Eq(RoomActionStatus.RequiresConfirmation, f.Invoke("exit", f.Input("exit").Ticket).Status); Eq(0, f.Launched.Count);
        });
    }
    sealed class ManualClock : TimeProvider
    {
        private long ticks;
        public override long TimestampFrequency => TimeSpan.TicksPerSecond;
        public Action? BeforeTimestamp;
        public override long GetTimestamp() { Interlocked.Exchange(ref BeforeTimestamp, null)?.Invoke(); return Interlocked.Read(ref ticks); }
        public void Advance(TimeSpan duration) => ticks += duration.Ticks;
    }
    sealed class Admission : IRoomSessionActionAdmissionAuthority
    {
        private readonly object gate = new();
        private VerifiedRoomInstallation installed;
        private bool enabled = true;
        public Action? OnAdmit;
        public Admission(VerifiedRoomInstallation installed) { this.installed = installed; }
        public bool Enabled { get { lock (gate) return enabled; } set { lock (gate) enabled = value; } }
        public T WithAdmission<T>(RoomSessionPeer peer, RoomSessionHello hello, Func<RoomSessionAdmission?, T> prepare)
        { lock (gate) return prepare(Admit(peer, hello)); }
        public void ReplaceInstallation() { lock (gate) installed = new(installed.RoomId, "replacement-stamp", installed.DeskIds, installed.StartDeskId, installed.ActionCatalog); }
        public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
        {
            lock (gate)
            {
                Interlocked.Exchange(ref OnAdmit, null)?.Invoke();
                return enabled && hello.RoomId == installed.RoomId &&
                    ((peer.TransportId == "runtime" && hello.Role == RoomClientRole.Coordinator) ||
                     (peer.TransportId == "player" && hello.Role == RoomClientRole.DesktopPlayer) ||
                     (peer.TransportId == "dock" && hello.Role == RoomClientRole.Dock)) ? new(peer.TransportId, hello.Role, installed) : null;
            }
        }
    }
    sealed class ActionFixture : IDisposable
    {
        private readonly Fixture fixture = new();
        public RoomSessionKernel Kernel { get; } = new();
        public RoomSessionPeer Peer { get; } = new("player");
        public RoomSessionPeer CorePeer { get; } = new("runtime");
        public RoomPersonalStore Store { get; }
        public string PersonalPath => Path.Combine(fixture.Path,"personal");
        public RoomSessionProtocolGateway Gateway { get; }
        public Admission Admission { get; }
        public RoomActionAuthority Actions { get; }
        public ManualClock Clock { get; } = new();
        public List<PersonalTarget> Launched { get; } = new();
        public Guid View { get; }
        public Guid Coordinator { get; }
        public Guid Session { get; }
        public ActionFixture(bool mediaSlots = false,bool dataCapabilities=false,bool storageCapabilities=false,bool navigationDynamic=false,bool controlCapabilities=false,bool layoutDock=false)
        {
            var directory = Path.Combine(fixture.Path, "installed"); Directory.CreateDirectory(directory);
            var manifest = """
            {"version":3,"apiVersion":1,"id":"d390f9c9-8136-4c56-a00b-afabbac4db2c","name":"Action fixture","startDesk":"home","resources":["scene.html"],
             "roomScene":{"entry":"scene.html","capabilities":["binding.launch","desk.navigate","dext.exit","hardware.read"]},
             "buttons":[{"id":"open","name":"Open","scope":"room","action":{"type":"binding.launch"}},
                        {"id":"icon","name":"Icon","scope":"room","action":{"type":"binding.launch"}},
                        {"id":"unbound","name":"Unbound","scope":"room","action":{"type":"binding.launch"}},
                        {"id":"next","name":"Next","scope":"room","action":{"type":"desk.next"}},
                        {"id":"exit","name":"Exit","scope":"room","action":{"type":"dext.exit"}},
                        {"id":"focus-only","name":"Focus","scope":"focus","action":{"type":"binding.launch"}}],
             "components":[{"id":"widget","role":"widget","entry":"scene.html","placement":{"x":0,"y":0,"width":100,"height":100},"capabilities":["binding.launch"],"buttonIds":["open"]}],
             "desks":[{"id":"home","name":"Home","icons":[{"id":"icon-1","buttonId":"icon","x":0,"y":0}],"components":["widget"]},
                      {"id":"focus","name":"Focus","icons":[],"components":[]}]}
            """;
            if(layoutDock){var document=JsonNode.Parse(manifest)!;document["components"]![0]!["role"]="dock";manifest=document.ToJsonString();}
            if (mediaSlots)
            {
                var document = JsonNode.Parse(manifest)!;
                var content = new JsonObject { ["type"] = "html", ["src"] = "scene.html",
                    ["capabilities"] = new JsonArray("binding.launch"), ["buttonIds"] = new JsonArray("open") };
                document["start"] = content.DeepClone(); document["idle"] = content.DeepClone();
                foreach (var desk in document["desks"]!.AsArray()) desk!["background"] = content.DeepClone();
                manifest = document.ToJsonString();
            }
            var dataCaps=new[]{"time.read","hardware.read","media.read","audio.read"};
            if(dataCapabilities){var document=JsonNode.Parse(manifest)!;foreach(var owner in new[]{document["roomScene"],document["start"],document["idle"]}.Where(owner=>owner!=null))
                foreach(var capability in dataCaps)if(!owner!["capabilities"]!.AsArray().Any(value=>value!.GetValue<string>()==capability))owner["capabilities"]!.AsArray().Add(capability);
                manifest=document.ToJsonString();}
            var storageCaps=new[]{"storage.read","storage.write"};
            if(storageCapabilities){var document=JsonNode.Parse(manifest)!;foreach(var owner in new[]{document["roomScene"],document["components"]![0]})foreach(var capability in storageCaps)owner!["capabilities"]!.AsArray().Add(capability);manifest=document.ToJsonString();}
            if(navigationDynamic){var document=JsonNode.Parse(manifest)!;document["buttons"]!.AsArray().Add(new JsonObject{["id"]="dynamic",["name"]="Dynamic",["scope"]="room"});manifest=document.ToJsonString();}
            var controlCaps=new[]{"media.control","audio.control"};
            if(controlCapabilities){var document=JsonNode.Parse(manifest)!;foreach(var owner in new[]{document["roomScene"],document["components"]![0]})foreach(var cap in controlCaps)owner!["capabilities"]!.AsArray().Add(cap);
                document["components"]![0]!["buttonIds"]!.AsArray().Add("dynamic");manifest=document.ToJsonString();}
            var manifestBytes = System.Text.Encoding.UTF8.GetBytes(manifest); var html = System.Text.Encoding.UTF8.GetBytes("<!doctype html><title>Fixture</title>");
            static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            File.WriteAllBytes(Path.Combine(directory, "room.json"), manifestBytes); File.WriteAllBytes(Path.Combine(directory, "scene.html"), html);
            File.WriteAllText(Path.Combine(directory, "installation.json"), JsonSerializer.Serialize(new { formatVersion = 1, roomId = Room, manifestSha256 = Hash(manifestBytes),
                resources = new[] { new { path = "scene.html", sha256 = Hash(html), size = html.Length } } }));
            var installed = RoomV3Installation.Verify(directory);
            Admission = new(installed); Gateway = new(Kernel, Admission);
            Coordinator = Gateway.Open(CorePeer, new(1, RoomClientRole.Coordinator, Room)).ConnectionId!.Value;
            Session = Gateway.Start(Coordinator, CorePeer).Snapshot!.SessionId;
            View = Gateway.Open(Peer, new(1, RoomClientRole.DesktopPlayer, Room)).ConnectionId!.Value;
            Store = new(Path.Combine(fixture.Path, "personal"));
            Store.Update(s => {
                s.Targets[Target] = new PersonalTarget("Notes", "application", @"C:\Windows\System32\notepad.exe", "/a", @"C:\Windows");
                var room = new RoomPersonalData(); s.Rooms[Room] = room;
                foreach (var button in new[] { "open", "icon", "focus-only" }) room.Buttons[button] = new PersonalButtonOverride(TargetId: Target);
                if (mediaSlots) foreach (var owner in new[] { "slot.start", "slot.idle", "slot.background.home", "slot.background.focus" })
                    room.Grants[owner] = new(installed.InstallationStamp, new[] { "binding.launch" });
                foreach (var owner in new[] { "official", "scene", "component.widget" }) room.Grants[owner] = new(installed.InstallationStamp,
                    owner == "component.widget" ? new[] { "binding.launch" } : new[] { "binding.launch", "desk.navigate", "dext.exit" });
            });
            if(dataCapabilities)Store.Update(state=>{var room=state.Rooms[Room];foreach(var owner in new[]{"scene","slot.start","slot.idle"})
                if(room.Grants.TryGetValue(owner,out var grant))room.Grants[owner]=new(grant.InstallationStamp,grant.Capabilities.Concat(dataCaps).Distinct().ToArray());});
            if(storageCapabilities)Store.Update(state=>{var room=state.Rooms[Room];foreach(var owner in new[]{"scene","component.widget"}){var grant=room.Grants[owner];room.Grants[owner]=new(grant.InstallationStamp,grant.Capabilities.Concat(storageCaps).ToArray());}});
            if(controlCapabilities)Store.Update(state=>{var room=state.Rooms[Room];foreach(var owner in new[]{"scene","component.widget"}){var grant=room.Grants[owner];room.Grants[owner]=new(grant.InstallationStamp,grant.Capabilities.Concat(controlCaps).ToArray());}});
            Actions = new(Gateway, Store, target => Launched.Add(target), Clock);
        }
        public RoomInputReply Input(string button, string consumer = "scene") => Actions.IssueHostInput(View, Peer, Session, consumer, button);
        public RoomActionReply Invoke(string button, Guid? ticket, string consumer = "scene") => Actions.InvokeButton(View, Peer, Session, consumer, button, ticket);
        public void Lifecycle(RoomLifecycleStage stage, bool paused = false, bool locked = false) =>
            Eq(RoomProtocolStatus.Accepted, Gateway.SetLifecycle(Coordinator, CorePeer, Session, stage, paused, locked).Status);
        public void Dispose() { Kernel.Dispose(); fixture.Dispose(); }
    }
}
