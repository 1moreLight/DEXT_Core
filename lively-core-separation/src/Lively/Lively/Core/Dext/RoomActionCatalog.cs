using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;

namespace Dext.Core.Rooms;

internal sealed record RoomButtonAction(string Type, string? DeskId = null);
internal sealed record AuthoredRoomButton(string Id, string Name, string Scope, RoomButtonAction? Action);

// Constructed from the same manifest bytes whose digest/inventory the native
// verifier has accepted. No separate mutable manifest read grants authority.
internal sealed class RoomActionCatalog
{
    internal sealed class Consumer
    {
        private readonly HashSet<string> capabilities;
        private readonly HashSet<string>? buttons;
        private readonly HashSet<string>? desks;
        private readonly bool desktop, dock;
        public Consumer(IEnumerable<string> capabilities, IEnumerable<string>? buttons, IEnumerable<string>? desks, bool desktop, bool dock)
        {
            this.capabilities = new(capabilities, StringComparer.Ordinal);
            this.buttons = buttons is null ? null : new(buttons, StringComparer.Ordinal);
            this.desks = desks is null ? null : new(desks, StringComparer.Ordinal);
            this.desktop = desktop; this.dock = dock;
        }
        public bool HasCapability(string capability) => capabilities.Contains(capability);
        public bool HasButton(string button) => buttons is null || buttons.Contains(button);
        public bool IsActive(RoomClientRole role, string desk) =>
            ((role == RoomClientRole.DesktopPlayer && desktop) || (role == RoomClientRole.Dock && dock)) && (desks is null || desks.Contains(desk));
    }
    public IReadOnlyDictionary<string, AuthoredRoomButton> Buttons { get; }
    public IReadOnlyDictionary<string, Consumer> Consumers { get; }
    private RoomActionCatalog(Dictionary<string, AuthoredRoomButton> buttons, Dictionary<string, Consumer> consumers)
    {
        Buttons = new ReadOnlyDictionary<string, AuthoredRoomButton>(buttons);
        Consumers = new ReadOnlyDictionary<string, Consumer>(consumers);
    }
    public static RoomActionCatalog FromVerifiedManifest(JsonElement room)
    {
        var buttons = new Dictionary<string, AuthoredRoomButton>(StringComparer.Ordinal);
        if (room.TryGetProperty("buttons", out var entries)) foreach (var entry in entries.EnumerateArray())
        {
            var id = entry.GetProperty("id").GetString()!;
            var action = entry.TryGetProperty("action", out var value) ? new RoomButtonAction(value.GetProperty("type").GetString()!,
                value.TryGetProperty("deskId", out var desk) ? desk.GetString() : null) : null;
            buttons.Add(id, new(id, entry.GetProperty("name").GetString()!, entry.GetProperty("scope").GetString()!, action));
        }
        static string[] Strings(JsonElement element, string key) => element.TryGetProperty(key, out var array)
            ? array.EnumerateArray().Select(v => v.GetString()!).ToArray() : Array.Empty<string>();
        var consumers = new Dictionary<string, Consumer>(StringComparer.Ordinal)
        {
            ["official"] = new(new[] { "desk.read", "desk.navigate", "binding.launch", "dext.exit" }, null, null, true, true),
        };
        if (room.TryGetProperty("roomScene", out var scene)) consumers.Add("scene", new(Strings(scene, "capabilities"), null, null, true, false));
        if (room.TryGetProperty("components", out var components)) foreach (var component in components.EnumerateArray())
        {
            var id = component.GetProperty("id").GetString()!;
            var desks = room.GetProperty("desks").EnumerateArray()
                .Where(d => Strings(d, "components").Contains(id, StringComparer.Ordinal)).Select(d => d.GetProperty("id").GetString()!);
            consumers.Add("component." + id, new(Strings(component, "capabilities"), Strings(component, "buttonIds"), desks,
                true, component.GetProperty("role").GetString() == "dock"));
        }
        return new(buttons, consumers);
    }
}

internal sealed record RoomActionContext(VerifiedRoomInstallation Installation, RoomSessionSnapshot Snapshot, RoomClientRole Role);
