using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Dext.Core.Rooms;

// Private ordering slots, independent of viewport size. File paths stay in the
// Core scanner cache; no source file is copied into the Room or this document.
internal sealed class RoomDesktopSync
{
    public bool Enabled { get; set; }
    public string DeskId { get; set; } = "";
    public Dictionary<string, int> Slots { get; set; } = new(StringComparer.Ordinal);
    internal static RoomDesktopSync Reconcile(RoomDesktopSync? previous, string deskId, bool enabled,
        IReadOnlyCollection<string>? currentIds, bool complete, IReadOnlyDictionary<string, string>? renames = null)
    {
        RoomPersonalStore.Id(deskId);
        Validate(previous);
        var next = new RoomDesktopSync { DeskId = deskId, Enabled = enabled,
            Slots = previous is null ? new(StringComparer.Ordinal) : new(previous.Slots, StringComparer.Ordinal) };
        if (currentIds is not null)
        {
            var ids = currentIds.Distinct(StringComparer.Ordinal).ToArray();
            if (ids.Length > 4096) throw new InvalidDataException("Desktop sync item limit exceeded.");
            foreach (var id in ids) ValidateItemId(id);
            if (renames is { Count: > 0 })
            {
                if (renames.Count > 4096) throw new InvalidDataException("Desktop rename limit exceeded.");
                foreach (var pair in renames) { ValidateItemId(pair.Key); ValidateItemId(pair.Value); }
                var present = ids.ToHashSet(StringComparer.Ordinal);
                var transfers = new List<(string Old, string New, int Slot)>();
                foreach (var old in next.Slots)
                {
                    if (present.Contains(old.Key)) continue;
                    var destination = old.Key;
                    var visited = new HashSet<string>(StringComparer.Ordinal) { destination };
                    var ambiguous = false;
                    while (renames.TryGetValue(destination, out var renamed))
                    {
                        if (!visited.Add(renamed)) { ambiguous = true; break; }
                        destination = renamed;
                        // An intermediate name still exists: events cannot establish
                        // which surviving file owns the old position.
                        if (present.Contains(destination) && renames.ContainsKey(destination)) { ambiguous = true; break; }
                    }
                    if (!ambiguous && present.Contains(destination) && !next.Slots.ContainsKey(destination))
                        transfers.Add((old.Key, destination, old.Value));
                }
                foreach (var group in transfers.GroupBy(item => item.New, StringComparer.Ordinal))
                {
                    if (group.Count() != 1) continue;
                    var move = group.Single();
                    next.Slots.Remove(move.Old);
                    next.Slots.Add(move.New, move.Slot);
                }
            }
            if (complete)
            {
                var retained = ids.ToHashSet(StringComparer.Ordinal);
                foreach (var id in next.Slots.Keys.Where(id => !retained.Contains(id)).ToArray()) next.Slots.Remove(id);
            }
            var used = next.Slots.Values.ToHashSet();
            var slot = 0;
            foreach (var id in ids)
            {
                if (next.Slots.ContainsKey(id)) continue;
                while (used.Contains(slot)) slot++;
                if (slot >= 4096) throw new InvalidDataException("Desktop sync layout is full.");
                next.Slots.Add(id, slot); used.Add(slot);
            }
        }
        Validate(next);
        return next;
    }
    internal static RoomDesktopSync PlaceDropped(RoomDesktopSync previous, IReadOnlyCollection<string> ids,
        int targetSlot, int columns, int capacity)
    {
        Validate(previous);
        if (targetSlot < 0 || targetSlot >= 4096 || columns < 1 || columns > 4096 || capacity < 1 || capacity > 4096)
            throw new InvalidDataException("Invalid desktop drop grid.");
        var requested = ids.Distinct(StringComparer.Ordinal).ToArray();
        if (requested.Length > 256) throw new InvalidDataException("Too many dropped items.");
        foreach (var id in requested) ValidateItemId(id);
        var next = new RoomDesktopSync { Enabled = previous.Enabled, DeskId = previous.DeskId,
            Slots = new(previous.Slots, StringComparer.Ordinal) };
        // The watcher may already have allocated these new files at the first
        // free cells. Only the caller's confirmed new drop IDs are repositioned.
        foreach (var id in requested) next.Slots.Remove(id);
        if (next.Slots.Count + requested.Length > 4096) throw new InvalidDataException("Desktop sync layout is full.");
        var used = next.Slots.Values.ToHashSet();
        var page = targetSlot / capacity;
        var cell = targetSlot % capacity;
        var x = cell % columns; var y = cell / columns;
        var free = Enumerable.Range(0, 4096).Where(slot => !used.Contains(slot))
            .OrderBy(slot => Math.Abs(slot / capacity - page))
            .ThenBy(slot => Math.Pow(slot % capacity % columns - x, 2) + Math.Pow(slot % capacity / columns - y, 2))
            .ThenBy(slot => slot).Take(requested.Length).ToArray();
        for (var index = 0; index < requested.Length; index++) next.Slots.Add(requested[index], free[index]);
        Validate(next);
        return next;
    }
    internal static void Validate(RoomDesktopSync? value)
    {
        if (value is null) return;
        RoomPersonalStore.Id(value.DeskId);
        if (value.Slots is null || value.Slots.Count > 4096 ||
            value.Slots.Values.Any(slot => slot < 0 || slot >= 4096) ||
            value.Slots.Values.Distinct().Count() != value.Slots.Count)
            throw new InvalidDataException("Invalid desktop sync slots.");
        foreach (var id in value.Slots.Keys) ValidateItemId(id);
    }
    private static void ValidateItemId(string id)
    {
        if (id is null || id.Length != 72 || !id.StartsWith("desktop-", StringComparison.Ordinal) ||
            !id.Skip(8).All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f'))
            throw new InvalidDataException("Invalid desktop item identity.");
    }
}

internal sealed record RoomDesktopViewItem(string Id, string Name, string Kind, int Slot, string? IconPng);
internal sealed record RoomDesktopView(string ContextId, string DeskId, IReadOnlyList<RoomDesktopViewItem>? Items, int IssueCount, bool Truncated);
