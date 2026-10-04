using Dext.Core.Rooms;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using System;
using System.Threading;

namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private LivelyMessageRoomDockState roomDockWindowState;
        internal event Action RoomDockStateChanged;

        internal LivelyMessageRoomDockState RoomDockWindowState
        {
            get
            {
                var value = Volatile.Read(ref roomDockWindowState);
                var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
                return nativeDock && !IsExited && current != null && value != null &&
                    value.RuntimeGeneration == current.Generation && value.SessionId == current.Session &&
                    value.Revision == current.Revision && value.WindowHwnd == Handle.ToInt64()
                    ? value : null;
            }
        }

        private void ObserveNativeDataSnapshot(RoomNativeDataSource data, RoomSessionSnapshot snapshot, RoomClientRole role)
        {
            var window = RoomDockWindowState;
            data.ObserveSnapshot(snapshot, role == RoomClientRole.Dock, window is { WindowReady: true, Visible: true });
        }

        private void AcceptNativeDockState(LivelyMessageRoomDockState value)
        {
            var attached = Volatile.Read(ref roomNativeAttachment);
            var current = attached?.Input.State;
            if (!nativeDock || IsExited || Pid is not { } pid || value == null ||
                value.ProtocolVersion != 1 || current == null || value.RuntimeGeneration != current.Generation ||
                value.SessionId != current.Session || value.Revision != current.Revision ||
                value.WindowHwnd != Handle.ToInt64() || value.HeightDip is < 48 or > 240 ||
                value.WindowReady && !value.RendererReady || value.Keyboard && !value.Visible ||
                NativeMethods.GetWindowThreadProcessId(Handle, out int ownerPid) == 0 || ownerPid != pid)
                return;
            Volatile.Write(ref roomDockWindowState, value);
            var snapshot = attached.Bridge.Read().Snapshot;
            if (snapshot != null) attached.Data.ObserveSnapshot(snapshot, true, value.WindowReady && value.Visible);
            if (!value.WindowReady || !value.Visible || value.Locked)
                attached.Input.CheckNativeViewport(ReadNativeViewport(), false);
            RoomDockStateChanged?.Invoke();
        }

        internal void SendNativeDockPolicy(bool inputConnected, bool leaveKeyboard = false, bool refreshGeometry = false)
        {
            var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
            if (!nativeDock || current == null || IsExited) return;
            SendMessage(new LivelyMessageRoomDockPolicy
            {
                RuntimeGeneration = current.Generation, SessionId = current.Session, Revision = current.Revision,
                InputConnected = inputConnected, LeaveKeyboard = leaveKeyboard, RefreshGeometry = refreshGeometry
            });
        }
    }
}
