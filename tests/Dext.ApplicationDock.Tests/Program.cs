using Lively.Services.ApplicationDock;
if (args.Contains("--fixture")) { NativeProbe.RunFixture(args.Contains("--interactive") ? 300000 : 30000); return; }
if (args.Contains("--native")) NativeProbe.Run();
if (args.Contains("--observe")) { Console.WriteLine("foreground=" + DockWindows.Foreground + " fullscreen=" + DockWindows.IsFullscreen()); return; }
if (args.Length == 2 && args[0] == "--inspect") { NativeProbe.Inspect(int.Parse(args[1])); return; }
RoomDockModeChecks.Run();
PresentationChecks.Run();
ThemeEligibilityChecks.Run();
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
var visibility=new DockVisibilityPolicy();
Check(visibility.Update(false,false,false,false,0),"default always visible");
Check(visibility.Update(true,false,false,false,0),"auto-hide starts with readable grace period");
Check(visibility.Update(true,false,false,false,699),"hide delay protects pointer crossing");
Check(!visibility.Update(true,false,false,false,700),"idle auto-hide collapses after delay");
Check(visibility.Update(true,false,true,false,701),"bottom edge reveals without extra dwell");
Check(visibility.Update(true,false,false,true,2000),"press menu and preview interaction keeps Dock visible");
Check(visibility.Update(true,false,false,false,2001),"leaving interaction starts new delay");
Check(!visibility.Update(true,false,false,false,2701),"leaving interaction eventually hides");
Check(!visibility.Update(false,true,true,true,3000),"fullscreen and lock override hover and interaction");
Check(visibility.Update(false,false,false,false,3100),"disabling auto-hide restores immediately");
var prefPath=Path.Combine(Path.GetTempPath(),"dext-dock-visibility-"+Guid.NewGuid()+".json");
try {
 File.WriteAllText(prefPath,"""{"Enabled":true,"Pins":[]}""");
 Check(!DockPreferenceFile.Load(prefPath).AutoHide,"old preferences keep always-visible default");
 DockPreferenceFile.Save(prefPath,new DockPreferences(true,Array.Empty<DockPin>(),true));
 Check(DockPreferenceFile.Load(prefPath).AutoHide,"auto-hide survives preference reload");
} finally {File.Delete(prefPath);}
Check(DockVisibilityPolicy.AtRevealEdge(300,1079,200,400,1080),"physical bottom reveals even when taskbar reduces work area");
Check(!DockVisibilityPolicy.AtRevealEdge(300,1039,200,400,1080),"work-area edge is not substituted for monitor bottom");
Check(!DockVisibilityPolicy.IsFullscreen(true,true,true),"captioned maximized window is not fullscreen after taskbar hide");
Check(DockVisibilityPolicy.IsFullscreen(true,true,false),"undecorated maximized fullscreen still blocks Dock");
Check(DockVisibilityPolicy.IsFullscreen(true,false,false),"borderless fullscreen still blocks Dock");
Check(DockVisibilityPolicy.TaskbarReady(true,true,false),"active hidden Dock keeps automatic lease while fullscreen");
Check(!DockVisibilityPolicy.TaskbarReady(true,true,true),"locked session releases automatic lease");
var overlay=new DockPreferences(true,Array.Empty<DockPin>());
Check(!overlay.ReserveSpace,"old default does not reserve work area");
var reserved=overlay.WithReserveSpace(true);
Check(reserved.ReserveSpace && !reserved.AutoHide,"reserve disables auto-hide");
var hidden=reserved.WithAutoHide(true);
Check(hidden.AutoHide && !hidden.ReserveSpace,"auto-hide releases reserve preference");
Check(reserved.WithAutoHide(false).ReserveSpace,"disabling auto-hide preserves reserve choice");
TaskProjectionChecks.Run();
TaskDisplayChecks.Run();
