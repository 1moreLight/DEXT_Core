using System.Linq;
using Lively.Models.Message;

namespace Dext.Core.Rooms;

// One projection for production Core and the isolated native transport probe.
internal static class RoomSessionPlayerMessage
{
    internal static LivelyMessageRoomSessionSnapshot Create(RoomSessionSnapshot snapshot, string[] deskIds) => new()
    {
        ProtocolVersion = snapshot.ProtocolVersion,
        SessionId = snapshot.SessionId,
        RoomId = snapshot.RoomId,
        DeskIds = deskIds.ToArray(),
        CurrentDeskId = snapshot.CurrentDeskId,
        TargetDeskId = snapshot.TargetDeskId,
        QueuedDeskId = snapshot.QueuedDeskId,
        TransitionId = snapshot.TransitionId,
        DeadlineUtc = snapshot.DeadlineUtc,
        Revision = snapshot.Revision,
        IsOperable = snapshot.IsOperable,
        IsActive = snapshot.IsActive,
        InstallationStamp = snapshot.InstallationStamp,
        Lifecycle = new LivelyRoomSessionLifecycle
        {
            Stage = snapshot.Lifecycle.Stage.ToString().ToLowerInvariant(),
            PlaybackPaused = snapshot.Lifecycle.PlaybackPaused,
            Locked = snapshot.Lifecycle.Locked,
            Revision = snapshot.Lifecycle.Revision,
        }
    };
}
