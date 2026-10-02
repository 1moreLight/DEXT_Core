using Dext.Core.Rooms;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

static class RoomActionChecks
{
    private const string Room = "d390f9c9-8136-4c56-a00b-afabbac4db2c";
    private const string Target = "ee0760c2-a1e3-4094-b002-81b6ab22a7d5";
    static void Eq<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}, got {actual}"); }
    public static void Run(Action<string, Action> check)
    {
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
        public RoomSessionProtocolGateway Gateway { get; }
        public Admission Admission { get; }
        public RoomActionAuthority Actions { get; }
        public ManualClock Clock { get; } = new();
        public List<PersonalTarget> Launched { get; } = new();
        public Guid View { get; }
        public Guid Coordinator { get; }
        public Guid Session { get; }
        public ActionFixture(bool mediaSlots = false)
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
            if (mediaSlots)
            {
                var document = JsonNode.Parse(manifest)!;
                var content = new JsonObject { ["type"] = "html", ["src"] = "scene.html",
                    ["capabilities"] = new JsonArray("binding.launch"), ["buttonIds"] = new JsonArray("open") };
                document["start"] = content.DeepClone(); document["idle"] = content.DeepClone();
                foreach (var desk in document["desks"]!.AsArray()) desk!["background"] = content.DeepClone();
                manifest = document.ToJsonString();
            }
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
            Actions = new(Gateway, Store, target => Launched.Add(target), Clock);
        }
        public RoomInputReply Input(string button, string consumer = "scene") => Actions.IssueHostInput(View, Peer, Session, consumer, button);
        public RoomActionReply Invoke(string button, Guid? ticket, string consumer = "scene") => Actions.InvokeButton(View, Peer, Session, consumer, button, ticket);
        public void Lifecycle(RoomLifecycleStage stage, bool paused = false, bool locked = false) =>
            Eq(RoomProtocolStatus.Accepted, Gateway.SetLifecycle(Coordinator, CorePeer, Session, stage, paused, locked).Status);
        public void Dispose() { Kernel.Dispose(); fixture.Dispose(); }
    }
}
