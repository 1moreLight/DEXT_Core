namespace Dext.Core.Rooms;
internal sealed partial class RoomSessionRuntimeCoordinator
{
    public RoomPersonalEditorReply GetRoomPersonalEditor(string roomId, string installationStamp) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomPersonalEditorReply("staleSession"),
            (connection, peer, session) => actions.GetPersonalEditor(connection, peer, session, roomId, installationStamp));
    public RoomPersonalEditorReply EditRoomPersonal(string roomId, string installationStamp, string editJson) =>
        WithCoordinatorSession(roomId, installationStamp, () => new RoomPersonalEditorReply("staleSession"),
            (connection, peer, session) => actions.EditPersonal(connection, peer, session, roomId, installationStamp, editJson));
}
