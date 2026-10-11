using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using Lively.Services.DesktopSync;
internal static class Program {
 [STAThread] static void Main(){var app=new Application{ShutdownMode=ShutdownMode.OnExplicitShutdown};app.Startup+=async(_,_)=>{
 var file=Path.Combine(Path.GetTempPath(),"Dext-menu-repeat-"+Guid.NewGuid()+".txt");File.WriteAllText(file,"temporary menu test");
 try {for(var i=0;i<5;i++){
  bool escaped=false;var before=GetForegroundWindow();
  var close=Task.Run(async()=>{await Task.Delay(450);var foreground=GetForegroundWindow();GetWindowThreadProcessId(foreground,out var pid);
   if(pid==(uint)Environment.ProcessId){keybd_event(27,0,0,UIntPtr.Zero);keybd_event(27,0,2,UIntPtr.Zero);escaped=true;}
  });
  bool timedOut=false;var timer=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(3)};timer.Tick+=(_,_)=>{timedOut=true;EndMenu();};timer.Start();
  var result=await DesktopContextMenuWindow.ShowAsync(new[]{file},80,80,()=>true,()=>before,()=>{});
  timer.Stop();await close;if(timedOut||!escaped||result!="cancelled")throw new Exception("Cycle "+i+" failed to open and close by Escape");
  Console.WriteLine("PASS native menu cycle "+(i+1)+" Escape closed");await Task.Delay(200);
 }}catch(Exception e){Console.Error.WriteLine(e);Environment.ExitCode=1;}finally{File.Delete(file);app.Shutdown();}};app.Run();}
 [DllImport("user32.dll")]static extern bool EndMenu();
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")]static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
