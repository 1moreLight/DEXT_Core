using CommandLine;
using Lively.Common;
using Lively.Common.Extensions;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Common.JsonConverters;
using Lively.Common.Services;
using Lively.Models.Enums;
using Lively.Models.Message;
using Lively.Player.WebView2.Extensions.WebView2;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using WebView = Microsoft.Web.WebView2.WinForms.WebView2;

namespace Lively.Player.WebView2
{
    public partial class Form1 : Form
    {
        private WebView webView;
        private StartArgs startArgs;
        private bool isPaused = false;
        private long playbackRevision;
        private bool runtimeDeliverySuspended;
        private readonly DextRoomRuntimeState roomRuntime = new DextRoomRuntimeState();
        private bool nativeRuntimeSeen;
        private bool isVideoStream = false;
        private int cefD3DRenderingSubProcessId;

        private bool initializedServices = false; //delay API init till loaded page
        private IAudioVisualizerService visualizerService;
        private IHardwareUsageService hardwareUsageService;
        private INowPlayingService nowPlayingService;

        private bool IsDebugging { get; } = BuildInfoUtil.IsDebugBuild();

        public Form1()
        {
            InitializeComponent();
            if (IsDebugging)
            {
                startArgs = new StartArgs
                {
                    // .html fullpath
                    Url = "https://google.com/",
                    //online or local(file)
                    Type = WebPageType.online,
                    // LivelyProperties.json path if any
                    Properties = @"",
                    SysInfo = false,
                    NowPlaying = false,
                    AudioVisualizer = false,
                    PauseEvent = false
                };

                this.FormBorderStyle = FormBorderStyle.Sizable;
                this.WindowState = FormWindowState.Normal;
                this.StartPosition = FormStartPosition.Manual;
                this.Size = new Size(1920, 1080);
                this.ShowInTaskbar = true;
                this.MaximizeBox = true;
                this.MinimizeBox = true;
            }
            else
            {
                Parser.Default.ParseArguments<StartArgs>(Environment.GetCommandLineArgs())
                    .WithParsed((x) => startArgs = x)
                    .WithNotParsed(HandleParseError);

                this.WindowState = FormWindowState.Minimized;
                this.StartPosition = FormStartPosition.Manual;
                this.Location = new Point(-9999, 0);

                if (startArgs.Geometry != null)
                {
                    var msg = startArgs.Geometry.Split('x');
                    if (msg.Length >= 2 && int.TryParse(msg[0], out int width) && int.TryParse(msg[1], out int height))
                    {
                        this.Size = new Size(width, height);
                    }
                }

                var darkColor = Color.FromArgb(30, 30, 30);
                var lightColor = Color.FromArgb(240, 240, 240);
                this.BackColor = startArgs.Theme switch
                {
                    AppTheme.Auto => ThemeUtil.GetWindowsTheme() == AppTheme.Dark ? darkColor : lightColor,
                    AppTheme.Light => lightColor,
                    AppTheme.Dark => darkColor,
                    _ => darkColor,
                };
            }

            InitializeWebView2Async().Await(() => {
                _ = ListenToParent();
            }, 
            (err) =>
            {
                err.SendError(SendToParent, "Failed to initialize WebView2");
                // Exit or display custom error page.
                Environment.Exit(1);
            });
        }

