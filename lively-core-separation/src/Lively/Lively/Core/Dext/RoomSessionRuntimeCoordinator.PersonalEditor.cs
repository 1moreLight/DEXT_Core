namespace Dext.Core.Rooms;
public sealed record RoomPersonalLifecycleReply(string Status, string? Message = null);
internal sealed partial class RoomSessionRuntimeCoordinator
{
    // Local configurator RPC only; never forwarded into the author protocol.
    public RoomPersonalLifecycleReply CopyRoomPersonal(string sourceRoomId, string newRoomId) =>
        actions.CopyRoomPersonal(sourceRoomId, newRoomId);

    public RoomPersonalLifecycleReply DeleteRoomPersonal(string roomId, bool dryRun)
    {
        lock (gate)
            if (kernel.Snapshot is { IsActive: true } snapshot && snapshot.RoomId == roomId)
                return new("roomActive", "请先停止正在运行的 Room，再删除其个人数据。");
        return actions.DeleteRoomPersonal(roomId, dryRun);
    }

    public RoomPersonalEditorReply GetRoomPersonalEditor(string roomId, string installationStamp) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomPersonalEditorReply("staleSession"),
            (connection, peer, session) => actions.GetPersonalEditor(connection, peer, session, roomId, installationStamp));
    public RoomPersonalEditorReply EditRoomPersonal(string roomId, string installationStamp, string editJson) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomPersonalEditorReply("staleSession"),
            (connection, peer, session) => actions.EditPersonal(connection, peer, session, roomId, installationStamp, editJson));
}
