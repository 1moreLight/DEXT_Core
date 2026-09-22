using System;

namespace Lively.Models.Message
{
    /// <summary>
    /// Wallpaper requests persisting its room.json (desktop-side edit: drag/delete icons).
    /// </summary>
    public class LivelyMessageSaveRoomCmd : IpcMessage
    {
        public string RoomJson { get; set; }
        public string RequestId { get; set; }

        public LivelyMessageSaveRoomCmd() : base(MessageType.msg_save_room)
        {
        }
    }
}
