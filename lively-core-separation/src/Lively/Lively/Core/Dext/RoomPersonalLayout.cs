using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Dext.Core.Rooms;

internal sealed record RoomLayoutPosition(double X, double Y);
internal sealed record RoomLayoutRectangle(double X, double Y, double Width, double Height);
internal sealed record RoomLayoutChange(string Kind, string Id, string? DeskId, double X, double Y, double? Width = null, double? Height = null, RoomLayoutChange[]? Peers = null);

// Saved design-canvas coordinates only. Viewport fitting and authored occupancy
// belong to the official view and must never overwrite this persisted snapshot.
internal sealed class RoomPersonalLayout
{
    public long Revision { get; set; }
    public Dictionary<string, Dictionary<string, RoomLayoutPosition>> Icons { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, RoomLayoutRectangle> Components { get; set; } = new(StringComparer.Ordinal);
    internal static bool Position(double x, double y) => double.IsFinite(x) && double.IsFinite(y) && x >= 0 && y >= 0 && x <= 1824 && y <= 976;
    internal static bool Rectangle(double x, double y, double w, double h) =>
        double.IsFinite(x) && double.IsFinite(y) && double.IsFinite(w) && double.IsFinite(h) &&
        x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1920 && y + h <= 1080;
    internal static void Validate(RoomPersonalLayout? layout)
    {
        static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool ok) { if (!ok) throw new InvalidDataException("Invalid personal layout"); }
        Require(layout is not null && layout.Revision >= 0 && layout.Revision <= 9007199254740991 && layout.Icons is not null && layout.Components is not null);
        Require(layout!.Icons.Count <= 64 && layout.Components.Count <= 128);
        var count = 0;
        foreach (var (desk, icons) in layout.Icons)
        {
            RoomPersonalStore.Id(desk); Require(icons is not null && icons.Count <= 1024);
            foreach (var (id, position) in icons!)
            { RoomPersonalStore.Id(id); Require(++count <= 4096 && position is not null && Position(position.X, position.Y)); }
        }
        foreach (var (id, rect) in layout.Components)
        { RoomPersonalStore.Id(id); Require(rect is not null && Rectangle(rect.X, rect.Y, rect.Width, rect.Height)); }
    }
    internal static RoomPersonalLayout Project(RoomPersonalLayout source, JsonElement manifest)
    {
        var result = new RoomPersonalLayout { Revision = source.Revision };
        foreach (var desk in manifest.GetProperty("desks").EnumerateArray())
        {
            var deskId = desk.GetProperty("id").GetString()!;
            if (!source.Icons.TryGetValue(deskId, out var positions)) continue;
            var known = desk.GetProperty("icons").EnumerateArray().Select(icon => icon.GetProperty("id").GetString()!).ToHashSet(StringComparer.Ordinal);
            var selected = positions.Where(pair => known.Contains(pair.Key)).ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);
            if (selected.Count > 0) result.Icons[deskId] = selected;
        }
        if (manifest.TryGetProperty("components", out var components))
            foreach (var component in components.EnumerateArray())
                if (component.GetProperty("role").GetString() == "widget" &&
                    source.Components.TryGetValue(component.GetProperty("id").GetString()!, out var rect))
                    result.Components[component.GetProperty("id").GetString()!] = rect;
        return result;
    }
}
