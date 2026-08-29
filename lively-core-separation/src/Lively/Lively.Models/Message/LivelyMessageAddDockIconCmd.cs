using System;

namespace Lively.Models.Message
{
    /// <summary>
    /// Wallpaper requests adding a desktop icon to the current desk Dock.
    /// </summary>
    public class LivelyMessageAddDockIconCmd : IpcMessage
    {
        public string Scope { get; set; }
        public int DeskIndex { get; set; }
        public string Label { get; set; }
        public string IconPng { get; set; }
        public string Glyph { get; set; }
        public string Color { get; set; }
        public string Action { get; set; }
        public string LaunchTarget { get; set; }
        public string LaunchArgs { get; set; }
        public string LaunchWorkdir { get; set; }

        public LivelyMessageAddDockIconCmd() : base(MessageType.msg_add_dock_icon)
        {
        }
    }
}
