using System;

namespace Lively.Models.Message
{
    public sealed class LivelyRoomRuntimeResource
    {
        public string Path { get; set; }
        public string Sha256 { get; set; }
        public long Size { get; set; }
    }
    public sealed class LivelyMessageRoomRuntime : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public string RoomId { get; set; }
        public string InstallationStamp { get; set; }
        // A raw JSON string intentionally crosses System.Text.Json -> Json.NET.
        public string ViewKind { get; set; } = "desktop";
        public string ManifestJson { get; set; }
        public LivelyRoomRuntimeResource[] Resources { get; set; }
        public LivelyMessageRoomRuntime() : base(MessageType.cmd_room_runtime) { }
    }
    public sealed class LivelyMessageRoomRuntimeRevoke : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public string RoomId { get; set; }
        public string InstallationStamp { get; set; }
        public string Reason { get; set; } = "invalidated";
        public LivelyMessageRoomRuntimeRevoke() : base(MessageType.cmd_room_runtime_revoke) { }
    }
}
