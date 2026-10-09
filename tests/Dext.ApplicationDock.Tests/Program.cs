using Lively.Services.ApplicationDock;
if (args.Contains("--fixture")) { NativeProbe.RunFixture(args.Contains("--interactive") ? 300000 : 30000); return; }
if (args.Contains("--native")) NativeProbe.Run();
if (args.Contains("--observe")) { Console.WriteLine("foreground=" + DockWindows.Foreground + " fullscreen=" + DockWindows.IsFullscreen()); return; }
if (args.Length == 2 && args[0] == "--inspect") { NativeProbe.Inspect(int.Parse(args[1])); return; }
var pin = new DockPin("Editor", @"C:\Apps\Editor.exe", "", @"C:\Apps");
var windows = new[] {
 new DockTask(11, 101, "Document A", @"c:\apps\editor.exe"),
 new DockTask(12, 101, "Document B", @"C:\Apps\Editor.exe"),
 new DockTask(20, 200, "Browser", @"C:\Apps\Browser.exe")
};
void Check(bool condition, string description) {
 if (!condition) throw new Exception(description);
 Console.WriteLine("PASS " + description);
}
var grouped = DockModel.Group(new[] { pin }, windows);
Check(grouped.Count == 2 && grouped[0].Windows.Count == 2, "case-insensitive identity groups multiple windows under pinned app");
Check(grouped[0].Pin == pin, "pinned order takes precedence");
Check(DockModel.Group(new[] {pin}, Array.Empty<DockTask>())[0].Windows.Count == 0, "closed pinned app remains launchable");
Check(DockModel.Group(Array.Empty<DockPin>(), windows).Count == 2, "unpin preserves running app");
Check(DockModel.Action(grouped[0], 11) == DockAction.Choose, "multiple windows offer selection");
var single = DockModel.Group(new[] {pin}, windows.Take(1).ToArray())[0];
Check(DockModel.Action(single, 11) == DockAction.Minimize, "foreground single window minimizes");
Check(DockModel.Action(single, 20) == DockAction.Activate, "background single window activates");
Check(DockModel.Action(DockModel.Group(new[] {pin}, Array.Empty<DockTask>())[0], 0) == DockAction.Launch, "idle pinned app launches");
var directory = Path.Combine(Path.GetTempPath(), "dext-dock-" + Guid.NewGuid().ToString("N"));
try {
 var path = Path.Combine(directory, "preferences.json");
 var prefs = new DockPreferences(true, new[] {pin, new DockPin("Browser", @"C:\Apps\Browser.exe", "--profile=test", "")});
 DockPreferenceFile.Save(path, prefs);
 var restored = DockPreferenceFile.Load(path);
 Check(restored.Enabled && restored.Pins.SequenceEqual(prefs.Pins), "enabled flag, pin order and launch arguments survive restart");
 File.WriteAllText(path, "{broken");
 var rejected = false;
 try { DockPreferenceFile.Load(path); } catch (System.Text.Json.JsonException) { rejected = true; }
 Check(rejected && File.ReadAllText(path) == "{broken", "invalid preferences are preserved and reported");
} finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
