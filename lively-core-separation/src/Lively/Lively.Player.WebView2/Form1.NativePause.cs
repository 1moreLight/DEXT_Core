using Microsoft.Web.WebView2.Core;
using Lively.Common.Extensions;
using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Lively.Player.WebView2
{

    public partial class Form1
    {
        private readonly SemaphoreSlim nativePauseRenderGate = new SemaphoreSlim(1, 1);
        private PictureBox nativePausedPicture;
        private bool nativeDesktopDropEnabled;
        private async Task UpdateNativeDropSurfaceAsync(string json)
        {
            if(startArgs.DextDock)return;
            var value=Newtonsoft.Json.Linq.JObject.Parse(json);
            if((string)value["status"]!="accepted"||value["presentation"]==null)return;
            var enabled=value["presentation"]["desktop"] is Newtonsoft.Json.Linq.JObject;
            if(enabled==nativeDesktopDropEnabled)return;
            nativeDesktopDropEnabled=enabled;
            if(isPaused)await FreezeNativeView(playbackRevision);
        }
        private void RevealDropSurface()
        {
            webView.CoreWebView2.Resume();webView.Visible=true;NativeViewController().IsVisible=true;
            if(nativePausedPicture!=null){nativePausedPicture.Visible=false;var image=nativePausedPicture.Image;nativePausedPicture.Image=null;image?.Dispose();}
        }

        // Only the trusted native Player uses this image. It stays in memory and
        // captures this WebView, never another application or the Windows desktop.
        private async Task FreezeNativeView(long revision)
        {
            await nativePauseRenderGate.WaitAsync();
            try
            {
                if (IsDisposed || !isPaused || revision != playbackRevision) return;
                // External Explorer drag occurs while media is paused. The snapshot
                // PictureBox is not an OLE target; keep the real WebView available.
                if(nativeDesktopDropEnabled){RevealDropSurface();"Native pause retained desktop drop surface".SendLog(SendToParent);return;}
                if (nativePausedPicture?.Image == null)
                {
                    using var stream = new MemoryStream();
                    await WaitNativeRenderTask(webView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream));
                    if (IsDisposed || !isPaused || revision != playbackRevision) return;
                    stream.Position = 0;
                    using var captured = Image.FromStream(stream);
                    var image = new Bitmap(captured);
                    nativePausedPicture ??= new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.StretchImage, Enabled = false, Text = "Dext native pause frame" };
                    if (nativePausedPicture.Parent == null) Controls.Add(nativePausedPicture);
                    nativePausedPicture.Image = image;
                }
                nativePausedPicture.Visible = true;
                nativePausedPicture.BringToFront();
                webView.Visible = false;
                // IsVisible=false is required. Suspension is best effort; the native
                // retained image guarantees a still picture even if it is declined.
                // https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2.trysuspendasync
                // WinForms Visible can disagree with the native controller after
                // external parent/style changes. TrySuspend checks the controller.
                var controller = NativeViewController();
                controller.IsVisible = false;
                if (controller.IsVisible) throw new InvalidOperationException("Native WebView is still visible.");
                await WaitNativeRenderTask(webView.CoreWebView2.TrySuspendAsync());
                "Native pause render complete".SendLog(SendToParent);
            }
            catch (Exception error)
            {
                // Do not keep an animated or permanently hidden Player alive when
                // its current pause cannot finish. Core owns bounded fault recovery.
                if (!IsDisposed && isPaused && revision == playbackRevision)
                {
                    error.SendError(SendToParent);
                    Close();
                }
            }
            finally { nativePauseRenderGate.Release(); }
        }

        private static async Task WaitNativeRenderTask(Task operation)
        {
            if (await Task.WhenAny(operation, Task.Delay(3000)) != operation)
            {
                _ = operation.ContinueWith(task => { _ = task.Exception; }, TaskContinuationOptions.OnlyOnFaulted);
                throw new TimeoutException("Native pause rendering did not complete.");
            }
            await operation;
        }

        private CoreWebView2Controller NativeViewController()
        {
            // This pinned WinForms SDK already uses the same controller field
            // for RasterizationScale during initialization.
            var field = typeof(Microsoft.Web.WebView2.WinForms.WebView2).GetField("_coreWebView2Controller", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
            return field?.GetValue(webView) as CoreWebView2Controller
                ?? throw new InvalidOperationException("Native WebView controller unavailable.");
        }

        private async Task ResumeNativeView()
        {
            await nativePauseRenderGate.WaitAsync();
            try { if (!IsDisposed) webView.CoreWebView2.Resume(); }
            finally { nativePauseRenderGate.Release(); }
        }

        private void RevealNativeView(long revision)
        {
            if (IsDisposed || isPaused || revision != playbackRevision) return;
            try
            {
                webView.Visible = true;
                NativeViewController().IsVisible = true;
                if (IsDisposed || isPaused || revision != playbackRevision) return;
                if (nativePausedPicture != null)
                {
                    nativePausedPicture.Visible = false;
                    var image = nativePausedPicture.Image;
                    nativePausedPicture.Image = null;
                    image?.Dispose();
                }
            }
            catch (Exception error)
            {
                if (!IsDisposed && !isPaused && revision == playbackRevision)
                { error.SendError(SendToParent); Close(); }
            }
        }

        private void DisposeNativePausedPicture()
        {
            var image = nativePausedPicture?.Image;
            if (nativePausedPicture != null) nativePausedPicture.Image = null;
            image?.Dispose();
            nativePausedPicture?.Dispose();
        }
    }
}
