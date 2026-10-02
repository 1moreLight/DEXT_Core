using Dext.Core.Rooms;

internal static class LifecycleChecks
{
    public static void Run(Action<string, Action> check)
    {
        check("host idle and wake cannot overwrite Windows restrictions or committed Desk",()=>{
            using var kernel=new RoomSessionKernel();var first=kernel.Start("room",["home","work","media"],"home",Policy());
            kernel.Request(first.SessionId,"work");kernel.Request(first.SessionId,"media");
            kernel.SetRuntimeFacts(first.SessionId,new(true,true,false));var before=kernel.Snapshot!;
            Require(kernel.SetHostStage(first.SessionId,RoomLifecycleStage.Idle),"idle entry");var idle=kernel.Snapshot!;
            Require(idle.Lifecycle is{Stage:RoomLifecycleStage.Idle,PlaybackPaused:true,Locked:true} && !idle.IsDesktopForeground && idle.CurrentDeskId=="work" && idle.QueuedDeskId=="media","idle facts retained");
            Require(kernel.SetHostStage(first.SessionId,RoomLifecycleStage.Desktop),"wake");var wake=kernel.Snapshot!;
            Require(wake.Lifecycle is{Stage:RoomLifecycleStage.Desktop,PlaybackPaused:true,Locked:true} && !wake.IsOperable && wake.QueuedDeskId=="media","wake cannot unlock or reset queue");
            Require(!kernel.SetHostStage(first.SessionId,RoomLifecycleStage.Starting) && !kernel.SetHostStage(Guid.NewGuid(),RoomLifecycleStage.Idle),"invalid host stage/session rejected");
            kernel.SetRuntimeFacts(first.SessionId,new(false,false,true));Require(kernel.Snapshot!.TargetDeskId=="media","actual recovery resumes final queue");
        });
        check("startup completion is current-phase only and preserves trusted restrictions",()=>{
            using var kernel=new RoomSessionKernel();var first=kernel.Start("room",["home","work"],"home",Policy(true),new(true,true,false));
            Require(!kernel.CompleteStartup(Guid.NewGuid(),first.Lifecycle.Revision),"wrong session");
            Require(!kernel.CompleteStartup(first.SessionId,first.Lifecycle.Revision+1),"wrong phase revision");
            Require(kernel.CompleteStartup(first.SessionId,first.Lifecycle.Revision),"current completion");
            var completed=kernel.Snapshot!;Require(completed.Lifecycle is{Stage:RoomLifecycleStage.Desktop,PlaybackPaused:true,Locked:true} && !completed.IsDesktopForeground && !completed.IsOperable,"facts preserved");
            Require(!kernel.CompleteStartup(first.SessionId,completed.Lifecycle.Revision),"completion cannot repeat outside starting");
            Require(kernel.Snapshot==completed,"replay changed state");
        });
        check("new document replays start once with committed Desk and cancels old completion",()=>{
            using var kernel=new RoomSessionKernel();var first=kernel.Start("room",["home","work"],"home",Policy(true));
            Require(kernel.BeginDocument(first.SessionId),"reload starting document");var reload=kernel.Snapshot!;
            Require(reload.Lifecycle.Revision==first.Lifecycle.Revision+1 && !kernel.CompleteStartup(first.SessionId,first.Lifecycle.Revision),"old document completion rejected");
            Require(kernel.CompleteStartup(first.SessionId,reload.Lifecycle.Revision),"new completion");
            var moving=kernel.Request(first.SessionId,"work").Snapshot!;Require(kernel.BeginDocument(first.SessionId),"reload while moving");
            var latest=kernel.Snapshot!;Require(latest.CurrentDeskId=="work" && latest.TargetDeskId==null && latest.Lifecycle.Stage==RoomLifecycleStage.Starting,"settled current target before start");
            Require(!kernel.Complete(first.SessionId,moving.TransitionId!.Value),"old transition rejected");
            Require(kernel.CompleteStartup(first.SessionId,latest.Lifecycle.Revision),"start completion");Require(kernel.Snapshot!.CurrentDeskId=="work","never reset to startDesk");
            Require(!kernel.SetLifecycle(first.SessionId,RoomLifecycleStage.Starting,false,false),"ordinary lifecycle cannot replay start");
        });
        check("new document during idle returns to idle without replay on ordinary wake",()=>{
            using var kernel=new RoomSessionKernel();var first=kernel.Start("room",["home","work"],"home",Policy(true));
            kernel.CompleteStartup(first.SessionId,first.Lifecycle.Revision);kernel.SetLifecycle(first.SessionId,RoomLifecycleStage.Idle,true,true);
            Require(kernel.BeginDocument(first.SessionId),"new idle document");var startup=kernel.Snapshot!;
            Require(kernel.CompleteStartup(first.SessionId,startup.Lifecycle.Revision),"finish idle document start");
            Require(kernel.Snapshot!.Lifecycle is{Stage:RoomLifecycleStage.Idle,PlaybackPaused:true,Locked:true},"return to idle preserves restrictions");
            kernel.SetLifecycle(first.SessionId,RoomLifecycleStage.Desktop,false,false);Require(kernel.Snapshot!.Lifecycle.Stage==RoomLifecycleStage.Desktop,"ordinary wake desktop");
        });
        check("new document failure does not publish a partial lifecycle or lose pending Desk",()=>{
            var store=new LifecycleStore();using var kernel=new RoomSessionKernel(store);var first=kernel.Start("room",["home","work"],"home",Policy(true));
            kernel.CompleteStartup(first.SessionId,first.Lifecycle.Revision);kernel.Request(first.SessionId,"work");var before=kernel.Snapshot!;
            var seen=new List<RoomSessionSnapshot>();using var watch=kernel.Subscribe(seen.Add);store.Fail=true;
            var failed=false;try{kernel.BeginDocument(first.SessionId);}catch(IOException){failed=true;}
            Require(failed && kernel.Snapshot==before && seen.Count==1,"failed checkpoint leaves exact state");store.Fail=false;
            Require(kernel.BeginDocument(first.SessionId) && kernel.Snapshot!.CurrentDeskId=="work","retry commits new document");
            using var noStart=new RoomSessionKernel();var plain=noStart.Start("plain",["a"],"a",Policy());Require(!noStart.BeginDocument(plain.SessionId)&&noStart.Snapshot==plain,"no invented start");
        });
        check("native start gates navigation and ordinary lifecycle cannot replay it", () =>
        {
            using var kernel = new RoomSessionKernel();
            var first = kernel.Start("room", ["home", "work"], "home", Policy(true));
            Require(first.Lifecycle.Stage == RoomLifecycleStage.Starting && !first.IsOperable && first.InstallationStamp == "stamp", "native start snapshot");
            Require(kernel.Request(first.SessionId, "work").Status == RoomCommandStatus.Queued, "start must queue navigation");
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Desktop, false, false);
            var moving = kernel.Snapshot!;
            Require(moving.TargetDeskId == "work" && moving.CurrentDeskId == "home", "startup completion resumes queued input");
            Require(!kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Starting, false, false), "start cannot replay in same session");
            Require(kernel.Snapshot == moving, "rejected replay changes nothing");
        });
        check("pause lock and idle preserve orthogonal facts and advance both revisions", () =>
        {
            using var kernel = new RoomSessionKernel();
            var first = kernel.Start("room", ["home", "work", "media"], "home", Policy());
            var updates = new List<RoomSessionSnapshot>();
            using var observation = kernel.Subscribe(updates.Add);
            var transition = kernel.Request(first.SessionId, "work").Snapshot!.TransitionId!.Value;
            kernel.Request(first.SessionId, "media");
            var before = kernel.Snapshot!;
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Desktop, true, false);
            var paused = kernel.Snapshot!;
            Require(paused.CurrentDeskId == "work" && paused.TargetDeskId is null && paused.QueuedDeskId == "media", "pause commits current target and retains final queue");
            Require(paused.Revision == before.Revision + 1 && paused.Lifecycle.Revision == before.Lifecycle.Revision + 1, "one atomic revision and lifecycle change");
            Require(!kernel.Complete(first.SessionId, transition), "late completion after pause rejected");
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Idle, true, true);
            var idle = kernel.Snapshot!;
            Require(idle.Lifecycle is { Stage: RoomLifecycleStage.Idle, PlaybackPaused: true, Locked: true }, "all facts retained");
            Require(idle.Revision == paused.Revision + 1 && idle.Lifecycle.Revision == paused.Lifecycle.Revision + 1 && !idle.IsOperable, "idle publishes one full state");
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Idle, true, true);
            Require(kernel.Snapshot == idle && updates[^1] == idle, "same facts do not publish again");
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Desktop, false, false);
            Require(kernel.Snapshot is { CurrentDeskId: "work", TargetDeskId: "media", IsOperable: true }, "resume committed Desk and final queued transition");
            Require(updates.Count == 6, "one event per change including initial");
        });
        check("foreground changes cannot override lock or pause and survive their recovery", () =>
        {
            using var kernel = new RoomSessionKernel();
            var first = kernel.Start("room", ["home", "work"], "home", Policy());
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Desktop, true, true);
            kernel.SetOperable(first.SessionId, true);
            Require(!kernel.Snapshot!.IsOperable, "foreground does not unlock playback");
            kernel.SetOperable(first.SessionId, false);
            kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Desktop, false, false);
            Require(!kernel.Snapshot!.IsOperable, "unlock keeps actual foreground false");
            kernel.SetOperable(first.SessionId, true);
            Require(kernel.Snapshot!.IsOperable, "foreground restoration enables desktop");
        });
        check("failed lifecycle commit preserves facts foreground revisions and observers", () =>
        {
            var store = new LifecycleStore();
            using var kernel = new RoomSessionKernel(store);
            var first = kernel.Start("room", ["home", "work"], "home", Policy());
            kernel.Request(first.SessionId, "work");
            var before = kernel.Snapshot;
            var updates = new List<RoomSessionSnapshot>();
            using var observation = kernel.Subscribe(updates.Add);
            store.Fail = true;
            var failed = false;
            try { kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Idle, true, true); }
            catch (IOException) { failed = true; }
            Require(failed && kernel.Snapshot == before && updates.Count == 1 && store.Current?.DeskId == "home", "failure must not publish partial lifecycle");
            store.Fail = false;
            Require(kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Idle, true, true), "retry accepted");
            Require(kernel.Snapshot!.CurrentDeskId == "work" && kernel.Snapshot.Revision == before!.Revision + 1 && updates.Count == 2, "one successful commit");
        });
        check("runtime lifecycle rejects stale stopped and invalid stage requests", () =>
        {
            using var kernel = new RoomSessionKernel();
            var first = kernel.Start("room", ["home"], "home", Policy());
            Require(!kernel.SetLifecycle(Guid.NewGuid(), RoomLifecycleStage.Idle, false, false), "wrong session");
            Require(!kernel.SetLifecycle(first.SessionId, (RoomLifecycleStage)99, false, false), "unknown stage");
            Require(kernel.Snapshot == first, "invalid facts do not change revision");
            kernel.Stop(first.SessionId);
            Require(!kernel.SetLifecycle(first.SessionId, RoomLifecycleStage.Idle, false, false), "stopped session");
        });
        check("restore requires matching installation and restarts startup with committed Desk", () =>
        {
            var store = new LifecycleStore();
            using (var kernel = new RoomSessionKernel(store))
            {
                var first = kernel.Start("room", ["home", "work"], "home", Policy());
                var transition = kernel.Request(first.SessionId, "work").Snapshot!.TransitionId!.Value;
                kernel.Complete(first.SessionId, transition);
            }
            using var restored = new RoomSessionKernel(store);
            Require(!restored.TryRestore("room", ["home", "work"], out _, Policy() with { InstallationStamp = "replacement" }), "new install cannot restore old copy");
            Require(!restored.TryRestore("room", ["home", "work"], out _), "legacy cannot restore native checkpoint");
            Require(restored.TryRestore("room", ["home", "work"], out var snapshot, Policy(true)), "same installation restores");
            Require(snapshot is { CurrentDeskId: "work", IsOperable: false } && snapshot.Lifecycle.Stage == RoomLifecycleStage.Starting, "new document gets start but keeps committed Desk");
        });
        check("installation watchdog survives ten second animations and uses per-session policy", () =>
        {
            var now = DateTimeOffset.UtcNow;
            using var kernel = new RoomSessionKernel(clock: () => now);
            var first = kernel.Start("room", ["home", "work"], "home", Policy() with { TransitionTimeout = TimeSpan.FromSeconds(12) });
            kernel.Request(first.SessionId, "work");
            Require(kernel.Snapshot!.DeadlineUtc == now.AddSeconds(12), "trusted session timeout");
            now = now.AddSeconds(10);
            Require(!kernel.ExpireTransition(), "legal long animation must not time out early");
            now = now.AddSeconds(2);
            Require(kernel.ExpireTransition() && kernel.Snapshot!.CurrentDeskId == "work", "watchdog eventually commits");
            var second = kernel.Start("other", ["a", "b"], "a", Policy());
            kernel.Request(second.SessionId, "b");
            Require(kernel.Snapshot!.DeadlineUtc == now.AddSeconds(3), "new policy replaces old timeout");
        });
    }

    private static RoomSessionRuntimePolicy Policy(bool start = false) => new("stamp", start, TimeSpan.FromSeconds(3));
    private static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
    private sealed class LifecycleStore : IRoomSessionCheckpointStore
    {
        public RoomSessionCheckpoint? Current;
        public bool Fail;
        public RoomSessionCheckpoint? Read() => Current;
        public void Write(RoomSessionCheckpoint value) { if (Fail) throw new IOException("unavailable"); Current = value; }
        public void Clear() => Current = null;
    }
}
