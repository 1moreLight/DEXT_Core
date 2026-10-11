using Lively.Services.DesktopSync;
internal static class MetadataCacheChecks
{
 internal static async Task Run()
 {
  var root=Directory.CreateTempSubdirectory("Dext-metadata-cache-").FullName;
  void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
  try
  {
   var path=Path.Combine(root,"sample.txt");File.WriteAllText(path,"one");
   var files=DesktopDirectoryScanner.Scan(new[]{new DesktopFolder("user",root)}).Items;
   var calls=0;var failed=false;
   var cache=new DesktopMetadataCache((items,token)=>{
    calls+=items.Count;
    return Task.FromResult<IReadOnlyList<DesktopShellItem>>(items.Select(i=>new DesktopShellItem(i.Id,"Shell name "+calls,"cG5n",!failed)).ToArray());
   });
   var first=await cache.ReadAsync(files);
   var same=await cache.ReadAsync(files);
   Check(calls==1&&same[0]==first[0],"unchanged file reuses Shell name and icon");
   await cache.ReadAsync(files,new[]{path.ToUpperInvariant()});
   Check(calls==2,"watcher invalidation refreshes unchanged fingerprint case-insensitively");
   File.AppendAllText(path," changed size");var changed=await cache.ReadAsync(files);
   Check(calls==3&&changed[0].Name=="Shell name 3","periodic verification detects changed file without watcher event");
   failed=true;var failure=await cache.ReadAsync(files,new[]{path});
   Check(failure[0]==changed[0],"failed Shell read retains confirmed name and icon");
   failed=false;await cache.ReadAsync(files);
   Check(calls==5,"failed refresh remains dirty and retries");
   File.Delete(path);var absent=await cache.ReadAsync(files);
   Check(calls==5&&absent[0].Name=="Shell name 5","retained unavailable file uses confirmed metadata without Shell read");
   await cache.ReadAsync(Array.Empty<DesktopFileItem>());File.WriteAllText(path,"new");await cache.ReadAsync(files);
   Check(calls==6,"confirmed deletion evicts metadata before path is reused");
   var budgetCache=new DesktopMetadataCache((items,token)=>Task.FromResult<IReadOnlyList<DesktopShellItem>>(items.Select(i=>new DesktopShellItem(i.Id,i.Name,new string('A',80000))).ToArray()));
   var budgetFiles=new List<DesktopFileItem>();
   for(var i=0;i<30;i++){var name=Path.Combine(root,"budget-"+i);File.WriteAllText(name,"x");budgetFiles.Add(new("id-"+i,name,"budget-"+i,"file",new[]{"user"}));}
   await budgetCache.ReadAsync(budgetFiles.Take(20).ToArray());
   var budgetResult=await budgetCache.ReadAsync(budgetFiles);
   Check(budgetResult.Sum(i=>i.IconPng?.Length??0)<=2*1024*1024&&budgetResult.Take(20).All(i=>i.IconPng!=null),"combined cached and refreshed icons respect the total image budget");
   using var cancel=new CancellationTokenSource();cancel.Cancel();var cancelled=false;
   try{await cache.ReadAsync(files,cancellation:cancel.Token);}catch(OperationCanceledException){cancelled=true;}
   Check(cancelled&&calls==6,"cancelled read never invokes Shell");
  }
  finally{Directory.Delete(root,true);}
 }
}