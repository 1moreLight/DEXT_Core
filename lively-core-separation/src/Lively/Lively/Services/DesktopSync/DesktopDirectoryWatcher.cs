using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using Timer = System.Threading.Timer;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopRename(string OldPath,string NewPath);
internal sealed record DesktopWatchBatch(IReadOnlyList<string> Paths,IReadOnlyList<DesktopRename> Renames,bool FullRescan);

// Events invalidate a snapshot; they never directly add/remove an authoritative item.
internal sealed class DesktopDirectoryWatcher : IDisposable
{
    private readonly object gate=new();
    private readonly Func<IReadOnlyList<DesktopFolder>> roots;
    private readonly Action<DesktopWatchBatch> changed;
    private readonly Action<Exception>? failed;
    private readonly Dictionary<string,FileSystemWatcher> watchers=new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> paths=new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string,string> renames=new(StringComparer.OrdinalIgnoreCase);
    private readonly Timer debounce;
    private readonly Timer health;
    private readonly TimeSpan quiet;
    private readonly TimeSpan maximumDelay;
    private bool disposed,full;
    private long firstChange;
    private const int MaximumPaths=4096;

    internal DesktopDirectoryWatcher(Func<IReadOnlyList<DesktopFolder>> roots,Action<DesktopWatchBatch> changed,
        Action<Exception>? failed=null,TimeSpan? quiet=null,TimeSpan? maximumDelay=null,TimeSpan? healthInterval=null)
    {
        this.roots=roots;this.changed=changed;this.failed=failed;
        this.quiet=quiet??TimeSpan.FromMilliseconds(250);this.maximumDelay=maximumDelay??TimeSpan.FromSeconds(2);
        var interval=healthInterval??TimeSpan.FromSeconds(15);
        if(this.quiet<=TimeSpan.Zero||this.maximumDelay<this.quiet||interval<=TimeSpan.Zero)throw new ArgumentOutOfRangeException(nameof(quiet));
        debounce=new Timer(Flush,null,Timeout.InfiniteTimeSpan,Timeout.InfiniteTimeSpan);
        health=new Timer(CheckRoots,null,Timeout.InfiniteTimeSpan,Timeout.InfiniteTimeSpan);
        CheckRoots(null);
        health.Change(interval,interval);
    }
    private void Report(Exception error){try{failed?.Invoke(error);}catch{ /* Reporting cannot terminate a Timer callback. */ }}
    private void CheckRoots(object? _)
    {
        try
        {
            var desired=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var errors=new List<Exception>();
            foreach(var root in roots())
            {
                if(!Path.IsPathFullyQualified(root.Path)){errors.Add(new ArgumentException("Desktop watch root must be absolute."));continue;}
                desired.Add(Path.GetFullPath(root.Path));
            }
            var retired=new List<FileSystemWatcher>();
            lock(gate)
            {
                if(disposed)return;
                foreach(var pair in watchers.ToArray())if(!desired.Contains(pair.Key)||!Directory.Exists(pair.Key))
                {watchers.Remove(pair.Key);retired.Add(pair.Value);}
                foreach(var path in desired)
                {
                    if(watchers.ContainsKey(path)||!Directory.Exists(path))continue;
                    FileSystemWatcher? watcher=null;
                    try
                    {
                        watcher=new FileSystemWatcher(path){IncludeSubdirectories=false,NotifyFilter=NotifyFilters.FileName|NotifyFilters.DirectoryName|NotifyFilters.Attributes|NotifyFilters.LastWrite|NotifyFilters.Size};
                        watcher.Created+=OnChanged;watcher.Deleted+=OnChanged;watcher.Changed+=OnChanged;watcher.Renamed+=OnRenamed;watcher.Error+=OnError;
                        watchers.Add(path,watcher);watcher.EnableRaisingEvents=true;
                    }
                    catch(Exception error) when(error is IOException or UnauthorizedAccessException or ArgumentException)
                    {watchers.Remove(path);if(watcher is not null)retired.Add(watcher);errors.Add(error);}
                }
                // Periodic full verification also repairs missed/overflowed notifications.
                QueueLocked(null,null,true);
            }
            foreach(var watcher in retired)watcher.Dispose();
            foreach(var error in errors)Report(error);
        }
        catch(Exception error){Report(error);lock(gate)if(!disposed)QueueLocked(null,null,true);}
    }
    private bool Current(object? sender)=>sender is FileSystemWatcher watcher&&watchers.TryGetValue(watcher.Path,out var current)&&ReferenceEquals(watcher,current);
    private void OnChanged(object sender,FileSystemEventArgs args)
    {lock(gate)if(!disposed&&Current(sender))QueueLocked(args.FullPath,null,false);}
    private void OnRenamed(object sender,RenamedEventArgs args)
    {lock(gate)if(!disposed&&Current(sender))QueueLocked(args.FullPath,args.OldFullPath,false);}
    private void OnError(object sender,ErrorEventArgs args)
    {
        FileSystemWatcher? retired=null;
        lock(gate)if(!disposed&&Current(sender))
        {
            retired=(FileSystemWatcher)sender;watchers.Remove(retired.Path);QueueLocked(null,null,true);
        }
        retired?.Dispose();Report(args.GetException());
    }
    private void QueueLocked(string? path,string? oldPath,bool requireFull)
    {
        if(firstChange==0)firstChange=Stopwatch.GetTimestamp();
        full|=requireFull;
        if(path is not null)paths.Add(path);
        if(oldPath is not null&&path is not null){paths.Add(oldPath);renames[oldPath]=path;}
        if(paths.Count>MaximumPaths||renames.Count>MaximumPaths){paths.Clear();renames.Clear();full=true;}
        var remaining=maximumDelay-Stopwatch.GetElapsedTime(firstChange);
        debounce.Change(remaining<=TimeSpan.Zero?TimeSpan.Zero:remaining<quiet?remaining:quiet,Timeout.InfiniteTimeSpan);
    }
    private void Flush(object? _)
    {
        DesktopWatchBatch batch;
        lock(gate)
        {
            if(disposed||firstChange==0)return;
            batch=new(paths.ToArray(),renames.Select(p=>new DesktopRename(p.Key,p.Value)).ToArray(),full);
            paths.Clear();renames.Clear();full=false;firstChange=0;
        }
        try{changed(batch);}catch(Exception error){Report(error);}
    }
    public void Dispose()
    {
        FileSystemWatcher[] retired;
        lock(gate)
        {
            if(disposed)return;disposed=true;retired=watchers.Values.ToArray();watchers.Clear();paths.Clear();renames.Clear();
            debounce.Dispose();health.Dispose();
        }
        foreach(var watcher in retired)watcher.Dispose();
    }
}
