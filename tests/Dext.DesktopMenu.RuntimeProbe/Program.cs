using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using Lively.Services.DesktopSync;
internal static class Program {
 [STAThread] static void Main(){var app=new Application{ShutdownMode=ShutdownMode.OnExplicitShutdown};app.Startup+=async(_,_)=>{
 var file=Path.Combine(Path.GetTempPath(),"Dext-menu-repeat-"+Guid.NewGuid()+".txt");File.WriteAllText(file,"temporary menu test");
 try {for(var i=0;i<5;i++){
  bool escaped=false;var before=GetForegroundWindow();
  var close=Task.Run(async()=>{for(var attempt=0;attempt<100;attempt++){
    await Task.Delay(40);var foreground=GetForegroundWindow();var thread=GetWindowThreadProcessId(foreground,out var pid);
    var info=new GuiInfo{Size=Marshal.SizeOf<GuiInfo>()};
    if(pid==(uint)Environment.ProcessId&&GetGUIThreadInfo(thread,ref info)&&(info.Flags&4)!=0){keybd_event(27,0,0,UIntPtr.Zero);keybd_event(27,0,2,UIntPtr.Zero);escaped=true;break;}
   }
  });
  bool timedOut=false;var timer=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(5)};timer.Tick+=(_,_)=>{timedOut=true;EndMenu();};timer.Start();
  var result=await DesktopContextMenuWindow.ShowAsync(new[]{file},80,80,()=>true,()=>before,()=>{},background:i%2==1);
  timer.Stop();await close;if(timedOut||!escaped||result!="cancelled")throw new Exception("Cycle "+i+" failed to open and close by Escape");
  Console.WriteLine("PASS native menu cycle "+(i+1)+" Escape closed");await Task.Delay(200);
 }
 // Retiring a Desk/session must end its popup without requiring another key.
 foreach(var background in new[]{false,true}){
  var allowed=1;var observed=false;var timedOut=false;var before=GetForegroundWindow();
  var retire=Task.Run(async()=>{for(var attempt=0;attempt<100;attempt++){
   await Task.Delay(40);var foreground=GetForegroundWindow();var thread=GetWindowThreadProcessId(foreground,out var pid);
   var info=new GuiInfo{Size=Marshal.SizeOf<GuiInfo>()};
   if(pid==(uint)Environment.ProcessId&&GetGUIThreadInfo(thread,ref info)&&(info.Flags&4)!=0){observed=true;Interlocked.Exchange(ref allowed,0);return;}
  }});
  var timer=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(5)};timer.Tick+=(_,_)=>{timedOut=true;EndMenu();};timer.Start();
  bool cancelled=false;
  try{await DesktopContextMenuWindow.ShowAsync(new[]{file},80,80,()=>Volatile.Read(ref allowed)==1,()=>before,()=>{},background:background);}
  catch(OperationCanceledException){cancelled=true;}
  finally{timer.Stop();await retire;}
  if(timedOut||!observed||!cancelled)throw new Exception("Retired popup failed to close");
  Console.WriteLine("PASS "+(background?"background":"file")+" native menu closes when its scope retires");
 }
 }catch(Exception e){Console.Error.WriteLine(e);Environment.ExitCode=1;}finally{File.Delete(file);app.Shutdown();}};app.Run();}
 [StructLayout(LayoutKind.Sequential)]struct GuiInfo{public int Size;public uint Flags;public IntPtr Active,Focus,Capture,MenuOwner,MoveSize,Caret;public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern bool GetGUIThreadInfo(uint thread,ref GuiInfo info);
 [DllImport("user32.dll")]static extern bool EndMenu();
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")]static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
