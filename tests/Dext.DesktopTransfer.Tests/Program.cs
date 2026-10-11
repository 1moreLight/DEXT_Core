using Lively.Services.DesktopSync;
if(args.Length==1&&args[0]=="--recycle"){await RecycleChecks.Run();return;}
if(args.Length==1&&args[0]=="--paste"){await PasteChecks.Run();return;}
if(args.Length==1&&args[0]=="--clipboard-data"){ClipboardChecks.Run();return;}
if(args.Length==1&&args[0]=="--rename"){await RenameChecks.Run();return;}
if (args.Length == 3 && args[0] == "--cross-volume") { await CrossVolumeChecks.Run(args[1], args[2]); return; }
var root=Directory.CreateTempSubdirectory("Dext-shell-transfer-").FullName;
void Check(bool value,string text){if(!value)throw new Exception(text);Console.WriteLine("PASS "+text);}
try
{
Check(DesktopDropPolicy.Select("all",0,true)==DesktopDropEffect.Move,"same-volume default moves");
Check(DesktopDropPolicy.Select("all",0,false)==DesktopDropEffect.Copy,"cross-volume default copies");
Check(DesktopDropPolicy.Select("all",1,true)==DesktopDropEffect.Copy,"Ctrl copies on same volume");
Check(DesktopDropPolicy.Select("all",2,false)==DesktopDropEffect.Move,"Shift moves across volumes");
Check(DesktopDropPolicy.Select("all",3,true)==DesktopDropEffect.Link&&DesktopDropPolicy.Select("all",4,false)==DesktopDropEffect.Link,"Ctrl+Shift and Alt request shortcuts");
Check(DesktopDropPolicy.Select("copy",2,true)==DesktopDropEffect.None,"unsupported explicit move is rejected");
Check(DesktopDropPolicy.Select("copy",0,true)==DesktopDropEffect.Copy,"copy-only source defaults to copy");
Check(DesktopDropPolicy.Select("none",0,true)==DesktopDropEffect.None&&DesktopDropPolicy.Select("all",8,true)==DesktopDropEffect.None,"invalid or empty effects are rejected");

 var source=Directory.CreateDirectory(Path.Combine(root,"source")).FullName;
 var destination=Directory.CreateDirectory(Path.Combine(root,"destination")).FullName;
 Check(DesktopDropVolume.SameVolume(source,destination),"native volume identity recognizes sibling directories");
 Check(!DesktopDropVolume.SameVolume("relative-file",destination),"unknown volume cannot select default move");
 var file=Path.Combine(source,"one.txt");File.WriteAllText(file,"original content");
 var revoked=false;
 try { await DesktopShellTransfer.RunAsync(new[]{file},destination,"all",2,default,false,default,()=>false); }
 catch(OperationCanceledException){revoked=true;}
 Check(revoked&&File.Exists(file)&&!File.Exists(Path.Combine(destination,"one.txt")),"revoked drop scope cannot start a transfer");
 var checks=0;var retired=false;
 try { await DesktopShellTransfer.RunAsync(new[]{file},destination,"all",2,default,false,default,()=>++checks<3); }
 catch(OperationCanceledException){retired=true;}
 Check(retired&&checks==3&&File.Exists(file)&&!File.Exists(Path.Combine(destination,"one.txt")),"scope revocation after Shell queueing prevents execution");
 var progressChecks=0;
 var interrupted=await DesktopShellTransfer.RunAsync(new[]{file},destination,"all",2,default,false,default,()=>++progressChecks<4);
 Check(progressChecks>=4&&interrupted.Aborted&&interrupted.Items.Single().Status=="cancelled"&&File.Exists(file)&&!File.Exists(Path.Combine(destination,"one.txt")),"revocation inside native Shell progress preserves unprocessed source");
 var rejected=await DesktopShellTransfer.RunAsync(new[]{file},destination,"copy",2,default,false);
 Check(rejected.Items.Single().Status=="failed"&&File.Exists(file)&&!File.Exists(Path.Combine(destination,"one.txt")),"unsupported explicit move cannot copy or move a file");
 var copied=await DesktopShellTransfer.RunAsync(new[]{file},destination,"all",1,default,false);
 Check(copied.Items.Single().Status=="completed"&&File.ReadAllText(Path.Combine(destination,"one.txt"))=="original content"&&File.Exists(file),"Shell copy reports actual completion and preserves source");
 var folder=Directory.CreateDirectory(Path.Combine(source,"Folder")).FullName;File.WriteAllText(Path.Combine(folder,"nested.txt"),"nested");
 var moved=await DesktopShellTransfer.RunAsync(new[]{folder},destination,true,default,false);
 Check(moved.Items.Single().Status=="completed"&&!Directory.Exists(folder)&&File.ReadAllText(Path.Combine(destination,"Folder","nested.txt"))=="nested","Shell move transfers directory contents before reporting success");
 var linked=await DesktopShellTransfer.RunAsync(new[]{file},source,DesktopDropEffect.Link,default,false);
 Check(linked.Items.Single().Status=="completed"&&File.Exists(file)&&File.Exists(linked.Items.Single().Destination),"same-directory shortcut is created without moving source");
 var shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell")!)!;
 object? shortcut=null;
 try
 {
  shortcut=shell.GetType().InvokeMember("CreateShortcut",System.Reflection.BindingFlags.InvokeMethod,null,shell,new object[]{linked.Items.Single().Destination!});
  var target=(string)shortcut!.GetType().InvokeMember("TargetPath",System.Reflection.BindingFlags.GetProperty,null,shortcut,null)!;
  Check(string.Equals(target,file,StringComparison.OrdinalIgnoreCase),"created shortcut resolves to the original file");
 }
 finally
 {
  if(shortcut is not null)System.Runtime.InteropServices.Marshal.ReleaseComObject(shortcut);
  System.Runtime.InteropServices.Marshal.ReleaseComObject(shell);
 }
 var same=await DesktopShellTransfer.RunAsync(new[]{file},source,true,default,false);
 Check(same.Items.Single().Status=="unchanged"&&File.Exists(file),"same-directory drop leaves source unchanged");
 var missing=await DesktopShellTransfer.RunAsync(new[]{Path.Combine(source,"missing.txt")},destination,false,default,false);
 Check(missing.Items.Single().Status=="failed","missing source is an item failure without opening error UI");
 var another=Path.Combine(source,"two.txt");File.WriteAllText(another,"second");
 var mixed=await DesktopShellTransfer.RunAsync(new[]{Path.Combine(source,"absent.txt"),another,another},destination,false,default,false);
 Check(mixed.Items.Count==2&&mixed.Items.Count(i=>i.Status=="completed")==1&&mixed.Items.Count(i=>i.Status=="failed")==1&&File.ReadAllText(Path.Combine(destination,"two.txt"))=="second","partial failure reports each distinct source while valid copy completes");
 var batchOne=Path.Combine(source,"cancel-first.txt");var batchTwo=Path.Combine(source,"cancel-second.txt");
 File.WriteAllText(batchOne,"first complete");File.WriteAllText(batchTwo,"second stays");
 var batchTarget=Path.Combine(destination,"cancel-first.txt");
 var partial=await DesktopShellTransfer.RunAsync(new[]{batchOne,batchTwo},destination,"all",2,default,false,default,()=>!File.Exists(batchTarget));
 Check(partial.Aborted&&partial.Items.Any(item=>item.Source==batchOne&&item.Status=="completed")&&
  File.ReadAllText(batchTarget)=="first complete"&&!File.Exists(batchOne)&&File.ReadAllText(batchTwo)=="second stays"&&
  !File.Exists(Path.Combine(destination,"cancel-second.txt")),"cancellation after first move reports its success and preserves second source");
 using var cancellation=new CancellationTokenSource();cancellation.Cancel();var cancelled=false;
 try{await DesktopShellTransfer.RunAsync(new[]{file},destination,true,cancellation.Token,false);}catch(OperationCanceledException){cancelled=true;}
 Check(cancelled&&File.Exists(file),"pre-cancelled transfer does not move a source");
}
finally{Directory.Delete(root,true);}