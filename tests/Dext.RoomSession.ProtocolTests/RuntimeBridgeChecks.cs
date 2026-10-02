using Dext.Core.Rooms;

internal static class RuntimeBridgeChecks
{
    public static void Run(Action<string, Action> check)
    {
        check("native host stage is coordinator-only and preserves current sampled facts",()=>NativeInstallationChecks.WithCopy(root=>{
            NativeInstallationChecks.PrepareHtmlSlots(root);using var f=new Fixture(root);var view=f.Gateway.Open(f.Player,new(1,RoomClientRole.DesktopPlayer,f.RoomId)).ConnectionId!.Value;
            f.Gateway.SetRuntimeFacts(f.Control,f.Core,f.Session,new(true,true,false));
            Require(f.Gateway.SetHostStage(view,f.Player,f.Session,RoomLifecycleStage.Idle).Status==RoomProtocolStatus.Forbidden,"view cannot enter idle");
            Require(f.Gateway.SetHostStage(f.Control,f.Core,Guid.NewGuid(),RoomLifecycleStage.Idle).Status==RoomProtocolStatus.StaleSession,"old session");
            Require(f.Gateway.SetHostStage(f.Control,f.Core,f.Session,RoomLifecycleStage.Idle).Status==RoomProtocolStatus.Accepted,"host idle");
            Require(f.Gateway.SetHostStage(f.Control,f.Core,f.Session,RoomLifecycleStage.Desktop).Status==RoomProtocolStatus.Accepted && f.Kernel.Snapshot!.Lifecycle is{PlaybackPaused:true,Locked:true} && !f.Kernel.Snapshot.IsDesktopForeground,"wake retains facts");
            Require(f.Gateway.SetHostStage(f.Control,f.Core,f.Session,RoomLifecycleStage.Starting).Status==RoomProtocolStatus.Rejected,"host cannot replay start");
        }));
        check("private native bridge completes only current startup and preserves Windows restrictions",()=>NativeInstallationChecks.WithCopy(root=>{
            NativeInstallationChecks.PrepareHtmlSlots(root);using var f=new Fixture(root);
            f.Gateway.SetRuntimeFacts(f.Control,f.Core,f.Session,new(true,true,false));var first=f.Kernel.Snapshot!;
            Require(RoomSessionPlayerBridge.Connect(f.Gateway,f.Player,f.RoomId,_=>{},out var bridge)==RoomProtocolStatus.Accepted,"connected");using(bridge){
                Require(bridge!.CompleteStartup(f.Session,first.Lifecycle.Revision+1).Status==RoomProtocolStatus.Rejected,"wrong phase");
                Require(bridge.CompleteStartup(f.Session,first.Lifecycle.Revision).Status==RoomProtocolStatus.Accepted,"current completion");
                Require(f.Kernel.Snapshot!.Lifecycle is{Stage:RoomLifecycleStage.Desktop,PlaybackPaused:true,Locked:true} && !f.Kernel.Snapshot.IsDesktopForeground,"facts retained");
                Require(bridge.CompleteStartup(f.Session,f.Kernel.Snapshot.Lifecycle.Revision).Status==RoomProtocolStatus.Rejected,"outside starting");
            }
            Require(bridge!.CompleteStartup(f.Session,first.Lifecycle.Revision).Status==RoomProtocolStatus.StaleSession,"disposed transport");
        }));
        check("new document and startup completion enforce separate trusted roles",()=>NativeInstallationChecks.WithCopy(root=>{
            NativeInstallationChecks.PrepareHtmlSlots(root);using var f=new Fixture(root);var first=f.Kernel.Snapshot!;
            var view=f.Gateway.Open(f.Player,new(1,RoomClientRole.DesktopPlayer,f.RoomId)).ConnectionId!.Value;
            Require(f.Gateway.BeginDocument(view,f.Player,f.Session).Status==RoomProtocolStatus.Forbidden,"Player cannot replay start");
            Require(f.Gateway.CompleteStartup(f.Control,f.Core,f.Session,first.Lifecycle.Revision).Status==RoomProtocolStatus.Forbidden,"coordinator cannot impersonate media completion");
            Require(f.Gateway.CompleteStartup(view,f.Core,f.Session,first.Lifecycle.Revision).Status==RoomProtocolStatus.Denied,"spoofed peer");
            Require(f.Gateway.CompleteStartup(view,f.Player,Guid.NewGuid(),first.Lifecycle.Revision).Status==RoomProtocolStatus.StaleSession,"wrong session");
            Require(f.Kernel.Snapshot==first,"denied operations preserve exact state");
            Require(f.Gateway.BeginDocument(f.Control,f.Core,f.Session).Status==RoomProtocolStatus.Accepted,"trusted new document");
            Require(f.Gateway.CompleteStartup(view,f.Player,f.Session,first.Lifecycle.Revision).Status==RoomProtocolStatus.Rejected,"old document completion");
            f.Authority.Unbind(7123);Require(f.Gateway.CompleteStartup(view,f.Player,f.Session,f.Kernel.Snapshot!.Lifecycle.Revision).Status!=RoomProtocolStatus.Accepted,"revoked installation");
        }));
        check("legacy new-document refresh invents no native start",()=>{
            using var kernel=new RoomSessionKernel();var g=new RoomSessionProtocolGateway(kernel,new TestAdmissionAuthority());var core=new RoomSessionPeer("core-1");
            var control=g.Open(core,new(1,RoomClientRole.Coordinator,"install-a")).ConnectionId!.Value;var first=g.Start(control,core).Snapshot!;
            var peer=new RoomSessionPeer("player-1");var view=g.Open(peer,new(1,RoomClientRole.DesktopPlayer,"install-a")).ConnectionId!.Value;
            Require(g.BeginDocument(control,core,first.SessionId).Status==RoomProtocolStatus.Accepted && kernel.Snapshot==first,"legacy remains unchanged");
            Require(g.CompleteStartup(view,peer,first.SessionId,first.Lifecycle.Revision).Status==RoomProtocolStatus.Rejected,"no native completion");
        });
        check("native bridge initializes verified context before every first or refresh snapshot", () => NativeInstallationChecks.WithCopy(root =>
        {
            using var f = new Fixture(root);
            var order = new List<string>();
            var status = RoomSessionPlayerBridge.Connect(f.Gateway, f.Player, f.RoomId,
                snapshot => { Require(snapshot.SessionId == f.Session, "current session"); order.Add("snapshot"); }, out var bridge,
                (context, snapshot) => { Require(context?.InstallationStamp == snapshot.InstallationStamp && context.RoomId == f.RoomId,
                    "context from verified installation"); order.Add("context"); }, () => order.Add("revoke"));
            Require(status == RoomProtocolStatus.Accepted && bridge is not null, "connected");
            Require(string.Join(',', order) == "context,snapshot", "context arrives before synchronous Subscribe snapshot");
            Require(bridge!.Refresh() == RoomProtocolStatus.Accepted, "refresh accepted");
            Require(string.Join(',', order) == "context,snapshot,context,snapshot", "reload obtains new initialization before replay");
            bridge.Dispose(); bridge.Dispose();
            Require(order.Count(x => x == "revoke") == 1, "detach revokes once");
            Require(bridge.Refresh() == RoomProtocolStatus.StaleSession, "disposed bridge cannot reinitialize");
        }));
        foreach (var mode in new[] { "stop", "replace", "unbind", "tamper" })
            check("native bridge sends one explicit revocation on " + mode, () => NativeInstallationChecks.WithCopy(root =>
            {
                using var f = new Fixture(root);
                var snapshots = 0; var revoked = 0;
                var status = RoomSessionPlayerBridge.Connect(f.Gateway, f.Player, f.RoomId, _ => snapshots++, out var bridge,
                    (_, _) => { }, () => revoked++);
                Require(status == RoomProtocolStatus.Accepted, "connected");
                switch (mode)
                {
                    case "stop": f.Gateway.Stop(f.Control, f.Core, f.Session); break;
                    case "replace": f.Gateway.Start(f.Control, f.Core); break;
                    case "unbind": f.Authority.Unbind(7123); bridge!.Read(); break;
                    case "tamper": File.AppendAllText(Path.Combine(root, "room.json"), " "); bridge!.Refresh(); break;
                }
                Require(revoked == 1 && snapshots == 1, "invalidation explicitly revokes without stale snapshot");
                bridge!.Dispose();
                Require(revoked == 1, "later disposal does not repeat revocation");
            }));
        check("session stopped during native initialization cannot finish attaching", () => NativeInstallationChecks.WithCopy(root =>
        {
            using var f = new Fixture(root); var revoked = 0; var snapshots = 0;
            var status = RoomSessionPlayerBridge.Connect(f.Gateway, f.Player, f.RoomId, _ => snapshots++, out var bridge,
                (_, _) => f.Gateway.Stop(f.Control, f.Core, f.Session), () => revoked++);
            Require(status != RoomProtocolStatus.Accepted && bridge is null, "no bridge after initialization invalidation");
            Require(revoked == 1 && snapshots == 0, "initialized context explicitly revoked before any snapshot");
        }));
        check("throwing initialization releases its observation and revokes the partial context", () => NativeInstallationChecks.WithCopy(root =>
        {
            using var f = new Fixture(root); var revoked = 0; var thrown = false;
            try { RoomSessionPlayerBridge.Connect(f.Gateway, f.Player, f.RoomId, _ => { }, out _,
                (_, _) => throw new InvalidOperationException("fixture initialization failure"), () => revoked++); }
            catch (InvalidOperationException) { thrown = true; }
            Require(thrown && revoked == 1, "failure propagates after cleanup");
            f.Gateway.Start(f.Control, f.Core);
            Require(revoked == 1, "no leaked observation to revoke a second time");
        }));
        check("legacy overlay initializes with no native context and keeps full snapshots", () =>
        {
            using var kernel = new RoomSessionKernel();
            var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
            var core = new RoomSessionPeer("core-1");
            var control = gateway.Open(core, new RoomSessionHello(1, RoomClientRole.Coordinator, "install-a")).ConnectionId!.Value;
            gateway.Start(control, core);
            var initialized = 0; var snapshots = 0;
            Require(RoomSessionPlayerBridge.Connect(gateway, new RoomSessionPeer("player-1"), "install-a", _ => snapshots++, out var bridge,
                (context, _) => { Require(context is null, "legacy has no fabricated v3 manifest"); initialized++; }) == RoomProtocolStatus.Accepted, "legacy connects");
            using (bridge) Require(initialized == 1 && snapshots == 1, "legacy initialize then snapshot");
        });
    }
    private static void Require(bool ok, string message) { if (!ok) throw new Exception(message); }
    private sealed class Fixture : IDisposable
    {
        public readonly InstalledRoomSessionAuthority Authority = new();
        public readonly RoomSessionKernel Kernel = new();
        public readonly RoomSessionPeer Core = new("core-runtime"), Player = new("player-process:7123");
        public readonly RoomSessionProtocolGateway Gateway;
        public readonly string RoomId;
        public readonly Guid Control, Session;
        public Fixture(string root)
        {
            RoomId = Authority.Bind(root, 7123)!.RoomId;
            Gateway = new(Kernel, Authority);
            Control = Gateway.Open(Core, new RoomSessionHello(1, RoomClientRole.Coordinator, RoomId)).ConnectionId!.Value;
            Session = Gateway.Start(Control, Core).Snapshot!.SessionId;
        }
        public void Dispose() => Kernel.Dispose();
    }
}
