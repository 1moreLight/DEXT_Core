using System;
namespace Lively.Models.Message
{
    public sealed class LivelyRoomNativeButton
    {
        public string Consumer { get; set; }
        public string Button { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public int TabIndex { get; set; }
    }
    public sealed class LivelyRoomNativeNavigation
    {
        public string Type { get; set; }
        public string DeskId { get; set; }
    }
    public sealed class LivelyRoomNativeLayoutChange
    {
        public string Kind { get; set; }
        public string Id { get; set; }
        public string DeskId { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
    }
    public sealed class LivelyMessageRoomNativeRequest : IpcMessage
    {
        public int ProtocolVersion { get; set; } = 1;
        public string RequestId { get; set; }
        public string Method { get; set; }
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public long LayoutRevision { get; set; }
        public LivelyRoomNativeLayoutChange LayoutChange { get; set; }
        public long GeometryVersion { get; set; }
        public long InputSequence { get; set; }
        public LivelyRoomNativeNavigation Action { get; set; }
        public string MediaAction { get; set; }
        public double? Volume { get; set; }
        public bool? Muted { get; set; }
        public long LifecycleRevision { get; set; }
        public string Consumer { get; set; }
        public string Capability { get; set; }
        public string Key { get; set; }
        public string ValueJson { get; set; }
        public string Button { get; set; }
        public int PixelWidth { get; set; }
        public int PixelHeight { get; set; }
        public LivelyRoomNativeButton[] Buttons { get; set; }
        public LivelyMessageRoomNativeRequest() : base(MessageType.msg_room_native_request) { }
    }
    public sealed class LivelyMessageRoomNativeResponse : IpcMessage
    {
        public string Method { get; set; }
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public string PayloadJson { get; set; }
        public LivelyMessageRoomNativeResponse() : base(MessageType.cmd_room_native_response) { }
    }
    public sealed class LivelyMessageRoomNativeInvalidated : IpcMessage
    {
        public long RuntimeGeneration { get; set; }
        public LivelyMessageRoomNativeInvalidated() : base(MessageType.msg_room_native_invalidated) { }
    }
}
