using System;
namespace Lively.Models.Message
{
    public sealed class LivelyMessageRoomDockTouch : IpcMessage
    {
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public Guid DocumentNonce { get; set; }
        public long Sequence { get; set; }
        public int PointerId { get; set; }
        public string Kind { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public long IssuedAt { get; set; }
        public long WindowHwnd { get; set; }
        public LivelyMessageRoomDockTouch() : base(MessageType.msg_room_dock_touch) { }
    }
}
