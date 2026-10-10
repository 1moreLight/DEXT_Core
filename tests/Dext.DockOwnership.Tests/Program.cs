using Dext.Core.Rooms;
var checks=0;
void Check(string name,Action test){test();checks++;Console.WriteLine("PASS "+name);}
void Yes(bool value){if(!value)throw new Exception("Expected true");}
void No(bool value)=>Yes(!value);
Check("application waits for actual theme release",()=>{var o=new DockHostOwnership();Yes(o.TryAcquire(DockHost.Theme));o.SetApplicationRequested(true);No(o.TryAcquire(DockHost.Application));Yes(o.Owner==DockHost.Theme);o.Release(DockHost.Theme);Yes(o.TryAcquire(DockHost.Application));No(o.TryAcquire(DockHost.Theme));});
Check("theme waits until application has hidden",()=>{var o=new DockHostOwnership();o.SetApplicationRequested(true);Yes(o.TryAcquire(DockHost.Application));o.SetApplicationRequested(false);No(o.TryAcquire(DockHost.Theme));o.Release(DockHost.Application);Yes(o.TryAcquire(DockHost.Theme));});
Check("rapid toggle does not transfer ownership prematurely",()=>{var o=new DockHostOwnership();Yes(o.TryAcquire(DockHost.Theme));o.SetApplicationRequested(true);o.SetApplicationRequested(false);Yes(o.TryAcquire(DockHost.Theme));No(o.TryAcquire(DockHost.Application));});
Check("foreign release cannot unlock a live host",()=>{var o=new DockHostOwnership();Yes(o.TryAcquire(DockHost.Theme));o.Release(DockHost.Application);Yes(o.Owner==DockHost.Theme);});
Check("shutdown wakes owner but forbids any new claim",()=>{var o=new DockHostOwnership();Yes(o.TryAcquire(DockHost.Theme));var notifications=0;o.Changed+=()=>notifications++;o.Shutdown();Yes(notifications==1);No(o.TryAcquire(DockHost.Theme));o.Release(DockHost.Theme);o.SetApplicationRequested(true);No(o.TryAcquire(DockHost.Application));});
Check("notification runs outside owner lock and no-op requests do not wake",()=>{var o=new DockHostOwnership();var notifications=0;o.Changed+=()=>{Yes(Task.Run(()=>o.Owner).Wait(1000));notifications++;};o.SetApplicationRequested(true);o.SetApplicationRequested(true);Yes(notifications==1);});
Console.WriteLine($"{checks}/{checks} ownership checks passed");
