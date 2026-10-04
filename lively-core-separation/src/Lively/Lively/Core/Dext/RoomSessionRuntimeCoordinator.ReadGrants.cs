using System;
namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    public RoomReadGrantsReply GetRoomReadGrants(string roomId, string installationStamp) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomReadGrantsReply("staleSession"), (connection, peer, session) =>
            actions.GetReadGrants(connection, peer, session, roomId, installationStamp));
    public RoomReadGrantsReply SetRoomReadGrant(string roomId, string installationStamp, string consumerId, string[] capabilities, bool allow) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomReadGrantsReply("staleSession"), (connection, peer, session) =>
            actions.SetReadGrant(connection, peer, session, roomId, installationStamp, consumerId, capabilities, allow));

    private T WithCoordinatorSession<T>(string roomId, string stamp, Func<T> stale, Func<Guid, RoomSessionPeer, Guid, T> operation)
    {
        Guid session;
        lock (gate)
        {
            var snapshot = kernel.Snapshot;
            if (!activeNativeRoom || activePlayerPid <= 0 || snapshot is not { IsActive: true } ||
                snapshot.SessionId != activeSessionId || snapshot.RoomId != roomId ||
                activeInstallationStamp != stamp || snapshot.InstallationStamp != stamp)
                return stale();
            session = snapshot.SessionId;
        }
        // No personal-store operation under the coordinator's attachment lock.
        // The action authority rechecks current admission inside its own atomic edit.
        var peer = new RoomSessionPeer("core-runtime");
        var opened = gateway.Open(peer, new(1, RoomClientRole.Coordinator, roomId));
        if (opened.ConnectionId is not { } connection) return stale();
        try
        {
            if (opened.Snapshot?.SessionId != session) return stale();
            return operation(connection, peer, session);
        }
        finally { gateway.Close(connection, peer); }
    }
}
