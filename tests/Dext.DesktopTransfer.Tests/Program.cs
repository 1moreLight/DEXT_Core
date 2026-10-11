using Lively.Services.DesktopSync;
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
 var file=Path.Combine(source,"one.txt");File.WriteAllText(file,"original content");
 var copied=await DesktopShellTransfer.RunAsync(new[]{file},destination,false,default,false);
 Check(copied.Items.Single().Status=="completed"&&File.ReadAllText(Path.Combine(destination,"one.txt"))=="original content"&&File.Exists(file),"Shell copy reports actual completion and preserves source");
 var folder=Directory.CreateDirectory(Path.Combine(source,"Folder")).FullName;File.WriteAllText(Path.Combine(folder,"nested.txt"),"nested");
 var moved=await DesktopShellTransfer.RunAsync(new[]{folder},destination,true,default,false);
 Check(moved.Items.Single().Status=="completed"&&!Directory.Exists(folder)&&File.ReadAllText(Path.Combine(destination,"Folder","nested.txt"))=="nested","Shell move transfers directory contents before reporting success");
 var same=await DesktopShellTransfer.RunAsync(new[]{file},source,true,default,false);
 Check(same.Items.Single().Status=="unchanged"&&File.Exists(file),"same-directory drop leaves source unchanged");
 var missing=await DesktopShellTransfer.RunAsync(new[]{Path.Combine(source,"missing.txt")},destination,false,default,false);
 Check(missing.Items.Single().Status=="failed","missing source is an item failure without opening error UI");
 var another=Path.Combine(source,"two.txt");File.WriteAllText(another,"second");
 var mixed=await DesktopShellTransfer.RunAsync(new[]{Path.Combine(source,"absent.txt"),another,another},destination,false,default,false);
 Check(mixed.Items.Count==2&&mixed.Items.Count(i=>i.Status=="completed")==1&&mixed.Items.Count(i=>i.Status=="failed")==1&&File.ReadAllText(Path.Combine(destination,"two.txt"))=="second","partial failure reports each distinct source while valid copy completes");
 using var cancellation=new CancellationTokenSource();cancellation.Cancel();var cancelled=false;
 try{await DesktopShellTransfer.RunAsync(new[]{file},destination,true,cancellation.Token,false);}catch(OperationCanceledException){cancelled=true;}
 Check(cancelled&&File.Exists(file),"pre-cancelled transfer does not move a source");
}
finally{Directory.Delete(root,true);}