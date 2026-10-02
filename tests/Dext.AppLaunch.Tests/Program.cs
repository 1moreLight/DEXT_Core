using System;
using System.IO;
using System.Threading;
using System.Text.Json;
using Lively.Services;

var fixture = Path.Combine(Path.GetTempPath(), "dext-launch-test-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(fixture);
try
{
    var target = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../Dext.AppLaunch.Target/bin/Release/net9.0/Dext.AppLaunch.Target.exe"));
    if (!File.Exists(target)) throw new Exception("Missing controlled target: " + target);
    var capture = Path.Combine(fixture, "captured.json");
    using var process = new AppCatalogService().Launch(target, "--capture \"" + capture + "\" \"hello space\"", fixture);
    var deadline = DateTime.UtcNow.AddSeconds(5);
    while (!File.Exists(capture) && DateTime.UtcNow < deadline) Thread.Sleep(50);
    if (!File.Exists(capture)) throw new Exception("Launch lost capture arguments; Explorer path=" + (process is null));
    using var document = JsonDocument.Parse(File.ReadAllBytes(capture));
    var argsCaptured = document.RootElement.GetProperty("arguments");
    if (argsCaptured.GetArrayLength() != 3 || argsCaptured[0].GetString() != "--capture" || argsCaptured[1].GetString() != capture || argsCaptured[2].GetString() != "hello space")
        throw new Exception("Native target received wrong arguments");
    if (!string.Equals(fixture, document.RootElement.GetProperty("workingDirectory").GetString(), StringComparison.OrdinalIgnoreCase))
        throw new Exception("Native target received wrong working directory");
    Console.WriteLine("PASS native application launch preserves arguments and working directory; Explorer path=" + (process is null));
}
catch (Exception failure) { Console.Error.WriteLine("FAIL " + failure.Message); Environment.ExitCode = 1; }
finally { Directory.Delete(fixture, true); }
