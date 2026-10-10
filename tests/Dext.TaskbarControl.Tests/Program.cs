using Dext.Core.Rooms;
var dir=Path.Combine(Path.GetTempPath(),"dext-taskbar-"+Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(dir);
var path=Path.Combine(dir,"mode.json");
var events=new List<string>();
var leases=new List<FakeLease>();
Task<ITaskbarLease> Create(int pid) {events.Add("start:"+pid); var lease=new FakeLease(pid,events); leases.Add(lease); return Task.FromResult<ITaskbarLease>(lease);}
void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
try {
 using var controller=new TaskbarController(path,100,Create,()=>true);
 Check(!controller.DockActionsReady(200),"automatic task actions wait for taskbar handoff");
 controller.RequestAutomatic(200,true);
 await controller.TickAsync();
 Check(leases.Count==1 && leases[0].Pid==200 && leases[0].Wanted,"automatic mode follows ready Dock");
 Check(controller.DockActionsReady(200)&&!controller.DockActionsReady(201),"automatic actions require the actual Dock owner");
 await controller.SetModeAsync("visible");
 controller.RequestAutomatic(200,true);
 await controller.TickAsync();
 Check(leases.Count==1 && leases[0].Stopped,"manual restore releases lease and overrides automatic request");
 Check(controller.DockActionsReady(200),"restored taskbar permits Dock actions without hidden lease");
 await controller.SetModeAsync("hidden");
 Check(leases.Count==2 && leases[1].Pid==100 && leases[1].Wanted,"manual hide uses Core lifetime without requiring Room Dock");
 Check(controller.DockActionsReady(200),"manual Core hiding permits theme Dock actions");
 await controller.SetModeAsync("auto");
 Check(events.IndexOf("stop:100")<events.LastIndexOf("start:200"),"old owner releases before next owner starts");
 controller.RequestAutomatic(999,false);
 await controller.TickAsync();
 Check(!leases[^1].Stopped,"old Dock release cannot clear current Dock request");
 await controller.SetModeAsync("visible");
 using var restored=new TaskbarController(path,100,Create,()=>true);
 restored.RequestAutomatic(200,true); await restored.TickAsync();
 Check(restored.Mode=="visible" && !restored.Hidden,"restore mode persists across restart");
 var rejected=false;try{await restored.SetModeAsync("wrong");}catch(ArgumentException){rejected=true;}
 Check(rejected && restored.Mode=="visible","invalid mode cannot overwrite confirmed preference");
 using var failing = new TaskbarController(Path.Combine(dir,"failure.json"),100,
     _ => Task.FromException<ITaskbarLease>(new IOException("watchdog missing")),()=>true);
 await failing.SetModeAsync("hidden");
 Check(failing.Error != null,"acquisition failure is reported");
 await failing.TickAsync();
 Check(failing.Error != null,"acquisition error remains visible during retry delay");
 var recoverAllowed=true;
 using var recovering = new TaskbarController(Path.Combine(dir,"recovery.json"),100,Create,()=>false,
     () => Task.FromResult(recoverAllowed));
 await recovering.SetModeAsync("hidden");
 recoverAllowed=false;
 await recovering.SetModeAsync("visible");
 await recovering.TickAsync();
 Check(recovering.Error != null && !recovering.Hidden,"pending recovery survives lease release and remains reported");
 Check(!recovering.DockActionsReady(200),"pending taskbar restoration does not prematurely enable actions");
 recoverAllowed=true;
 await recovering.TickAsync();
 Check(recovering.Error == null,"pending recovery retries until confirmed");
 var releaseAllowed=true;
 using var handoff=new TaskbarController(Path.Combine(dir,"handoff.json"),100,Create,()=>true,()=>Task.FromResult(releaseAllowed));
 handoff.RequestAutomatic(201,true);await handoff.TickAsync();releaseAllowed=false;
 Check(!await handoff.ReleaseAutomaticAsync(201),"handoff waits for taskbar restoration after lease is gone");
 releaseAllowed=true;
 Check(await handoff.ReleaseAutomaticAsync(201),"handoff completes when restoration is confirmed");
 await handoff.SetModeAsync("hidden");
 Check(await handoff.ReleaseAutomaticAsync(201) && handoff.Mode=="hidden" && handoff.ReadyFor(100),"handoff preserves a separate manual Core lease");
 Check(await handoff.ReleaseAutomaticAsync(100) && handoff.ReadyFor(100),"application owner can release automatic request while same Core manual lease remains");
 var recoveryCalls=0;
 using var asyncHandoff=new TaskbarController(Path.Combine(dir,"async-handoff.json"),100,Create,()=>true,
     async ()=>{if(++recoveryCalls>1)await Task.Delay(80);return true;});
 asyncHandoff.RequestAutomatic(203,true);await asyncHandoff.TickAsync();
 Check(await asyncHandoff.ReleaseAutomaticAsync(203),"handoff awaits in-flight successful recovery instead of reporting failure");
 var stopLease=new FailingStopLease();
 using var blockedHandoff=new TaskbarController(Path.Combine(dir,"blocked-handoff.json"),100,_=>Task.FromResult<ITaskbarLease>(stopLease),()=>true);
 blockedHandoff.RequestAutomatic(202,true);await blockedHandoff.TickAsync();
 Check(!await blockedHandoff.ReleaseAutomaticAsync(202),"handoff stays blocked when watchdog stop throws");
 stopLease.Fail=false;
 Check(await blockedHandoff.ReleaseAutomaticAsync(202),"handoff can retry watchdog release");
 var disposing=new TaskbarController(Path.Combine(dir,"dispose.json"),100,
     _=>Task.FromResult<ITaskbarLease>(new SlowLease()),()=>true);
 await disposing.SetModeAsync("hidden");
 var uiThread=new Thread(()=>{SynchronizationContext.SetSynchronizationContext(new BlockedUiContext());disposing.Dispose();}){IsBackground=true};
 uiThread.Start();
 Check(uiThread.Join(1500),"UI-thread disposal does not deadlock asynchronous lease recovery");
 File.WriteAllText(path,"broken");
 using var broken=new TaskbarController(path,100,Create,()=>true);
 broken.RequestAutomatic(200,true);await broken.TickAsync();
 Check(broken.Mode=="visible" && broken.Error!=null && File.ReadAllText(path)=="broken","invalid settings preserve file and leave taskbar unmanaged");
} finally {Directory.Delete(dir,true);}
sealed class FakeLease(int pid,List<string> events):ITaskbarLease {
 public int Pid=>pid; public bool Wanted;public bool Stopped;
 public bool IsAlive=>!Stopped;public bool Ready=>Wanted&&!Stopped;public string? Error=>null;
 public void SetWanted(bool value){Wanted=value;}
 public Task StopAsync(){Stopped=true;Wanted=false;events.Add("stop:"+pid);return Task.CompletedTask;}
}

sealed class SlowLease:ITaskbarLease {
 public bool IsAlive=>true;public bool Ready=>true;public string? Error=>null;
 public void SetWanted(bool value){}
 public async Task StopAsync(){await Task.Yield();}
}
sealed class BlockedUiContext:SynchronizationContext {
 public override void Post(SendOrPostCallback action,object? state){}
}sealed class FailingStopLease:ITaskbarLease {
 public bool Fail=true;
 public bool IsAlive=>true;public bool Ready=>false;public string? Error=>null;
 public void SetWanted(bool value){}
 public Task StopAsync()=>Fail?Task.FromException(new IOException("stop unavailable")):Task.CompletedTask;
}
