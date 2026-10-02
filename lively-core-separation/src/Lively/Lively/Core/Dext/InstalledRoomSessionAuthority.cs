using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Dext.Core.Rooms;

// Native v3 admission, retaining the accepted v2 development overlay until
// the complete native runtime replaces its visual host.
internal sealed class InstalledRoomSessionAuthority : IRoomSessionAdmissionAuthority
{
    private readonly object gate = new();
    private string? packageDirectory;
    private int playerPid;

    public VerifiedRoomInstallation? Bind(string packageDirectory, int playerPid)
    {
        if (playerPid <= 0) return null;
        var directory = Path.GetFullPath(packageDirectory);
        var installation = ReadInstallation(directory);
        if (installation is null) return null;
        lock (gate)
        {
            this.packageDirectory = directory;
            this.playerPid = playerPid;
        }
        return installation;
    }

    public void Unbind(int playerPid)
    {
        lock (gate)
        {
            if (this.playerPid != playerPid) return;
            packageDirectory = null;
            this.playerPid = 0;
        }
    }

    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
    {
        lock (gate)
        {
            if (packageDirectory is null ||
                !((peer.TransportId == "core-runtime" && hello.Role == RoomClientRole.Coordinator) ||
                  (peer.TransportId == $"player-process:{playerPid}" &&
                   hello.Role == RoomClientRole.DesktopPlayer)))
                return null;
            var installation = ReadInstallation(packageDirectory);
            return installation is null || installation.RoomId != hello.RoomId
                ? null
                : new RoomSessionAdmission(peer.TransportId, hello.Role, installation);
        }
    }

    private static VerifiedRoomInstallation? ReadInstallation(string directory)
    {
        try
        {
            if (Directory.Exists(Path.Combine(directory, "content")))
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) return null;
                return RoomV3Installation.Verify(Path.Combine(directory, "content"));
            }
            if (File.Exists(Path.Combine(directory, "installation.json")))
                return RoomV3Installation.Verify(directory);
            var manifestPath = Path.Combine(directory, "session.v3.json");
            var roomPath = Path.Combine(directory, "room.json");
            if (!File.Exists(manifestPath) || !File.Exists(roomPath) ||
                new FileInfo(manifestPath).Length is <= 0 or > 65536 ||
                new FileInfo(roomPath).Length is <= 0 or > 1048576)
                return null;
            var manifestBytes = File.ReadAllBytes(manifestPath);
            var roomBytes = File.ReadAllBytes(roomPath);
            using var manifest = JsonDocument.Parse(manifestBytes);
            using var room = JsonDocument.Parse(roomBytes);
            var root = manifest.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("protocolVersion", out var protocol) ||
                protocol.GetInt32() != RoomSessionKernel.ProtocolVersion ||
                !root.TryGetProperty("roomId", out var roomIdValue) ||
                !Guid.TryParse(roomIdValue.GetString(), out var roomGuid) ||
                roomGuid == Guid.Empty ||
                !root.TryGetProperty("deskIds", out var idsValue) ||
                idsValue.ValueKind != JsonValueKind.Array ||
                !root.TryGetProperty("startDeskId", out var startValue))
                return null;
            var deskIds = idsValue.EnumerateArray().Select(item => item.GetString()).ToArray();
            var startDeskId = startValue.GetString();
            var visual = room.RootElement;
            if (!visual.TryGetProperty("version", out var version) || version.GetInt32() != 2 ||
                !visual.TryGetProperty("desks", out var desks) ||
                desks.ValueKind != JsonValueKind.Array || desks.GetArrayLength() != deskIds.Length ||
                !visual.TryGetProperty("startDesk", out var startDesk) ||
                startDesk.GetInt32() != Array.IndexOf(deskIds, startDeskId))
                return null;
            // Desk layout edits update room.json while the installed session stays the same.
            // The manifest and canonical installation path define session identity.
            var stampMaterial = Encoding.UTF8.GetBytes(Path.GetFullPath(directory).ToUpperInvariant() + "|" +
                Convert.ToHexString(SHA256.HashData(manifestBytes)));
            var stamp = Convert.ToHexString(SHA256.HashData(stampMaterial));
            return new VerifiedRoomInstallation(roomGuid.ToString("D"), stamp,
                deskIds!, startDeskId!);
        }
        catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException or
            JsonException or InvalidOperationException or ArgumentException or FormatException or KeyNotFoundException or OverflowException)
        {
            return null;
        }
    }
}
