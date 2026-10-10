using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services.DesktopSync;

// One instance per desktop scope. Serializes cache updates and never caches a
// failed Shell read as a successful refresh; the next health scan can retry it.
internal sealed class DesktopMetadataCache
{
    private sealed record Fingerprint(string Path, string Name, string Kind, long Created, long Modified, long Length, FileAttributes Attributes);
    private sealed record Entry(Fingerprint Stamp, DesktopShellItem Item, bool Dirty);
    private readonly SemaphoreSlim serial = new(1, 1);
    private readonly Dictionary<string, Entry> entries = new(StringComparer.Ordinal);
    private readonly Func<IReadOnlyList<DesktopFileItem>, CancellationToken, Task<IReadOnlyList<DesktopShellItem>>> read;
    internal DesktopMetadataCache(Func<IReadOnlyList<DesktopFileItem>, CancellationToken, Task<IReadOnlyList<DesktopShellItem>>>? read = null)
        => this.read = read ?? DesktopShellMetadata.ReadAsync;

    internal async Task<IReadOnlyList<DesktopShellItem>> ReadAsync(IReadOnlyList<DesktopFileItem> files,
        IReadOnlyCollection<string>? changedPaths = null, CancellationToken cancellation = default)
    {
        if (files.Count > 4096) throw new ArgumentOutOfRangeException(nameof(files));
        await serial.WaitAsync(cancellation).ConfigureAwait(false);
        try
        {
            var retained = files.Select(file => file.Id).ToHashSet(StringComparer.Ordinal);
            foreach (var id in entries.Keys.Where(id => !retained.Contains(id)).ToArray()) entries.Remove(id);
            var changed = new HashSet<string>(changedPaths ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            var stamps = new Dictionary<string, Fingerprint>(StringComparer.Ordinal);
            var pending = new List<DesktopFileItem>();
            foreach (var file in files)
            {
                cancellation.ThrowIfCancellationRequested();
                entries.TryGetValue(file.Id, out var old);
                var stamp = Inspect(file);
                if (stamp is null) continue; // A merged, unavailable entry keeps its last metadata.
                if (old is not null && !old.Dirty && old.Stamp == stamp && !changed.Contains(file.FullPath)) continue;
                if (old is not null) entries[file.Id] = old with { Dirty = true };
                stamps[file.Id] = stamp;
                pending.Add(file);
            }
            if (pending.Count != 0)
            {
                var loaded = await read(pending, cancellation).ConfigureAwait(false);
                cancellation.ThrowIfCancellationRequested();
                foreach (var item in loaded)
                    if (item.Success && stamps.TryGetValue(item.Id, out var stamp))
                        entries[item.Id] = new(stamp, item, false);
            }
            var budget = 2 * 1024 * 1024;
            var result = new List<DesktopShellItem>(files.Count);
            foreach (var file in files)
            {
                cancellation.ThrowIfCancellationRequested();
                var item = entries.TryGetValue(file.Id, out var entry) ? entry.Item : new(file.Id, file.Name, null, false);
                if (item.IconPng is { } png)
                {
                    if (png.Length > 87384 || png.Length > budget)
                    {
                        item = item with { IconPng = null };
                        if (entry is not null) entries[file.Id] = entry with { Item = item };
                    }
                    else budget -= png.Length;
                }
                result.Add(item);
            }
            return result.AsReadOnly();
        }
        finally { serial.Release(); }
    }
    private static Fingerprint? Inspect(DesktopFileItem file)
    {
        try
        {
            FileSystemInfo info = file.Kind == "folder" ? new DirectoryInfo(file.FullPath) : new FileInfo(file.FullPath);
            info.Refresh();
            if (!info.Exists) return null;
            return new(file.FullPath, file.Name, file.Kind, info.CreationTimeUtc.Ticks, info.LastWriteTimeUtc.Ticks,
                info is FileInfo regular ? regular.Length : 0, info.Attributes);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or System.Security.SecurityException)
        { return null; }
    }
}