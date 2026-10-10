using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Diagnostics;
using System.Text.Json;

// Only launches this probe executable, with a bounded, owned window mode.
internal sealed class FusionLaunchProbe : IDisposable
{
    private readonly DesktopService.DesktopServiceClient client;
    private readonly string target=Environment.ProcessPath!;
    private readonly HashSet<int> baseline;
    private bool pinAttempted;
    private bool disposed;
    internal FusionLaunchProbe(DesktopService.DesktopServiceClient client)
    {
        this.client=client;
        if(Path.GetFileName(target)!="Dext.ApplicationDock.RuntimeProbe.exe")
            throw new Exception("Launch test requires its own apphost executable");
        if(Read().GetProperty("pins").EnumerateArray().Any(p=>string.Equals(p.GetProperty("target").GetString(),target,StringComparison.OrdinalIgnoreCase)))
            throw new Exception("Probe is already pinned; preserving existing binding");
        baseline=OwnedProcesses().Select(p=>{using(p)return p.Id;}).ToHashSet();
    }
    private JsonElement Read()=>JsonDocument.Parse(client.GetApplicationDockStatus(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5)).ReplyJson).RootElement.Clone();
    private void Edit(object patch) {
        Console.WriteLine("Launch fixture edit: "+JsonSerializer.Serialize(patch));
        client.EditApplicationDock(new(){PatchJson=JsonSerializer.Serialize(patch)},deadline:DateTime.UtcNow.AddSeconds(15));
        Console.WriteLine("Launch fixture edit acknowledged");
    }
    private IEnumerable<Process> OwnedProcesses()
    {
        foreach(var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(target))) {
            bool match=false;
            try{match=string.Equals(p.MainModule?.FileName,target,StringComparison.OrdinalIgnoreCase);}catch(System.ComponentModel.Win32Exception){}catch(InvalidOperationException){}
            if(match)yield return p;else p.Dispose();
        }
    }
    public async Task Verify(IntPtr dock,Func<JsonElement?> observe)
    {
        pinAttempted=true;
        Edit(new{operation="pin",app=new{name="Dext Fusion Launch Probe",target,arguments="--owned-launch-window",workingDirectory=Path.GetDirectoryName(target)}});
        if(!Read().GetProperty("pins").EnumerateArray().Any(p=>p.GetProperty("target").GetString()==target))throw new Exception("Temporary launch pin not acknowledged");
        await FusionActionWindow.Wait(()=>{
            var d=observe();return d is not null&&d.Value.TryGetProperty("launchStopped",out var stopped)&&stopped.GetBoolean();
        },"Pinned task must have zero running windows before launch");
        var elapsed=Stopwatch.StartNew();
        long upMs=0;
        var origin=DateTime.UtcNow;
        await FusionActionWindow.Click(dock,observe,phase=>{
            if(phase=="afterUp")upMs=elapsed.ElapsedMilliseconds;
            Console.WriteLine($"TIMING {phase} elapsedMs={elapsed.ElapsedMilliseconds} utc={DateTime.UtcNow:O}");
        });
        int started=0;
        var seen=new HashSet<int>();
        await FusionActionWindow.Wait(()=>{
            foreach(var p in OwnedProcesses())using(p) {
                if(!baseline.Contains(p.Id)&&seen.Add(p.Id))Console.WriteLine($"TIMING process PID={p.Id} createdAfterOriginMs={(p.StartTime.ToUniversalTime()-origin).TotalMilliseconds:F0} observedMs={elapsed.ElapsedMilliseconds}");
                if(!baseline.Contains(p.Id)&&p.MainWindowHandle!=IntPtr.Zero&&p.MainWindowTitle==FusionActionWindow.Title){started=p.Id;return true;}
            }
            return false;
        },"Actual task click did not launch owned apphost window",30);
        Console.WriteLine("PASS actual OS Dock click launches previously stopped pinned application; new PID="+started+", preparation-and-start ms="+elapsed.ElapsedMilliseconds+", after-UP-to-window ms="+(elapsed.ElapsedMilliseconds-upMs));
    }
    public void Dispose()
    {
        if(disposed)return;disposed=true;
        try {
            foreach(var p in OwnedProcesses())using(p) {
                if(baseline.Contains(p.Id))continue;
                p.CloseMainWindow();
                if(!p.WaitForExit(1500)) {p.Kill();p.WaitForExit(5000);}
            }
        } finally {
            if(pinAttempted) {
                Edit(new{operation="unpin",target});
                if(Read().GetProperty("pins").EnumerateArray().Any(p=>p.GetProperty("target").GetString()==target))throw new Exception("Temporary launch pin cleanup failed");
                pinAttempted=false;
                Console.WriteLine("RESTORED temporary launch pin and owned child process");
            }
        }
    }
}
