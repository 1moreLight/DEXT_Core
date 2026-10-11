using Lively.Services.DesktopSync;
using System.Runtime.InteropServices;
internal static class RecycleChecks
{
 internal static async Task Run()
 {
  var root=Directory.CreateTempSubdirectory("Dext-recycle-").FullName;
  var file=Path.Combine(root,"dext-recycle-"+Guid.NewGuid().ToString("N")+"-中文.txt");
  var folder=Path.Combine(root,"dext-recycle-"+Guid.NewGuid().ToString("N"));
  File.WriteAllText(file,"recyclable original bytes");Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"child.txt"),"child bytes");
  var count=0;
  void Check(bool value,string label){if(!value)throw new Exception(label);count++;Console.WriteLine("PASS "+label);}
  try{
   var guard=new TransferSink(file,default,recycleOnly:true);
   Check(guard.PreDeleteItem(0,null!)<0&&guard.Result?.Status=="notRecyclable"&&File.Exists(file),"non-recycle Shell callback is rejected before touching a source");
   var allowed=new TransferSink(file,default,recycleOnly:true);
   Check(allowed.PreDeleteItem(0x80,null!)==0&&File.Exists(file),"recycle-marked callback may proceed without performing IO itself");
   var result=await DesktopShellActions.DeleteToRecycleBinAsync(new[]{file,file},interactive:false);
   Check(result.Items.Count==1&&result.Items[0].Status=="completed"&&!File.Exists(file),"native recycle deduplicates and reports a real recycled file");
   await Restore(file);Check(File.ReadAllText(file)=="recyclable original bytes","exact generated file restores from Windows recycle bin with original bytes");
   var folderResult=await DesktopShellActions.DeleteToRecycleBinAsync(new[]{folder},interactive:false);
   Check(folderResult.Items.Single().Status=="completed"&&!Directory.Exists(folder),"native recycle moves the generated folder");
   await Restore(folder);Check(File.ReadAllText(Path.Combine(folder,"child.txt"))=="child bytes","exact generated folder restores with its child contents");
   using var cancellation=new CancellationTokenSource();cancellation.Cancel();var cancelled=false;
   try{await DesktopShellActions.DeleteToRecycleBinAsync(new[]{file},cancellation:cancellation.Token,interactive:false);}catch(OperationCanceledException){cancelled=true;}
   Check(cancelled&&File.Exists(file),"pre-cancelled delete preserves the source");
   var revoked=false;try{await DesktopShellActions.DeleteToRecycleBinAsync(new[]{file},interactive:false,permitted:()=>false);}catch(OperationCanceledException){revoked=true;}
   Check(revoked&&File.Exists(file),"retired desktop scope preserves the source");
   var missing=await DesktopShellActions.DeleteToRecycleBinAsync(new[]{Path.Combine(root,"missing")},interactive:false);
   Check(missing.Items.Single().Status=="failed","missing source is reported without a delete dialog");
   Console.WriteLine($"{count}/{count} native recycle checks passed");
  }finally{
   // Restore only our unique names if any earlier assertion failed after recycling.
   if(!File.Exists(file))await Restore(file);
   if(!Directory.Exists(folder))await Restore(folder);
   var absolute=Path.GetFullPath(root);var temporary=Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath()));
   if(!string.Equals(Path.GetDirectoryName(absolute),temporary,StringComparison.OrdinalIgnoreCase)||!Path.GetFileName(absolute).StartsWith("Dext-recycle-",StringComparison.Ordinal))throw new Exception("Unexpected fixture cleanup path");
   Directory.Delete(absolute,true); // Resolved unique fixture only; never the recycle bin.
  }
 }
 private static async Task Restore(string original)
 {
  await DesktopShellTransfer.RunStaAsync(()=>{
   object? shell=null,folder=null,items=null;
   try{
    shell=Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application",true)!);folder=((dynamic)shell!).NameSpace(10);items=((dynamic)folder!).Items();
    var total=(int)((dynamic)items).Count;
    if(total>20000)throw new Exception("Recycle fixture lookup limit reached; leave fixture for inspection");
    for(var i=0;i<total;i++){
     object? item=null;
     try{
      item=((dynamic)items).Item(i);
      var name=(string)((dynamic)item).Name;
      var parent=Convert.ToString(((dynamic)item).ExtendedProperty("System.Recycle.DeletedFrom"));
      if((name!=Path.GetFileName(original)&&name!=Path.GetFileNameWithoutExtension(original))||!string.Equals(parent,Path.GetDirectoryName(original),StringComparison.OrdinalIgnoreCase))continue;
      ((dynamic)item).InvokeVerb("undelete");return new DesktopTransferResult(Array.Empty<DesktopTransferItem>(),false,0);
     }finally{if(item is not null&&Marshal.IsComObject(item))Marshal.ReleaseComObject(item);}
    }
    throw new Exception("Generated fixture was not found in recycle bin: "+Path.GetFileName(original));
   }finally{foreach(var value in new[]{items,folder,shell})if(value is not null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
  },default,null);
  for(var attempt=0;attempt<100;attempt++){
   if(File.Exists(original)||Directory.Exists(original))return;
   await Task.Delay(50);
  }
  throw new Exception("Generated recycle fixture restoration timed out");
 }
}
