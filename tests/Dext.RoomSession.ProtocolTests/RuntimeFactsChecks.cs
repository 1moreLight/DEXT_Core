using Dext.Core.Rooms;

internal static class RuntimeFactsChecks
{
    public static void Run(Action<string, Action> check)
    {
        check("unsampled Windows facts deny operation and actual pause is per display", () =>
        {
            var source = new RoomRuntimeFactsSource();
            Equal(new RoomSessionFacts(true, true, false), source.Read("a"), "unknown facts fail closed");
            source.Update("a", false, false, true);
            Equal(new RoomSessionFacts(false, false, true), source.Read("a"), "display a playing");
            Equal(new RoomSessionFacts(true, false, true), source.Read("b"), "unsampled display remains paused");
            source.Update("b", true, false, false);
            Equal(new RoomSessionFacts(false, false, false), source.Read("a"), "global foreground is independent of a pause");
            source.Update(null, false, true, false);
            Equal(new RoomSessionFacts(false, true, false), source.Read("a"), "global playback clears per-display overrides");
            Equal(source.Read("a"), source.Read("b"), "lock applies to all displays");
            source.Update(null, null, false, false);
            Equal(new RoomSessionFacts(false, false, false), source.Read("b"), "unlock cannot invent foreground or pause");
        });
        check("Windows samples notify outside storage lock and repeat for failed delivery retry", () =>
        {
            var source = new RoomRuntimeFactsSource();
            var count = 0;
            source.Sampled += () => {
                var read = Task.Run(() => source.Read("a"));
                Require(read.Wait(TimeSpan.FromSeconds(2)), "sample observer can read from another thread");
                Equal(new RoomSessionFacts(false, false, true), read.Result, "published complete facts");
                count++;
            };
            source.Update(null, false, false, true);
            source.Update(null, false, false, true);
            Equal(2, count, "repeat sample permits storage failure retry");
        });
        check("first subscribed snapshot already contains complete trusted Windows facts", () =>
        {
            using var kernel = new RoomSessionKernel();
            var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
            var core = new RoomSessionPeer("core-1");
            var control = Open(gateway, core, RoomClientRole.Coordinator);
            var all = new List<RoomSessionSnapshot>();
            using var watch = kernel.Subscribe(all.Add);
            var initial = gateway.Start(control, core, new RoomSessionFacts(true, true, false));
            Equal(RoomProtocolStatus.Accepted, initial.Status, "trusted start");
            var player = new RoomSessionPeer("player-1");
            var view = Open(gateway, player, RoomClientRole.DesktopPlayer);
            var events = new List<RoomSessionSnapshot>();
            gateway.Subscribe(view, player, events.Add, out var handle);
            using (handle)
            {
                Equal(1, all.Count, "no permissive intermediate kernel snapshot");
                Equal(1, events.Count, "single complete initial Player snapshot");
                Equal(initial.Snapshot, events[0], "view matches authoritative start");
                Require(!events[0].IsOperable && !events[0].IsDesktopForeground &&
                    events[0].Lifecycle.Locked && events[0].Lifecycle.PlaybackPaused, "all restrictive facts present initially");
            }
        });
        check("native start and checkpoint restore preserve initially restricted facts", () =>
        {
            var store = new MemoryCheckpointStore();
            var policy = new RoomSessionRuntimePolicy("native-stamp", true, TimeSpan.FromSeconds(3));
            var facts = new RoomSessionFacts(true, true, false);
            using (var kernel = new RoomSessionKernel(store))
            {
                var first = kernel.Start("room", ["a", "b"], "b", policy, facts);
                Equal(RoomLifecycleStage.Starting, first.Lifecycle.Stage, "start policy retained");
                Require(first.Lifecycle.Locked && first.Lifecycle.PlaybackPaused && !first.IsDesktopForeground, "initial restrictions retained");
            }
            using var restored = new RoomSessionKernel(store);
            var all = new List<RoomSessionSnapshot>();
            using var watch = restored.Subscribe(all.Add);
            Require(restored.TryRestore("room", ["a", "b"], out var snapshot, policy, facts), "same-install restore");
            Equal("b", snapshot!.CurrentDeskId, "checkpoint desk preserved");
            Equal(1, all.Count, "one complete restore publication");
            Require(!snapshot.IsOperable && snapshot.Lifecycle.Locked && snapshot.Lifecycle.PlaybackPaused &&
                !snapshot.IsDesktopForeground, "restore has no permissive intermediate state");
        });
        check("atomic unlock with background foreground never emits an operable revision", () =>
        {
            using var kernel = new RoomSessionKernel();
            var first = kernel.Start("room", ["a", "b"], "a", initialFacts: new RoomSessionFacts(true, true, true));
            var events = new List<RoomSessionSnapshot>();
            using var watch = kernel.Subscribe(events.Add);
            Require(kernel.SetRuntimeFacts(first.SessionId, new RoomSessionFacts(false, false, false)), "unlock accepted");
            Equal(first.Revision + 1, kernel.Snapshot!.Revision, "single global revision");
            Equal(first.Lifecycle.Revision + 1, kernel.Snapshot.Lifecycle.Revision, "single lifecycle revision");
            Require(events.All(s => !s.IsOperable), "no stale foreground unlock");
            kernel.SetRuntimeFacts(first.SessionId, new RoomSessionFacts(false, false, false));
            Equal(2, events.Count, "unchanged complete facts do not publish");
            kernel.SetRuntimeFacts(first.SessionId, new RoomSessionFacts(false, false, true));
            Require(kernel.Snapshot.IsOperable, "only subsequent real foreground enables desktop");
        });
        check("runtime facts storage failure keeps exact snapshot and repeated sample retries", () =>
        {
            var store = new FaultingCheckpointStore();
            using var kernel = new RoomSessionKernel(store);
            var gateway = new RoomSessionProtocolGateway(kernel, new TestAdmissionAuthority());
            var core = new RoomSessionPeer("core-1");
            var control = Open(gateway, core, RoomClientRole.Coordinator);
            var first = gateway.Start(control, core).Snapshot!;
            var player = new RoomSessionPeer("player-1");
            var view = Open(gateway, player, RoomClientRole.DesktopPlayer);
            var moving = gateway.Request(view, player, first.SessionId, "work").Snapshot!;
            var source = new RoomRuntimeFactsSource();
            var replies = new List<RoomProtocolReply>();
            source.Sampled += () => replies.Add(gateway.SetRuntimeFacts(control, core, first.SessionId, source.Read("a")));
            store.WriteFailure = new IOException("fixture locked checkpoint");
            source.Update("a", true, true, false);
            Equal(RoomProtocolStatus.StorageUnavailable, replies[^1].Status, "failure surfaced");
            Equal(moving, kernel.Snapshot, "no partially updated Windows facts");
            store.WriteFailure = null;
            source.Update("a", true, true, false);
            Equal(RoomProtocolStatus.Accepted, replies[^1].Status, "same sample retries");
            Equal("work", kernel.Snapshot!.CurrentDeskId, "target committed before restricted snapshot");
            Require(kernel.Snapshot.Lifecycle.Locked && !kernel.Snapshot.IsDesktopForeground &&
                kernel.Snapshot.Lifecycle.PlaybackPaused && !kernel.Snapshot.IsOperable, "all facts committed together");
        });
        check("only current coordinator may apply complete runtime facts", () =>
        {
            using var kernel = new RoomSessionKernel();
            var authority = new TestAdmissionAuthority();
            var gateway = new RoomSessionProtocolGateway(kernel, authority);
            var core = new RoomSessionPeer("core-1");
            var control = Open(gateway, core, RoomClientRole.Coordinator);
            var first = gateway.Start(control, core).Snapshot!;
            var facts = new RoomSessionFacts(true, true, false);
            foreach (var (peer, role) in new[] { (new RoomSessionPeer("player-1"), RoomClientRole.DesktopPlayer), (new RoomSessionPeer("dock-1"), RoomClientRole.Dock) })
            {
                var view = Open(gateway, peer, role);
                Equal(RoomProtocolStatus.Forbidden, gateway.SetRuntimeFacts(view, peer, first.SessionId, facts).Status, "view cannot supply Windows facts");
                Equal(RoomProtocolStatus.Forbidden, gateway.Start(view, peer, facts).Status, "view cannot supply startup facts");
            }
            Equal(RoomProtocolStatus.Denied, gateway.SetRuntimeFacts(control, new RoomSessionPeer("player-1"), first.SessionId, facts).Status, "spoofed transport");
            Equal(RoomProtocolStatus.StaleSession, gateway.SetRuntimeFacts(control, core, Guid.NewGuid(), facts).Status, "wrong session");
            Equal(first, kernel.Snapshot, "denied mutations preserved exact snapshot");
            gateway.Close(control, core);
            Equal(RoomProtocolStatus.StaleSession, gateway.SetRuntimeFacts(control, core, first.SessionId, facts).Status, "closed coordinator");
            var replacement = Open(gateway, core, RoomClientRole.Coordinator);
            authority.StampA = "reinstalled";
            Require(gateway.SetRuntimeFacts(replacement, core, first.SessionId, facts).Status != RoomProtocolStatus.Accepted, "changed installation rejected");
        });
    }
    private static Guid Open(RoomSessionProtocolGateway gateway, RoomSessionPeer peer, RoomClientRole role) =>
        gateway.Open(peer, new RoomSessionHello(RoomSessionKernel.ProtocolVersion, role, "install-a")).ConnectionId!.Value;
    private static void Require(bool condition, string detail) { if (!condition) throw new Exception(detail); }
    private static void Equal<T>(T expected, T actual, string detail) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"{detail}: expected {expected}, got {actual}"); }
}
