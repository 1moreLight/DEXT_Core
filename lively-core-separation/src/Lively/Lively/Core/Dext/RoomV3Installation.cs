using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Dext.Core.Rooms;

// Independent admission of native authored bytes; integrity is not a script grant.
internal static class RoomV3Installation
{
    private const long ResourceLimit = 1L << 30;
    private static readonly string[] Capabilities = { "desk.read", "desk.navigate", "time.read", "hardware.read", "media.read",
        "media.control", "audio.read", "audio.control", "storage.read", "storage.write", "binding.launch", "dext.exit" };

    public static VerifiedRoomInstallation Verify(string directory)
    {
        directory = Path.GetFullPath(directory);
        Inspect(directory, true);
        var manifestBytes = ReadBounded(directory, "room.json", 1048576);
        var snapshotBytes = ReadBounded(directory, "installation.json", 2097152);
        using var manifest = JsonDocument.Parse(manifestBytes);
        using var snapshot = JsonDocument.Parse(snapshotBytes);
        var room = manifest.RootElement;
        UniqueProperties(room);
        var paths = ValidateManifest(room);
        var installed = snapshot.RootElement;
        Fields(installed, "formatVersion roomId manifestSha256 resources");
        Require(Integer(installed, "formatVersion") == 1 && Text(installed, "roomId") == Text(room, "id"), "installation identity");
        Require(Text(installed, "manifestSha256") == Hash(manifestBytes), "manifest digest");
        var records = Array(installed, "resources", 4096);
        Require(records.Length == paths.Count, "resource count");
        var sortedPaths = paths.OrderBy(p => p, Comparer<string>.Create((a,b) =>
            Encoding.UTF8.GetBytes(a).AsSpan().SequenceCompareTo(Encoding.UTF8.GetBytes(b)))).ToArray();
        long total = 0;
        for (var i = 0; i < records.Length; i++)
        {
            Fields(records[i], "path sha256 size");
            var path = Text(records[i], "path");
            Require(path == sortedPaths[i], "resource order");
            var (hash, size) = HashFile(directory, path);
            Require(hash == Text(records[i], "sha256") && size == Integer(records[i], "size"), "resource digest");
            total += size; Require(total <= 2 * ResourceLimit, "installation size");
        }
        var actual = new HashSet<string>(StringComparer.Ordinal);
        var entries = 0;
        Inventory(directory, directory, actual, ref entries, 0);
        paths.UnionWith(new[] { "room.json", "installation.json" });
        Require(actual.SetEquals(paths), "undeclared or missing resources");
        var stamp = Hash(Encoding.UTF8.GetBytes(directory.TrimEnd(Path.DirectorySeparatorChar).ToUpperInvariant() + "|" + Hash(snapshotBytes)));
        return new VerifiedRoomInstallation(Text(room, "id"), stamp,
            Array(room, "desks", 64).Select(d => Text(d, "id")).ToArray(), Text(room, "startDesk"), RoomActionCatalog.FromVerifiedManifest(room),
            RoomRuntimeContext.FromVerifiedManifest(room, installed.GetProperty("resources"), stamp));
    }

