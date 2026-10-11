using Lively.Services.DesktopSync;

internal static class RenameChecks
{
 internal static async Task Run()
 {
  var root=Directory.CreateTempSubdirectory("Dext-rename-").FullName;
  var files=new List<string>();var folders=new List<string>();
  void Check(bool pass,string message){if(!pass)throw new Exception(message);Console.WriteLine("PASS "+message);}
  string Fixture(string name){var path=Path.Combine(root,name);files.Add(path);File.WriteAllText(path,"original bytes");return path;}
  try
  {
   var source=Fixture("old.txt");var target=Path.Combine(root,"新名字.txt");files.Add(target);
   var result=await DesktopShellActions.RenameAsync(source,"新名字.txt",interactive:false);
   Check(result.Items.Single() is{Status:"completed"}&&result.Items.Single().Destination==target&&!File.Exists(source)&&File.ReadAllText(target)=="original bytes","Shell rename preserves contents and returns actual Unicode target");
   var same=await DesktopShellActions.RenameAsync(target,"新名字.txt",interactive:false);
   Check(same.Items.Single().Status=="unchanged"&&File.Exists(target),"unchanged name does not rewrite the file");
   var original=Fixture("blocked.txt");var invalid=false;
   try{await DesktopShellActions.RenameAsync(original,"../escape.txt",interactive:false);}catch(ArgumentException){invalid=true;}
   Check(invalid&&File.ReadAllText(original)=="original bytes","rename cannot turn a file name into another directory");
   var occupied=Fixture("occupied.txt");File.WriteAllText(occupied,"existing destination");
   var conflict=await DesktopShellActions.RenameAsync(original,"occupied.txt",interactive:false);
   Check(conflict.Items.Single().Status=="conflict"&&File.ReadAllText(original)=="original bytes"&&File.ReadAllText(occupied)=="existing destination","name collision preserves both files without auto-overwrite");
   using var cancel=new CancellationTokenSource();cancel.Cancel();var cancelled=false;
   try{await DesktopShellActions.RenameAsync(original,"cancelled.txt",cancellation:cancel.Token,interactive:false);}catch(OperationCanceledException){cancelled=true;}
   Check(cancelled&&File.Exists(original),"cancelled rename preserves the original");
   var retired=false;try{await DesktopShellActions.RenameAsync(original,"retired.txt",interactive:false,permitted:()=>false);}catch(OperationCanceledException){retired=true;}
   Check(retired&&File.Exists(original),"retired desktop scope cannot rename a file");
   var folder=Path.Combine(root,"Folder");var renamed=Path.Combine(root,"目录");folders.Add(folder);folders.Add(renamed);Directory.CreateDirectory(folder);
   var child=Path.Combine(folder,"inside.txt");var renamedChild=Path.Combine(renamed,"inside.txt");files.Add(child);files.Add(renamedChild);File.WriteAllText(child,"child bytes");
   var moved=await DesktopShellActions.RenameAsync(folder,"目录",interactive:false);
   Check(moved.Items.Single().Status=="completed"&&!Directory.Exists(folder)&&File.ReadAllText(renamedChild)=="child bytes","folder rename retains its children");
  }
  finally
  {
   foreach(var path in files)if(File.Exists(path))File.Delete(path);
   foreach(var path in folders)if(Directory.Exists(path))Directory.Delete(path);
   Directory.Delete(root);
  }
 }
}