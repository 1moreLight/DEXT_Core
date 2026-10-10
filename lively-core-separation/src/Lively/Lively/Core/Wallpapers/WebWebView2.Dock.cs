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
            {
                CancelNativeDockTouch();
                attached.Input.CheckNativeViewport(ReadNativeViewport(), false);
            }
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

        private bool NativeDockTaskPlacementReady()
        {
            if(nativeDockMode=="reserve")return NativeDockReservationReady;
            var viewport=ReadNativeViewport();
            return viewport!=null&&DextNativeInputWindow.TryReadWorkArea(Handle,out var work)&&
                viewport.X==work.Left&&viewport.Width==work.Right-work.Left&&
                viewport.Y+viewport.Height==work.Bottom;
        }
        internal bool NativeDockTaskIsCurrent(Lively.Services.ApplicationDock.DockTaskCompletion completion)
        {
            if(completion==null||IsExited||!NativeDockAvailable()||!NativeDockTaskPlacementReady())return false;
            var g=completion.Gesture;var current=Volatile.Read(ref roomNativeAttachment)?.Input.State;
            return Lively.Services.ApplicationDock.DockTaskInput.IsCurrent(completion,current,ReadNativeViewport(),TimeProvider.System)&&
                (g.Key!=0?RoomDockWindowState?.Keyboard==true&&NativeDockForeground():g.ReleaseX is int x&&g.ReleaseY is int y&&NativeDockAt(x,y));
        }
        internal void CompleteNativeDockTaskPresentation(Lively.Services.ApplicationDock.DockTaskCompletion completion)
        {
            // Keyboard completion already sends this private event. Mouse/touch
            // must not depend on a second DOM click after native sampling.
            if(completion.Gesture.Key!=0||!NativeDockTaskIsCurrent(completion)||
                completion.Action!="openWindows"&&completion.Action!="dismissMenu"&&
                completion.Action!="chooseWindow"&&completion.Action!="togglePin")return;
            var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;if(state==null)return;
            SendNative(a,state,new{type="dext:v3-native-event",kind="activate",runtimeGeneration=state.Generation,
                sessionId=state.Session,revision=state.Revision,geometryVersion=state.GeometryVersion,
                inputSequence=completion.Sequence,consumer=DextNativeTaskSample.Consumer,button=completion.ItemId,
                entryId=completion.ContextId+"/"+completion.ItemId+"/"+completion.Action+"/"+(completion.WindowId??"-")});
        }
        private string nativeDockTaskReadiness;

        internal bool SendNativeDockTasks(string expectedEpoch, string snapshotJson, Lively.Services.ApplicationDock.DockTaskViewSnapshot display, bool presentationReady)
        {
            var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
            if (current == null || expectedEpoch == null || expectedEpoch != NativeDockTaskEpoch ||
                snapshotJson == null || snapshotJson.Length > 4 * 1024 * 1024) return false;
            Volatile.Read(ref roomNativeAttachment)?.TaskKeyboard.Update(display);
            var available = NativeDockAvailable();
            var placementReady = NativeDockTaskPlacementReady();
            var readiness = $"{presentationReady}/{available}/{placementReady}";
            if (readiness != nativeDockTaskReadiness)
            {
                nativeDockTaskReadiness = readiness;
                var window = RoomDockWindowState;
                Logger.Debug($"Dock task readiness lease={presentationReady} available={available} placement={placementReady} route={Volatile.Read(ref nativeDockRouteConnected)} ready={window?.WindowReady} visible={window?.Visible} locked={window?.Locked} fullscreen={window?.Fullscreen} geometryUpdating={window?.GeometryUpdating}");
            }
            SendMessage(new LivelyMessageRoomDockTasks
            {
                RuntimeGeneration = current.Generation, SessionId = current.Session,
                Revision = current.Revision, SnapshotJson = snapshotJson,
                // Completion still validates physical input and the current task projection.
                ActionsEnabled = presentationReady && available && placementReady
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