    private static HashSet<string> ValidateManifest(JsonElement room)
    {
        Fields(room, "version apiVersion id name startDesk desks resources roomScene start idle transition components buttons dockComponentId");
        Require(Integer(room, "version") == 3 && Integer(room, "apiVersion") == 1, "Room version");
        Require(Guid.TryParseExact(Text(room, "id"), "D", out var uuid) && uuid != Guid.Empty, "Room UUID");
        Name(Text(room, "name"));
        var paths = new HashSet<string>(StringComparer.Ordinal);
        var insensitive = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in Array(room, "resources", 4096))
        {
            var path = item.GetString() ?? throw Invalid("resource path"); ResourcePath(path);
            Require(paths.Add(path) && insensitive.Add(path), "duplicate resource");
        }
        void Entry(string path, bool html = false) => Require(paths.Contains(path) &&
            (!html || path.EndsWith(".html", StringComparison.Ordinal)), "undeclared entry");
        void Content(JsonElement value)
        {
            Fields(value, "type src capabilities buttonIds"); var src = Text(value, "src"); Entry(src);
            ValidateCapabilities(value);
            var ext = Path.GetExtension(src).ToLowerInvariant();
            Require(Text(value, "type") switch {
                "html" => ext == ".html", "gif" => ext == ".gif", "video" => ext is ".mp4" or ".webm",
                "image" => ext is ".png" or ".jpg" or ".jpeg" or ".webp" or ".svg" or ".avif" or ".gif", _ => false
            }, "content type");
        }
        var desks = Array(room, "desks", 64); Require(desks.Length > 0, "empty Desks");
        var deskIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var desk in desks)
        {
            Fields(desk, "id name icons components background componentOverrides");
            var id = Text(desk, "id"); Id(id); Require(deskIds.Add(id), "duplicate Desk"); Name(Text(desk, "name"));
            if (Optional(desk, "background", out var background)) Content(background);
        }
        Require(deskIds.Contains(Text(room, "startDesk")), "missing default Desk");
        if (Optional(room, "roomScene", out var scene))
        {
            Fields(scene, "entry capabilities config"); Entry(Text(scene, "entry"), true);
            ValidateCapabilities(scene); Config(scene);
        }
        foreach (var name in new[] { "start", "idle" }) if (Optional(room, name, out var content)) Content(content);
        if (Optional(room, "transition", out var transition))
        {
            Fields(transition, "type durationMs"); var type = Text(transition, "type");
            Require(type is "slide" or "fade" or "none" or "author", "transition type");
            Require(Integer(transition, "durationMs") is >= 0 and <= 10000, "transition duration");
            Require(type != "author" || Optional(room, "roomScene", out _), "author requires scene");
        }
        var buttons = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var button in Array(room, "buttons", 1024, true))
        {
            Fields(button, "id name scope action"); var id = Text(button, "id"); Id(id); Name(Text(button, "name"));
            var scope = Text(button, "scope"); Require(scope == "room" || deskIds.Contains(scope), "button scope");
            Require(buttons.TryAdd(id, scope), "duplicate button");
            if (Optional(button, "action", out var action))
            {
                Fields(action, "type deskId"); var type = Text(action, "type");
                Require(type is "desk.next" or "desk.previous" or "desk.go" or "binding.launch" or "dext.exit", "action type");
                Require(type == "desk.go" ? Optional(action, "deskId", out var target) && deskIds.Contains(target.GetString()!)
                    : !Optional(action, "deskId", out _), "action Desk");
            }
        }
        foreach (var name in new[] { "start", "idle" })
            if (Optional(room, name, out var content)) References(Array(content, "buttonIds", 1024, true), buttons.Keys);
        foreach (var desk in desks)
            if (Optional(desk, "background", out var content)) References(Array(content, "buttonIds", 1024, true), buttons.Keys);
        var components = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var component in Array(room, "components", 128, true))
        {
            Fields(component, "id role entry placement capabilities buttonIds config");
            var id = Text(component, "id"); Id(id); var role = Text(component, "role");
            Require(role is "widget" or "dock", "component role"); Require(components.TryAdd(id, role), "duplicate component");
            Entry(Text(component, "entry"), true); ValidateCapabilities(component); Config(component);
            var placement = component.GetProperty("placement"); Fields(placement, "x y width height");
            var x = placement.GetProperty("x").GetDouble(); var y = placement.GetProperty("y").GetDouble();
            var width = placement.GetProperty("width").GetDouble(); var height = placement.GetProperty("height").GetDouble();
            Require(double.IsFinite(x) && double.IsFinite(y) && double.IsFinite(width) && double.IsFinite(height) &&
                x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1920 && y + height <= 1080, "placement");
            References(Array(component, "buttonIds", 1024, true), buttons.Keys);
        }
        if (Optional(room, "dockComponentId", out var dock))
            Require(components.TryGetValue(dock.GetString()!, out var role) && role == "dock", "Dock component");
        var iconIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var desk in desks)
        {
            var assigned = References(Array(desk, "components", 32), components.Keys);
            if (desk.TryGetProperty("componentOverrides", out var overrides))
            {
                Require(overrides.ValueKind == JsonValueKind.Object, "component overrides");
                foreach (var prop in overrides.EnumerateObject())
                {
                    Require(assigned.Contains(prop.Name), "override reference"); PublicConfig(prop.Value, 0);
                }
            }
            foreach (var icon in Array(desk, "icons", 512))
            {
                Fields(icon, "id buttonId x y label glyph"); var id = Text(icon, "id"); Id(id);
                Require(iconIds.Add(id), "duplicate icon");
                Require(buttons.TryGetValue(Text(icon, "buttonId"), out var scope) && (scope == "room" || scope == Text(desk, "id")), "icon button scope");
                Require(Integer(icon, "x") is >= 0 and <= 63 && Integer(icon, "y") is >= 0 and <= 63, "icon coordinates");
                foreach (var (key, limit) in new[] { ("label", 160), ("glyph", 8) })
                    if (Optional(icon, key, out var text)) Require(text.ValueKind == JsonValueKind.String &&
                        text.GetString() is { } label && Characters(label) <= limit, "icon text");
            }
        }
        return paths;
    }

    private static HashSet<string> References(JsonElement[] refs, IEnumerable<string> allowed)
    {
        var valid = new HashSet<string>(allowed, StringComparer.Ordinal); var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in refs) Require(valid.Contains(item.GetString()!) && seen.Add(item.GetString()!), "duplicate or missing reference");
        return seen;
    }
    private static void ValidateCapabilities(JsonElement subject) => References(Array(subject, "capabilities", Capabilities.Length, true), Capabilities);
    private static void Config(JsonElement subject) { if (subject.TryGetProperty("config", out var config)) PublicConfig(config, 0); }
    private static void PublicConfig(JsonElement value, int depth)
    {
        Require(depth <= 12 && (depth != 0 || value.ValueKind == JsonValueKind.Object), "public config shape");
        if (value.ValueKind == JsonValueKind.Object) foreach (var prop in value.EnumerateObject())
        {
            Require(!new[] { "target", "args", "workdir", "password", "token", "secret", "bindings", "grants", "__source" }.Contains(prop.Name.ToLowerInvariant()), "private field");
            PublicConfig(prop.Value, depth + 1);
        }
        else if (value.ValueKind == JsonValueKind.Array)
        {
            Require(value.GetArrayLength() <= 256, "config array size"); foreach (var item in value.EnumerateArray()) PublicConfig(item, depth + 1);
        }
        else if (value.ValueKind == JsonValueKind.String)
        {
            var text = value.GetString()!;
            Require(Encoding.UTF8.GetByteCount(text) <= 8192 && !text.StartsWith("\\\\", StringComparison.Ordinal) &&
                !text.StartsWith("file:", StringComparison.OrdinalIgnoreCase) && !(text.Length > 2 && text[1] == ':' && char.IsAsciiLetter(text[0])), "private path");
        }
    }
    private static void ResourcePath(string path)
    {
        Require(Encoding.UTF8.GetByteCount(path) is > 0 and <= 240, "resource path length");
        foreach (var part in path.Split('/'))
        {
            Require(part.Length > 0 && part is not "." and not ".." && !part.EndsWith('.') && !part.EndsWith(' ') &&
                !part.Any(c => char.IsControl(c) || "\\:*?\"<>|%#".Contains(c)), "unsafe path");
            var stem = part.Split('.')[0].ToUpperInvariant();
            Require(stem is not "CON" and not "PRN" and not "AUX" and not "NUL" && !(stem.Length == 4 &&
                (stem.StartsWith("COM", StringComparison.Ordinal) || stem.StartsWith("LPT", StringComparison.Ordinal)) && stem[3] is >= '1' and <= '9'), "reserved path");
        }
        Require(new[] { ".html", ".css", ".js", ".mjs", ".json", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".mp4", ".webm", ".ogg", ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".otf", ".avif" }
            .Contains(Path.GetExtension(path).ToLowerInvariant()) && !new[] { "room.json", "installation.json" }.Contains(path.ToLowerInvariant()), "resource type");
    }
    private static void Id(string id) => Require(id.Length is > 0 and <= 80 && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.'), "stable ID");
    private static int Characters(string value) => value.EnumerateRunes().Count();
    private static void Name(string name) => Require(!string.IsNullOrWhiteSpace(name) && Characters(name) <= 160, "name");
    private static string Text(JsonElement value, string key) => value.GetProperty(key).GetString() ?? throw Invalid(key);
    private static long Integer(JsonElement value, string key) => value.GetProperty(key).GetInt64();
    private static bool Optional(JsonElement value, string key, out JsonElement item) => value.TryGetProperty(key, out item);
    private static void UniqueProperties(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var prop in value.EnumerateObject()) { Require(seen.Add(prop.Name), "duplicate JSON property"); UniqueProperties(prop.Value); }
        }
        else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) UniqueProperties(item);
    }
    private static JsonElement[] Array(JsonElement value, string key, int limit, bool optional = false)
    {
        if (!value.TryGetProperty(key, out var item) && optional) return System.Array.Empty<JsonElement>();
        Require(item.ValueKind == JsonValueKind.Array && item.GetArrayLength() <= limit, key); return item.EnumerateArray().ToArray();
    }
    private static void Fields(JsonElement value, string allowed)
    {
        Require(value.ValueKind == JsonValueKind.Object, "object shape"); var names = allowed.Split(' '); var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var prop in value.EnumerateObject()) Require(names.Contains(prop.Name) && seen.Add(prop.Name), "unknown/duplicate field");
    }
    private static void Inspect(string path, bool directory)
    {
        var attrs = File.GetAttributes(path); Require((attrs & FileAttributes.ReparsePoint) == 0 && ((attrs & FileAttributes.Directory) != 0) == directory, "nonlocal path");
    }
    internal sealed class ResourceReader : IDisposable
    {
        public FileStream Stream { get; }
        private readonly List<SafeFileHandle> directories;
        public ResourceReader(FileStream stream, List<SafeFileHandle> directories) { Stream = stream; this.directories = directories; }
        public void Dispose() { Stream.Dispose(); foreach (var directory in directories) directory.Dispose(); }
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct FileInformation
    {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInformation information);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint length, uint flags);
    private static string Normalize(string path)
    {
        if (path.StartsWith("\\\\?\\UNC\\", StringComparison.OrdinalIgnoreCase)) path = "\\\\" + path.Substring(8);
        else if (path.StartsWith("\\\\?\\", StringComparison.Ordinal)) path = path.Substring(4);
        return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar);
    }
    private static SafeFileHandle OpenHandle(string path, bool directory, string root)
    {
        // No delete sharing retains this exact name; read-only sharing also
        // prevents resource writes for the lifetime of its reader.
        var handle = CreateFileW(path, 0x80000000, directory ? 3u : 1u, IntPtr.Zero, 3, 0x00200000 | (directory ? 0x02000000u : 0), IntPtr.Zero);
        try
        {
            if (handle.IsInvalid) throw new IOException("Cannot lock installed path", new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
            Require(GetFileInformationByHandle(handle, out var info) && (info.Attributes & 0x400) == 0 &&
                ((info.Attributes & 0x10) != 0) == directory, "opened path type/reparse point");
            var final = new StringBuilder(32768);
            var count = GetFinalPathNameByHandleW(handle, final, (uint)final.Capacity, 0);
            Require(count > 0 && count < final.Capacity, "opened path identity");
            var resolved = Normalize(final.ToString());
            root = Normalize(root);
            Require(resolved.Equals(root, StringComparison.OrdinalIgnoreCase) ||
                resolved.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "opened path escaped root");
            return handle;
        }
        catch { handle.Dispose(); throw; }
    }
    internal static ResourceReader OpenResource(string root, string relative)
    {
        ResourcePath(relative);
        return OpenLocal(root, relative);
    }
    internal static SafeFileHandle RetainDirectory(string root) => OpenHandle(Path.GetFullPath(root), true, Path.GetFullPath(root));
    internal static void CheckUniqueJson(JsonElement value) => UniqueProperties(value);
    private static ResourceReader OpenLocal(string root, string relative)
    {
        root = Path.GetFullPath(root);
        if (!OperatingSystem.IsWindows()) throw Invalid("native installation requires Windows handle verification");
        var directories = new List<SafeFileHandle>();
        try
        {
            directories.Add(OpenHandle(root, true, root));
            var parts = relative.Split('/'); var path = root;
            for (var i = 0; i < parts.Length - 1; i++) { path = Path.Combine(path, parts[i]); directories.Add(OpenHandle(path, true, root)); }
            var handle = OpenHandle(Path.Combine(path, parts[^1]), false, root);
            try { return new ResourceReader(new FileStream(handle, FileAccess.Read), directories); }
            catch { handle.Dispose(); throw; }
        }
        catch { foreach (var directory in directories) directory.Dispose(); throw; }
    }
    private static byte[] ReadBounded(string root, string relative, int limit)
    {
        using var reader = OpenLocal(root, relative);
        var file = reader.Stream; Require(file.Length is > 0 && file.Length <= limit, "document size");
        using var buffer = new MemoryStream(); var chunk = new byte[65536]; int count;
        while ((count = file.Read(chunk)) != 0) { Require(buffer.Length + count <= limit, "document grew"); buffer.Write(chunk, 0, count); } return buffer.ToArray();
    }
    private static (string Hash, long Size) HashFile(string root, string relative)
    {
        using var reader = OpenLocal(root, relative);
        var file = reader.Stream; using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var chunk = new byte[65536]; long size = 0; int count;
        while ((count = file.Read(chunk)) != 0) { size += count; Require(size <= ResourceLimit, "resource size"); hash.AppendData(chunk, 0, count); }
        return (Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(), size);
    }
    private static void Inventory(string root, string directory, HashSet<string> files, ref int entries, int depth)
    {
        using var directoryGuard = OpenHandle(directory, true, root);
        Require(depth <= 32, "resource nesting"); foreach (var path in Directory.EnumerateFileSystemEntries(directory))
        {
            Require(++entries <= 16384, "inventory entries"); var isDirectory = (File.GetAttributes(path) & FileAttributes.Directory) != 0; Inspect(path, isDirectory);
            if (isDirectory) Inventory(root, path, files, ref entries, depth + 1);
            else Require(files.Add(Path.GetRelativePath(root, path).Replace('\\', '/')), "duplicate resource");
        }
    }
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static InvalidDataException Invalid(string message) => new($"Invalid native v3 installation: {message}");
    private static void Require(bool condition, string message) { if (!condition) throw Invalid(message); }
}
