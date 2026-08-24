using System;

namespace Lively.Models.Message
{
    /// <summary>
    /// Wallpaper requests an app/file launch; handled by the core (Explorer-delegated).
    /// </summary>
    public class LivelyMessageLaunchCmd : IpcMessage
    {
        public string Target { get; set; }
        public string Arguments { get; set; }
        public string WorkingDirectory { get; set; }

        public LivelyMessageLaunchCmd() : base(MessageType.msg_launch)
        {
        }
    }
}
