using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

namespace Dext.Core.Rooms;

public enum RoomCommandStatus { Accepted, Queued, Rejected }
public enum RoomLifecycleStage { Starting, Desktop, Idle }
public sealed record RoomSessionLifecycle(RoomLifecycleStage Stage, bool PlaybackPaused, bool Locked, long Revision);
// Only the trusted installation adapter supplies this policy, never page input.
public sealed record RoomSessionRuntimePolicy(string InstallationStamp, bool HasStart, TimeSpan TransitionTimeout);

// Complete snapshots allow a reconnected view to catch up without replaying events.
public sealed record RoomSessionSnapshot(
    int ProtocolVersion,
    Guid SessionId,
    string RoomId,
    string CurrentDeskId,
    string? TargetDeskId,
    string? QueuedDeskId,
    Guid? TransitionId,
    long Revision,
    bool IsOperable,
    DateTimeOffset? DeadlineUtc)
{
    public bool IsActive { get; init; } = true;
    public string InstallationStamp { get; init; } = string.Empty;
    public RoomSessionLifecycle Lifecycle { get; init; } = new(RoomLifecycleStage.Desktop, false, false, 0);
}

public sealed record RoomCommandResult(RoomCommandStatus Status, RoomSessionSnapshot? Snapshot);
public sealed record RoomSessionCheckpoint(int FormatVersion, string RoomId, string DeskId, string? InstallationStamp = null);

public interface IRoomSessionCheckpointStore
{
    RoomSessionCheckpoint? Read();
    void Write(RoomSessionCheckpoint checkpoint);
    void Clear();
}

public sealed class FileRoomSessionCheckpointStore : IRoomSessionCheckpointStore
{
    private readonly string path;

    public FileRoomSessionCheckpointStore(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("Checkpoint path is required", nameof(path));
        this.path = Path.GetFullPath(path);
    }

    public RoomSessionCheckpoint? Read()
    {
        try
        {
            var checkpoint = JsonSerializer.Deserialize<RoomSessionCheckpoint>(File.ReadAllText(path));
            return checkpoint is { FormatVersion: 1 } &&
                   !string.IsNullOrWhiteSpace(checkpoint.RoomId) &&
                   !string.IsNullOrWhiteSpace(checkpoint.DeskId)
                ? checkpoint
                : null;
        }
        catch (Exception error) when (error is FileNotFoundException or DirectoryNotFoundException or JsonException)
        {
            Trace.TraceWarning($"Dext Room checkpoint could not be read: {error.Message}");
            return null;
        }
    }

