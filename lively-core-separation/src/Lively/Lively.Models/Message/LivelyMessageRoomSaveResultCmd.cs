namespace Lively.Models.Message
{
    public class LivelyMessageRoomSaveResultCmd : IpcMessage
    {
        public string RequestId { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }

        public LivelyMessageRoomSaveResultCmd() : base(MessageType.cmd_save_room_result)
        {
        }
    }
}
