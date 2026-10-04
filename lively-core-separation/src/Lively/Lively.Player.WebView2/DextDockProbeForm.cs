using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using WebView = Microsoft.Web.WebView2.WinForms.WebView2;

namespace Lively.Player.WebView2
{
    // Explicit manual prototype only: fixed packaged HTML, no Core connection.
    internal sealed class DextDockProbeForm : Form
    {
        private const string Origin = "https://dock-probe.dext.local";
        private const string Entry = Origin + "/index.html";
        private readonly WebView webView;
        private readonly StreamWriter log;
        private readonly string output;
        private readonly DextDockWindowHost.DockMode initialMode;
        private readonly int initialHeight, durationSeconds;
        private DextDockWindowHost host;
        private System.Windows.Forms.Timer lifetime;
        private bool closing;
        private int exitCode, nativeFrameResult = -1;
        private long eventSequence;

        private DextDockProbeForm(string directory, DextDockWindowHost.DockMode mode, int height, int seconds)
        {
            output = directory;
            initialMode = mode;
            initialHeight = height;
            durationSeconds = seconds;
            Directory.CreateDirectory(output);
            log = new StreamWriter(new FileStream(Path.Combine(output, "events.jsonl"),
                FileMode.CreateNew, FileAccess.Write, FileShare.Read), new UTF8Encoding(false)) { AutoFlush = true };
            Text = "Dext P2b Dock prototype";
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-20000, -20000);
            ClientSize = new Size(800, 128);
            ShowInTaskbar = false;
            BackColor = Color.Black; // DWM extended frame needs black client pixels.
            webView = new WebView { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Transparent };
            Controls.Add(webView);
            Shown += async (sender, args) =>
            {
                nativeFrameResult = DextDockWindowHost.ExtendTransparentFrame(Handle);
                Write("native-frame", new { nativeFrameResult, note = "HRESULT is not proof of visible alpha; verify against the underlying software." });
                lifetime = new System.Windows.Forms.Timer { Interval = durationSeconds * 1000 };
                lifetime.Tick += (tickSender, tickArgs) => { Write("timeout", new { durationSeconds }); Close(); };
                lifetime.Start();
                try { await InitializeAsync(); }
                catch (Exception ex) { Fail(ex); }
            };
            Write("identity", new { role = "dock-probe", pid = System.Diagnostics.Process.GetCurrentProcess().Id,
                player = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName,
                output, mode = mode.ToString(), height, seconds,
                note = "Manual P2b prototype. No Core, Room, grants or system-taskbar changes." });
        }

        protected override void WndProc(ref Message message)
        {
            base.WndProc(ref message);
            if (message.Msg == 0x031E && !closing && log != null) // WM_DWMCOMPOSITIONCHANGED
            {
                nativeFrameResult = DextDockWindowHost.ExtendTransparentFrame(Handle);
                Write("native-frame", new { nativeFrameResult });
                SendState();
            }
        }

        protected override bool ShowWithoutActivation => true;
        protected override CreateParams CreateParams
        {
            get
            {
                var parameters = base.CreateParams;
                parameters.ExStyle |= 0x08000080; // NOACTIVATE | TOOLWINDOW
                return parameters;
            }
        }

        private async System.Threading.Tasks.Task InitializeAsync()
        {
            var root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DockProbe");
            if (!File.Exists(Path.Combine(root, "index.html")))
                throw new FileNotFoundException("DockProbe assets are missing; run scripts/build.ps1.");
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(output, "profile"));
            if (closing || IsDisposed) return;
            await webView.EnsureCoreWebView2Async(environment);
            if (closing || IsDisposed) return;
            var core = webView.CoreWebView2;
            core.IsMuted = true;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsStatusBarEnabled = false;
            core.SetVirtualHostNameToFolderMapping("dock-probe.dext.local", root, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NewWindowRequested += (sender, args) => args.Handled = true;
            core.DownloadStarting += (sender, args) => args.Cancel = true;
            core.PermissionRequested += (sender, args) => args.State = CoreWebView2PermissionState.Deny;
            core.NavigationStarting += (sender, args) => { if (args.Uri != Entry) args.Cancel = true; };
            core.WebMessageReceived += OnMessage;
            core.ProcessFailed += (sender, args) => Fail(new InvalidOperationException("Dock WebView process failed: " + args.ProcessFailedKind));
            core.NavigationCompleted += (sender, args) =>
            {
                if (closing || host != null) return;
                if (!args.IsSuccess) { Fail(new InvalidOperationException("Dock HTML failed: " + args.WebErrorStatus)); return; }
                try
                {
                    host = new DextDockWindowHost(this);
                    host.StateChanged += state =>
                    {
                        Write("state", state);
                        if (!closing) core.PostWebMessageAsJson(JsonConvert.SerializeObject(new { kind = "state", state, nativeFrameResult }));
                    };
                    host.Failed += Fail;
                    host.Start(initialMode, initialHeight);

                    SendState();
                }
                catch (Exception ex) { Fail(ex); }
            };
            core.Navigate(Entry);
        }

