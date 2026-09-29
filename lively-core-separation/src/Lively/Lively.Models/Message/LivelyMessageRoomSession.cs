using System;

namespace Lively.Models.Message
{
    public sealed class LivelyMessageRoomSessionSnapshot : IpcMessage
    {
        public int ProtocolVersion { get; set; }
        public Guid SessionId { get; set; }
        public string RoomId { get; set; }
        public string[] DeskIds { get; set; }
        public string CurrentDeskId { get; set; }
        public string TargetDeskId { get; set; }
        public Guid? TransitionId { get; set; }
        public long Revision { get; set; }
        public bool IsOperable { get; set; }

        public LivelyMessageRoomSessionSnapshot() : base(MessageType.cmd_room_session_snapshot) { }
    }

    public sealed class LivelyMessageRoomSessionRequest : IpcMessage
    {
        public Guid SessionId { get; set; }
        public string DeskId { get; set; }

        public LivelyMessageRoomSessionRequest() : base(MessageType.msg_room_session_request) { }
    }

    public sealed class LivelyMessageRoomTransitionComplete : IpcMessage
    {
        public Guid SessionId { get; set; }
        public Guid TransitionId { get; set; }

        public LivelyMessageRoomTransitionComplete() : base(MessageType.msg_room_transition_complete) { }
    }

    public sealed class LivelyMessageRoomSessionReady : IpcMessage
    {
        public LivelyMessageRoomSessionReady() : base(MessageType.msg_room_session_ready) { }
    }
}
