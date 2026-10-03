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

        // Only the trusted native Player uses this image. It stays in memory and
        // captures this WebView, never another application or the Windows desktop.
        private async Task FreezeNativeView(long revision)
        {
            await nativePauseRenderGate.WaitAsync();
            try
            {
                if (IsDisposed || !isPaused || revision != playbackRevision) return;
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
                await WaitNativeRenderTask(webView.CoreWebView2.TrySuspendAsync());
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

        private async Task ResumeNativeView()
        {
            await nativePauseRenderGate.WaitAsync();
            try { if (!IsDisposed) webView.CoreWebView2.Resume(); }
            finally { nativePauseRenderGate.Release(); }
        }

        private void RevealNativeView(long revision)
        {
            if (IsDisposed || isPaused || revision != playbackRevision) return;
            webView.Visible = true;
            if (nativePausedPicture != null)
            {
                nativePausedPicture.Visible = false;
                var image = nativePausedPicture.Image;
                nativePausedPicture.Image = null;
                image?.Dispose();
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
