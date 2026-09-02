namespace Lively.Models.Message
{
    public class LivelyMessageSystemControlRequest : IpcMessage
    {
        public string RequestId { get; set; }
        public string Action { get; set; }
        public string Subject { get; set; }
        public double? Level { get; set; }
        public bool? Muted { get; set; }

        public LivelyMessageSystemControlRequest() : base(MessageType.msg_system_control_request)
        {
        }
    }
}
