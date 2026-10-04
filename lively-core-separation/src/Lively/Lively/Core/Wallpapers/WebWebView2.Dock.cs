using Dext.Core.Rooms;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using System;
using System.Diagnostics;
using System.Threading;

namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private LivelyMessageRoomDockState roomDockWindowState;
        private long roomDockStateReceivedAt;
        internal event Action RoomDockStateChanged;
        internal bool RoomDockHeartbeatExpired => nativeDock && !IsExited &&
            Interlocked.Read(ref roomDockStateReceivedAt) > 0 &&
            (Stopwatch.GetTimestamp() - Interlocked.Read(ref roomDockStateReceivedAt)) / (double)Stopwatch.Frequency >= 5;

        internal LivelyMessageRoomDockState RoomDockWindowState
        {
            get
            {
                var value = Volatile.Read(ref roomDockWindowState);
                var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
                return nativeDock && !IsExited && current != null && value != null &&
                    (Stopwatch.GetTimestamp() - Interlocked.Read(ref roomDockStateReceivedAt)) / (double)Stopwatch.Frequency < 5 &&
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
            var previous = Volatile.Read(ref roomDockWindowState);
            var expired = (Stopwatch.GetTimestamp() - Interlocked.Read(ref roomDockStateReceivedAt)) / (double)Stopwatch.Frequency >= 5;
            Interlocked.Exchange(ref roomDockStateReceivedAt, Stopwatch.GetTimestamp());
            Volatile.Write(ref roomDockWindowState, value);
            if (!expired && previous != null && previous.RuntimeGeneration == value.RuntimeGeneration &&
                previous.SessionId == value.SessionId && previous.Revision == value.Revision &&
                previous.RendererReady == value.RendererReady && previous.WindowReady == value.WindowReady &&
                previous.WindowHwnd == value.WindowHwnd && previous.Visible == value.Visible &&
                previous.Keyboard == value.Keyboard && previous.Fullscreen == value.Fullscreen &&
                previous.Locked == value.Locked && previous.HeightDip == value.HeightDip) return;
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
