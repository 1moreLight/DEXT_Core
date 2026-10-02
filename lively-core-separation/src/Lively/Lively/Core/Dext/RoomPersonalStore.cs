using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32.SafeHandles;

namespace Dext.Core.Rooms;

internal sealed record PersonalTarget(string Name, string Kind, string Target, string Arguments = "", string WorkingDirectory = "");
internal sealed record PersonalButtonOverride(string? Action = null, string? DeskId = null, string? TargetId = null, string? Skin = null);
internal sealed record RoomCapabilityGrant(string InstallationStamp, string[] Capabilities);
internal sealed class RoomPersonalData
{
    public Dictionary<string, PersonalButtonOverride> Buttons { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, RoomCapabilityGrant> Grants { get; set; } = new(StringComparer.Ordinal);
}
internal sealed class RoomPersonalState
{
    public int FormatVersion { get; set; } = 1;
    public long Revision { get; set; }
    public Dictionary<string, PersonalTarget> Targets { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, RoomPersonalData> Rooms { get; set; } = new(StringComparer.Ordinal);
}

// Core-owned state, never returned through an authored-page API. All edits
// publish a complete validated snapshot, leaving prior bytes on failure.
internal sealed class RoomPersonalStore
{
    private const int Limit = 1048576;
    private readonly object gate = new();
    private readonly string directory;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };
    internal static readonly string[] CapabilityNames = { "desk.read", "desk.navigate", "time.read", "hardware.read", "media.read",
        "media.control", "audio.read", "audio.control", "storage.read", "storage.write", "binding.launch", "dext.exit" };
    internal static readonly string[] ActionNames = { "desk.next", "desk.previous", "desk.go", "binding.launch", "dext.exit" };

    public RoomPersonalStore(string directory)
    {
        this.directory = Path.GetFullPath(directory);
        Directory.CreateDirectory(this.directory);
        using var retained = RoomV3Installation.RetainDirectory(this.directory);
    }
    public RoomPersonalState Read() { lock (gate) return ReadState(); }
    // Callback only validates detached state and prepares an immutable action.
    // It must not launch, publish observations or edit personal data.
    internal T ReadForDispatch<T>(Func<RoomPersonalState, T> prepare)
    { lock (gate) return prepare(ReadState()); }
    public void Update(Action<RoomPersonalState> edit)
    {
        ArgumentNullException.ThrowIfNull(edit);
        lock (gate)
        {
            using var retained = RoomV3Installation.RetainDirectory(directory);
            var state = ReadState(); var revision = state.Revision;
            edit(state);
            state.Revision = checked(revision + 1);
            Validate(state);
            var bytes = JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions);
            Require(bytes.Length <= Limit, "personal data quota");
            Publish(bytes);
        }
    }
    public void CopyRoom(string sourceId, string newId)
    {
        Uuid(sourceId); Uuid(newId);
        Update(s =>
        {
            Require(sourceId != newId && !s.Rooms.ContainsKey(newId), "copy must have a new identity");
            var copy = new RoomPersonalData();
            if (s.Rooms.TryGetValue(sourceId, out var source))
                foreach (var (id, button) in source.Buttons) copy.Buttons.Add(id, button);
            s.Rooms.Add(newId, copy); // Permission is never inherited by a new Room copy.
        });
    }
    public void DeleteRoom(string roomId) { Uuid(roomId); Update(s => s.Rooms.Remove(roomId)); }

    private RoomPersonalState ReadState()
    {
        using var retained = RoomV3Installation.RetainDirectory(directory);
        RoomV3Installation.ResourceReader reader;
        try { reader = RoomV3Installation.OpenResource(directory, "personal.json"); }
        catch (IOException e) when (e.InnerException is System.ComponentModel.Win32Exception native && native.NativeErrorCode == 2)
        { return new RoomPersonalState(); }
        using (reader)
        {
            Require(reader.Stream.Length is > 0 and <= Limit, "personal document size");
            using var buffer = new MemoryStream(); var chunk = new byte[65536]; int count;
            while ((count = reader.Stream.Read(chunk)) != 0)
            { Require(buffer.Length + count <= Limit, "personal document grew"); buffer.Write(chunk, 0, count); }
            var bytes = buffer.ToArray();
            using var document = JsonDocument.Parse(bytes);
            RoomV3Installation.CheckUniqueJson(document.RootElement);
            Require(document.RootElement.ValueKind == JsonValueKind.Object &&
                new[] { "formatVersion", "revision", "targets", "rooms" }.All(p => document.RootElement.TryGetProperty(p, out _)), "missing personal fields");
            var state = JsonSerializer.Deserialize<RoomPersonalState>(bytes, JsonOptions);
            Require(state is not null, "personal state required"); Validate(state!); return state!;
        }
    }

