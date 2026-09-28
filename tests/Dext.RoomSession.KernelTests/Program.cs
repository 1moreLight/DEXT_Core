using Dext.Core.Rooms;

var failures = 0;

void Check(string name, Action test)
{
    try
    {
        test();
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception error)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {name}: {error.Message}");
    }
}

static void Equal<T>(T expected, T actual, string detail)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new Exception($"{detail}: expected {expected}, got {actual}");
}

static void True(bool value, string detail)
{
    if (!value) throw new Exception(detail);
}

if (args.Contains("--demo"))
{
    var now = new DateTimeOffset(2026, 9, 28, 10, 0, 0, TimeSpan.Zero);
    var folder = Path.Combine(Path.GetTempPath(), "dext-session-demo-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(folder);
    try
    {
        var store = new FileRoomSessionCheckpointStore(Path.Combine(folder, "session.json"));
        using var kernel = new RoomSessionKernel(store, () => now, TimeSpan.FromSeconds(2));
        using var desktop = kernel.Subscribe(s => Console.WriteLine($"desktop: r{s.Revision} {s.CurrentDeskId} → {s.TargetDeskId ?? "-"} ({s.SessionId})"));
        using var dock = kernel.Subscribe(s => Console.WriteLine($"dock:    r{s.Revision} {s.CurrentDeskId} → {s.TargetDeskId ?? "-"} ({s.SessionId})"));
        var first = kernel.Start("room-alpha", ["home", "work", "media", "games"], "home");
        var transition = kernel.Request(first.SessionId, "work").Snapshot!.TransitionId!.Value;
        Console.WriteLine("during work animation: request media, then games (last input wins)");
        kernel.Request(first.SessionId, "media");
        kernel.Request(first.SessionId, "games");
        kernel.Complete(first.SessionId, transition);
        Console.WriteLine("focus lost: commit games immediately");
        kernel.SetOperable(first.SessionId, false);
        Console.WriteLine("while unfocused: queue home without starting animation");
        kernel.Request(first.SessionId, "home");
        Console.WriteLine("focus restored: begin queued home transition");
        kernel.SetOperable(first.SessionId, true);
        Console.WriteLine("deadline exceeded: commit home without an animation result");
        now = now.AddSeconds(3);
        kernel.ExpireTransition();
        var second = kernel.Start("room-beta", ["new-home", "new-work"], "new-home");
        Console.WriteLine($"old completion accepted: {kernel.Complete(first.SessionId, transition)}");
        Console.WriteLine($"new session: {second.RoomId}/{second.CurrentDeskId}");
        using var restarted = new RoomSessionKernel(store);
        Console.WriteLine($"restore with wrong Room: {restarted.TryRestore("room-alpha", ["home", "work"], out _)}");
        Console.WriteLine($"restore with matching Room: {restarted.TryRestore("room-beta", ["new-home", "new-work"], out var restored)} -> {restored?.CurrentDeskId}");
        if (restored is not null)
        {
            restarted.Stop(restored.SessionId);
            Console.WriteLine($"stop clears checkpoint: {store.Read() is null}");
        }
    }
    finally
    {
        Directory.Delete(folder, recursive: true);
    }
    return;
}

Check("two views receive the same committed Desk and revision", () =>
{
    var kernel = new RoomSessionKernel();
    RoomSessionSnapshot? desktop = null;
    RoomSessionSnapshot? dock = null;
    using var viewA = kernel.Subscribe(s => desktop = s);
    using var viewB = kernel.Subscribe(s => dock = s);
    var started = kernel.Start("room-one", ["home", "work"], "home");
    Equal(1L, started.Revision, "initial revision");
    var requested = kernel.Request(started.SessionId, "work");
    Equal(RoomCommandStatus.Accepted, requested.Status, "request status");
    Equal("home", requested.Snapshot!.CurrentDeskId, "Desk must not commit before animation");
    Equal("work", requested.Snapshot.TargetDeskId, "target Desk");
    True(kernel.Complete(started.SessionId, requested.Snapshot.TransitionId!.Value), "completion accepted");
    Equal("work", desktop?.CurrentDeskId, "desktop Desk");
    Equal("work", dock?.CurrentDeskId, "dock Desk");
    Equal(desktop?.Revision, dock?.Revision, "view revision");
    Equal(null, kernel.Snapshot?.TargetDeskId, "transition ended");
});

Check("only the final queued target runs after an animation", () =>
{
    var kernel = new RoomSessionKernel();
    var start = kernel.Start("room-one", ["a", "b", "c", "d"], "a");
    var first = kernel.Request(start.SessionId, "b");
    Equal(RoomCommandStatus.Queued, kernel.Request(start.SessionId, "c").Status, "first queued input");
    Equal(RoomCommandStatus.Queued, kernel.Request(start.SessionId, "d").Status, "last queued input");
    True(kernel.Complete(start.SessionId, first.Snapshot!.TransitionId!.Value), "first completion");
    Equal(5L, kernel.Snapshot?.Revision, "one published revision per state change");
    Equal("b", kernel.Snapshot?.CurrentDeskId, "first target committed");
    Equal("d", kernel.Snapshot?.TargetDeskId, "last target now active");
    var second = kernel.Snapshot!.TransitionId!.Value;
    True(kernel.Complete(start.SessionId, second), "second completion");
    Equal("d", kernel.Snapshot?.CurrentDeskId, "final Desk");
    Equal(null, kernel.Snapshot?.TargetDeskId, "no third transition");
});

Check("timeout and focus loss commit the target and pause new transitions", () =>
{
    var now = new DateTimeOffset(2026, 9, 28, 10, 0, 0, TimeSpan.Zero);
    var kernel = new RoomSessionKernel(clock: () => now, transitionTimeout: TimeSpan.FromSeconds(2));
    var start = kernel.Start("room-one", ["a", "b", "c"], "a");
    kernel.Request(start.SessionId, "b");
    now = now.AddSeconds(1);
    True(!kernel.ExpireTransition(), "early timeout rejected");
    now = now.AddSeconds(2);
    True(kernel.ExpireTransition(), "deadline commits target");
    Equal("b", kernel.Snapshot?.CurrentDeskId, "timeout target");
    kernel.Request(start.SessionId, "c");
    True(kernel.SetOperable(start.SessionId, false), "focus loss accepted");
    Equal("c", kernel.Snapshot?.CurrentDeskId, "focus loss target");
    Equal(RoomCommandStatus.Queued, kernel.Request(start.SessionId, "a").Status, "input paused");
    Equal(null, kernel.Snapshot?.TransitionId, "no transition while unfocused");
    True(kernel.SetOperable(start.SessionId, true), "focus restored");
    Equal("a", kernel.Snapshot?.TargetDeskId, "queued input resumes");
});

Check("old sessions and late animation results cannot overwrite a new Room", () =>
{
    var kernel = new RoomSessionKernel();
    var old = kernel.Start("old-room", ["a", "b"], "a");
    var pending = kernel.Request(old.SessionId, "b").Snapshot!.TransitionId!.Value;
    var fresh = kernel.Start("new-room", ["x", "y"], "x");
    True(!kernel.Complete(old.SessionId, pending), "old completion rejected");
    var rejected = kernel.Request(old.SessionId, "a");
    Equal(RoomCommandStatus.Rejected, rejected.Status, "old request rejected");
    Equal(null, rejected.Snapshot, "old session receives no new Room state");
    Equal(fresh.SessionId, kernel.Snapshot?.SessionId, "new session retained");
    Equal("x", kernel.Snapshot?.CurrentDeskId, "new Desk retained");
});

Check("checkpoint contains only committed Desk and needs validated Room identity to restore", () =>
{
    var folder = Path.Combine(Path.GetTempPath(), "dext-session-test-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(folder);
    try
    {
        var file = Path.Combine(folder, "session.json");
        var store = new FileRoomSessionCheckpointStore(file);
        var kernel = new RoomSessionKernel(store);
        var first = kernel.Start("room-one", ["a", "b"], "a");
        var transition = kernel.Request(first.SessionId, "b").Snapshot!.TransitionId!.Value;
        Equal("a", store.Read()?.DeskId, "uncommitted target not persisted");
        kernel.Complete(first.SessionId, transition);
        Equal("b", store.Read()?.DeskId, "committed target persisted");
        var restarted = new RoomSessionKernel(store);
        True(!restarted.TryRestore("other-room", ["a", "b"], out _), "wrong Room rejected");
        True(!restarted.TryRestore("room-one", ["a"], out _), "missing Desk rejected");
        True(restarted.TryRestore("room-one", ["a", "b"], out var restored), "matching Room restored");
        Equal("b", restored?.CurrentDeskId, "restored Desk");
        True(restored?.SessionId != first.SessionId, "old session ID not reused");
    }
    finally
    {
        Directory.Delete(folder, recursive: true);
    }
});

Check("an unresponsive view is committed by the kernel timer", () =>
{
    using var kernel = new RoomSessionKernel(transitionTimeout: TimeSpan.FromMilliseconds(60));
    var started = kernel.Start("room-one", ["a", "b"], "a");
    kernel.Request(started.SessionId, "b");
    True(SpinWait.SpinUntil(() => kernel.Snapshot?.CurrentDeskId == "b", TimeSpan.FromSeconds(2)),
        "target must commit without a view calling ExpireTransition");
    Equal(null, kernel.Snapshot?.TargetDeskId, "timed-out transition cleared");
});

Check("timer retries when the wall clock moves backward", () =>
{
    var start = new DateTimeOffset(2026, 9, 28, 10, 0, 0, TimeSpan.Zero);
    long clockTicks = start.Ticks;
    using var kernel = new RoomSessionKernel(
        clock: () => new DateTimeOffset(Interlocked.Read(ref clockTicks), TimeSpan.Zero),
        transitionTimeout: TimeSpan.FromMilliseconds(40));
    var started = kernel.Start("room-one", ["a", "b"], "a");
    kernel.Request(started.SessionId, "b");
    Interlocked.Exchange(ref clockTicks, start.AddMilliseconds(-40).Ticks);
    Thread.Sleep(200);
    Equal("a", kernel.Snapshot?.CurrentDeskId, "early timer callback must not commit");
    Interlocked.Exchange(ref clockTicks, start.AddSeconds(1).Ticks);
    True(SpinWait.SpinUntil(() => kernel.Snapshot?.CurrentDeskId == "b", TimeSpan.FromSeconds(2)),
        "timer must retry and commit after the shifted deadline");
});

Check("restore cannot replace a live session", () =>
{
    var folder = Path.Combine(Path.GetTempPath(), "dext-session-live-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(folder);
    try
    {
        var kernel = new RoomSessionKernel(new FileRoomSessionCheckpointStore(Path.Combine(folder, "session.json")));
        var active = kernel.Start("room-one", ["a", "b"], "a");
        True(!kernel.TryRestore("room-one", ["a", "b"], out _), "restore is startup-only");
        Equal(active.SessionId, kernel.Snapshot?.SessionId, "live session preserved");
    }
    finally
    {
        Directory.Delete(folder, recursive: true);
    }
});

Check("stopping a Room invalidates commands, notifies views and clears recovery", () =>
{
    var folder = Path.Combine(Path.GetTempPath(), "dext-session-stop-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(folder);
    try
    {
        var store = new FileRoomSessionCheckpointStore(Path.Combine(folder, "session.json"));
        using var kernel = new RoomSessionKernel(store);
        RoomSessionSnapshot? view = null;
        using var subscription = kernel.Subscribe(s => view = s);
        var active = kernel.Start("room-one", ["a", "b"], "a");
        var pending = kernel.Request(active.SessionId, "b").Snapshot!.TransitionId!.Value;
        True(kernel.Stop(active.SessionId), "stop accepted");
        True(view is { IsActive: false }, "view sees stopped state");
        Equal(RoomCommandStatus.Rejected, kernel.Request(active.SessionId, "a").Status, "old command rejected");
        True(!kernel.Complete(active.SessionId, pending), "late completion rejected");
        Equal(null, store.Read(), "recovery removed");
        using var restarted = new RoomSessionKernel(store);
        True(!restarted.TryRestore("room-one", ["a", "b"], out _), "stopped Room cannot restore");
    }
    finally
    {
        Directory.Delete(folder, recursive: true);
    }
});

Environment.ExitCode = failures == 0 ? 0 : 1;
Console.WriteLine($"{8 - failures}/8 session checks passed");
