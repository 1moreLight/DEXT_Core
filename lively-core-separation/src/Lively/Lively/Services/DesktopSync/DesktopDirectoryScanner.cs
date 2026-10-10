using System;
using System.Collections.Generic;
using System.Threading;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopFolder(string Source, string Path);
internal sealed record DesktopFileItem(string Id, string FullPath, string Name, string Kind, IReadOnlyList<string> Sources);
internal sealed record DesktopScanIssue(string Source, string Path, string Message);
internal sealed record DesktopScanResult(IReadOnlyList<DesktopFileItem> Items, IReadOnlyList<DesktopScanIssue> Issues, bool Truncated);

// Core-only paths. Never publish this snapshot to author content or a Room manifest.
internal static class DesktopDirectoryScanner
{
    internal static IReadOnlyList<DesktopFolder> SystemFolders() => new[]
    {
        new DesktopFolder("user", Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory, Environment.SpecialFolderOption.DoNotVerify)),
        new DesktopFolder("public", Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory, Environment.SpecialFolderOption.DoNotVerify))
    };

    // Run on a worker thread. This only reads top-level metadata; shortcut targets
    // remain unresolved so a broken shortcut still appears just as a desktop item.
    internal static DesktopScanResult Scan(IEnumerable<DesktopFolder> folders, CancellationToken cancellation = default, int maximumItems = 4096)
    {
        ArgumentNullException.ThrowIfNull(folders);
        if (maximumItems <= 0) throw new ArgumentOutOfRangeException(nameof(maximumItems));
        cancellation.ThrowIfCancellationRequested();
        var items = new Dictionary<string, DesktopFileItem>(StringComparer.OrdinalIgnoreCase);
        var issues = new List<DesktopScanIssue>();
        var truncated = false;
        foreach (var folder in folders.OrderBy(f => f.Path, StringComparer.OrdinalIgnoreCase).ThenBy(f => f.Source, StringComparer.Ordinal))
        {
            cancellation.ThrowIfCancellationRequested();
            try
            {
                if (string.IsNullOrWhiteSpace(folder.Path) || !Path.IsPathFullyQualified(folder.Path))
                    throw new IOException("System desktop folder is unavailable.");
                var root = Path.GetFullPath(folder.Path);
                foreach (var entry in Directory.EnumerateFileSystemEntries(root))
                {
                    cancellation.ThrowIfCancellationRequested();
                    try
                    {
                        var fullPath = Path.GetFullPath(entry);
                        var name = Path.GetFileName(fullPath);
                        if (name.Equals("desktop.ini", StringComparison.OrdinalIgnoreCase)) continue;
                        var attributes = File.GetAttributes(fullPath);
                        if ((attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0) continue;
                        if (items.TryGetValue(fullPath, out var previous))
                        {
                            items[fullPath] = previous with { Sources = Array.AsReadOnly(previous.Sources.Append(folder.Source).Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray()) };
                            continue;
                        }
                        if (items.Count >= maximumItems) { truncated = true; break; }
                        var extension = Path.GetExtension(name);
                        var kind = (attributes & FileAttributes.Directory) != 0 ? "folder" :
                            extension.Equals(".lnk", StringComparison.OrdinalIgnoreCase) || extension.Equals(".url", StringComparison.OrdinalIgnoreCase) ? "shortcut" : "file";
                        var id = IdentityForPath(fullPath);
                        items.Add(fullPath, new(id, fullPath, kind == "shortcut" ? Path.GetFileNameWithoutExtension(name) : name,
                            kind, Array.AsReadOnly(new[] { folder.Source })));
                    }
                    catch (Exception error) when (ReadFailure(error))
                    { issues.Add(new(folder.Source, entry, error.Message)); }
                }
            }
            catch (Exception error) when (ReadFailure(error))
            { issues.Add(new(folder.Source, folder.Path, error.Message)); }
        }
        cancellation.ThrowIfCancellationRequested();
        var ordered = items.Values.OrderBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.FullPath, StringComparer.OrdinalIgnoreCase).ToArray();
        return new(Array.AsReadOnly(ordered), issues.AsReadOnly(), truncated);
    }

    internal static string IdentityForPath(string path) => "desktop-" + Convert.ToHexString(SHA256.HashData(
        Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToUpperInvariant()))).ToLowerInvariant();

    private static bool ReadFailure(Exception error) => error is IOException or UnauthorizedAccessException or
        System.Security.SecurityException or ArgumentException or NotSupportedException;
}
