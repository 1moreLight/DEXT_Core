using Lively.Services.ApplicationDock;
void Check(bool pass,string label){if(!pass)throw new Exception(label);Console.WriteLine("PASS "+label);}
var os=new FakePlatform();
var dock=new DockReservation(os);
var screen=new DockBounds(0,0,1920,1080);
dock.Update(true,screen,600,80);
Check(dock.Registered && dock.Ready && dock.Bounds==new DockBounds(660,1000,1260,1080),"approved central strip reserves bottom work area");
var calls=os.Reserves;
dock.Update(true,screen,600,80);
Check(os.Reserves==calls,"stable ready area avoids redundant shell writes");
os.WorkArea=screen;
dock.Update(true,screen,600,80);
Check(os.Reserves==calls+1 && dock.Ready,"lost work area is re-negotiated");
dock.Update(false,screen,600,80);
Check(!dock.Registered && !dock.Ready && os.Removes==1,"disable unregisters before releasing ownership");
os.Accept=false;
dock.Update(true,screen,600,80);
Check(!dock.Registered && dock.Error!=null,"registration refusal is visible and never ready");
os.Accept=true;dock.Update(true,screen,600,80);
Check(dock.Ready && dock.Error==null,"failed registration may recover");
dock.ExplorerRestarted();
Check(!dock.Registered && !dock.Ready,"Explorer restart invalidates old registration");
dock.Update(true,screen,800,100);
Check(dock.Ready && dock.Bounds.Width==800 && dock.Bounds.Height==100,"restart and resize acquire fresh area");
os.Confirm=false;os.WorkArea=screen;
dock.Update(true,screen,800,100);
Check(!dock.Ready && dock.Error!=null,"shell acceptance alone does not prove work area reservation");
dock.Release();
Check(!dock.Registered && dock.Bounds==default,"release clears placement even after incomplete confirmation");
os.Confirm=true;dock.Update(true,screen,600,80);
dock.MarkUnavailable("monitor temporarily unavailable");
Check(!dock.Ready && dock.Error!=null,"native monitor failure invalidates previously confirmed readiness");
dock.Update(true,screen,600,80);
Check(dock.Ready && dock.Error==null,"native readiness can recover on the next successful sample");
dock.Release();
sealed class FakePlatform:IDockReservationPlatform {
 public bool Accept=true,Confirm=true;public int Reserves,Removes;
 public DockBounds WorkArea {get;set;}=new(0,0,1920,1080);
 public bool Register()=>Accept;
 public DockBounds Reserve(DockBounds requested){Reserves++;if(Confirm)WorkArea=new(0,0,1920,requested.Top);return requested;}
 public void Remove(){Removes++;WorkArea=new(0,0,1920,1080);}
}
