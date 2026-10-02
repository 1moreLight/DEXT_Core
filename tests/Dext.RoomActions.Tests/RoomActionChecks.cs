using Dext.Core.Rooms;
using System.Text.Json;
using System.Security.Cryptography;

static class RoomActionChecks
{
    private const string Room = "d390f9c9-8136-4c56-a00b-afabbac4db2c";
    private const string Target = "ee0760c2-a1e3-4094-b002-81b6ab22a7d5";
    static void Eq<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}, got {actual}"); }
    public static void Run(Action<string, Action> check)
    {
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
        foreach (var change in new[] { "close", "stop", "pause", "unbind", "replace" })
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
        public ActionFixture()
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
                foreach (var owner in new[] { "official", "scene", "component.widget" }) room.Grants[owner] = new(installed.InstallationStamp,
                    owner == "component.widget" ? new[] { "binding.launch" } : new[] { "binding.launch", "desk.navigate", "dext.exit" });
            });
            Actions = new(Gateway, Store, target => Launched.Add(target), Clock);
        }
        public RoomInputReply Input(string button) => Actions.IssueHostInput(View, Peer, Session, "scene", button);
        public RoomActionReply Invoke(string button, Guid? ticket) => Actions.InvokeButton(View, Peer, Session, "scene", button, ticket);
        public void Dispose() { Kernel.Dispose(); fixture.Dispose(); }
    }
}
