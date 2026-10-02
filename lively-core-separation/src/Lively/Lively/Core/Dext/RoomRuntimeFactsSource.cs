using System;
using System.Collections.Generic;

namespace Dext.Core.Rooms;

// Leaf service: Windows playback owns samples; the coordinator only reads them.
// Unknown/new displays are restrictive until an actual playback decision arrives.
public sealed class RoomRuntimeFactsSource
{
    private readonly object gate = new();
    private readonly Dictionary<string, bool> displayPause = new(StringComparer.OrdinalIgnoreCase);
    private string? nativePresentationDisplay;
    private bool allPaused = true, locked = true, foreground;
    public event Action? Sampled;

    public RoomSessionFacts Read(string displayId)
    {
        lock (gate)
            return new(displayPause.TryGetValue(displayId, out var paused) ? paused : allPaused, locked, foreground || StringComparer.OrdinalIgnoreCase.Equals(nativePresentationDisplay, displayId));
    }

    internal void SetNativePresentation(string? displayId, bool shown, bool? desktopForeground = null)
    {
        if (shown && string.IsNullOrEmpty(displayId)) throw new ArgumentException("Presented display is required.", nameof(displayId));
        lock (gate)
        {
            nativePresentationDisplay = shown ? displayId : null;
            if (desktopForeground is { } sampled) foreground = sampled;
        }
        Sampled?.Invoke();
    }

    public void Update(string? displayId, bool? playbackPaused, bool isLocked, bool desktopForeground,
        string? nativeDisplay = null, bool? nativeShown = null)
    {
        lock (gate)
        {
            if (nativeShown is { } shown) nativePresentationDisplay = shown ? nativeDisplay : null;
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
