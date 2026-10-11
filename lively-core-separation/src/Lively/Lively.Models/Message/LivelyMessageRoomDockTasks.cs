using System;

namespace Lively.Models.Message
{
    // Core -> owned Dock Player only; display data, never an action capability.
    public sealed class LivelyMessageRoomDockTasks : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public bool ActionsEnabled { get; set; } // False until Core native completion route is connected.
        public string SnapshotJson { get; set; }
        public LivelyMessageRoomDockTasks() : base(MessageType.cmd_room_dock_tasks) { }
    }
}
