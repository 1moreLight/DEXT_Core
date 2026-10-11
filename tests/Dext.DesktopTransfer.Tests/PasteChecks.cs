using Lively.Services.DesktopSync;
internal static class PasteChecks
{
 internal static async Task Run()
 {
  var root=Directory.CreateTempSubdirectory("Dext-paste-").FullName;
  void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
  try{
   var original=Path.Combine(root,"中文 original.txt");File.WriteAllText(original,"original bytes");
   var first=await DesktopShellTransfer.PasteAsync(new[]{original},root,DesktopDropEffect.Copy,interactive:false);
   var copy=first.Items.Single();
   Check(copy.Status=="completed"&&copy.Destination!=original&&File.ReadAllText(copy.Destination!)=="original bytes"&&File.ReadAllText(original)=="original bytes","same-folder paste creates a real separate copy and preserves source");
   var second=await DesktopShellTransfer.PasteAsync(new[]{original},root,DesktopDropEffect.Copy,interactive:false);
   Check(second.Items.Single().Destination!=copy.Destination&&File.ReadAllText(second.Items.Single().Destination!)=="original bytes","repeated paste makes another unique Shell copy");
   var unchanged=await DesktopShellTransfer.PasteAsync(new[]{original},root,DesktopDropEffect.Move,interactive:false);
   Check(unchanged.Items.Single().Status=="unchanged"&&File.Exists(original),"same-folder cut paste does not delete or duplicate source");
   var folder=Directory.CreateDirectory(Path.Combine(root,"Folder")).FullName;File.WriteAllText(Path.Combine(folder,"inside.txt"),"child bytes");
   var folderResult=await DesktopShellTransfer.PasteAsync(new[]{folder},root,DesktopDropEffect.Copy,interactive:false);
   var folderCopy=folderResult.Items.Single();
   Check(folderCopy.Status=="completed"&&folderCopy.Destination!=folder&&File.ReadAllText(Path.Combine(folderCopy.Destination!,"inside.txt"))=="child bytes","same-folder directory paste preserves its contents in a new folder");
   var missing=Path.Combine(root,"missing.txt");
   var partial=await DesktopShellTransfer.PasteAsync(new[]{original,missing},root,DesktopDropEffect.Copy,interactive:false);
   Check(partial.Items.Count==2&&partial.Items.Any(i=>i.Source==original&&i.Status=="completed")&&partial.Items.Any(i=>i.Source==missing&&i.Status=="failed"),"partial paste keeps actual successful copy and reports missing item");
   using var cancelled=new CancellationTokenSource();cancelled.Cancel();var stopped=false;
   try{await DesktopShellTransfer.PasteAsync(new[]{original},root,DesktopDropEffect.Copy,cancelled.Token,false);}catch(OperationCanceledException){stopped=true;}
   Check(stopped&&File.Exists(original),"pre-cancelled paste leaves source intact");
   Console.WriteLine("6/6 native Shell paste checks passed");
  }finally{
   var absolute=Path.GetFullPath(root);var temporary=Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath()));
   if(!string.Equals(Path.GetDirectoryName(absolute),temporary,StringComparison.OrdinalIgnoreCase)||!Path.GetFileName(absolute).StartsWith("Dext-paste-",StringComparison.Ordinal))throw new Exception("Unexpected fixture cleanup path");
   Directory.Delete(absolute,true); // Only this generated fixture and its Shell-created copies.
  }
 }
}