        private void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (closing || host == null || args.Source != Entry) return;
            try
            {
                var json = args.WebMessageAsJson;
                if (json.Length > 4096) return;
                var request = JObject.Parse(json);
                var command = (string)request["command"];
                switch (command)
                {
                    case "mode": host.SetMode(ParseMode((string)request["value"])); break;
                    case "height":
                        var height = request["value"]?.ToObject<int>() ?? 128;
                        host.SetHeight(height);
                        break;
                    case "keyboard":
                        var accepted = host.EnterKeyboard();
                        if (accepted) webView.Focus();
                        Write("keyboard-request", new { accepted });
                        break;
                    case "mouse": host.LeaveKeyboard(true); break;
                    case "input":
                        // Diagnostic only. No Dext actions or input tickets are issued.
                        Write("html-input", new
                        {
                            eventType = (string)request["eventType"], id = (string)request["id"],
                            count = request["count"]?.ToObject<int>(), trusted = (bool?)request["trusted"],
                            state = host.Snapshot()
                        });
                        break;
                    case "ping": SendState(); break;
                    case "close": BeginInvoke((Action)Close); break;
                    default: return;
                }
                if (!closing) SendState();
            }
            catch (Exception ex)
            {
                Write("command-error", new { message = ex.Message });
                if (!closing)
                    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { kind = "error", message = ex.Message }));
            }
        }

        private void SendState()
        {
            if (closing || host == null) return;
            webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new { kind = "state", state = host.Snapshot(), nativeFrameResult }));
        }

        private void Write(string kind, object value)
        {
            if (closing) return;
            log.WriteLine(JsonConvert.SerializeObject(new { sequence = ++eventSequence, utc = DateTime.UtcNow, kind, value }));
        }

        private void Fail(Exception error)
        {
            if (closing || IsDisposed) return;
            Write("failure", new { message = error.ToString() });
            exitCode = 1;
            BeginInvoke((Action)Close);
        }

        protected override void OnFormClosing(FormClosingEventArgs args)
        {
            if (!closing)
            {
                lifetime?.Stop();
                lifetime?.Dispose();
                try
                {
                    host?.Dispose();
                    var work = DextDockWindowHost.ReadPrimaryWorkArea();
                    Write("closed", new { exitCode, workArea = new
                    {
                        x = work.X, y = work.Y, width = work.Width, height = work.Height
                    } });
                }
                catch (Exception error)
                {
                    exitCode = 1;
                    Write("cleanup-error", new { message = error.Message });
                }
                finally
                {
                    closing = true;
                    log.Dispose();
                    webView.Dispose();
                }
            }
            base.OnFormClosing(args);
        }

        private static DextDockWindowHost.DockMode ParseMode(string value)
        {
            switch ((value ?? "").ToLowerInvariant())
            {
                case "overlay": return DextDockWindowHost.DockMode.Overlay;
                case "autohide": return DextDockWindowHost.DockMode.Autohide;
                case "reserve": return DextDockWindowHost.DockMode.Reserve;
                default: throw new ArgumentException("Dock probe mode must be overlay, autohide or reserve.");
            }
        }

        internal static int Run(string[] args)
        {
            try
            {
                var values = new Dictionary<string, string>(StringComparer.Ordinal);
                for (var index = 0; index < args.Length; index++)
                {
                    if (args[index] == "--dext-dock-probe") continue;
                    if (!new[] { "--dock-probe-mode", "--dock-probe-height", "--dock-probe-seconds", "--dock-probe-output" }.Contains(args[index]) ||
                        index + 1 == args.Length || values.ContainsKey(args[index]))
                        throw new ArgumentException("Invalid Dock probe arguments.");
                    var name = args[index];
                    values.Add(name, args[++index]);
                }
                var mode = ParseMode(values.TryGetValue("--dock-probe-mode", out var modeText) ? modeText : "overlay");
                var height = values.TryGetValue("--dock-probe-height", out var heightText) ? int.Parse(heightText) : 128;
                var seconds = values.TryGetValue("--dock-probe-seconds", out var secondsText) ? int.Parse(secondsText) : 180;
                if (height < 48 || height > 240 || seconds < 30 || seconds > 900)
                    throw new ArgumentOutOfRangeException("Height 48..240 DIP and duration 30..900 seconds required.");
                var output = Path.GetFullPath(values.TryGetValue("--dock-probe-output", out var outputText) ?
                    outputText : Path.Combine(Path.GetTempPath(), "Dext-p2b-" + Guid.NewGuid().ToString("N"))).TrimEnd(Path.DirectorySeparatorChar);
                if (!string.Equals(Path.GetDirectoryName(output), Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) ||
                    !Path.GetFileName(output).StartsWith("Dext-p2b-", StringComparison.Ordinal))
                    throw new ArgumentException("Probe output must be a dedicated Dext-p2b-* directory directly under TEMP.");
                using (var instance = new Mutex(true, @"Local\DEXT:DOCK_PROBE", out var created))
                {
                    if (!created) return 183;
                    try
                    {
                        using (var form = new DextDockProbeForm(output, mode, height, seconds))
                        {
                            Application.Run(form);
                            return form.exitCode;
                        }
                    }
                    finally { instance.ReleaseMutex(); }
                }
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error.Message);
                return 87;
            }
        }
    }
}
