using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Dext.Core.Rooms;

public sealed record RoomDockPreferences(int SchemaVersion = 1, bool Enabled = false,
    string Mode = "autohide", int HeightDip = 128);
internal sealed record RoomDockPreferenceResult(string Status, RoomDockPreferences? Preferences, string? Message = null);

// Global user preference, deliberately outside the installed/shareable Room.
// Reads never create or reset a file; failed writes leave the confirmed bytes.
internal sealed class RoomDockPreferenceStore
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly object gate = new();
    private readonly string path;

    public RoomDockPreferenceStore(string path) { this.path = Path.GetFullPath(path); }

    public RoomDockPreferenceResult Read()
    {
        lock (gate)
        {
            try { return new("accepted", ReadUnsafe()); }
            catch (Exception error) when (StorageFailure(error))
            { return new("storageUnavailable", null, "无法读取 Dock 偏好：" + error.Message); }
        }
    }

    public RoomDockPreferenceResult Patch(string json)
    {
        lock (gate)
        {
            RoomDockPreferences current;
            try { current = ReadUnsafe(); }
            catch (Exception error) when (StorageFailure(error))
            { return new("storageUnavailable", null, "无法读取 Dock 偏好：" + error.Message); }
            RoomDockPreferences next;
            try
            {
                if (json is null || json.Length > 4096) throw new ArgumentException("Dock 偏好请求过大。");
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object) throw new ArgumentException("Dock 偏好必须是对象。");
                var names = root.EnumerateObject().Select(property => property.Name).ToArray();
                if (names.Distinct(StringComparer.Ordinal).Count() != names.Length ||
                    names.Any(name => name is not ("enabled" or "mode" or "heightDip")))
                    throw new ArgumentException("Dock 偏好包含未知或重复字段。");
                next = current with
                {
                    Enabled = root.TryGetProperty("enabled", out var enabled) ? enabled.GetBoolean() : current.Enabled,
                    Mode = root.TryGetProperty("mode", out var mode) ? mode.GetString()! : current.Mode,
                    HeightDip = root.TryGetProperty("heightDip", out var height) ? height.GetInt32() : current.HeightDip
                };
                Validate(next);
            }
            catch (Exception error) when (error is JsonException or ArgumentException or InvalidOperationException or FormatException)
            { return new("invalidRequest", current, error.Message); }
            if (next == current) return new("accepted", current);
            var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(temporary, JsonSerializer.Serialize(next, Json), new UTF8Encoding(false));
                if (File.Exists(path)) File.Replace(temporary, path, null);
                else File.Move(temporary, path);
                return new("accepted", next);
            }
            catch (Exception error) when (StorageFailure(error))
            { return new("storageUnavailable", current, "无法保存 Dock 偏好：" + error.Message); }
            finally
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); }
                catch (Exception error) when (StorageFailure(error)) { }
            }
        }
    }

    private RoomDockPreferences ReadUnsafe()
    {
        if (!File.Exists(path)) return new();
        if (new FileInfo(path).Length > 4096) throw new InvalidDataException("Dock 偏好文件过大。");
        var settings = JsonSerializer.Deserialize<RoomDockPreferences>(File.ReadAllText(path), Json)
            ?? throw new InvalidDataException("Dock 偏好文件为空。");
        try { Validate(settings); }
        catch (ArgumentException error) { throw new InvalidDataException(error.Message, error); }
        return settings;
    }

    private static void Validate(RoomDockPreferences value)
    {
        if (value.SchemaVersion != 1) throw new ArgumentException("不支持的 Dock 偏好版本。");
        if (value.Mode is not ("overlay" or "autohide" or "reserve")) throw new ArgumentException("Dock 模式必须是 overlay、autohide 或 reserve。");
        if (value.HeightDip is < 48 or > 240) throw new ArgumentException("Dock 高度必须为 48–240 DIP。");
    }

    private static bool StorageFailure(Exception error) =>
        error is IOException or UnauthorizedAccessException or JsonException or System.Security.SecurityException;
}

public sealed record RoomDockRuntimeStatus(string Phase, int PlayerPid, string? RoomId, string? DeskId,
    bool HasDock, bool AutoHideAvailable, bool ReserveAvailable, bool TaskbarReplacementReady, string? Reason,
    int? EffectiveHeightDip = null, int? DisplayDpi = null, bool HeightConstrained = false, bool AppBarOccupied = false, bool OverlayAvailable = false);
public sealed record RoomDockStatusReply(string Status, RoomDockPreferences? Preferences,
    RoomDockRuntimeStatus Runtime, string? Message = null);
