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
internal sealed class InstalledRoomSessionAuthority : IRoomSessionActionAdmissionAuthority, IDisposable
{
    private readonly object gate = new();
    private readonly bool retainNativeInstallation;
    private VerifiedRoomInstallation? retainedInstallation;
    private List<IDisposable> retainedResources = new();
    public InstalledRoomSessionAuthority(bool retainNativeInstallation = false)
    { this.retainNativeInstallation = retainNativeInstallation; }
    private void ReleaseInstallation()
    {
        retainedInstallation = null;
        foreach (var resource in retainedResources) resource.Dispose();
        retainedResources.Clear();
    }
    public void Dispose()
    {
        lock (gate) { ReleaseInstallation(); packageDirectory = null; playerPid = 0; dockPid = 0; dockStamp = null; }
    }
    private string? packageDirectory;
    private int playerPid;
    private int dockPid;
    private string? dockStamp;

    public VerifiedRoomInstallation? Bind(string packageDirectory, int playerPid)
    {
        if (playerPid <= 0) return null;
        var directory = Path.GetFullPath(packageDirectory);
        var installation = ReadInstallation(directory);
        if (installation is null) return null;
        var resources = new List<IDisposable>();
        if (retainNativeInstallation && installation.RuntimeContext is { } context)
        {
            try
            {
                resources.Add(RoomV3Installation.RetainDirectory(directory));
                var root = Directory.Exists(Path.Combine(directory, "content")) ? Path.Combine(directory, "content") : directory;
                // Keep this verified inventory read-only for the bound Player lifetime.
                foreach (var path in context.Resources.Select(resource => resource.Path))
                    resources.Add(RoomV3Installation.OpenResource(root, path));
                foreach (var name in new[] { "room.json", "installation.json" })
                    resources.Add(RoomV3Installation.OpenInstallationDocument(root, name));
                var locked = ReadInstallation(directory);
                if (locked is null || locked.InstallationStamp != installation.InstallationStamp)
                    throw new InvalidDataException("Installation changed while binding");
                installation = locked;
            }
            catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException or ArgumentException)
            {
                foreach (var resource in resources) resource.Dispose();
                return null;
            }
        }
        lock (gate)
        {
            ReleaseInstallation();
            retainedResources = resources;
            retainedInstallation = resources.Count > 0 ? installation : null;
            this.packageDirectory = directory;
            this.playerPid = playerPid;
            dockPid = 0; dockStamp = null;
        }
        return installation;
    }

    public void Unbind(int playerPid)
    {
        lock (gate)
        {
            if (this.playerPid != playerPid) return;
            ReleaseInstallation();
            packageDirectory = null;
            this.playerPid = 0;
            dockPid = 0; dockStamp = null;
        }
    }

    // Only the coordinator binds a second Core-created process to the current
    // desktop installation. This binding never replaces the desktop process.
    public bool BindDock(int desktopPid, int pid, string installationStamp)
    {
        lock (gate)
        {
            if (pid <= 0 || desktopPid != playerPid || pid == playerPid ||
                packageDirectory is null || (dockPid != 0 && dockPid != pid)) return false;
            var installation = retainedInstallation ?? ReadInstallation(packageDirectory);
            if (installation?.RuntimeContext is null || installation.InstallationStamp != installationStamp) return false;
            dockPid = pid; dockStamp = installationStamp;
            return true;
        }
    }

    public void UnbindDock(int pid)
    {
        lock (gate)
        {
            if (dockPid != pid) return;
            dockPid = 0; dockStamp = null;
        }
    }

    public RoomSessionAdmission? Admit(RoomSessionPeer peer, RoomSessionHello hello)
    {
        lock (gate)
        {
            if (packageDirectory is null ||
                !((peer.TransportId == "core-runtime" && hello.Role == RoomClientRole.Coordinator) ||
                  (peer.TransportId == $"player-process:{playerPid}" &&
                   hello.Role == RoomClientRole.DesktopPlayer) ||
                  (dockPid > 0 && peer.TransportId == $"dock-process:{dockPid}" && hello.Role == RoomClientRole.Dock)))
                return null;
            var installation = retainedInstallation ?? ReadInstallation(packageDirectory);
            return installation is null || installation.RoomId != hello.RoomId ||
                (hello.Role == RoomClientRole.Dock && installation.InstallationStamp != dockStamp)
                ? null
                : new RoomSessionAdmission(peer.TransportId, hello.Role, installation);
        }
    }

    public T WithAdmission<T>(RoomSessionPeer peer, RoomSessionHello hello, Func<RoomSessionAdmission?, T> prepare)
    { lock (gate) return prepare(Admit(peer, hello)); }

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
