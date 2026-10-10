using Lively.Common.Extensions;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Lively.Player.WebView2
{
    public partial class Form1
    {
        private DextDockWindowHost nativeDockWindow;
        private System.Windows.Forms.Timer nativeDockHeartbeat;
        private bool nativeDockRendererReady, nativeDockInputConnected;
        private bool nativeDockVisibilitySynchronized, nativeDockSynchronizedVisible;
        private long nativeDockStateVersion;
        private long nativeDockGeometryStarted;
        private bool nativeDockTouchTracePending;
        private string nativeDockTouchTrace;
        private Rectangle nativeDockSynchronizedBounds;
        private readonly SemaphoreSlim nativeDockStateGate = new SemaphoreSlim(1, 1);

        private void InitializeNativeDockWindow()
        {
            if (!startArgs.DextDock) return;
            if (startArgs.DextDockMode != "autohide" && startArgs.DextDockMode != "reserve")
                throw new ArgumentException("Invalid Core Dock mode.");
            BackColor = Color.Black;
            WindowState = FormWindowState.Normal;
            // The HWND stays hidden; Core admits its identity before enabling
            // input. The original primary work area is not changed by autohide.
            nativeDockWindow = new DextDockWindowHost(this, "native-dock");
            nativeDockWindow.SetAvailability(false);
            nativeDockWindow.StateChanged += _ => ObserveNativeDockWindow();
            nativeDockWindow.Failed += error =>
            {
                if (IsDisposed || Disposing) return;
                error.SendError(SendToParent, "Native Dock window failed");
                nativeDockWindow.SetAvailability(false);
                PublishNativeDockState();
                BeginInvoke((Action)(() => { if (!IsDisposed && !Disposing) Close(); }));
            };
            DextDockWindowHost.ExtendTransparentFrame(Handle);
            nativeDockHeartbeat = new System.Windows.Forms.Timer { Interval = 1000 };
            nativeDockHeartbeat.Tick += (sender, args) => { PublishNativeDockState(); _ = TraceNativeDockTouchAsync(); };
            nativeDockHeartbeat.Start();
        }

        private bool NativeDockIdentity(long generation, Guid session, long revision) =>
            startArgs.DextDock && roomRuntime.CanUseInput(generation, session, revision);

        private async Task OnNativeDockRendererReady(long generation, Guid session, long revision)
        {
            if (!NativeDockIdentity(generation, session, revision)) return;
            nativeDockRendererReady = true;
            await SynchronizeNativeDockWindow();
        }

        private async Task ApplyNativeDockPolicy(LivelyMessageRoomDockPolicy policy)
        {
            if (policy.ProtocolVersion != 1 || !NativeDockIdentity(policy.RuntimeGeneration, policy.SessionId, policy.Revision)) return;
            // Only private Core stdin sets this. Authors have no input-enable API.
            if (nativeDockInputConnected != policy.InputConnected)
            { nativeDockVisibilitySynchronized = false; nativeDockGeometryStarted = 0; }
            nativeDockInputConnected = policy.InputConnected;
            if (policy.LeaveKeyboard)
            {
                nativeDockWindow?.LeaveKeyboard(true);
                if(webView.CoreWebView2!=null&&IsOfficialDextDocument(webView.CoreWebView2.Source))
                    await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeDockKeyboardExit&&this.dextNativeDockKeyboardExit()");
            }
            await SynchronizeNativeDockWindow();
            if (policy.RefreshGeometry && nativeDockInputConnected && IsOfficialDextDocument(webView.CoreWebView2.Source))
                await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeDockRefresh&&this.dextNativeDockRefresh()");
        }

        private void ResetNativeDockDocument()
        {
            if (!startArgs.DextDock) return;
            nativeDockVisibilitySynchronized = false;
            nativeDockGeometryStarted = 0;
            nativeDockRendererReady = false;
            nativeDockInputConnected = false;
            nativeDockWindow?.SetAvailability(false);
            PublishNativeDockState();
        }

        private void ObserveNativeDockWindow()
        {
            if (IsDisposed || Disposing) return;
            if (nativeDockWindow.IsVisible != nativeDockSynchronizedVisible)
                nativeDockGeometryStarted = 0;
            else if (nativeDockVisibilitySynchronized && Bounds != nativeDockSynchronizedBounds)
                nativeDockGeometryStarted = Stopwatch.GetTimestamp();
            if (nativeDockWindow.IsVisible != nativeDockSynchronizedVisible || Bounds != nativeDockSynchronizedBounds)
            {
                if (nativeDockVisibilitySynchronized)
                    SendToParent(new LivelyMessageConsole { Category = ConsoleMessageType.log,
                        Message = "Dock synchronization invalidated previousBounds=" + nativeDockSynchronizedBounds +
                            " actualBounds=" + Bounds + " previousVisible=" + nativeDockSynchronizedVisible +
                            " state=" + JsonConvert.SerializeObject(nativeDockWindow.Snapshot()) });
                nativeDockVisibilitySynchronized = false;
            }
            PublishNativeDockState();
            _ = SynchronizeNativeDockWindow();
        }

        private async Task SynchronizeNativeDockWindow()
        {
            if (!startArgs.DextDock || nativeDockWindow == null || IsDisposed || Disposing) return;
            var version = ++nativeDockStateVersion;
            await nativeDockStateGate.WaitAsync();
            try
            {
                if (IsDisposed || Disposing || version != nativeDockStateVersion) return;
                var enabled = nativeDockRendererReady && nativeDockInputConnected;
                nativeDockWindow.SetAvailability(enabled && roomRuntime.DockCanPresent);
                if (enabled && !nativeDockWindow.IsStarted)
                    nativeDockWindow.Start(startArgs.DextDockMode == "reserve" ? DextDockWindowHost.DockMode.Reserve :
                        DextDockWindowHost.DockMode.Autohide, startArgs.DextDockHeight);
                if (!nativeDockRendererReady || roomRuntime.Generation <= 0) return;
                var visible = nativeDockWindow.IsVisible && enabled && roomRuntime.DockCanPresent;
                var bounds = Bounds;
                var identity = roomRuntime.Replay();
                var snapshot = identity.Count == 0 ? null : identity[identity.Count - 1];
                if ((string)snapshot?["type"] != "dext:v3-session") return;
                var value = new JObject
                {
                    ["runtimeGeneration"] = roomRuntime.Generation,
                    ["sessionId"] = snapshot["sessionId"], ["revision"] = snapshot["revision"], ["visible"] = visible
                };
                if (nativePointerDelivery != null && !visible) await nativePointerDelivery.InvalidateAsync();
                if (nativeFrameMedia != null) await nativeFrameMedia.SetSuspendedAsync(!visible);
                if (IsDisposed || Disposing || version != nativeDockStateVersion) return;
                await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeDockVisibility&&this.dextNativeDockVisibility(" + value.ToString(Formatting.None) + ")");
                if (version != nativeDockStateVersion) return;
                // A work-area change can move the native HWND without resizing the
                // DOM. Republish geometry so Core does not retain the old origin.
                if (visible && bounds != nativeDockSynchronizedBounds)
                    await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeDockRefresh&&this.dextNativeDockRefresh()");
                if (version != nativeDockStateVersion) return;
                nativeDockSynchronizedBounds = bounds;
                // Native show/hide of the Form does not restore the WebView2
                // controller visibility cached while its parent was hidden.
                // Publish ready only after the actual browser can receive input.
                NativeViewController().IsVisible = visible && !runtimeDeliverySuspended;
                nativeDockSynchronizedVisible = visible;
                nativeDockVisibilitySynchronized = true;
                nativeDockGeometryStarted = 0;
                PublishNativeDockState();
            }
            catch (Exception error)
            {
                if (!IsDisposed && !Disposing)
                {
                    error.SendError(SendToParent, "Native Dock visibility synchronization failed");
                    nativeDockWindow.SetAvailability(false);
                    Close();
                }
            }
            finally { nativeDockStateGate.Release(); }
        }

        private void PublishNativeDockState()
        {
            if (nativeDockWindow == null || IsDisposed || Disposing || roomRuntime.Generation <= 0) return;
            var messages = roomRuntime.Replay();
            var snapshot = messages.Count == 0 ? null : messages[messages.Count - 1];
            if ((string)snapshot?["type"] != "dext:v3-session") return;
            if (!Guid.TryParse((string)snapshot["sessionId"], out var session)) return;
            SendToParent(new LivelyMessageRoomDockState
            {
                RuntimeGeneration = roomRuntime.Generation, SessionId = session, Revision = (long)snapshot["revision"],
                RendererReady = nativeDockRendererReady,
                WindowReady = nativeDockRendererReady && nativeDockInputConnected && nativeDockWindow.IsStarted && nativeDockVisibilitySynchronized,
                GeometryUpdating = nativeDockRendererReady && nativeDockInputConnected && nativeDockWindow.IsStarted &&
                    nativeDockGeometryStarted != 0 &&
                    (Stopwatch.GetTimestamp() - nativeDockGeometryStarted) / (double)Stopwatch.Frequency < 2,
                WindowHwnd = Handle.ToInt64(), Visible = nativeDockWindow.IsVisible,
                Keyboard = nativeDockWindow.IsKeyboard, Fullscreen = nativeDockWindow.IsFullscreen,
                Locked = roomRuntime.DockLocked, HeightDip = startArgs.DextDockHeight,
                Mode = startArgs.DextDockMode, AppBarRegistered = nativeDockWindow.IsAppBarRegistered,
                AppBarReady = nativeDockWindow.IsAppBarReady
            });
        }

        private async Task TraceNativeDockTouchAsync()
        {
            if (nativeDockTouchTracePending || nativeFrameMedia == null || !nativeDockRendererReady || IsDisposed || Disposing) return;
            nativeDockTouchTracePending = true;
            try
            {
                var value = await nativeFrameMedia.ReadOfficialInputDiagnosticsAsync();
                if (value != nativeDockTouchTrace && !IsDisposed && !Disposing)
                {
                    nativeDockTouchTrace = value;
                    SendToParent(new LivelyMessageConsole { Category = ConsoleMessageType.log, Message = "Dock touch gate " + value });
                }
            }
            catch (Exception) { /* Diagnostic polling must not change input behavior during navigation/exit. */ }
            finally { nativeDockTouchTracePending = false; }
        }

        private void DisposeNativeDockWindow()
        {
            nativeDockStateVersion++;
            nativeDockHeartbeat?.Stop();
            nativeDockHeartbeat?.Dispose();
            nativeDockHeartbeat = null;
            nativeDockWindow?.Dispose();
            nativeDockWindow = null;
        }
    }
}
