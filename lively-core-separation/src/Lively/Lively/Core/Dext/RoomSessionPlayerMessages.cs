using System;
using System.Linq;
using Lively.Models.Message;

namespace Dext.Core.Rooms;

// One stream per attached bridge; generation allocation belongs to the Player
// lifetime, so messages from an older attachment cannot revive a new document.
internal sealed class RoomSessionPlayerMessages(Action<IpcMessage> send, Func<long> nextGeneration, string[] deskIds)
{
    private readonly object gate = new();
    private bool active;
    private long generation;
    private Guid session;
    private string? room, stamp;

    public void Initialize(RoomRuntimeContext? context, RoomSessionSnapshot snapshot)
    {
        lock (gate)
        {
            active = true; session = snapshot.SessionId; room = snapshot.RoomId; stamp = snapshot.InstallationStamp;
            generation = context is null ? 0 : nextGeneration();
            if (context is null) return;
            if (context.RoomId != room || context.InstallationStamp != stamp)
                throw new InvalidOperationException("Runtime context does not match session");
            send(new LivelyMessageRoomRuntime
            {
                RuntimeGeneration = generation, SessionId = session, RoomId = room, InstallationStamp = stamp,
                ManifestJson = context.Manifest.GetRawText(),
                Resources = context.Resources.Select(item => new LivelyRoomRuntimeResource
                { Path = item.Path, Sha256 = item.Sha256, Size = item.Size }).ToArray()
            });
        }
    }
    public void Snapshot(RoomSessionSnapshot snapshot)
    {
        lock (gate)
        {
            if (!active || snapshot.SessionId != session || snapshot.RoomId != room || snapshot.InstallationStamp != stamp) return;
            var message = RoomSessionPlayerMessage.Create(snapshot, deskIds);
            message.RuntimeGeneration = generation;
            send(message);
        }
    }
    public void Revoke()
    {
        lock (gate)
        {
            if (!active) return;
            active = false;
            if (generation > 0) send(new LivelyMessageRoomRuntimeRevoke
            { RuntimeGeneration = generation, SessionId = session, RoomId = room, InstallationStamp = stamp });
        }
    }
}
