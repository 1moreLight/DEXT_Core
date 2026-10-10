using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Threading;

namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private readonly object nativeDockInputGate = new();
        private bool nativeDockRouteConnected, nativeDockMouseOwned, nativeDockPointerInside, nativeDockGeometryRefreshPending;
        private long nativeDockPolicyGeneration, nativeDockPolicyRevision;
        private Guid nativeDockPolicySession;
        private readonly HashSet<int> nativeDockKeysHeld = new();
        private readonly HashSet<int> nativeDockKeysOwned = new();

        [DllImport("user32.dll", EntryPoint = "WindowFromPoint")]
        private static extern IntPtr DockWindowFromPoint(NativeMethods.POINT point);

        private bool NativeDockAvailable()
        {
            var window = RoomDockWindowState;
            var snapshot = Volatile.Read(ref roomNativeAttachment)?.Input.State;
            return nativeDock && Volatile.Read(ref nativeDockRouteConnected) &&
                window is { WindowReady: true, Visible: true, Locked: false, Fullscreen: false } &&
                snapshot != null && NativeMethods.IsWindowVisible(Handle);
        }

        private bool NativeDockForeground() => NativeDockAvailable() &&
            NativeMethods.GetAncestor(NativeMethods.GetForegroundWindow(), NativeMethods.GetAncestorFlags.GetRoot) == Handle;

        private bool NativeDockAt(int x, int y) => NativeDockAvailable() &&
            NativeMethods.GetAncestor(DockWindowFromPoint(new NativeMethods.POINT { X = x, Y = y }),
                NativeMethods.GetAncestorFlags.GetRoot) == Handle;

        private bool NativeDockInputAvailable()
        {
            if (!NativeDockAvailable()) return false;
            if (NativeDockTouchAvailable()) return true;
            var window = RoomDockWindowState;
            if (window?.Keyboard == true && NativeDockForeground()) return true;
            return NativeMethods.GetCursorPos(out NativeMethods.POINT pointer) && NativeDockAt(pointer.X, pointer.Y);
        }

        internal void ConnectNativeDockInput()
        {
            if (!nativeDock || IsExited) return;
            NativeInputIsForeground = NativeDockInputAvailable;
            Volatile.Write(ref nativeDockRouteConnected, true);
            var current = Volatile.Read(ref roomNativeAttachment)?.Input.State;
            if (current == null) return;
            lock (nativeDockInputGate)
            {
                if (nativeDockPolicyGeneration == current.Generation && nativeDockPolicySession == current.Session &&
                    nativeDockPolicyRevision == current.Revision) return;
                nativeDockPolicyGeneration = current.Generation;
                nativeDockPolicySession = current.Session;
                nativeDockPolicyRevision = current.Revision;
            }
            SendNativeDockPolicy(true);
        }

        internal void DisconnectNativeDockInput()
        {
            CancelNativeDockTouch();
            Volatile.Write(ref nativeDockRouteConnected, false);
            NativeInputIsForeground = null;
            nativeDockMouseOwned = nativeDockPointerInside = false;
            NativeMouseMove(0, 0, false);
        }

        internal void RouteNativeDockMouse(int x, int y, string edge, bool blocked)
        {
            if (!nativeDock || !Volatile.Read(ref nativeDockRouteConnected)) return;
            if (dockTouchContact != null)
            {
                if (!NativeDockTouchAvailable()) CancelNativeDockTouch();
                else if (edge == "down") { var released = dockTouchContact.Released; CancelNativeDockTouch(); if (!released) return; }
                else return;
            }
            var inside = !blocked && NativeDockAt(x, y);
            if(edge=="down"||edge=="up")Logger.Debug($"Dock raw edge={edge} inside={inside} blocked={blocked} available={NativeDockAvailable()} owned={nativeDockMouseOwned}");
            if (edge == "down")
            {
                // Outside presses must not clear an idle Dock's current geometry.
                if (!inside && !nativeDockMouseOwned) return;
                nativeDockMouseOwned = inside;
                NativeMouseDown(x, y, inside);
            }
            else if (edge == "up")
            {
                if (!nativeDockMouseOwned) return;
                nativeDockMouseOwned = false;
                NativeMouseUp(x, y, inside);
            }
            else if (edge == "move")
            {
                if (nativeDockMouseOwned)
                {
                    NativeMouseMove(x, y, inside);
                    if (!inside) nativeDockGeometryRefreshPending = true;
                }
                if (inside && !nativeDockPointerInside) nativeDockGeometryRefreshPending = true;
                var input = Volatile.Read(ref roomNativeAttachment)?.Input.State;
                if (inside && nativeDockGeometryRefreshPending && !nativeDockMouseOwned &&
                    !InputUtil.IsPrimaryMouseButtonDown && nativeDockKeysOwned.Count == 0 &&
                    (input?.Gesture == null || input.Completed?.IsConsumed == true))
                {
                    nativeDockGeometryRefreshPending = false;
                    SendNativeDockPolicy(true, refreshGeometry: true);
                }
                nativeDockPointerInside = inside;
            }
        }

        internal void RouteNativeDockKey(int key, bool down, bool reverse, int scanCode, bool extended, bool blocked)
        {
            if (!nativeDock || !Volatile.Read(ref nativeDockRouteConnected)) return;
            var window = RoomDockWindowState;
            var keyboard = !blocked && window?.Keyboard == true && NativeDockForeground();
            if (key == 27 && down && keyboard)
            {
                NativeMouseMove(0, 0, false);
                SendNativeDockPolicy(true, leaveKeyboard: true, refreshGeometry: true);
                return;
            }
            if (key != 9 && key != 13 && key != 32) return;
            // Observe every raw edge locally, but do not invalidate idle Dock
            // geometry when the user types in another app. A key held before
            // keyboard entry is ignored until its real UP.
            if (down)
            {
                if (!nativeDockKeysHeld.Add(key)) return;
                if (!keyboard) return;
                nativeDockKeysOwned.Add(key);
            }
            else
            {
                nativeDockKeysHeld.Remove(key);
                if (!nativeDockKeysOwned.Remove(key)) return;
            }
            NativeKey(key, down, reverse, keyboard, scanCode, extended);
        }
    }
}