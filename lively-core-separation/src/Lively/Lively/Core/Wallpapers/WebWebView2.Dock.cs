using Dext.Core.Rooms;
using Lively.Common.Helpers.Pinvoke;
using Lively.Common.Helpers;
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

        internal bool NativeDockReservationReady
        {
            get
            {
                var state = RoomDockWindowState;
                var viewport = ReadNativeViewport();
                return nativeDockMode == "reserve" && state is { Mode: "reserve",
                    AppBarRegistered: true, AppBarReady: true } && (state.WindowReady || state.GeometryUpdating) && viewport != null &&
                    DextNativeInputWindow.TryReadWorkArea(Handle, out var work) &&
                    work.Bottom <= viewport.Y && work.Top < viewport.Y;
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
                value.Mode != nativeDockMode || value.AppBarReady && (!value.AppBarRegistered || value.Mode != "reserve") ||
                (value.WindowReady || value.GeometryUpdating) && !value.RendererReady || value.Keyboard && !value.Visible ||
                NativeMethods.GetWindowThreadProcessId(Handle, out int ownerPid) == 0 || ownerPid != pid)
                return;
            var previous = Volatile.Read(ref roomDockWindowState);
            var expired = (Stopwatch.GetTimestamp() - Interlocked.Read(ref roomDockStateReceivedAt)) / (double)Stopwatch.Frequency >= 5;
            Interlocked.Exchange(ref roomDockStateReceivedAt, Stopwatch.GetTimestamp());
            Volatile.Write(ref roomDockWindowState, value);
            if (!expired && previous != null && previous.RuntimeGeneration == value.RuntimeGeneration &&
                previous.SessionId == value.SessionId && previous.Revision == value.Revision &&
                previous.RendererReady == value.RendererReady && previous.WindowReady == value.WindowReady &&
                previous.GeometryUpdating == value.GeometryUpdating &&
                previous.WindowHwnd == value.WindowHwnd && previous.Visible == value.Visible &&
                previous.Keyboard == value.Keyboard && previous.Fullscreen == value.Fullscreen &&
                previous.Locked == value.Locked && previous.HeightDip == value.HeightDip &&
                previous.Mode == value.Mode && previous.AppBarRegistered == value.AppBarRegistered &&
                previous.AppBarReady == value.AppBarReady) return;
            var snapshot = attached.Bridge.Read().Snapshot;
            if (snapshot != null) attached.Data.ObserveSnapshot(snapshot, true, value.WindowReady && value.Visible);
            if (!value.WindowReady || !value.Visible || value.Locked)
                attached.Input.CheckNativeViewport(ReadNativeViewport(), false);
            RoomDockStateChanged?.Invoke();
        }

        // The runtime generation belongs to this exact attachment, not a process-name match.
        internal string NativeDockTaskEpoch
        {
            get
            {
                var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
                return nativeDock && !IsExited && current != null
                    ? $"{Pid}/{current.Generation}/{current.Session}" : null;
            }
        }

        internal bool NativeDockTaskIsCurrent(Lively.Services.ApplicationDock.DockTaskCompletion completion)
        {
            if(completion==null||IsExited||!NativeDockAvailable())return false;
            var g=completion.Gesture;var current=Volatile.Read(ref roomNativeAttachment)?.Input.State;
            return Lively.Services.ApplicationDock.DockTaskInput.IsCurrent(completion,current,ReadNativeViewport(),TimeProvider.System)&&
                (g.Key!=0?RoomDockWindowState?.Keyboard==true&&NativeDockForeground():g.ReleaseX is int x&&g.ReleaseY is int y&&NativeDockAt(x,y));
        }
        internal bool SendNativeDockTasks(string expectedEpoch, string snapshotJson, Lively.Services.ApplicationDock.DockTaskViewSnapshot display)
        {
            var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
            if (current == null || expectedEpoch == null || expectedEpoch != NativeDockTaskEpoch ||
                snapshotJson == null || snapshotJson.Length > 4 * 1024 * 1024) return false;
            Volatile.Read(ref roomNativeAttachment)?.TaskKeyboard.Update(display);
            SendMessage(new LivelyMessageRoomDockTasks
            {
                RuntimeGeneration = current.Generation, SessionId = current.Session,
                Revision = current.Revision, SnapshotJson = snapshotJson,
                // Completion still validates physical input and the current task projection.
                ActionsEnabled = NativeDockAvailable()
            });
            return true;
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
