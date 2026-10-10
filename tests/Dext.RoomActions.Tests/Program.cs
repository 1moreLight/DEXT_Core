using Dext.Core.Rooms;
using System.Diagnostics;
using System.Text.Json;

if (args.Length==1 && args[0]=="--desktop-sync") { DesktopSyncChecks.Run(); return; }
if (args.Length==1 && args[0]=="--foreground-return") { ForegroundReturnChecks.Run(); return; }
if (args.Length==1 && args[0]=="--native-data-sources") { await NativeDataLiveProbe.Run(); return; }
if (args.Length!=0 && !(args.Length==1 && args[0] is "--read-grants" or "--personal-editor" or "--visible-data" or "--sharing-copy")) throw new ArgumentException("Unknown action probe mode");

var failures = 0;
var total = 0;
const string Room = "d390f9c9-8136-4c56-a00b-afabbac4db2c";
const string Copy = "7265c092-080f-49cb-a001-56495511e9cc";
const string Target = "ee0760c2-a1e3-4094-b002-81b6ab22a7d5";

void Check(string name, Action body)
{
    total++;
    try { body(); Console.WriteLine($"PASS {name}"); }
    catch (Exception error) { failures++; Console.Error.WriteLine($"FAIL {name}: {error}"); }
}
static void True(bool value, string detail) { if (!value) throw new Exception(detail); }
static void Equal<T>(T expected, T actual, string detail)
{ if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"{detail}: expected {expected}, got {actual}"); }
static void Refuses(Action body)
{
    try { body(); }
    catch (Exception e) when (e is IOException or InvalidDataException or JsonException or UnauthorizedAccessException) { return; }
    throw new Exception("Operation should reject");
}
static void Seed(RoomPersonalStore store)
{
    store.Update(s =>
    {
        s.Targets[Target] = new PersonalTarget("Notes", "application", @"C:\Windows\System32\notepad.exe", "/a", @"C:\Windows");
        s.Rooms[Room] = new RoomPersonalData();
        s.Rooms[Room].Buttons["open"] = new PersonalButtonOverride("binding.launch", null, Target, "glass");
        s.Rooms[Room].Grants["scene"] = new RoomCapabilityGrant("verified-stamp", new[] { "binding.launch" });
    });
}

if(args.Length==1 && args[0]=="--sharing-copy"){
 SharingCopyChecks.Run(Check);
 Console.WriteLine($"{total-failures}/{total} sharing copy checks passed");
 Environment.ExitCode=failures==0?0:1;return;
}
if(args.Length==1 && args[0]=="--personal-editor"){
 RoomActionChecks.PersonalEditorChecks(Check);
 Console.WriteLine($"{total-failures}/{total} personal editor checks passed");
 Environment.ExitCode=failures==0?0:1;return;
}

if(args.Length==1 && args[0]=="--visible-data"){
 RoomActionChecks.VisibleDataChecks(Check);
 Console.WriteLine($"{total-failures}/{total} visible-data checks passed");
 Environment.ExitCode=failures==0?0:1;return;
}

if(args.Length==1 && args[0]=="--read-grants"){
 RoomActionChecks.ReadGrantChecks(Check);
 Console.WriteLine($"{total-failures}/{total} read grant checks passed");
 Environment.ExitCode=failures==0?0:1;return;
}

