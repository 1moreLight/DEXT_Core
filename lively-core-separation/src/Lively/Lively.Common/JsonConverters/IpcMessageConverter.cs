using System;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Lively.Common.JsonConverters
{
    public class IpcMessageConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return objectType == typeof(IpcMessage);
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            JObject jo = JObject.Load(reader);
            return (MessageType)jo["Type"].Value<int>() switch
            {
                MessageType.cmd_reload => jo.ToObject<LivelyReloadCmd>(serializer),
                MessageType.cmd_close => jo.ToObject<LivelyCloseCmd>(serializer),
                MessageType.cmd_screenshot => jo.ToObject<LivelyScreenshotCmd>(serializer),
                MessageType.cmd_suspend => jo.ToObject<LivelySuspendCmd>(serializer),
                MessageType.cmd_resume => jo.ToObject<LivelyResumeCmd>(serializer),
                MessageType.cmd_volume => jo.ToObject<LivelyVolumeCmd>(serializer),
                MessageType.lsp_perfcntr => jo.ToObject<LivelySystemInformation>(serializer),
                MessageType.lsp_nowplaying => jo.ToObject<LivelySystemNowPlaying>(serializer),
                MessageType.lp_slider => jo.ToObject<LivelySlider>(serializer),
                MessageType.lp_textbox => jo.ToObject<LivelyTextBox>(serializer),
                MessageType.lp_dropdown => jo.ToObject<LivelyDropdown>(serializer),
                MessageType.lp_fdropdown => jo.ToObject<LivelyFolderDropdown>(serializer),
                MessageType.lp_button => jo.ToObject<LivelyButton>(serializer),
                MessageType.lp_cpicker => jo.ToObject<LivelyColorPicker>(serializer),
                MessageType.lp_chekbox => jo.ToObject<LivelyCheckbox>(serializer),
                MessageType.msg_console => jo.ToObject<LivelyMessageConsole>(serializer),
                MessageType.msg_hwnd => jo.ToObject<LivelyMessageHwnd>(serializer),
                MessageType.msg_screenshot => jo.ToObject<LivelyMessageScreenshot>(serializer),
                MessageType.msg_wploaded => jo.ToObject<LivelyMessageWallpaperLoaded>(serializer),
                MessageType.msg_launch => jo.ToObject<LivelyMessageLaunchCmd>(serializer),
                MessageType.msg_save_room => jo.ToObject<LivelyMessageSaveRoomCmd>(serializer),
                MessageType.msg_add_dock_icon => jo.ToObject<LivelyMessageAddDockIconCmd>(serializer),
                MessageType.msg_app_status => jo.ToObject<LivelyMessageAppStatus>(serializer),
                MessageType.msg_system_control_request => jo.ToObject<LivelyMessageSystemControlRequest>(serializer),
                MessageType.cmd_system_control_response => jo.ToObject<LivelyMessageSystemControlResponse>(serializer),
                MessageType.cmd_room_layout_sync => jo.ToObject<LivelyMessageRoomLayoutSyncCmd>(serializer),
                MessageType.cmd_desktop_icon_preferences => jo.ToObject<LivelyMessageDesktopIconPreferencesCmd>(serializer),
                MessageType.cmd_save_room_result => jo.ToObject<LivelyMessageRoomSaveResultCmd>(serializer),
                MessageType.cmd_room_session_snapshot => jo.ToObject<LivelyMessageRoomSessionSnapshot>(serializer),
                MessageType.msg_room_session_request => jo.ToObject<LivelyMessageRoomSessionRequest>(serializer),
                MessageType.msg_room_transition_complete => jo.ToObject<LivelyMessageRoomTransitionComplete>(serializer),
                MessageType.msg_room_session_ready => jo.ToObject<LivelyMessageRoomSessionReady>(serializer),
                MessageType.cmd_room_runtime => jo.ToObject<LivelyMessageRoomRuntime>(serializer),
                MessageType.cmd_room_runtime_revoke => jo.ToObject<LivelyMessageRoomRuntimeRevoke>(serializer),
                MessageType.msg_room_native_request => jo.ToObject<LivelyMessageRoomNativeRequest>(serializer),
                MessageType.cmd_room_native_response => jo.ToObject<LivelyMessageRoomNativeResponse>(serializer),
                MessageType.msg_room_native_invalidated => jo.ToObject<LivelyMessageRoomNativeInvalidated>(serializer),
                MessageType.cmd_room_native_pointer => jo.ToObject<LivelyMessageRoomNativePointer>(serializer),
                MessageType.msg_room_native_sample => jo.ToObject<LivelyMessageRoomNativeSample>(serializer),
                MessageType.msg_room_dock_state => jo.ToObject<LivelyMessageRoomDockState>(serializer),
                MessageType.cmd_room_dock_policy => jo.ToObject<LivelyMessageRoomDockPolicy>(serializer),
                MessageType.lp_dropdown_scaler => jo.ToObject<LivelyDropdownScaler>(serializer),
                _ => null,
            };
        }

        public override bool CanWrite
        {
            get { return false; }
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }
    }
}
