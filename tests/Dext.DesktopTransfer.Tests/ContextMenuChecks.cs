using Lively.Services.DesktopSync;
internal static class ContextMenuChecks
{
 internal static Task Run()
 {
  var done=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
  var thread=new Thread(()=>
  {
   var root=Directory.CreateTempSubdirectory("Dext-context-menu-").FullName;
   var first=Path.Combine(root,"用户");var second=Path.Combine(root,"公共");
   Directory.CreateDirectory(first);Directory.CreateDirectory(second);
   var a=Path.Combine(first,"一.txt");var b=Path.Combine(first,"二.txt");var c=Path.Combine(second,"三.txt");
   File.WriteAllText(a,"one");File.WriteAllText(b,"two");File.WriteAllText(c,"three");
   void Check(bool pass,string message){if(!pass)throw new Exception(message);Console.WriteLine("PASS "+message);}
   Exception? failure=null;
   try
   {
    using(var background=DesktopShellContextMenu.CreateBackground()){Check(background.Commands().Count>0,"native desktop background exposes commands without a selected file");}
    foreach(var paths in new[]{new[]{a},new[]{a,b},new[]{a,c}})
    {
     using var menu=DesktopShellContextMenu.Create(paths);
     Check(menu.Verbs.Contains("properties"),"Shell exposes properties for "+paths.Length+" selected file(s) from "+paths.Select(Path.GetDirectoryName).Distinct().Count()+" folder(s)");
     Check(menu.Verbs.Contains("copy"),"Shell exposes copy for the complete selection");
    }
    using(var menu=DesktopShellContextMenu.Create(new[]{a,c}))
    {
     var delete=menu.Commands().Single(command=>command.Verb=="delete");
     Check(menu.Dispatch(delete.Id,IntPtr.Zero,0,0,()=>true)=="delete","native Delete returns to Dext recycle-only operation without invoking Shell deletion");
     var copy=menu.Commands().Single(command=>command.Verb=="copy");
     Check(menu.Dispatch(copy.Id,IntPtr.Zero,0,0,()=>true)=="copy","native Copy returns to existing clipboard and selection feedback");
     var properties=menu.Commands().Single(command=>command.Verb=="properties");
     var cancelled=false;
     try{menu.Dispatch(properties.Id,IntPtr.Zero,0,0,()=>false);}catch(OperationCanceledException){cancelled=true;}
     Check(cancelled,"retired scope cannot open Properties");
     var invalid=false;
     try{menu.Dispatch(0,IntPtr.Zero,0,0,()=>true);}catch(ArgumentOutOfRangeException){invalid=true;}
     Check(invalid,"cancelled/unknown native command cannot invoke a default verb");
     Check(!menu.HandleMessage(0x0201,UIntPtr.Zero,IntPtr.Zero,out _),"unrelated mouse messages are not sent to Shell handlers");
     var handled=menu.HandleMessage(0x117,(UIntPtr)menu.Handle,IntPtr.Zero,out _);
     Console.WriteLine("INFO root menu initialization handled by Shell: "+handled);
     Check(menu.Verbs.Contains("properties"),"menu survives optional Shell popup initialization without losing Properties");
    }
    var disposed=DesktopShellContextMenu.Create(new[]{a});disposed.Dispose();disposed.Dispose();
    var rejected=false;try{_=disposed.Verbs;}catch(ObjectDisposedException){rejected=true;}
    Check(rejected,"disposed menu cannot be reused; repeated disposal is harmless");
    Check(File.ReadAllText(a)=="one"&&File.ReadAllText(b)=="two"&&File.ReadAllText(c)=="three","querying and disposing menus preserves all fixture contents");
   }
   catch(Exception error){failure=error;}
   finally
   {
    // Remove only explicitly created fixtures; nonrecursive cleanup cannot erase unrelated files.
    try{File.Delete(a);File.Delete(b);File.Delete(c);
     Directory.Delete(first);Directory.Delete(second);Directory.Delete(root);}
    catch(Exception cleanup){failure=failure is null?cleanup:new AggregateException(failure,cleanup);}
   }
   if(failure is null)done.SetResult();else done.SetException(failure);
  });
  thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();return done.Task;
 }
}