        // Hide from taskview and taskbar.
        // ShowInTaskbar = true does not create TOOLWINDOW.
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW
                cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE
                return cp;
            }
        }

        private void HandleParseError(IEnumerable<Error> errs)
        {
            if (errs != null)
                string.Join(Environment.NewLine, errs).SendError(SendToParent, "Error parsing launch arguments");

            // ERROR_INVALID_PARAMETER
            // Ref: <https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499->
            Environment.Exit(87);
        }

        public async Task InitializeWebView2Async()
        {
            webView = new WebView() {
                DefaultBackgroundColor = Color.Transparent
            };
            webView.NavigationCompleted += WebView_NavigationCompleted;

            var webViewStartArgs =
                // Allow media autoplay even if not muted.
                "--autoplay-policy=no-user-gesture-required " +
                // Disable SMTC.
                "--disable-features=HardwareMediaKeyHandling ";
            CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions(webViewStartArgs);
            // WebView2 does not have in-memory mode, ref: https://github.com/MicrosoftEdge/WebView2Feedback/issues/3637
            // Custom user data folder, ref: https://docs.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder
            $"Setting UserData path: {startArgs.UserDataPath}".SendLog(SendToParent);
            var env = await CoreWebView2Environment.CreateAsync(null, startArgs.UserDataPath, options);
            await webView.EnsureCoreWebView2Async(env);

            // Defaults
            webView.CoreWebView2.IsMuted = startArgs.Volume == 0;
            webView.CoreWebView2.Profile.PreferredColorScheme = startArgs.Theme.GetPreferredColorScheme();
            if (startArgs.Scale != null)
            {
                $"Attempt to set scale: {startArgs.Scale.Value}".SendLog(SendToParent);
                try
                {
                    // RasterizationScale is better choice than ZoomFactor since it is not affected by system text size but not exposed in .NET, ref:
                    // https://github.com/MicrosoftEdge/WebView2Feedback/issues/4775
                    // https://github.com/MicrosoftEdge/WebView2Feedback/issues/3839
                    // https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2controller.rasterizationscale
                    var field = typeof(WebView).GetField("_coreWebView2Controller", BindingFlags.Instance | BindingFlags.NonPublic);
                    if (field?.GetValue(webView) is CoreWebView2Controller controller)
                    {
                        controller.ShouldDetectMonitorScaleChanges = false;
                        // Bug: Initial value is always 1, ref: https://github.com/MicrosoftEdge/WebView2Feedback/issues/5329
                        $"Current scale: {controller.RasterizationScale}".SendLog(SendToParent);
                        controller.RasterizationScale = startArgs.Scale.Value;
                        $"Updated scale: {controller.RasterizationScale}".SendLog(SendToParent);
                    }
                    else
                    {
                        "CoreWebView2Controller not found".SendError(SendToParent);
                    }
                }
                catch (Exception ex)
                {
                    ex.SendError(SendToParent, "Failed to set scale");
                }
            }

            if (!IsDebugging)
            {
                // Don't allow contextmenu and devtools.
                webView.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            }

            if (!string.IsNullOrWhiteSpace(startArgs.DebugPort) && int.TryParse(startArgs.DebugPort, out int _))
            {
                // In WebView2 --remote-debugging-port=XXXX is not opening up a direct connection, we will just ignore port and open DevTools instead.
                webView.CoreWebView2.OpenDevToolsWindow();
                webView.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = true;
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            }

            webView.CoreWebView2.ProcessFailed += CoreWebView2_ProcessFailed;
            webView.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;
            webView.CoreWebView2.DownloadStarting += CoreWebView2_DownloadStarting;
            webView.CoreWebView2.DocumentTitleChanged += CoreWebView2_DocumentTitleChanged;
            if (startArgs.DextTrustedHost)
                ConfigureDextOfflineBoundary();
            // Wallpaper -> core requests (launch app / save room), forwarded over the stdin/stdout IPC.
            webView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                try
                {
                    // Only the official top document may reach Lively IPC. Sandboxed
                    // background/start/switch/idle frames are intentionally rejected.
                    if (!IsTopLevelWebMessage(e))
                        return;
                    var o = JsonConvert.DeserializeObject<dynamic>(e.TryGetWebMessageAsString());
                    if ((string)o.type == "saveRoom")
                    {
                        SendToParent(new LivelyMessageSaveRoomCmd()
                        {
                            RoomJson = (string)o.room.ToString(Newtonsoft.Json.Formatting.None),
                            RequestId = (string)o.requestId,
                        });
                    }
                    else if ((string)o.type == "addDockIcon")
                    {
                        var icon = o.icon;
                        SendToParent(new LivelyMessageAddDockIconCmd
                        {
                            Scope = (string)o.scope ?? "desk",
                            DeskIndex = (int?)o.deskIndex ?? 0,
                            Label = (string)icon.label ?? string.Empty,
                            IconPng = (string)icon.icon_png ?? string.Empty,
                            Glyph = (string)icon.glyph ?? "?",
                            Color = (string)icon.color ?? "#3b82f6",
                            Action = (string)icon.action ?? string.Empty,
                            LaunchTarget = (string)icon.launch.target ?? string.Empty,
                            LaunchArgs = (string)icon.launch.args ?? string.Empty,
                            LaunchWorkdir = (string)icon.launch.workdir ?? string.Empty,
                        });
                    }
                    else if ((string)o.type == "dext:system-control")
                    {
                        var request = BuildSystemControlRequest(o);
                        if (request != null)
                            SendToParent(request);
                    }
                    else if ((string)o.type == "dext:v3-request-desk")
                    {
                        if (startArgs.DextTrustedHost &&
                            Guid.TryParse((string)o.sessionId, out var sessionId) &&
                            !string.IsNullOrWhiteSpace((string)o.deskId))
                            SendToParent(new LivelyMessageRoomSessionRequest
                            {
                                SessionId = sessionId,
                                DeskId = (string)o.deskId,
                            });
                    }
                    else if ((string)o.type == "dext:v3-transition-complete")
                    {
                        if (startArgs.DextTrustedHost &&
                            Guid.TryParse((string)o.sessionId, out var sessionId) &&
                            Guid.TryParse((string)o.transitionId, out var transitionId))
                            SendToParent(new LivelyMessageRoomTransitionComplete
                            {
                                SessionId = sessionId,
                                TransitionId = transitionId,
                            });
                    }
                    else if ((string)o.type == "dext:v3-page-ready")
                    {
                        if (startArgs.DextTrustedHost)
                            SendToParent(new LivelyMessageRoomSessionReady());
                    }
                    else if (((string)o.type)?.StartsWith("dext:v3-", StringComparison.Ordinal) == true)
                    {
                        // Unknown v3 envelopes never inherit legacy launch behavior.
                        return;
                    }
                    else
                    {
                        SendToParent(new LivelyMessageLaunchCmd()
                        {
                            Target = (string)o.target,
                            Arguments = (string)o.args ?? string.Empty,
                            WorkingDirectory = (string)o.workdir ?? string.Empty,
                        });
                    }
                }
                catch (Exception ex)
                {
                    ex.SendError(SendToParent, "Failed to forward web message");
                }
            };

            switch (startArgs.Type)
            {
                case WebPageType.online:
                    {
                        var (contentType, id) = WebContentUtil.GetContentType(startArgs.Url);
                        switch (contentType)
                        {
                            case WebContentType.shadertoy:
                                {
                                    $"Opening shadertoy shader: {id}".SendLog(SendToParent);
                                    webView.CoreWebView2.Navigate($"https://www.shadertoy.com/embed/{id}?gui=false&t=10&paused=false&muted=true");
                                }
                                break;
                            case WebContentType.youtube:
                                {
                                    isVideoStream = true;
                                    $"Opening yt stream: {id}".SendLog(SendToParent);
                                    // Error 153, ref: https://github.com/rocksdanister/lively/issues/2991
                                    webView.CoreWebView2.AddWebResourceRequestedFilter("*youtube.com/*", CoreWebView2WebResourceContext.All);
                                    webView.CoreWebView2.WebResourceRequested += (s, e) =>
                                    {
                                        var headers = e.Request.Headers;
                                        if (!headers.Contains("Referer"))
                                            headers.SetHeader("Referer", "https://localhost/");
                                    };
                                    webView.CoreWebView2.Navigate($"https://www.youtube.com/embed/{id}?version=3&rel=0&autoplay=1&loop=1&controls=0&playlist={id}");
                                }
                                break;
                            case WebContentType.generic:
                                {
                                    $"Opening address: {startArgs.Url}".SendLog(SendToParent);
                                    webView.CoreWebView2.Navigate(startArgs.Url);
                                }
                                break;
                            case WebContentType.none:
                                {
                                    "Failed to parse url".SendError(SendToParent);
                                    throw new ArgumentException(startArgs.Url);
                                }
                            default:
                                throw new NotImplementedException();
                        }
                    }
                    break;
                case WebPageType.local:
                    {
                        $"Opening local project: {startArgs.Url}".SendLog(SendToParent);
                        webView.NavigateToLocalPath(startArgs.Url, startArgs.Screensaver);
                    }
                    break;
            }
            this.Controls.Add(webView);
            webView.Dock = DockStyle.Fill;

            // Make sure to do this after WebView control is attached to form to avoid issues.
            SendToParent(new LivelyMessageHwnd() {
                Hwnd = webView.Handle.ToInt32()
            });
        }

        private bool IsTopLevelWebMessage(CoreWebView2WebMessageReceivedEventArgs e)
        {
            var current = webView?.CoreWebView2?.Source;
            if (nativeRuntimeSeen && !IsOfficialDextDocument(current)) return false;
            if (string.IsNullOrWhiteSpace(current) || string.IsNullOrWhiteSpace(e?.Source))
                return false;
            if (!Uri.TryCreate(current, UriKind.Absolute, out var currentUri) ||
                !Uri.TryCreate(e.Source, UriKind.Absolute, out var sourceUri))
                return false;
            var parts = UriComponents.SchemeAndServer | UriComponents.PathAndQuery;
            return string.Equals(
                currentUri.GetComponents(parts, UriFormat.SafeUnescaped),
                sourceUri.GetComponents(parts, UriFormat.SafeUnescaped),
                StringComparison.OrdinalIgnoreCase);
        }

        private void ConfigureDextOfflineBoundary()
        {
            webView.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
            webView.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
            webView.CoreWebView2.Settings.AreHostObjectsAllowed = false;
            webView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            webView.CoreWebView2.WebResourceRequested += (sender, args) =>
            {
                if (!IsAllowedDextResource(args.Request.Uri))
                    args.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                        null, 403, "Dext Offline Boundary", "Content-Type: text/plain");
            };
            webView.CoreWebView2.NavigationStarting += (sender, args) =>
            {
                if (!IsAllowedDextResource(args.Uri) || nativeRuntimeSeen && !IsOfficialDextDocument(args.Uri))
                    args.Cancel = true;
                if (roomRuntime.Invalidate("navigation")) PostRuntimeLastMessage();
            };
            webView.CoreWebView2.FrameNavigationStarting += (sender, args) =>
            {
                if (!IsAllowedDextResource(args.Uri))
                    args.Cancel = true;
            };
            webView.CoreWebView2.PermissionRequested += (sender, args) =>
            {
                args.State = CoreWebView2PermissionState.Deny;
                args.Handled = true;
            };
        }

        private bool IsAllowedDextResource(string uri)
        {
            if (string.Equals(uri, "about:blank", StringComparison.OrdinalIgnoreCase))
                return true;
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var candidate) ||
                !string.Equals(candidate.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                return false;
            var current = webView?.CoreWebView2?.Source;
            if (Uri.TryCreate(current, UriKind.Absolute, out var top) &&
                string.Equals(candidate.Host, top.Host, StringComparison.OrdinalIgnoreCase))
                return true;

            // Before the first navigation completes there is no real Source yet —
            // WebView2 reports the initial about:blank document, not an empty string.
            // The official local virtual host always ends in .localhost; remote hosts remain blocked.
            var noDocumentYet = string.IsNullOrWhiteSpace(current) ||
                string.Equals(current, "about:blank", StringComparison.OrdinalIgnoreCase);
            return noDocumentYet &&
                candidate.Host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase);
        }

        private static LivelyMessageSystemControlRequest BuildSystemControlRequest(dynamic payload)
        {
            string requestId = (string)payload?.requestId;
            string action = (string)payload?.action?.id;
            if (string.IsNullOrWhiteSpace(requestId) || requestId.Length > 80 ||
                requestId.Any(character => !(
                    character >= 'a' && character <= 'z' ||
                    character >= 'A' && character <= 'Z' ||
                    character >= '0' && character <= '9' ||
                    character == '-')))
                return null;

            var request = new LivelyMessageSystemControlRequest { RequestId = requestId };
            switch (action)
            {
                case "system.permissions.read":
                    request.Action = "permissions-read";
                    break;
                case "system.volume.read":
                    request.Action = "volume-read";
                    break;
                case "system.volume.set":
                    request.Action = "volume-set";
                    request.Level = (double?)payload.action.value;
                    if (!request.Level.HasValue || double.IsNaN(request.Level.Value) ||
                        double.IsInfinity(request.Level.Value) || request.Level.Value < 0 || request.Level.Value > 1)
                        return null;
                    break;
                case "system.volume.mute":
                    request.Action = "volume-mute";
                    request.Muted = (bool?)payload.action.value;
                    if (!request.Muted.HasValue)
                        return null;
                    break;
                case "system.volume.toggle-mute":
                    request.Action = "volume-toggle-mute";
                    break;
                case "system.media.play":
                case "system.media.pause":
                case "system.media.toggle-play-pause":
                case "system.media.next":
                case "system.media.previous":
                    request.Action = action.Substring("system.media.".Length);
                    break;
                default:
                    return null;
            }
            if (request.Action != "permissions-read" && request.Action != "volume-read")
            {
                request.Subject = (string)payload?.subject;
                if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Length > 160 ||
                    request.Subject.Any(character => !(
                        character >= 'a' && character <= 'z' ||
                        character >= '0' && character <= '9' ||
                        character == '-' || character == ':' || character == '>')))
                    return null;
            }
            return request;
        }

        private void CoreWebView2_DocumentTitleChanged(object sender, object e)
        {
            this.Invoke((MethodInvoker)(() => this.Text = webView.CoreWebView2.DocumentTitle));
        }

        private void CoreWebView2_ProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs e)
        {
            // Expected behavior: DebugActiveProcess(CEF_D3DRenderingSubProcess)
            // Ref: https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2processfailedkind
            if (isPaused && e.Reason == CoreWebView2ProcessFailedReason.Unresponsive)
                return;

            roomRuntime.Invalidate("processFailed");
            e.Reason.ToString().SendError(SendToParent, "CoreWebView2 process failed");
        }

        private void CoreWebView2_NewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            // Native v3 author content cannot open an external browser through this path.
            if (nativeRuntimeSeen) { e.Handled = true; return; }
            // Avoid popups.
            if (e.IsUserInitiated)
            {
                e.Handled = true;
                // Open new tab/window  hyperlink (target="_blank") in default browser.
                LinkUtil.OpenBrowser(e.Uri);
            }
        }

        private void CoreWebView2_DownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            // Cancel user requested downloads.
            e.Cancel = true;
        }

        private async void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            // Restore default.
            webView.DefaultBackgroundColor = Color.White;

            if (!e.IsSuccess)
            {
                e.WebErrorStatus.ToString().SendError(SendToParent, "WebView navigation failed");
                return;
            }

            if (!webView.TryGetCefD3DRenderingSubProcessId(out cefD3DRenderingSubProcessId))
                "Failed to retrieve GetCefD3DRenderingSubProcessId".SendError(SendToParent);

            switch (startArgs.Type)
            {
                case WebPageType.online:
                    switch (WebContentUtil.GetContentType(startArgs.Url).ContentType)
                    {
                        case WebContentType.shadertoy:
                            await webView.TryHideShaderToyGui();
                            break;
                    }
                    break;
                case WebPageType.local:
                    await RestoreLivelyProperties(startArgs.Properties);
                    break;
            }
            SendToParent(new LivelyMessageWallpaperLoaded() { Success = e.IsSuccess });

            if (!initializedServices)
            {
                initializedServices = true;
                if (startArgs.NowPlaying)
                {
                    nowPlayingService = new NpsmNowPlayingService();
                    nowPlayingService.NowPlayingTrackChanged += (s, e) => {
                        try
                        {
                            if (isPaused)
                                return;

                            // CefSharp CanExecuteJavascriptInMainFrame equivalent in webview required?
                            this.Invoke((Action)(() =>
                            {
                                _ = webView.ExecuteScriptFunctionAsync("livelyCurrentTrack", JsonConvert.SerializeObject(e, Formatting.Indented));
                            }));

                        }
                        catch (Exception ex)
                        {
                            ex.SendError(SendToParent, "Error sending track information");

                        }
                    };
                    nowPlayingService.Start();
                }


                if (startArgs.SysInfo)
                {
                    hardwareUsageService = new HardwareUsageService();
                    hardwareUsageService.HWMonitor += (s, e) => {
                        try
                        {
                            if (isPaused)
                                return;

                            // CefSharp CanExecuteJavascriptInMainFrame equivalent in webview required?
                            this.Invoke((Action)(() =>
                            {
                                _ = webView.ExecuteScriptFunctionAsync("livelySystemInformation", JsonConvert.SerializeObject(e, Formatting.Indented));
                            }));
                        }
                        catch { }
                    };
                    hardwareUsageService.Start();
                }

                if (startArgs.AudioVisualizer)
                {
                    visualizerService = new NAudioVisualizerService();
                    visualizerService.AudioDataAvailable += (s, e) => {
                        try
                        {
                            if (isPaused)
                                return;

                            //TODO: CefSharp CanExecuteJavascriptInMainFrame equivalent in webview
                            this.Invoke((Action)(() =>
                            {
                                _ = webView.ExecuteScriptFunctionAsync("livelyAudioListener", e);
                            }));
                        }
                        catch { }
                    };
                    visualizerService.Start(startArgs.AudioVisualizerDeviceId);
                }
            }
        }

        /// <summary>
        /// Resumes the suspended CEF Direct3D rendering subprocess by detaching the debugger.
        /// Must be called on the same thread that previously attached, since debugger state is thread-specific.
        /// </summary>
        private void ResumeRenderingSubProcess()
        {
            if (cefD3DRenderingSubProcessId == 0)
                return;

            _ = NativeMethods.DebugActiveProcessStop((uint)cefD3DRenderingSubProcessId);
        }

        /// <summary>
        /// Suspends the CEF Direct3D rendering subprocess by attaching a debugger.
        /// Must be called on the same thread to ensure proper detachment later.
        /// </summary>
        private void SuspendRenderingSubProcess()
        {
            // The "System Idle Process" is given process ID 0, Kernel is 1.
            if (cefD3DRenderingSubProcessId == 0)
                return;

            // DebugSetProcessKillOnExit by default is TRUE.
            // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-debugsetprocesskillonexit
            _ = NativeMethods.DebugActiveProcess((uint)cefD3DRenderingSubProcessId);
        }

        public async Task ListenToParent()
        {
            if (IsDebugging)
                return;

            var reader = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);

            try
            {
                await Task.Run(async () =>
                {
                    while (true)
                    {
                        // Since UTF8 is backward compatible, will work without this reader for non unicode characters.
                        string text = await reader.ReadLineAsync();
                        if (startArgs.VerboseLog)
                            Console.WriteLine(text);

                        if (string.IsNullOrEmpty(text))
                        {
                            // When the redirected stream is closed, a null line is sent to the event handler. 
                            break;
                        }
                        else
                        {
                            try
                            {
                                var obj = JsonConvert.DeserializeObject<IpcMessage>(text, new JsonSerializerSettings() { Converters = { new IpcMessageConverter() } });
                                if (obj.Type == MessageType.cmd_close)
                                {
                                    break;
                                }

                                // Ensure all processing is on the same thread.
                                // Some WebView2 calls require UI thread.
                                this.Invoke((Action)(async () =>
                                {
                                    try
                                    {
                                        await ProcessMessage(obj);
                                    }
                                    catch (Exception ie1)
                                    {
                                        ie1.SendError(SendToParent);
                                    }
                                }));
                            }
                            catch (Exception ie2)
                            {
                                ie2.SendError(SendToParent);
                            }
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                ex.SendError(SendToParent);
            }
            finally
            {
                reader?.Dispose();
                this.Invoke((Action)Application.Exit);
            }
        }

        private async Task ProcessMessage(IpcMessage obj)
        {            switch (obj.Type)
            {
                case MessageType.cmd_reload:
                    // ConnectionAborted issue.
                    //try
                    //{
                    //    webView?.Reload();
                    //}
                    //catch (Exception ie)
                    //{
                    //    WriteToParent(new LivelyMessageConsole()
                    //    {
                    //        Category = ConsoleMessageType.error,
                    //        Message = $"Reload failed: {ie.Message}"
                    //    });
                    //}
                    break;
                case MessageType.cmd_suspend:
                    await HandleSuspend();
                    break;
                case MessageType.cmd_resume:
                    await HandleResume();
                    break;
                case MessageType.cmd_volume:
                    var vc = (LivelyVolumeCmd)obj;
                    webView.CoreWebView2.IsMuted = vc.Volume == 0;
                    break;
                case MessageType.cmd_screenshot:
                    var success = true;
                    var scr = (LivelyScreenshotCmd)obj;
                    try
                    {
                        await webView.CaptureScreenshot(scr.Format, scr.FilePath);
                    }
                    catch (Exception ie)
                    {
                        success = false;
                        ie.SendError(SendToParent, "Failed to capture screenshot");
                    }
                    finally
                    {
                        SendToParent(new LivelyMessageScreenshot()
                        {
                            FileName = Path.GetFileName(scr.FilePath),
                            Success = success
                        });
                    }
                    break;
                case MessageType.lp_slider:
                    var sl = (LivelySlider)obj;
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", sl.Name, sl.Value);
                    break;
                case MessageType.lp_textbox:
                    var tb = (LivelyTextBox)obj;
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", tb.Name, tb.Value);
                    break;
                case MessageType.lp_dropdown:
                    var dd = (LivelyDropdown)obj;
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", dd.Name, dd.Value);
                    break;
                case MessageType.lp_cpicker:
                    var cp = (LivelyColorPicker)obj;
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", cp.Name, cp.Value);
                    break;
                case MessageType.lp_chekbox:
                    var cb = (LivelyCheckbox)obj;
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", cb.Name, cb.Value);
                    break;
                case MessageType.lp_fdropdown:
                    var fd = (LivelyFolderDropdown)obj;
                    var filePath = fd.Value is null ? null : Path.Combine(Path.GetDirectoryName(startArgs.Url), fd.Value);
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", fd.Name, File.Exists(filePath) ? fd.Value : null);
                    break;
                case MessageType.lp_button:
                    var btn = (LivelyButton)obj;
                    if (btn.IsDefault)
                        await RestoreLivelyProperties(startArgs.Properties);
                    else
                        await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", btn.Name, true);
                    break;
                case MessageType.lsp_perfcntr:
                    await webView.ExecuteScriptFunctionAsync("livelySystemInformation", JsonConvert.SerializeObject(((LivelySystemInformation)obj).Info, Formatting.Indented));

                    break;
                case MessageType.lsp_nowplaying:
                    await webView.ExecuteScriptFunctionAsync("livelyCurrentTrack", JsonConvert.SerializeObject(((LivelySystemNowPlaying)obj).Info, Formatting.Indented));
                    break;
                case MessageType.cmd_close:
                    // Handle on caller
                    break;
                case MessageType.msg_app_status:
                    var appStatus = (LivelyMessageAppStatus)obj;
                    var statusPayload = new
                    {
                        type = "dext:app-status",
                        target = appStatus.Target ?? string.Empty,
                        running = appStatus.Running,
                    };
                    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(statusPayload));
                    break;
                case MessageType.cmd_room_layout_sync:
                    var layout = (LivelyMessageRoomLayoutSyncCmd)obj;
                    if (string.IsNullOrWhiteSpace(layout.RoomJson))
                        break;
                    try
                    {
                        var room = JObject.Parse(layout.RoomJson);
                        var layoutPayload = new
                        {
                            type = "dext:room-layout",
                            room,
                            deskIndex = layout.DeskIndex,
                            enterEdit = layout.EnterEdit,
                            highlightTarget = layout.HighlightTarget ?? string.Empty,
                        };
                        webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(layoutPayload));
                    }
                    catch (JsonReaderException)
                    {
                        // Reject malformed payloads before they cross into the page.
                    }
                    break;
                case MessageType.cmd_room_runtime:
                    if (startArgs.DextTrustedHost && IsOfficialDextDocument(webView.CoreWebView2.Source) &&
                        roomRuntime.Initialize((LivelyMessageRoomRuntime)obj))
                    {
                        nativeRuntimeSeen = true;
                        PostRuntimeLastMessage();
                    }
                    break;
                case MessageType.cmd_room_runtime_revoke:
                    if (startArgs.DextTrustedHost && roomRuntime.Revoke((LivelyMessageRoomRuntimeRevoke)obj))
                        PostRuntimeLastMessage();
                    break;
                case MessageType.cmd_room_session_snapshot:
                    if (startArgs.DextTrustedHost && roomRuntime.AcceptSnapshot((LivelyMessageRoomSessionSnapshot)obj))
                        PostRuntimeLastMessage();
                    break;
                case MessageType.cmd_desktop_icon_preferences:
                    if (!startArgs.DextTrustedHost)
                        break;
                    var desktopIcons = (LivelyMessageDesktopIconPreferencesCmd)obj;
                    var desktopIconPayload = new
                    {
                        type = "dext:desktop-preferences",
                        revision = desktopIcons.Revision,
                        preferences = new
                        {
                            feedbackStyle = desktopIcons.FeedbackStyle ?? "halo",
                            showLabels = desktopIcons.ShowLabels,
                            hitTargetSize = desktopIcons.HitTargetSize ?? "standard",
                            visualSize = desktopIcons.VisualSize ?? "standard",
                            spacing = desktopIcons.Spacing ?? "standard",
                        },
                    };
                    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(desktopIconPayload));
                    break;
                case MessageType.cmd_save_room_result:
                    if (!startArgs.DextTrustedHost)
                        break;
                    var saveResult = (LivelyMessageRoomSaveResultCmd)obj;
                    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new
                    {
                        type = "dext:room-save-result",
                        requestId = saveResult.RequestId,
                        success = saveResult.Success,
                        error = saveResult.Error,
                    }));
                    break;
                case MessageType.cmd_system_control_response:
                    var response = (LivelyMessageSystemControlResponse)obj;
                    var systemPayload = new
                    {
                        type = "dext:system-control-result",
                        requestId = response.RequestId ?? string.Empty,
                        success = response.Success,
                        error = response.Error ?? string.Empty,
                        userVisible = response.UserVisible,
                        permissions = string.IsNullOrWhiteSpace(response.PermissionsJson)
                            ? null
                            : JsonConvert.DeserializeObject(response.PermissionsJson),
                        volume = response.HasVolume ? new
                        {
                            level = response.Level,
                            muted = response.Muted,
                            available = true,
                        } : null,
                    };
                    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(systemPayload));
                    break;
            }
        }

        private bool IsOfficialDextDocument(string address)
        {
            if (startArgs.Type != WebPageType.local || !Uri.TryCreate(address, UriKind.Absolute, out var candidate)) return false;
            var query = startArgs.Screensaver ? "?screensaver=1" : string.Empty;
            var official = new Uri($"https://{LinkUtil.GetStableHostName(startArgs.Url)}.localhost/{Path.GetFileName(startArgs.Url)}{query}");
            return Uri.Compare(candidate, official, UriComponents.SchemeAndServer | UriComponents.PathAndQuery,
                UriFormat.SafeUnescaped, StringComparison.OrdinalIgnoreCase) == 0;
        }

        private void PostRuntimeLastMessage()
        {
            var messages = roomRuntime.Replay();
            if (messages.Count > 0) PostRuntimeMessage(messages[messages.Count - 1]);
        }

        private void PostRuntimeMessage(JObject message)
        {
            if (!runtimeDeliverySuspended && startArgs.DextTrustedHost && IsOfficialDextDocument(webView.CoreWebView2.Source))
                webView.CoreWebView2.PostWebMessageAsJson(message.ToString(Formatting.None));
        }

        private async Task HandleSuspend()
        {
            if (isPaused) return;
            isPaused = true;
            runtimeDeliverySuspended = true;
            var revision = ++playbackRevision;
            try
            {
                if (startArgs.PauseWebMedia || isVideoStream) await webView.TryPauseMedia();
                if (startArgs.PauseEvent)
                    await webView.ExecuteScriptFunctionAsync("livelyWallpaperPlaybackChanged",
                        JsonConvert.SerializeObject(new WallpaperPlaybackState() { IsPaused = true }), Formatting.Indented);
            }
            finally
            {
                if (isPaused && revision == playbackRevision) SuspendRenderingSubProcess();
            }
        }

        private async Task HandleResume()
        {
            ResumeRenderingSubProcess();
            // Playback polls can repeat resume while the first async media call
            // is pending. Keep its revision and completion responsible for replay.
            if (!isPaused) return;
            isPaused = false;
            var revision = ++playbackRevision;
            try
            {
                if (startArgs.PauseWebMedia || isVideoStream) await webView.TryPlayMedia();
                if (startArgs.PauseEvent)
                    await webView.ExecuteScriptFunctionAsync("livelyWallpaperPlaybackChanged",
                        JsonConvert.SerializeObject(new WallpaperPlaybackState() { IsPaused = false }), Formatting.Indented);
                if (startArgs.NowPlaying)
                    await webView.ExecuteScriptFunctionAsync("livelyCurrentTrack", JsonConvert.SerializeObject(nowPlayingService?.CurrentTrack, Formatting.Indented));
            }
            finally
            {
                if (!isPaused && revision == playbackRevision)
                {
                    runtimeDeliverySuspended = false;
                    foreach (var message in roomRuntime.Replay()) PostRuntimeMessage(message);
                }
            }
        }

        private async Task RestoreLivelyProperties(string propertyPath)
        {
            try
            {
                await LivelyPropertyUtil.LoadProperty(propertyPath, Path.GetDirectoryName(startArgs.Url), async (key, value) =>
                {
                    await webView.ExecuteScriptFunctionAsync("livelyPropertyListener", key, value);
                });
            }
            catch (Exception ex)
            {
                ex.SendError(SendToParent);
            }
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            roomRuntime.Invalidate("closed");
            visualizerService?.Dispose();
            hardwareUsageService?.Stop();
            nowPlayingService?.Stop();
            webView?.Dispose();
        }

        private static readonly JsonSerializerSettings ParentJsonSettings = new JsonSerializerSettings
        { StringEscapeHandling = StringEscapeHandling.EscapeNonAscii };

        private void SendToParent(IpcMessage obj)
        {
            // Framework console encoding can differ from the Core pipe reader.
            // ASCII JSON escapes preserve all Unicode independently of code page.
            var json = JsonConvert.SerializeObject(obj, ParentJsonSettings);
            if (!IsDebugging) Console.WriteLine(json);
            Debug.WriteLine(json);
        }

        private sealed class WallpaperPlaybackState
        {
            public bool IsPaused { get; set; }
        }
    }
}
