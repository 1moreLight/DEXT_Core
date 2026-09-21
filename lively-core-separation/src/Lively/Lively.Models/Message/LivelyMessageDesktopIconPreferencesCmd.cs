namespace Lively.Models.Message
{
    /// <summary>
    /// Core delivers the complete global desktop icon preference snapshot to a trusted Dext host.
    /// </summary>
    public class LivelyMessageDesktopIconPreferencesCmd : IpcMessage
    {
        public string FeedbackStyle { get; set; }
        public bool ShowLabels { get; set; }
        public string HitTargetSize { get; set; }
        public string VisualSize { get; set; }
        public string Spacing { get; set; }

        public LivelyMessageDesktopIconPreferencesCmd() : base(MessageType.cmd_desktop_icon_preferences)
        {
        }
    }
}
