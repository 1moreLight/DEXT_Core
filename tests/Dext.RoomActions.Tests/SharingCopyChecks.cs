using Dext.Core.Rooms;
using System.Text.Json;

internal static class SharingCopyChecks
{
    internal static void Run(Action<string, Action> check)
    {
        const string room = "d390f9c9-8136-4c56-a00b-afabbac4db2c";
        const string copy = "7265c092-080f-49cb-a001-56495511e9cc";
        const string target = "ee0760c2-a1e3-4094-b002-81b6ab22a7d5";
        static void Require(bool ok, string message) { if (!ok) throw new Exception(message); }
        check("copy preserves buttons but resets consent, stored values and personal placement", () =>
        {
            using var fixture = new Fixture();
            var store = new RoomPersonalStore(fixture.Path);
            store.Update(s =>
            {
                s.Targets[target] = new PersonalTarget("Notes", "application", @"C:\Windows\System32\notepad.exe");
                var original = s.Rooms[room] = new RoomPersonalData();
                original.Buttons["open"] = new PersonalButtonOverride("binding.launch", null, target, "glass");
                original.Grants["component.clock"] = new("old-installation", new[] { "storage.read", "storage.write" });
                original.ReadGrants["component.clock"] = new("old-installation", new[] { "time.read" });
                original.Storage["component.clock"] = new() { ["count"] = JsonSerializer.SerializeToElement(7) };
                original.Layout.Revision = 3;
                original.Layout.Icons["home"] = new() { ["open"] = new(100, 200) };
                original.Layout.Components["clock"] = new(400, 200, 300, 180);
            });
            var before = JsonSerializer.Serialize(store.Read().Rooms[room]);
            store.CopyRoom(room, copy);
            var reopened = new RoomPersonalStore(fixture.Path).Read();
            var cloned = reopened.Rooms[copy];
            Require(cloned.Buttons["open"] == reopened.Rooms[room].Buttons["open"], "binding and skin are copied");
            Require(cloned.Grants.Count == 0 && cloned.ReadGrants.Count == 0, "fresh consent");
            Require(cloned.Storage.Count == 0 && cloned.Layout.Revision == 0 &&
                cloned.Layout.Icons.Count == 0 && cloned.Layout.Components.Count == 0, "fresh values and layout");
            store.Update(s => s.Rooms[copy].Buttons["open"] = new("desk.next"));
            Require(JsonSerializer.Serialize(store.Read().Rooms[room]) == before, "source stays independent");
            store.DeleteRoom(copy);
            var remaining = new RoomPersonalStore(fixture.Path).Read();
            Require(!remaining.Rooms.ContainsKey(copy) && remaining.Targets.ContainsKey(target), "delete keeps global target");
            Require(JsonSerializer.Serialize(remaining.Rooms[room]) == before, "delete keeps source values and consent");
        });
        check("copy of Room without personal overrides creates an independent empty record", () =>
        {
            using var fixture = new Fixture();
            var store = new RoomPersonalStore(fixture.Path);
            store.CopyRoom(room, copy);
            Require(store.Read().Rooms[copy].Buttons.Count == 0, "empty overrides");
            var path = Path.Combine(fixture.Path, "personal.json");
            var bytes = File.ReadAllBytes(path);
            try { store.CopyRoom(room, copy); throw new Exception("duplicate should fail"); }
            catch (InvalidDataException) { }
            Require(File.ReadAllBytes(path).SequenceEqual(bytes), "duplicate leaves previous snapshot");
        });
    }
}