    public void Write(RoomSessionCheckpoint checkpoint)
    {
        if (checkpoint.FormatVersion != 1 || string.IsNullOrWhiteSpace(checkpoint.RoomId) ||
            string.IsNullOrWhiteSpace(checkpoint.DeskId))
            throw new ArgumentException("Invalid Room checkpoint", nameof(checkpoint));

        var directory = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(directory);
        var temp = Path.Combine(directory, $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp");
        try
        {
            File.WriteAllText(temp, JsonSerializer.Serialize(checkpoint));
            if (File.Exists(path)) File.Replace(temp, path, null);
            else File.Move(temp, path);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    public void Clear()
    {
        if (File.Exists(path)) File.Delete(path);
    }
}

public sealed class RoomSessionKernel : IDisposable
{
    public const int ProtocolVersion = 1;
    private readonly object gate = new();
    private readonly IRoomSessionCheckpointStore store;
    private readonly Func<DateTimeOffset> clock;
    private readonly TimeSpan transitionTimeout;
    private readonly Timer timeoutTimer;
    private readonly Dictionary<long, Subscription> subscriptions = new();
    private HashSet<string>? deskIds;
    private RoomSessionSnapshot? snapshot;
    private long revision;
    private RoomSessionRuntimePolicy? runtimePolicy;
    private bool desktopForeground = true;
    private long nextSubscriptionId;
    private bool disposed;

    public RoomSessionKernel(IRoomSessionCheckpointStore? store = null,
        Func<DateTimeOffset>? clock = null, TimeSpan? transitionTimeout = null)
    {
        this.store = store ?? new TransientCheckpointStore();
        this.clock = clock ?? (() => DateTimeOffset.UtcNow);
        this.transitionTimeout = transitionTimeout ?? TimeSpan.FromSeconds(10);
        if (this.transitionTimeout <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(transitionTimeout));
        timeoutTimer = new Timer(_ => OnTimeout(), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
    }

    public RoomSessionSnapshot? Snapshot
    {
        get { lock (gate) return snapshot; }
    }

    // Short read boundary: callback must not mutate or publish notifications.
    internal T WithSnapshot<T>(Func<RoomSessionSnapshot?, T> prepare)
    { lock (gate) return prepare(disposed ? null : snapshot); }

    public IDisposable Subscribe(Action<RoomSessionSnapshot> observer)
    {
        ArgumentNullException.ThrowIfNull(observer);
        Subscription subscription;
        RoomSessionSnapshot? initial;
        lock (gate)
        {
            ThrowIfDisposed();
            subscription = new Subscription(this, ++nextSubscriptionId, observer);
            subscriptions.Add(subscription.Id, subscription);
            initial = snapshot;
        }
        if (initial is not null) subscription.Notify(initial);
        return subscription;
    }

    public RoomSessionSnapshot Start(string roomId, IReadOnlyList<string> deskIds, string startDeskId,
        RoomSessionRuntimePolicy? policy = null)
    {
        var validIds = ValidateRoom(roomId, deskIds, startDeskId);
        ValidateRuntimePolicy(policy);
        RoomSessionSnapshot result;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            // A failed checkpoint write must leave the old authority intact.
            store.Write(new RoomSessionCheckpoint(1, roomId, startDeskId, policy?.InstallationStamp));
            this.deskIds = validIds;
            runtimePolicy = policy;
            desktopForeground = true;
            result = new RoomSessionSnapshot(ProtocolVersion, Guid.NewGuid(), roomId,
                startDeskId, null, null, null, ++revision, policy?.HasStart != true, null)
            {
                InstallationStamp = policy?.InstallationStamp ?? string.Empty,
                Lifecycle = new(policy?.HasStart == true ? RoomLifecycleStage.Starting : RoomLifecycleStage.Desktop, false, false, 1)
            };
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return result;
    }

    public RoomCommandResult Request(Guid sessionId, string deskId)
    {
        RoomSessionSnapshot result;
        RoomCommandStatus status;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            var current = RequireSession();
            if (!current.IsActive || current.SessionId != sessionId)
                return new RoomCommandResult(RoomCommandStatus.Rejected, null);
            if (deskIds is null || !deskIds.Contains(deskId))
                return new RoomCommandResult(RoomCommandStatus.Rejected, current);
            if (current.TargetDeskId is null && current.IsOperable && current.CurrentDeskId == deskId)
                return new RoomCommandResult(RoomCommandStatus.Rejected, current);

            if (!current.IsOperable || current.TargetDeskId is not null)
            {
                result = current with { QueuedDeskId = deskId, Revision = ++revision };
                status = RoomCommandStatus.Queued;
            }
            else
            {
                result = BeginTransition(current, deskId);
                status = RoomCommandStatus.Accepted;
            }
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return new RoomCommandResult(status, result);
    }

    public bool Complete(Guid sessionId, Guid transitionId)
    {
        RoomSessionSnapshot result;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            var current = snapshot;
            if (current is null || !current.IsActive || current.SessionId != sessionId || current.TransitionId != transitionId ||
                current.TargetDeskId is null)
                return false;
            result = CommitTarget(current, current.IsOperable);
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return true;
    }

    public bool Stop(Guid sessionId)
    {
        RoomSessionSnapshot result;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            var current = snapshot;
            if (current is null || !current.IsActive || current.SessionId != sessionId) return false;
            store.Clear();
            result = current with { IsActive = false, IsOperable = false, TargetDeskId = null, QueuedDeskId = null,
                TransitionId = null, DeadlineUtc = null, Revision = ++revision };
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return true;
    }

    // This is the foreground fact; it cannot override pause/lock/start/idle.
    public bool SetOperable(Guid sessionId, bool operable) =>
        UpdateLifecycle(sessionId, null, null, null, operable);

    public bool SetLifecycle(Guid sessionId, RoomLifecycleStage stage, bool playbackPaused, bool locked) =>
        UpdateLifecycle(sessionId, stage, playbackPaused, locked, null);

    private bool UpdateLifecycle(Guid sessionId, RoomLifecycleStage? stage, bool? playbackPaused, bool? locked, bool? foreground)
    {
        RoomSessionSnapshot result;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            var current = snapshot;
            if (current is null || !current.IsActive || current.SessionId != sessionId) return false;
            var previous = current.Lifecycle;
            var nextStage = stage ?? previous.Stage;
            if (!Enum.IsDefined(typeof(RoomLifecycleStage), nextStage) ||
                (nextStage == RoomLifecycleStage.Starting && previous.Stage != RoomLifecycleStage.Starting)) return false;
            var paused = playbackPaused ?? previous.PlaybackPaused;
            var isLocked = locked ?? previous.Locked;
            var nextForeground = foreground ?? desktopForeground;
            var operable = nextForeground && nextStage == RoomLifecycleStage.Desktop && !paused && !isLocked;
            var lifecycleChanged = nextStage != previous.Stage || paused != previous.PlaybackPaused || isLocked != previous.Locked;
            if (!lifecycleChanged && current.IsOperable == operable)
            {
                desktopForeground = nextForeground;
                return true;
            }
            var updated = current with { Lifecycle = lifecycleChanged
                ? new(nextStage, paused, isLocked, previous.Revision + 1) : previous };
            if (!operable && updated.TargetDeskId is not null)
                result = CommitTarget(updated, false);
            else if (operable && updated.QueuedDeskId is not null && updated.QueuedDeskId != updated.CurrentDeskId)
                result = BeginTransition(updated with { IsOperable = true, QueuedDeskId = null }, updated.QueuedDeskId);
            else
                result = updated with { IsOperable = operable, Revision = ++revision,
                    QueuedDeskId = operable ? null : updated.QueuedDeskId };
            // A failed target checkpoint leaves all lifecycle/foreground facts
            // and revisions intact, so the trusted adapter can retry atomically.
            desktopForeground = nextForeground;
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return true;
    }

    public bool ExpireTransition()
    {
        RoomSessionSnapshot result;
        Subscription[] listeners;
        lock (gate)
        {
            if (disposed) return false;
            var current = snapshot;
            if (current is null || !current.IsActive || current.TargetDeskId is null) return false;
            if (current.DeadlineUtc > clock())
            {
                // A wall-clock adjustment can make a one-shot timer fire before the deadline.
                ScheduleTimeout(current);
                return false;
            }
            result = CommitTarget(current, current.IsOperable);
            snapshot = result;
            ScheduleTimeout(result);
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, result);
        return true;
    }

    public bool TryRestore(string roomId, IReadOnlyList<string> deskIds, out RoomSessionSnapshot? restored,
        RoomSessionRuntimePolicy? policy = null)
    {
        ValidateRuntimePolicy(policy);
        restored = null;
        Subscription[] listeners;
        lock (gate)
        {
            ThrowIfDisposed();
            if (snapshot is not null) return false;
            var checkpoint = store.Read();
            if (checkpoint is null || !StringComparer.Ordinal.Equals(checkpoint.RoomId, roomId) ||
                !StringComparer.Ordinal.Equals(checkpoint.InstallationStamp, policy?.InstallationStamp) ||
                deskIds is null || !deskIds.Contains(checkpoint.DeskId, StringComparer.Ordinal))
                return false;
            // Only a caller holding a validated installed Room may restore. Disk state
            // never restores a former session token, transition or queued input.
            var validIds = ValidateRoom(roomId, deskIds, checkpoint.DeskId);
            this.deskIds = validIds;
            runtimePolicy = policy;
            desktopForeground = true;
            restored = new RoomSessionSnapshot(ProtocolVersion, Guid.NewGuid(), roomId,
                checkpoint.DeskId, null, null, null, ++revision, policy?.HasStart != true, null)
            {
                InstallationStamp = policy?.InstallationStamp ?? string.Empty,
                Lifecycle = new(policy?.HasStart == true ? RoomLifecycleStage.Starting : RoomLifecycleStage.Desktop, false, false, 1)
            };
            snapshot = restored;
            listeners = subscriptions.Values.ToArray();
        }
        Publish(listeners, restored);
        return true;
    }

    private RoomSessionSnapshot BeginTransition(RoomSessionSnapshot current, string targetDeskId) =>
        current with
        {
            TargetDeskId = targetDeskId,
            QueuedDeskId = null,
            TransitionId = Guid.NewGuid(),
            DeadlineUtc = clock() + (runtimePolicy?.TransitionTimeout ?? transitionTimeout),
            Revision = ++revision
        };

    private RoomSessionSnapshot CommitTarget(RoomSessionSnapshot current, bool operable)
    {
        var target = current.TargetDeskId!;
        store.Write(new RoomSessionCheckpoint(1, current.RoomId, target,
            current.InstallationStamp.Length == 0 ? null : current.InstallationStamp));
        var committed = current with
        {
            CurrentDeskId = target,
            TargetDeskId = null,
            TransitionId = null,
            DeadlineUtc = null,
            IsOperable = operable
        };
        if (operable && committed.QueuedDeskId is not null && committed.QueuedDeskId != target)
            return BeginTransition(committed with { QueuedDeskId = null }, committed.QueuedDeskId);
        return committed with { QueuedDeskId = operable ? null : committed.QueuedDeskId,
            Revision = ++revision };
    }

    private static void ValidateRuntimePolicy(RoomSessionRuntimePolicy? policy)
    {
        if (policy is not null && (string.IsNullOrWhiteSpace(policy.InstallationStamp) || policy.InstallationStamp.Length > 128 ||
            policy.TransitionTimeout < TimeSpan.FromSeconds(3) || policy.TransitionTimeout > TimeSpan.FromSeconds(12)))
            throw new ArgumentException("Invalid native runtime policy", nameof(policy));
    }

    private RoomSessionSnapshot RequireSession() =>
        snapshot ?? throw new InvalidOperationException("No v3 Room session is active");

    private static HashSet<string> ValidateRoom(string roomId, IReadOnlyList<string> ids, string startDeskId)
    {
        if (string.IsNullOrWhiteSpace(roomId)) throw new ArgumentException("Room ID is required", nameof(roomId));
        if (ids is null || ids.Count == 0 || ids.Any(string.IsNullOrWhiteSpace))
            throw new ArgumentException("At least one nonempty Desk ID is required", nameof(ids));
        var distinct = new HashSet<string>(ids, StringComparer.Ordinal);
        if (distinct.Count != ids.Count || !distinct.Contains(startDeskId))
            throw new ArgumentException("Desk IDs must be unique and include the start Desk", nameof(ids));
        return distinct;
    }

    private void Unsubscribe(long id)
    {
        lock (gate) subscriptions.Remove(id);
    }

    private static void Publish(Subscription[] listeners, RoomSessionSnapshot value)
    {
        foreach (var listener in listeners) listener.Notify(value);
    }

    private sealed class Subscription(RoomSessionKernel owner, long id, Action<RoomSessionSnapshot> observer) : IDisposable
    {
        private readonly object notifyGate = new();
        private long lastRevision;
        private bool disposed;
        public long Id { get; } = id;

        public void Notify(RoomSessionSnapshot value)
        {
            lock (notifyGate)
            {
                if (disposed || value.Revision <= lastRevision) return;
                lastRevision = value.Revision;
                try { observer(value); }
                catch (Exception error) { Trace.TraceError($"Dext Room subscriber failed: {error}"); }
            }
        }

        public void Dispose()
        {
            lock (notifyGate) disposed = true;
            owner.Unsubscribe(Id);
        }
    }

    private sealed class TransientCheckpointStore : IRoomSessionCheckpointStore
    {
        public RoomSessionCheckpoint? Read() => null;
        public void Write(RoomSessionCheckpoint checkpoint) { }
        public void Clear() { }
    }

    private void ScheduleTimeout(RoomSessionSnapshot value)
    {
        if (value.DeadlineUtc is not { } deadline)
        {
            timeoutTimer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
            return;
        }
        var remaining = deadline - clock();
        timeoutTimer.Change(remaining > TimeSpan.Zero ? remaining : TimeSpan.FromMilliseconds(1),
            Timeout.InfiniteTimeSpan);
    }

    private void OnTimeout()
    {
        try { ExpireTransition(); }
        catch (Exception error)
        {
            Trace.TraceError($"Dext Room transition timeout failed: {error}");
            lock (gate)
            {
                if (!disposed && snapshot?.TargetDeskId is not null)
                    timeoutTimer.Change(TimeSpan.FromSeconds(1), Timeout.InfiniteTimeSpan);
            }
        }
    }

    private void ThrowIfDisposed()
    {
        if (disposed) throw new ObjectDisposedException(nameof(RoomSessionKernel));
    }

    public void Dispose()
    {
        lock (gate)
        {
            if (disposed) return;
            disposed = true;
            timeoutTimer.Dispose();
            subscriptions.Clear();
        }
    }
}
