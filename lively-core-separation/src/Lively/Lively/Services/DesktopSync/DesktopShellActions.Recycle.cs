using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
namespace Lively.Services.DesktopSync;
internal static partial class DesktopShellActions
{
    internal static Task<DesktopTransferResult> DeleteToRecycleBinAsync(IReadOnlyList<string> sources,IntPtr owner=default,
        CancellationToken cancellation=default,bool interactive=true,Func<bool>? permitted=null)
    {
        if(sources.Count is <1 or >256)throw new ArgumentOutOfRangeException(nameof(sources));
        var copy=sources.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return DesktopShellTransfer.RunStaAsync(()=>Recycle(copy,owner,cancellation,interactive,permitted),cancellation,permitted);
    }
    private static DesktopTransferResult Recycle(string[] sources,IntPtr owner,CancellationToken cancellation,bool interactive,Func<bool>? permitted)
    {
        var results=new List<DesktopTransferItem>();var pending=new List<TransferSink>();var resources=new List<object>();
        void CheckScope(){cancellation.ThrowIfCancellationRequested();if(permitted?.Invoke()==false)throw new OperationCanceledException("Desktop recycle scope retired.",cancellation);}
        try{
            CheckScope();
            var operation=(IDesktopFileOperation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3ad05575-8857-4850-9277-11b85bdb8e09"),true)!)!;resources.Add(operation);
            // Recycle only; keep undo, do not delete connected HTML assets, and
            // stop on error. The progress sink vetoes a permanent-delete fallback.
            operation.SetOperationFlags(0x00080000u|0x20000000u|0x40u|0x2000u|0x4000u|0x00100000u|0x400u|(interactive?0u:0x14u));
            if(owner!=IntPtr.Zero)operation.SetOwnerWindow(owner);
            foreach(var source in sources){
                CheckScope();
                try{
                    if(!Path.IsPathFullyQualified(source))throw new ArgumentException("Source must be absolute.");
                    var path=Path.TrimEndingDirectorySeparator(Path.GetFullPath(source));
                    var root=Path.GetPathRoot(path);
                    if(root is null||Path.GetDirectoryName(path) is null||new DriveInfo(root).DriveType!=DriveType.Fixed){
                        results.Add(new(source,null,"notRecyclable",TransferSink.RecycleUnavailable));continue;
                    }
                    if(!File.Exists(path)&&!Directory.Exists(path))throw new FileNotFoundException("Selected source no longer exists.",path);
                    var item=DesktopShellTransfer.CreateItem(path);resources.Add(item);
                    var sink=new TransferSink(path,cancellation,permitted:permitted,recycleOnly:true);
                    operation.DeleteItem(item,sink);pending.Add(sink);
                }catch(Exception error)when(error is IOException or UnauthorizedAccessException or ArgumentException or COMException){results.Add(new(source,null,"failed",error.HResult));}
            }
            CheckScope();var result=pending.Count==0?0:operation.PerformOperations();operation.GetAnyOperationsAborted(out var aborted);
            aborted=aborted||cancellation.IsCancellationRequested||pending.Any(sink=>sink.Cancelled)||result==unchecked((int)0x800704C7);
            foreach(var sink in pending)results.Add(sink.Result??new(sink.Source,null,aborted?"cancelled":"failed",result));
            return new(results.AsReadOnly(),aborted,result);
        }finally{
            for(var index=resources.Count-1;index>=0;index--)if(Marshal.IsComObject(resources[index]))Marshal.ReleaseComObject(resources[index]);
            GC.KeepAlive(pending);
        }
    }
}
