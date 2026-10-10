using Lively.Services.DesktopSync;
if(args.Contains("--watch")){await WatcherChecks.Run();return;}
if(args.Contains("--system"))
{
 var folders=DesktopDirectoryScanner.SystemFolders();
 var result=await Task.Run(()=>DesktopDirectoryScanner.Scan(folders));
 foreach(var folder in folders)Console.WriteLine($"SYSTEM {folder.Source} resolved={Path.IsPathFullyQualified(folder.Path)} items={result.Items.Count(i=>i.Sources.Contains(folder.Source))}");
 Console.WriteLine($"SYSTEM total={result.Items.Count} issues={result.Issues.Count} truncated={result.Truncated}");
 return;
}
if(args.Contains("--shell-icons"))
{
 var temporary=Path.Combine(Path.GetTempPath(),"dext-shell-icons-"+Guid.NewGuid().ToString("N"));
 try
 {
  Directory.CreateDirectory(temporary);Directory.CreateDirectory(Path.Combine(temporary,"Folder"));File.WriteAllText(Path.Combine(temporary,"Document.txt"),"fixture");
  var scan=DesktopDirectoryScanner.Scan(new[]{new DesktopFolder("user",temporary)});
  var metadata=await DesktopShellMetadata.ReadAsync(scan.Items);
  if(metadata.Count!=2||metadata.Any(i=>string.IsNullOrWhiteSpace(i.Name)||i.IconPng==null||!Convert.FromBase64String(i.IconPng).AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10})))throw new Exception("Native Shell file/folder icons missing");
  Console.WriteLine("PASS native Shell file and folder names/PNG icons on background STA thread");
 }
 finally{if(Directory.Exists(temporary))Directory.Delete(temporary,true);}
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
 var catalog=new DesktopSyncCatalog();var scope=new DesktopSyncScope(Guid.NewGuid(),"room","stamp","home");
 var ticket=catalog.Begin(scope);var slots=scan.Items.Select((item,index)=>(item.Id,index)).ToDictionary(p=>p.Id,p=>p.index);
 var metadata=scan.Items.Select(i=>new DesktopShellItem(i.Id,i.Name,null)).ToArray();
 Check(catalog.Publish(ticket,scan,metadata,slots),"current completed scan publishes official desktop view");
 var view=catalog.Read(scope)!;
 Check(view.Items.Count==5&&!System.Text.Json.JsonSerializer.Serialize(view).Contains(user.Replace("\\","\\\\")),"official view carries names and slots without local paths");
 Check(catalog.TryResolve(scope,view.ContextId,scan.Items[0].Id,out var resolved)&&resolved!.FullPath==scan.Items[0].FullPath,"Core resolves current official item to its exact source file");
 var refresh=catalog.Begin(scope);
 Check(catalog.Read(scope)?.ContextId==view.ContextId&&catalog.TryResolve(scope,view.ContextId,scan.Items[0].Id,out _),"same-scope refresh retains confirmed icons and click context while scanning");
 Check(!catalog.Publish(ticket,scan,metadata,slots),"older refresh result cannot replace the latest request");
 Check(catalog.Publish(refresh,scan,metadata,slots)&&catalog.Read(scope)?.ContextId==view.ContextId,"unchanged refresh preserves click context instead of resetting the desktop page");
 var altered=metadata.Select((item,index)=>index==0?item with{Name=item.Name+" updated"}:item).ToArray();
 var changed=catalog.Begin(scope);
 Check(catalog.Publish(changed,scan,altered,slots)&&catalog.Read(scope)?.ContextId!=view.ContextId,"changed visible metadata rotates context");
 Check(!catalog.TryResolve(scope,view.ContextId,scan.Items[0].Id,out _),"changed presentation revokes previous click context");
 var other=scope with{DeskId="other"};var newer=catalog.Begin(other);
 Check(!catalog.Publish(ticket,scan,metadata,slots)&&catalog.Read(other)==null,"late scan cannot publish into a replacement Desk");
 Check(!catalog.TryResolve(other,view.ContextId,scan.Items[0].Id,out _),"old context cannot open files while replacement scan is pending");
 Check(catalog.Publish(newer,scan,metadata,slots),"replacement scan can publish its own context");
 catalog.Clear();Check(catalog.Read(other)==null&&!catalog.TryResolve(other,newer.ToString("N"),scan.Items[0].Id,out _),"disable/exit clears published paths and context");
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