    private static void Validate(RoomPersonalState state)
    {
        Require(state.FormatVersion == 1 && state.Revision >= 0 && state.Targets is not null && state.Rooms is not null, "personal shape/version");
        Require(state.Targets!.Count <= 4096 && state.Rooms!.Count <= 4096, "personal count");
        foreach (var (id, target) in state.Targets)
        {
            Uuid(id); Require(target is not null, "target required");
            Text(target!.Name, 256, true); Text(target.Target, 4096, true); Text(target.Arguments, 8192); Text(target.WorkingDirectory, 4096);
            Require(target.Kind is "application" or "file" or "url", "target kind");
            if (target.Kind == "url")
                Require(Uri.TryCreate(target.Target, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http", "target URL");
            else Require(Path.IsPathFullyQualified(target.Target), "target path");
            Require(target.WorkingDirectory.Length == 0 || Path.IsPathFullyQualified(target.WorkingDirectory), "working directory");
            Require(target.Kind == "application" || (target.Arguments.Length == 0 && target.WorkingDirectory.Length == 0), "non-application parameters");
        }
        foreach (var (roomId, room) in state.Rooms)
        {
            Uuid(roomId); Require(room is not null && room.Buttons is not null && room.Grants is not null, "Room personal shape");
            Require(room!.Buttons.Count <= 1024 && room.Grants.Count <= 130, "Room personal count");
            foreach (var (id, button) in room.Buttons)
            {
                Id(id); Require(button is not null, "button override");
                Require(button!.Action is null || ActionNames.Contains(button.Action, StringComparer.Ordinal), "action override");
                if (button.DeskId is not null) Id(button.DeskId);
                if (button.TargetId is not null) Uuid(button.TargetId);
                if (button.Skin is not null) Id(button.Skin);
                Require(button.Action != "desk.go" || button.DeskId is not null, "desk.go target");
                Require(button.DeskId is null || button.Action == "desk.go", "unexpected Desk target");
            }
            foreach (var (id, grant) in room.Grants)
            {
                Id(id.StartsWith("component.", StringComparison.Ordinal) ? id.Substring(10) : id); Require(grant is not null, "grant required"); Text(grant!.InstallationStamp, 128, true);
                Require(grant.Capabilities is not null && grant.Capabilities.Length <= 12 &&
                    grant.Capabilities.Distinct(StringComparer.Ordinal).Count() == grant.Capabilities.Length &&
                    grant.Capabilities.All(c => CapabilityNames.Contains(c, StringComparer.Ordinal)), "grant capabilities");
            }
        }
    }
    internal static void Id(string id) => Require(!string.IsNullOrEmpty(id) && id.Length <= 80 &&
        id.All(c => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '_' or '.' or '-'), "stable ID");
    private static void Uuid(string id) => Require(Guid.TryParseExact(id, "D", out var value) && value != Guid.Empty && value.ToString("D") == id, "canonical UUID");
    private static void Text(string text, int maximum, bool required = false) => Require(text is not null &&
        text.Length <= maximum && (!required || !string.IsNullOrWhiteSpace(text)) && !text.Contains('\0'), "personal text");
    private static void Require([DoesNotReturnIf(false)] bool value, string detail) { if (!value) throw new InvalidDataException("Invalid private Room state: " + detail); }

    [StructLayout(LayoutKind.Sequential)]
    private struct RenameInfo { public uint Replace; public IntPtr Root; public uint Length; public ushort Name; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetFileInformationByHandle(SafeFileHandle file, int kind, IntPtr info, uint length);
    private void Publish(byte[] bytes)
    {
        // A retained DELETE-capable file handle is renamed directly. No reopen
        // by mutable temporary pathname, and no unsafe Drop deletion on failure.
        var temporary = Path.Combine(directory, ".personal-" + Guid.NewGuid().ToString("N") + ".tmp");
        using var handle = CreateFileW(temporary, 0xC0010000, 0, IntPtr.Zero, 1, 0x80200000, IntPtr.Zero);
        if (handle.IsInvalid) throw NativeFailure("Cannot create private snapshot");
        using var output = new FileStream(handle, FileAccess.ReadWrite);
        output.Write(bytes); output.Flush(true);
        var name = Encoding.Unicode.GetBytes(Path.Combine(directory, "personal.json"));
        var offset = Marshal.OffsetOf<RenameInfo>(nameof(RenameInfo.Name)).ToInt32();
        var size = checked(offset + name.Length + 2); var memory = Marshal.AllocHGlobal(size);
        try
        {
            for (var i = 0; i < size; i++) Marshal.WriteByte(memory, i, 0);
            Marshal.WriteInt32(memory, 1);
            Marshal.WriteInt32(memory, Marshal.OffsetOf<RenameInfo>(nameof(RenameInfo.Length)).ToInt32(), name.Length);
            Marshal.Copy(name, 0, IntPtr.Add(memory, offset), name.Length);
            if (!SetFileInformationByHandle(handle, 3, memory, (uint)size)) throw NativeFailure("Cannot publish private snapshot");
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
    private static IOException NativeFailure(string detail) => new(detail, new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
}
