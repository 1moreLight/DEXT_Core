using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Lively.Services.ApplicationDock;

internal sealed record DockPin(string Name, string Target, string Arguments, string WorkingDirectory);
internal sealed record DockTask(long Handle, int ProcessId, string Title, string Target);
internal sealed record DockGroup(string Key, string Name, DockPin Pin, IReadOnlyList<DockTask> Windows)
{
    public string PinScope { get; init; }
}
internal sealed record DockPreferences(bool Enabled, DockPin[] Pins, bool AutoHide = false, bool ReserveSpace = false, string Presentation = "native")
{
    public DockPreferences WithAutoHide(bool value) => this with { AutoHide = value, ReserveSpace = value ? false : ReserveSpace };
    public DockPreferences WithReserveSpace(bool value) => this with { ReserveSpace = value, AutoHide = value ? false : AutoHide };
}
internal enum DockAction { Launch, Activate, Minimize, Choose }

internal static class DockModel
{
    public static string Identity(string target) => (target ?? "").Trim().Replace('/', '\\').ToUpperInvariant();
    public static IReadOnlyList<DockGroup> Group(IReadOnlyList<DockPin> pins, IReadOnlyList<DockTask> windows)
    {
        var running = windows.GroupBy(w => Identity(w.Target)).ToDictionary(g => g.Key, g => (IReadOnlyList<DockTask>)g.ToArray());
        var result = new List<DockGroup>();
        var seen = new HashSet<string>();
        foreach (var pin in pins)
        {
            var key = Identity(pin.Target);
            if (seen.Add(key))
                result.Add(new(key, pin.Name, pin, running.GetValueOrDefault(key) ?? Array.Empty<DockTask>()));
        }
        foreach (var pair in running.OrderBy(p => p.Key, StringComparer.Ordinal))
            if (seen.Add(pair.Key))
                result.Add(new(pair.Key, Path.GetFileNameWithoutExtension(pair.Value[0].Target), null, pair.Value));
        return result;
    }
    public static bool CanEditPin(DockGroup group, string scope) => group.PinScope == scope;
    public static DockAction Action(DockGroup group, long foreground) =>
        group.Windows.Count switch
        {
            0 => DockAction.Launch,
            1 => group.Windows[0].Handle == foreground ? DockAction.Minimize : DockAction.Activate,
            _ => DockAction.Choose
        };
}

internal static class DockPreferenceFile
{
    public static DockPreferences Load(string path)
    {
        // A missing file prefers the native Application Dock. Theme presentation stays opt-in.
        if (!File.Exists(path)) return new(true, Array.Empty<DockPin>());
        var value = JsonSerializer.Deserialize<DockPreferences>(File.ReadAllText(path));
        if (value == null || value.Presentation is not ("native" or "theme") || value.AutoHide && value.ReserveSpace || value.Pins == null || value.Pins.Any(p => p == null || string.IsNullOrWhiteSpace(p.Target) || string.IsNullOrWhiteSpace(p.Name)))
            throw new JsonException("Application Dock preferences are invalid.");
        return value;
    }
    public static void Save(string path, DockPreferences value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(value));
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
