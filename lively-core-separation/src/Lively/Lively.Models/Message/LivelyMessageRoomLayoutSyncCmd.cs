namespace Lively.Models.Message
{
    /// <summary>
    /// Core delivers a validated Room layout snapshot to the official desktop host.
    /// </summary>
    public class LivelyMessageRoomLayoutSyncCmd : IpcMessage
    {
        public string RoomJson { get; set; }
        public int DeskIndex { get; set; }
        public bool EnterEdit { get; set; }
        public string HighlightTarget { get; set; }

        public LivelyMessageRoomLayoutSyncCmd() : base(MessageType.cmd_room_layout_sync)
        {
        }
    }
}
