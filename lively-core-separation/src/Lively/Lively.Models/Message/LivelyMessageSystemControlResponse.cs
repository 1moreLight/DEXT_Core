namespace Lively.Models.Message
{
    public class LivelyMessageSystemControlResponse : IpcMessage
    {
        public string RequestId { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }
        public bool UserVisible { get; set; }
        public bool HasVolume { get; set; }
        public double Level { get; set; }
        public bool Muted { get; set; }
        public string PermissionsJson { get; set; }

        public LivelyMessageSystemControlResponse() : base(MessageType.cmd_system_control_response)
        {
        }
    }
}
