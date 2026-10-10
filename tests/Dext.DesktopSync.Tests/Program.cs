using Lively.Services.DesktopSync;
if(args.Contains("--system"))
{
 var folders=DesktopDirectoryScanner.SystemFolders();
 var result=await Task.Run(()=>DesktopDirectoryScanner.Scan(folders));
 foreach(var folder in folders)Console.WriteLine($"SYSTEM {folder.Source} resolved={Path.IsPathFullyQualified(folder.Path)} items={result.Items.Count(i=>i.Sources.Contains(folder.Source))}");
 Console.WriteLine($"SYSTEM total={result.Items.Count} issues={result.Issues.Count} truncated={result.Truncated}");
 return;
}
void Check(bool pass,string label){if(!pass)throw new Exception(label);Console.WriteLine("PASS "+label);}
var root=Path.Combine(Path.GetTempPath(),"dext-desktop-scan-"+Guid.NewGuid().ToString("N"));
try
{
 var user=Path.Combine(root,"Redirected desktop");var common=Path.Combine(root,"Public desktop");
 Directory.CreateDirectory(user);Directory.CreateDirectory(common);
 File.WriteAllText(Path.Combine(user,"same.txt"),"private");File.WriteAllText(Path.Combine(common,"same.txt"),"public");
 File.WriteAllText(Path.Combine(user,"Application.lnk"),"unresolved shortcut is still a desktop item");
 File.WriteAllText(Path.Combine(user,"Website.url"),"[InternetShortcut]");
 File.WriteAllText(Path.Combine(user,"desktop.ini"),"shell settings");
 var folder=Path.Combine(user,"Folder");Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"Nested.txt"),"nested");
 var roots=new[]{new DesktopFolder("user",user),new DesktopFolder("public",common)};
 var scan=DesktopDirectoryScanner.Scan(roots);
 Check(scan.Items.Count==5&&scan.Issues.Count==0&&!scan.Truncated,"merge top-level user/public files without desktop.ini or nested children");
 Check(scan.Items.Count(i=>i.Name=="same.txt")==2&&scan.Items.Select(i=>i.Id).Distinct().Count()==5,"same name in different desktop folders keeps separate identities");
 Check(scan.Items.Count(i=>i.Kind=="shortcut")==2&&scan.Items.Single(i=>i.Kind=="folder").Name=="Folder","files, folders and unresolved shortcuts retain their types");
 var again=DesktopDirectoryScanner.Scan(roots.Reverse());
 Check(scan.Items.Select(i=>i.Id).SequenceEqual(again.Items.Select(i=>i.Id)),"repeat scans preserve IDs and deterministic order regardless of source order");
 var alias=DesktopDirectoryScanner.Scan(new[]{new DesktopFolder("user",user),new DesktopFolder("public",user.ToUpperInvariant())});
 Check(alias.Items.Count==4&&alias.Items.All(i=>i.Sources.Count==2),"same physical path with casing difference deduplicates and retains both sources");
 var partial=DesktopDirectoryScanner.Scan(new[]{roots[0],new DesktopFolder("public",Path.Combine(root,"missing"))});
 Check(partial.Items.Count==4&&partial.Issues.Count==1,"unavailable public desktop reports partial failure without dropping valid items");
 Check(DesktopDirectoryScanner.Scan(roots,maximumItems:2).Truncated,"bounded scan explicitly reports truncation");
 using var cancel=new CancellationTokenSource();cancel.Cancel();var canceled=false;
 try{DesktopDirectoryScanner.Scan(roots,cancel.Token);}catch(OperationCanceledException){canceled=true;}
 Check(canceled,"cancelled scan exits instead of publishing an empty success");
 Check(File.ReadAllText(Path.Combine(user,"same.txt"))=="private"&&File.ReadAllText(Path.Combine(common,"same.txt"))=="public"&&File.Exists(Path.Combine(folder,"Nested.txt")),"scan preserves original files and contents");
}
finally{if(Directory.Exists(root))Directory.Delete(root,true);}
