using System;

namespace Lively.Models.Message
{
    /// <summary>
    /// Core reports whether an application launch target is currently running.
    /// Runtime-only telemetry; it is never persisted in room.json.
    /// </summary>
    public class LivelyMessageAppStatus : IpcMessage
    {
        public string Target { get; set; }
        public bool Running { get; set; }

        public LivelyMessageAppStatus() : base(MessageType.msg_app_status)
        {
        }
    }
}
