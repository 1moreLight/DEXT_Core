using System;
namespace Lively.Models.Message
{
    public sealed class LivelyRoomNativePoint
    {
        public double X { get; set; }
        public double Y { get; set; }
    }
    public sealed class LivelyRoomNativeButton
    {
        public string Consumer { get; set; }
        public string Button { get; set; }
        public string EntryId { get; set; }
        public LivelyRoomNativePoint[][] Polygons { get; set; }
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
    // Core private transport only; this is never parsed from a web message.
    public sealed class LivelyMessageRoomNativePointer : IpcMessage
    {
        public int ProtocolVersion { get; set; }=1;
        public long RuntimeGeneration { get; set; }
        public Guid SessionId { get; set; }
        public long Revision { get; set; }
        public long GeometryVersion { get; set; }
        public long GestureId { get; set; }
        public long IssuedAt { get; set; }
        public long InputHandle { get; set; }
        public string Kind { get; set; }
        public int OriginX { get; set; }
        public int OriginY { get; set; }
        public int PixelWidth { get; set; }
        public int PixelHeight { get; set; }
        public int Dpi { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int Modifiers { get; set; }
        public int Key { get; set; }
        public int ScanCode { get; set; }
        public bool IsExtended { get; set; }
        public string Consumer { get; set; }
        public string Button { get; set; }
        public string EntryId { get; set; }
        public LivelyMessageRoomNativePointer() : base(MessageType.cmd_room_native_pointer) { }
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
        public string AuthorInstance { get; set; }
        public string SdkRequestJson { get; set; }
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
