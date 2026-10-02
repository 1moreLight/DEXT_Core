using System;
using System.Collections.Generic;

namespace Dext.Core.Rooms;

// Leaf service: Windows playback owns samples; the coordinator only reads them.
// Unknown/new displays are restrictive until an actual playback decision arrives.
public sealed class RoomRuntimeFactsSource
{
    private readonly object gate = new();
    private readonly Dictionary<string, bool> displayPause = new(StringComparer.OrdinalIgnoreCase);
    private bool allPaused = true, locked = true, foreground;
    public event Action? Sampled;

    public RoomSessionFacts Read(string displayId)
    {
        lock (gate)
            return new(displayPause.TryGetValue(displayId, out var paused) ? paused : allPaused, locked, foreground);
    }

    public void Update(string? displayId, bool? playbackPaused, bool isLocked, bool desktopForeground)
    {
        lock (gate)
        {
            locked = isLocked;
            foreground = desktopForeground;
            if (playbackPaused is { } paused)
            {
                if (displayId is null) { allPaused = paused; displayPause.Clear(); }
                else displayPause[displayId] = paused;
            }
        }
        // No storage lock across observers. Repeated samples permit a previously
        // failed checkpoint write to retry; unchanged Kernel facts are a no-op.
        Sampled?.Invoke();
    }
}
