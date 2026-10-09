using System;

namespace Lively.Models.Message
{
    // Private Core/Player messages. The author SDK never receives HWNDs or an
    // API for enabling the native input route.
    public sealed class LivelyMessageRoomDockState : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public bool RendererReady { get; set; }
        public bool WindowReady { get; set; }
        public long WindowHwnd { get; set; }
        public bool Visible { get; set; }
        public bool Keyboard { get; set; }
        public bool Fullscreen { get; set; }
        public bool Locked { get; set; }
        public int HeightDip { get; set; }
        public string Mode { get; set; } = "autohide";
        public bool AppBarRegistered { get; set; }
        public bool AppBarReady { get; set; }
        public LivelyMessageRoomDockState() : base(MessageType.msg_room_dock_state) { }
    }

    public sealed class LivelyMessageRoomDockPolicy : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public bool InputConnected { get; set; }
        public bool LeaveKeyboard { get; set; }
        public bool RefreshGeometry { get; set; }
        public LivelyMessageRoomDockPolicy() : base(MessageType.cmd_room_dock_policy) { }
    }
}
