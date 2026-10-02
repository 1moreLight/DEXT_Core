using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Dext.Core.Rooms;

internal sealed record RoomRuntimeResource(string Path, string Sha256, long Size);

// Public authored data for the official host, captured inside installation
// verification. This is not an author grant and contains no local target path.
internal sealed class RoomRuntimeContext
{
    public string RoomId { get; }
    public string InstallationStamp { get; }
    public JsonElement Manifest { get; }
    public IReadOnlyList<RoomRuntimeResource> Resources { get; }
    internal RoomSessionRuntimePolicy Policy { get; }

    private RoomRuntimeContext(JsonElement manifest, JsonElement inventory, string installationStamp)
    {
        RoomId = manifest.GetProperty("id").GetString()!;
        InstallationStamp = installationStamp;
        // The verifier owns and disposes both JsonDocuments. Keep our own frozen
        // value, never a filename which a later caller could read without hashing.
        Manifest = manifest.Clone();
        var duration = manifest.TryGetProperty("transition", out var transition)
            ? transition.GetProperty("durationMs").GetInt32() : 450;
        Policy = new(installationStamp, manifest.TryGetProperty("start", out _),
            TimeSpan.FromMilliseconds(Math.Max(3000, duration + 2000)));
        Resources = Array.AsReadOnly(inventory.EnumerateArray().Select(item => new RoomRuntimeResource(
            item.GetProperty("path").GetString()!, item.GetProperty("sha256").GetString()!,
            item.GetProperty("size").GetInt64())).ToArray());
    }

    internal static RoomRuntimeContext FromVerifiedManifest(JsonElement manifest,
        JsonElement inventory, string installationStamp) => new(manifest, inventory, installationStamp);
}
