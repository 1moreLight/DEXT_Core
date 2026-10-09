using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading;
namespace Dext.Core.Rooms;
// Observe kernel-confirmed duration; this does not claim a displayed-frame timing.
internal sealed class RoomPerformanceTrace
{
    private readonly object gate = new();
    private Guid session;
    private Guid? transition;
    private string? target;
    private long started;
    public void Observe(RoomSessionSnapshot snapshot)
    {
        string? entry = null;
        lock (gate)
        {
            if (session != snapshot.SessionId) { session = snapshot.SessionId; transition = null; target = null; }
            if (transition is not null && transition != snapshot.TransitionId)
            {
                var duration = (Stopwatch.GetTimestamp() - started) * 1000.0 / Stopwatch.Frequency;
                entry = JsonSerializer.Serialize(new { kind = "desk.kernelConfirmed", processId = Environment.ProcessId, roomId = snapshot.RoomId,
                    transitionId = transition, durationMs = duration,
                    outcome = snapshot.IsActive && snapshot.CurrentDeskId == target ? "arrived" : "interrupted",
                    unixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
                transition = null;
            }
            if (snapshot.TransitionId is not null && snapshot.TransitionId != transition)
            { transition = snapshot.TransitionId; target = snapshot.TargetDeskId; started = Stopwatch.GetTimestamp(); }
        }
        if (entry is not null)
        {
            // Snapshot callbacks may hold gateway locks; logging happens afterward.
            var message = entry;
            ThreadPool.QueueUserWorkItem(_ => NLog.LogManager.GetCurrentClassLogger().Info("DEXT_PERF " + message));
        }
    }
}