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
 // The appended command is outside Shell's ID range; exercise actual native selection.
 {
  var selected=false;var before=GetForegroundWindow();var timedOut=false;
  var choose=Task.Run(async()=>{for(var attempt=0;attempt<100;attempt++){
   await Task.Delay(40);var foreground=GetForegroundWindow();var thread=GetWindowThreadProcessId(foreground,out var pid);
   var info=new GuiInfo{Size=Marshal.SizeOf<GuiInfo>()};
   if(pid==(uint)Environment.ProcessId&&GetGUIThreadInfo(thread,ref info)&&(info.Flags&4)!=0){
    var active=typeof(DesktopContextMenuWindow).GetField("active",System.Reflection.BindingFlags.Static|System.Reflection.BindingFlags.NonPublic)!.GetValue(null);
    var menu=(IntPtr)typeof(DesktopShellContextMenu).GetField("menu",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic)!.GetValue(active)!;
    var index=Enumerable.Range(0,GetMenuItemCount(menu)).Single(i=>GetMenuItemID(menu,i)==0x8001);
    if(GetMenuItemRect(IntPtr.Zero,menu,(uint)index,out var rect)){
     var point=new PointI{X=(rect.Left+rect.Right)/2,Y=(rect.Top+rect.Bottom)/2};
     var hit=WindowFromPoint(point);GetWindowThreadProcessId(hit,out var targetPid);
     if(targetPid==(uint)Environment.ProcessId){
      GetCursorPos(out var oldPoint);SetCursorPos(point.X,point.Y);
      try{mouse_event(2,0,0,0,UIntPtr.Zero);mouse_event(4,0,0,0,UIntPtr.Zero);selected=true;}
      finally{await Task.Delay(100);SetCursorPos(oldPoint.X,oldPoint.Y);}
      return;
     }
    }
    Console.WriteLine("INFO paste rectangle not owned by probe menu");
    keybd_event(27,0,0,UIntPtr.Zero);keybd_event(27,0,2,UIntPtr.Zero);return;
   }
  }});
  var timer=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(5)};timer.Tick+=(_,_)=>{timedOut=true;EndMenu();};timer.Start();
  string result;
  try{result=await DesktopContextMenuWindow.ShowAsync(new[]{file},80,80,()=>true,()=>before,()=>{},background:true,canPaste:true);}
  finally{timer.Stop();await choose;}
  if(timedOut||!selected||result!="dext.paste")throw new Exception($"Native background paste did not dispatch: timeout={timedOut}, sent={selected}, result={result}");
  Console.WriteLine("PASS native background paste selection returns Dext command without changing clipboard or files");
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
 [DllImport("user32.dll")]static extern int GetMenuItemCount(IntPtr menu);
 [DllImport("user32.dll")]static extern uint GetMenuItemID(IntPtr menu,int position);
 [StructLayout(LayoutKind.Sequential)]struct PointI{public int X,Y;}
 [StructLayout(LayoutKind.Sequential)]struct RectI{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern bool GetMenuItemRect(IntPtr owner,IntPtr menu,uint item,out RectI rect);
 [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(PointI point);
 [DllImport("user32.dll")]static extern bool GetCursorPos(out PointI point);
 [DllImport("user32.dll")]static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")]static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")]static extern bool GetGUIThreadInfo(uint thread,ref GuiInfo info);
 [DllImport("user32.dll")]static extern bool EndMenu();
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")]static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
