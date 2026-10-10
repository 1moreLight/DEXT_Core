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
 controller.RequestAutomatic(200,true);
 await controller.TickAsync();
 Check(leases.Count==1 && leases[0].Pid==200 && leases[0].Wanted,"automatic mode follows ready Dock");
 await controller.SetModeAsync("visible");
 controller.RequestAutomatic(200,true);
 await controller.TickAsync();
 Check(leases.Count==1 && leases[0].Stopped,"manual restore releases lease and overrides automatic request");
 await controller.SetModeAsync("hidden");
 Check(leases.Count==2 && leases[1].Pid==100 && leases[1].Wanted,"manual hide uses Core lifetime without requiring Room Dock");
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
 recoverAllowed=true;
 await recovering.TickAsync();
 Check(recovering.Error == null,"pending recovery retries until confirmed");
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
}