Check("reopening private data preserves target, binding and skin", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store);
    var saved = new RoomPersonalStore(f.Path).Read();
    Equal(@"C:\Windows\System32\notepad.exe", saved.Targets[Target].Target, "private target");
    Equal(Target, saved.Rooms[Room].Buttons["open"].TargetId, "binding");
    Equal("glass", saved.Rooms[Room].Buttons["open"].Skin, "skin");
    Equal(1L, saved.Revision, "committed revision");
});
Check("personal layout survives reopening without exposing other Room data", () =>
{
    using var f=new Fixture();var store=new RoomPersonalStore(f.Path);Seed(store);
    var path=Path.Combine(f.Path,"personal.json");
    var json=System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(path))!;
    json["rooms"]![Room]!["layout"]=System.Text.Json.Nodes.JsonNode.Parse("""
        {"revision":4,"icons":{"home":{"icon-1":{"x":240,"y":360}}},"components":{"widget":{"x":500,"y":200,"width":300,"height":180}}}
        """);
    File.WriteAllText(path,json.ToJsonString());
    var saved=new RoomPersonalStore(f.Path).Read();
    using var projection=JsonDocument.Parse(JsonSerializer.Serialize(saved.Rooms[Room],new JsonSerializerOptions{PropertyNamingPolicy=JsonNamingPolicy.CamelCase}));
    var layout=projection.RootElement.GetProperty("layout");
    Equal(4L,layout.GetProperty("revision").GetInt64(),"independent layout revision");
    Equal(240d,layout.GetProperty("icons").GetProperty("home").GetProperty("icon-1").GetProperty("x").GetDouble(),"saved icon position");
    Equal(1L,saved.Revision,"layout read does not increment personal revision");
});
Check("detached reads cannot accidentally persist edits", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store);
    store.Read().Targets.Clear();
    True(store.Read().Targets.ContainsKey(Target), "read mutation must be detached");
});
Check("copy isolates personal bindings and skins without inheriting grants", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store); store.CopyRoom(Room, Copy);
    var copy = store.Read().Rooms[Copy]; Equal(Target, copy.Buttons["open"].TargetId, "copied target identity");
    Equal("glass", copy.Buttons["open"].Skin, "copied skin"); Equal(0, copy.Grants.Count, "fresh consent");
    store.Update(s => s.Rooms[Copy].Buttons["open"] = new PersonalButtonOverride("desk.next"));
    Equal("binding.launch", store.Read().Rooms[Room].Buttons["open"].Action, "old room isolated");
    Refuses(() => store.CopyRoom(Room, Copy));
});
Check("deleting a Room removes its data but preserves global targets", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store); store.DeleteRoom(Room);
    var state = store.Read(); Equal(0, state.Rooms.Count, "room removed");
    True(state.Targets.ContainsKey(Target), "global target retained");
});
Check("blocked publication leaves old readable private bytes unchanged", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store);
    var path = System.IO.Path.Combine(f.Path, "personal.json"); var previous = File.ReadAllBytes(path);
    using (var held = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
        Refuses(() => store.Update(s => s.Targets.Clear()));
    True(previous.SequenceEqual(File.ReadAllBytes(path)), "old bytes survive write failure");
    True(store.Read().Targets.ContainsKey(Target), "prior snapshot readable");
});
Check("failed edit does not persist a partial state", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store);
    try { store.Update(s => { s.Targets.Clear(); throw new ArithmeticException("edit failed"); }); }
    catch (ArithmeticException) { }
    True(store.Read().Targets.ContainsKey(Target), "edit failure did not erase targets");
    Equal(1L, store.Read().Revision, "failed revision not committed");
});
Check("malformed duplicate unknown and oversized stores refuse without resetting", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path);
    var path = System.IO.Path.Combine(f.Path, "personal.json");
    foreach (var bytes in new[] { "{", "{\"formatVersion\":1,\"formatVersion\":1}",
        "{\"formatVersion\":1,\"unknown\":true}", new string(' ', 1048577) + "{}" })
    {
        File.WriteAllText(path, bytes); Refuses(() => store.Read()); Refuses(() => store.Update(s => s.Targets.Clear()));
        Equal(bytes, File.ReadAllText(path), "corrupt bytes preserved for diagnosis");
    }
});
Check("invalid targets cannot replace a valid personal snapshot", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path); Seed(store);
    foreach (var target in new[] { new PersonalTarget("Bad", "url", "javascript:alert(1)"),
        new PersonalTarget("Bad", "application", "relative.exe"), new PersonalTarget("Bad", "file", "C:\\document.txt", "--run") })
        Refuses(() => store.Update(s => s.Targets[Target] = target));
    Equal("Notes", store.Read().Targets[Target].Name, "valid target remains");
});
Check("private store refuses a reparse root without touching outside data", () =>
{
    using var f = new Fixture(); var outside = System.IO.Path.Combine(f.Path, "outside"); Directory.CreateDirectory(outside);
    var link = System.IO.Path.Combine(f.Path, "linked");
    using var process = Process.Start(new ProcessStartInfo("cmd.exe", $"/c mklink /J \"{link}\" \"{outside}\"")
        { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true })!;
    process.WaitForExit(); Equal(0, process.ExitCode, "fixture junction");
    try
    {
        Refuses(() => new RoomPersonalStore(link).Update(s => s.Rooms[Room] = new RoomPersonalData()));
        Equal(0, Directory.GetFileSystemEntries(outside).Length, "outside unchanged");
    }
    finally { Directory.Delete(link); }
});

Check("maximum native consumer IDs and counts fit private grants", () =>
{
    using var f = new Fixture(); var store = new RoomPersonalStore(f.Path);
    store.Update(s => {
        var room = new RoomPersonalData(); s.Rooms[Room] = room;
        room.Grants["official"] = new("stamp", Array.Empty<string>());
        room.Grants["scene"] = new("stamp", Array.Empty<string>());
        room.Grants["slot.start"] = new("stamp", Array.Empty<string>());
        room.Grants["slot.idle"] = new("stamp", Array.Empty<string>());
        for (var i = 0; i < 64; i++) room.Grants["slot.background." + new string('b', 77) + i.ToString("D3")] = new("stamp", Array.Empty<string>());
        for (var i = 0; i < 128; i++) room.Grants["component." + new string('a', 77) + i.ToString("D3")] = new("stamp", Array.Empty<string>());
    });
    Equal(196, store.Read().Rooms[Room].Grants.Count, "all consumers preserved");
    Refuses(() => store.Update(state => state.Rooms[Room].Grants["extra"] = new("stamp", Array.Empty<string>())));
    Equal(196, store.Read().Rooms[Room].Grants.Count, "overflow preserves current grants");
    Refuses(() => store.Update(state => {
        state.Rooms[Room].Grants.Clear();
        state.Rooms[Room].Grants["slot.background." + new string('c', 81)] = new("stamp", Array.Empty<string>());
    }));
    Equal(196, store.Read().Rooms[Room].Grants.Count, "overlong suffix preserves current grants");
});

RoomActionChecks.Run(Check);
RoomActionChecks.ReadGrantChecks(Check);
RoomActionChecks.PersonalEditorChecks(Check);
NativeEventSampleChecks.Run(Check);
RoomNativeDataSourceChecks.Run(Check);
Console.WriteLine($"{total - failures}/{total} Room action checks passed");
Environment.ExitCode = failures == 0 ? 0 : 1;

sealed class Fixture : IDisposable
{
    public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "dext-action-test-" + Guid.NewGuid().ToString("N"));
    public Fixture() { Directory.CreateDirectory(Path); }
    public void Dispose() { Directory.Delete(Path, true); }
}
