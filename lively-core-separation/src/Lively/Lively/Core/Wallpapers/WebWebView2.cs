using Lively.Common;
using Lively.Common.Exceptions;
using Lively.Common.Extensions;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Common.JsonConverters;
using Lively.Models;
using Lively.Models.Enums;
using Lively.Models.Message;
using Lively.Grpc.Common.Proto.Desktop;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Core.Wallpapers
{
    public class WebWebView2 : IWallpaper
    {
        private static readonly NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();
        private readonly TaskCompletionSource<Exception> tcsProcessWait = new();
        private readonly TaskCompletionSource contentReadyTcs = new();
        private bool IsContentReady => contentReadyTcs.Task.IsCompleted;
        private readonly Process process;
        private readonly object roomPersistenceLock = new();
        private static int globalCount;
        private readonly int uniqueId;
        private readonly string wallpaperPath;
        private readonly CancellationTokenSource appMonitorCts = new();
        private readonly object appMonitorLock = new();
        private readonly object sendLock = new();
        private readonly HashSet<string> monitoredAppTargets = new(StringComparer.OrdinalIgnoreCase);
        private readonly Lively.Services.SystemControlService systemControlService = new();
        private int currentVolume = 0;
        private bool isInitialized;
        private bool isMuted;

        public event EventHandler Exited;
        public event EventHandler Loaded;

        public bool IsLoaded { get; private set; } = false;

        public WallpaperType Category => Model.LivelyInfo.Type;

        public LibraryModel Model { get; }

        public IntPtr Handle { get; private set; }

        public IntPtr InputHandle { get; private set; }

        public int? Pid { get; private set; } = null;

        public DisplayMonitor Screen { get; set; }

        public string LivelyPropertyCopyPath { get; }

        public bool IsExited { get; private set; }

        public WebWebView2(string path,
            LibraryModel model,
            DisplayMonitor display,
            string debugPort,
            string livelyPropertyPath,
            string userDataDir,
            AppTheme theme,
            int volume,
            double? scale = null,
            string audioVisualizerId = null,
            bool isScreensaver = false)
        {
            var filePath = ResolveFilePath(path, model);
            LivelyPropertyCopyPath = livelyPropertyPath;
            wallpaperPath = path;

            var cmdArgs = new StringBuilder();
            cmdArgs.Append(" --wallpaper-pause-media ");
            cmdArgs.Append(" --wallpaper-volume " + volume);
            cmdArgs.Append(scale != null ? " --wallpaper-scale " + JsonConvert.SerializeObject(scale.Value) : " ");
            cmdArgs.Append(" --wallpaper-url " + "\"" + filePath + "\"");
            cmdArgs.Append(" --wallpaper-color-scheme " + theme + " ");
            cmdArgs.Append(" --wallpaper-user-data " + "\"" + userDataDir + "\"");
            cmdArgs.Append(" --wallpaper-display " + "\"" + display.DeviceId + "\"");
            cmdArgs.Append(" --wallpaper-property " + "\"" + LivelyPropertyCopyPath + "\"");
            cmdArgs.Append(" --wallpaper-geometry " + display.Bounds.Width + "x" + display.Bounds.Height);
            // --audio false Issue: https://github.com/commandlineparser/commandline/issues/702
            cmdArgs.Append(model.LivelyInfo.Type == WallpaperType.webaudio ? " --wallpaper-audio true" : " ");
            cmdArgs.Append(!string.IsNullOrEmpty(audioVisualizerId) ? " --wallpaper-audio-id " + audioVisualizerId : " ");
            cmdArgs.Append(!string.IsNullOrWhiteSpace(debugPort) ? " --wallpaper-debug " + debugPort : " ");
            cmdArgs.Append(isScreensaver ? " --wallpaper-screensaver true" : " ");
            cmdArgs.Append(model.LivelyInfo.Type.IsOnlineWallpaper() ? " --wallpaper-type online" : " --wallpaper-type local");
            if (TryParseUserCommandArgs(model.LivelyInfo.Arguments, out string parsedArgs))
                cmdArgs.Append(" " + parsedArgs);

            this.process = new Process
            {
                EnableRaisingEvents = true,
                StartInfo = new ProcessStartInfo
                {
                    Arguments = cmdArgs.ToString(),
                    FileName = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, Constants.PlayerPartialPaths.WebView2Path),
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = false,
                    UseShellExecute = false,
                    StandardInputEncoding = Encoding.UTF8,
                    //StandardOutputEncoding = Encoding.UTF8,
                    WorkingDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, Constants.PlayerPartialPaths.WebView2Dir)
                },
            };
            this.Model = model;
            this.Screen = display;

            //for logging purpose
            uniqueId = globalCount++;
        }

        public void Close()
        {
            if (IsExited)
                return;

            SendMessage(new LivelyCloseCmd());
        }

        public void Pause()
        {
            if (!IsContentReady)
                return;

            SendMessage(new LivelySuspendCmd()); //"{\"Type\":7}"
        }

        public void Play()
        {
            if (!IsContentReady)
                return;

            SendMessage(new LivelyResumeCmd()); //"{\"Type\":8}"
        }

        private void SendMessage(string msg)
        {
            if (IsExited)
                return;

            try
            {
                // Setting process StandardInputEncoding to UTF8.
                lock (sendLock)
                    process?.StandardInput.WriteLine(msg);
                // Or convert message to UTF8.
                //byte[] bytes = Encoding.UTF8.GetBytes(msg);
                //Proc.StandardInput.BaseStream.Write(bytes, 0, bytes.Length);
            }
            catch (Exception e)
            {
                Logger.Error($"Stdin write fail: {e.Message}");
            }
        }

        public void SendMessage(IpcMessage obj)
        {
            SendMessage(JsonConvert.SerializeObject(obj));
        }

        public void SetVolume(int volume)
        {
            currentVolume = volume;

            if (!isMuted)
                SendMessage(new LivelyVolumeCmd() { Volume = volume });
        }

        public void SetMute(bool mute)
        {
            isMuted = mute;
            // WebView2 does not have volume control, only IsMuted property, so we use that to set volume internally.
            // Ref: https://github.com/MicrosoftEdge/WebView2Feedback/issues/41
            if (isMuted)
                SendMessage(new LivelyVolumeCmd() { Volume = 0 });
            else
                SendMessage(new LivelyVolumeCmd { Volume = currentVolume });
        }

        public async Task ShowAsync()
        {
            if (process is null)
                return;

            try
            {
                process.Exited += Proc_Exited;
                process.OutputDataReceived += Proc_OutputDataReceived;
                process.Start();
                Pid = process.Id;
                process.BeginOutputReadLine();

                await tcsProcessWait.Task;
                if (tcsProcessWait.Task.Result is not null)
                    throw tcsProcessWait.Task.Result;
            }
            catch (Exception)
            {
                Terminate();

                throw;
            }
        }

        private void Proc_Exited(object sender, EventArgs e)
        {
            Logger.Info($"Wv2{uniqueId}: Process exited with exit code: {process?.ExitCode}");
            if (!isInitialized)
            {
                // 2 = ERROR_FILE_NOT_FOUND
                // 87 = ERROR_INVALID_PARAMETER
                // Ref: <https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499->
                if (process is not null && process.ExitCode == 2)
                    tcsProcessWait.TrySetResult(new WallpaperWebView2NotFoundException());
                else if (process is not null && process.ExitCode == 87)
                    tcsProcessWait.TrySetResult(new WallpaperPluginException("Error initializing. Unknown options are passed."));
                else
                    tcsProcessWait.TrySetResult(new InvalidOperationException(Properties.Resources.LivelyExceptionGeneral));
            }
            process.OutputDataReceived -= Proc_OutputDataReceived;
            appMonitorCts.Cancel();
            process?.Dispose();
            IsExited = true;
            Exited?.Invoke(this, EventArgs.Empty);
        }

        private async void Proc_OutputDataReceived(object sender, DataReceivedEventArgs e)
        {
            //When the redirected stream is closed, a null line is sent to the event handler.
            if (!string.IsNullOrEmpty(e.Data))
            {
                IpcMessage obj = null;
                try
                {
                    obj = JsonConvert.DeserializeObject<IpcMessage>(e.Data, new JsonSerializerSettings() { Converters = { new IpcMessageConverter() } });
                }
                catch (Exception ex)
                {
                    Logger.Error($"Wv2{uniqueId}: Ipc parse error: {e.Data}.\n\nException: {ex.Message}");
                }

                if (obj is null)
                    return;

                // Log message
                switch (obj.Type)
                {
                    case MessageType.msg_console:
                        var msg = obj as LivelyMessageConsole;
                        switch (msg.Category)
                        {
                            case ConsoleMessageType.log:
                                Logger.Info($"Wv2{uniqueId}: {msg.Message}");
                                break;
                            case ConsoleMessageType.error:
                                Logger.Error($"Wv2{uniqueId}: {msg.Message}");
                                break;
                            case ConsoleMessageType.console:
                                Logger.Info($"Wv2{uniqueId}: {msg.Message}");
                                break;
                        }
                        break;
                    default:
                        Logger.Info($"Wv2{uniqueId}: {e.Data}");
                        break;
                }

                // Process message
                switch (obj.Type)
                {
                    case MessageType.msg_hwnd:
                        if (!isInitialized)
                        {
                            Exception error = null;
                            try
                            {
                                //CefBrowserWindow
                                var handle = new IntPtr(((LivelyMessageHwnd)obj).Hwnd);
                                //WindowsForms10.Window.8.app.0.141b42a_r9_ad1
                                var chrome_WidgetWin_0 = NativeMethods.FindWindowEx(handle, IntPtr.Zero, "Chrome_WidgetWin_0", null);
                                if (!chrome_WidgetWin_0.Equals(IntPtr.Zero))
                                {
                                    this.InputHandle = NativeMethods.FindWindowEx(chrome_WidgetWin_0, IntPtr.Zero, "Chrome_WidgetWin_1", null);
                                }
                                Handle = process.GetProcessWindow(true);

                                if (IntPtr.Equals(Handle, IntPtr.Zero) || IntPtr.Equals(InputHandle, IntPtr.Zero))
                                    throw new Exception("Browser input/window handle NULL.");

                                // We are doing this player side.
                                // WindowUtil.RemoveWindowFromTaskbar(Handle);
                            }
                            catch (Exception ie)
                            {
                                error = ie;
                            }
                            finally
                            {
                                isInitialized = true;
                                tcsProcessWait.TrySetResult(error);
                            }
                        }
                        break;
                    case MessageType.msg_wploaded:
                        if (!IsLoaded)
                        {
                            IsLoaded = true;
                            Loaded?.Invoke(this, EventArgs.Empty);

                            // Wait before pausing or other internal fn since some pages can have transition.
                            await Task.Delay(1000);
                            if (!IsExited)
                                contentReadyTcs.TrySetResult();
                            else
                                contentReadyTcs.TrySetException(new InvalidOperationException("Process exited."));
                        }
                        break;
                    case MessageType.msg_launch:
                        var launchMsg = (LivelyMessageLaunchCmd)obj;
                        var launchTarget = launchMsg.Target;
                        var launchArgs = launchMsg.Arguments;
                        var launchWorkdir = launchMsg.WorkingDirectory;
                        _ = Task.Run(() =>
                        {
                            try
                            {
                                if (string.IsNullOrWhiteSpace(launchTarget))
                                {
                                    Logger.Error($"Wv2{uniqueId}: LaunchApp rejected: missing target");
                                    return;
                                }

                                new Lively.Services.AppCatalogService().Launch(launchTarget, launchArgs, launchWorkdir);
                                Logger.Info($"Wv2{uniqueId}: LaunchApp: {launchTarget}");
                                TrackLaunchedApp(launchTarget);
                            }
                            catch (Exception le)
                            {
                                Logger.Error($"Wv2{uniqueId}: LaunchApp failed: {le.Message}");
                            }
                        });
                        break;
                    case MessageType.msg_save_room:
                        var saveMsg = (LivelyMessageSaveRoomCmd)obj;
                        _ = Task.Run(() =>
                        {
                            try
                            {
                                var roomPath = GetPackageRoomPath();
                                var incoming = JsonConvert.DeserializeObject<Newtonsoft.Json.Linq.JObject>(saveMsg.RoomJson)
                                    ?? throw new InvalidDataException("Room payload must be an object.");
                                SaveTrustedRoomCopies(roomPath, incoming);
                                Logger.Info($"Wv2{uniqueId}: SaveRoom: {roomPath}");
                            }
                            catch (Exception se)
                            {
                                Logger.Error($"Wv2{uniqueId}: SaveRoom failed: {se.Message}");
                            }
                        });
                        break;
                    case MessageType.msg_add_dock_icon:
                        var addDockMsg = (LivelyMessageAddDockIconCmd)obj;
                        _ = Task.Run(() => AddDockIconToRoom(addDockMsg));
                        break;
                    case MessageType.msg_system_control_request:
                        _ = HandleSystemControlRequestAsync((LivelyMessageSystemControlRequest)obj);
                        break;
                }
            }
        }

        private async Task HandleSystemControlRequestAsync(LivelyMessageSystemControlRequest request)
        {
            var response = new LivelyMessageSystemControlResponse
            {
                RequestId = request.RequestId ?? string.Empty,
                UserVisible = !string.Equals(request.Action, "volume-read", StringComparison.Ordinal)
                    && !string.Equals(request.Action, "permissions-read", StringComparison.Ordinal),
            };
            try
            {
                if (string.IsNullOrWhiteSpace(request.RequestId) || request.RequestId.Length > 80)
                    throw new InvalidDataException("Invalid system control request id.");

                switch (request.Action)
                {
                    case "permissions-read":
                        response.PermissionsJson = LoadCurrentPermissionGrants().ToString(Formatting.None);
                        break;
                    case "volume-read":
                        SetVolumeResponse(response, systemControlService.GetVolume());
                        break;
                    case "volume-set":
                        EnsureActionPermission(request.Subject);
                        SetVolumeResponse(response, systemControlService.SetVolume(request.Level, null));
                        break;
                    case "volume-mute":
                        EnsureActionPermission(request.Subject);
                        SetVolumeResponse(response, systemControlService.SetVolume(null, request.Muted));
                        break;
                    case "volume-toggle-mute":
                        EnsureActionPermission(request.Subject);
                        var current = systemControlService.GetVolume();
                        SetVolumeResponse(response, systemControlService.SetVolume(null, !current.Muted));
                        break;
                    case "play":
                    case "pause":
                    case "toggle-play-pause":
                    case "next":
                    case "previous":
                        EnsureActionPermission(request.Subject);
                        using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5)))
                        {
                            var action = request.Action switch
                            {
                                "play" => SystemMediaAction.Play,
                                "pause" => SystemMediaAction.Pause,
                                "toggle-play-pause" => SystemMediaAction.TogglePlayPause,
                                "next" => SystemMediaAction.Next,
                                "previous" => SystemMediaAction.Previous,
                                _ => throw new InvalidOperationException(),
                            };
                            if (!await systemControlService.ControlMediaAsync(action, timeout.Token))
                                throw new InvalidOperationException("Windows has no controllable current media session.");
                        }
                        break;
                    default:
                        throw new InvalidDataException($"Unsupported system action {request.Action}.");
                }
                response.Success = true;
            }
            catch (Exception error)
            {
                response.Success = false;
                response.Error = error.Message;
                Logger.Warn($"Wv2{uniqueId}: System control rejected: {error.Message}");
            }
            SendMessage(response);
        }

        private void EnsureActionPermission(string subject)
        {
            if (string.IsNullOrWhiteSpace(subject))
                throw new UnauthorizedAccessException("System action has no permission subject.");
            var grants = LoadCurrentPermissionGrants();
            var permissions = grants[subject] as Newtonsoft.Json.Linq.JArray;
            if (permissions == null || !permissions.Values<string>().Contains("action.invoke", StringComparer.Ordinal))
                throw new UnauthorizedAccessException("This content version is not authorized for system actions.");
        }

        private Newtonsoft.Json.Linq.JObject LoadCurrentPermissionGrants()
        {
            try
            {
                var package = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(GetPackageRoomPath()));
                var sourcePath = ResolveTrustedSourceRoomPath(package);
                if (sourcePath == null)
                    return new Newtonsoft.Json.Linq.JObject();
                var normalized = Path.GetFullPath(sourcePath).Replace('\\', '/').ToLowerInvariant();
                var fingerprint = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(sourcePath))).ToLowerInvariant();
                var storePath = Path.Combine(DextRuntimeIdentity.Current.AppDataDirectory, "permissions-v1.json");
                if (!File.Exists(storePath))
                    return new Newtonsoft.Json.Linq.JObject();
                var store = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(storePath));
                var grant = (int?)store["version"] == 1
                    ? store["rooms"]?[normalized] as Newtonsoft.Json.Linq.JObject
                    : null;
                if (grant == null || !string.Equals((string)grant["fingerprint"], fingerprint, StringComparison.Ordinal))
                    return new Newtonsoft.Json.Linq.JObject();
                return grant["subjects"] as Newtonsoft.Json.Linq.JObject ?? new Newtonsoft.Json.Linq.JObject();
            }
            catch (Exception error)
            {
                Logger.Warn($"Wv2{uniqueId}: Permission store unavailable: {error.Message}");
                return new Newtonsoft.Json.Linq.JObject();
            }
        }

        private static void SetVolumeResponse(
            LivelyMessageSystemControlResponse response,
            SystemVolumeSnapshot volume)
        {
            response.HasVolume = true;
            response.Level = volume.Level;
            response.Muted = volume.Muted;
        }

        private void AddDockIconToRoom(LivelyMessageAddDockIconCmd msg)
        {
            try
            {
                lock (roomPersistenceLock)
                {
                    if (string.IsNullOrWhiteSpace(msg.LaunchTarget))
                    {
                        Logger.Error($"Wv2{uniqueId}: AddDockIcon rejected: missing launch target");
                        return;
                    }
                    var roomPath = GetPackageRoomPath();
                    var jo = Newtonsoft.Json.Linq.JObject.Parse(System.IO.File.ReadAllText(roomPath));
                    var scope = string.Equals(msg.Scope, "global", StringComparison.OrdinalIgnoreCase) ? "global" : "desk";
                    Newtonsoft.Json.Linq.JObject target;
                    if (scope == "global")
                    {
                        target = jo["dock"] as Newtonsoft.Json.Linq.JObject ?? new Newtonsoft.Json.Linq.JObject();
                        jo["dock"] = target;
                    }
                    else
                    {
                        var desks = jo["desks"] as Newtonsoft.Json.Linq.JArray;
                        if (desks == null || msg.DeskIndex < 0 || msg.DeskIndex >= desks.Count || desks[msg.DeskIndex] is not Newtonsoft.Json.Linq.JObject desk)
                        {
                            Logger.Error($"Wv2{uniqueId}: AddDockIcon rejected: invalid desk index {msg.DeskIndex}");
                            return;
                        }
                        target = desk["dock"] as Newtonsoft.Json.Linq.JObject ?? new Newtonsoft.Json.Linq.JObject();
                        desk["dock"] = target;
                    }
                    var inheritedIcons = jo["dock"]?["icons"] as Newtonsoft.Json.Linq.JArray;
                    var icons = target["icons"] as Newtonsoft.Json.Linq.JArray
                        ?? (scope == "desk" && inheritedIcons != null
                            ? (Newtonsoft.Json.Linq.JArray)inheritedIcons.DeepClone()
                            : new Newtonsoft.Json.Linq.JArray());
                    target["icons"] = icons;
                    if (icons.OfType<Newtonsoft.Json.Linq.JObject>().Any(icon => (string)icon["launch"]?["target"] == msg.LaunchTarget))
                    {
                        Logger.Info($"Wv2{uniqueId}: AddDockIcon skipped duplicate: {msg.LaunchTarget}");
                        return;
                    }
                    icons.Add(new Newtonsoft.Json.Linq.JObject
                    {
                        ["label"] = msg.Label ?? msg.LaunchTarget,
                        ["icon_png"] = msg.IconPng ?? string.Empty,
                        ["glyph"] = msg.Glyph ?? "?",
                        ["color"] = msg.Color ?? "#3b82f6",
                        ["action"] = msg.Action ?? $"启动 {msg.Label ?? msg.LaunchTarget}",
                        ["launch"] = new Newtonsoft.Json.Linq.JObject
                        {
                            ["target"] = msg.LaunchTarget,
                            ["args"] = msg.LaunchArgs ?? string.Empty,
                            ["workdir"] = msg.LaunchWorkdir ?? string.Empty,
                        },
                    });
                    SaveTrustedRoomCopies(roomPath, jo);
                    Logger.Info($"Wv2{uniqueId}: AddDockIcon: {roomPath}");
                }
            }
            catch (Exception ex)
            {
                Logger.Error($"Wv2{uniqueId}: AddDockIcon failed: {ex.Message}");
            }
        }

        private string GetPackageRoomPath()
        {
            var roomDir = File.Exists(wallpaperPath)
                ? Path.GetDirectoryName(wallpaperPath)
                : wallpaperPath;
            return Path.Combine(roomDir, "room.json");
        }

        private static string ResolveTrustedSourceRoomPath(Newtonsoft.Json.Linq.JObject packageRoom)
        {
            var source = (string)packageRoom?["__source"];
            if (string.IsNullOrWhiteSpace(source))
                return null;
            try
            {
                var fullPath = Path.GetFullPath(source);
                if (Directory.Exists(fullPath))
                    fullPath = Path.Combine(fullPath, "room.json");
                if (!File.Exists(fullPath) ||
                    !string.Equals(Path.GetFileName(fullPath), "room.json", StringComparison.OrdinalIgnoreCase))
                    return null;
                return fullPath;
            }
            catch
            {
                return null;
            }
        }

        private void SaveTrustedRoomCopies(string packageRoomPath, Newtonsoft.Json.Linq.JObject incoming)
        {
            lock (roomPersistenceLock)
            {
                // The source stamp is trusted only from the existing package produced by Rust.
                // A page-provided __source is always discarded before either write.
                var existing = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(packageRoomPath));
                var sourcePath = ResolveTrustedSourceRoomPath(existing);
                var sourceStamp = (string)existing["__source"];
                var clean = (Newtonsoft.Json.Linq.JObject)incoming.DeepClone();
                clean.Remove("__source");
                var package = (Newtonsoft.Json.Linq.JObject)clean.DeepClone();
                if (!string.IsNullOrWhiteSpace(sourceStamp))
                    package["__source"] = sourceStamp;

                AtomicWriteJson(packageRoomPath, package);
                if (sourcePath != null)
                {
                    AtomicWriteJson(sourcePath, clean);
                    Logger.Info($"Wv2{uniqueId}: Room source sync: {sourcePath}");
                }
            }
        }

        private static void AtomicWriteJson(string path, Newtonsoft.Json.Linq.JObject room)
        {
            var tempPath = path + $".{Guid.NewGuid():N}.tmp";
            File.WriteAllText(tempPath, room.ToString(Formatting.Indented), new UTF8Encoding(false));
            if (File.Exists(path))
                File.Replace(tempPath, path, null);
            else
                File.Move(tempPath, path);
        }

        private void TrackLaunchedApp(string target)
        {
            var normalized = target?.Trim();
            if (string.IsNullOrWhiteSpace(normalized))
                return;

            lock (appMonitorLock)
            {
                if (!monitoredAppTargets.Add(normalized))
                    return;
            }

            SendMessage(new LivelyMessageAppStatus { Target = normalized, Running = true });
            _ = MonitorLaunchedApp(normalized, appMonitorCts.Token);
        }

        private async Task MonitorLaunchedApp(string target, CancellationToken cancellationToken)
        {
            var observedRunning = false;
            var launchGraceUntil = DateTime.UtcNow.AddSeconds(5);
            try
            {
                while (!cancellationToken.IsCancellationRequested && !IsExited)
                {
                    var running = IsTargetRunning(target);
                    if (running)
                    {
                        observedRunning = true;
                        launchGraceUntil = DateTime.UtcNow.AddSeconds(5);
                    }
                    else if (observedRunning || DateTime.UtcNow >= launchGraceUntil)
                    {
                        SendMessage(new LivelyMessageAppStatus { Target = target, Running = false });
                        return;
                    }

                    await Task.Delay(500, cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Wallpaper is closing; stop runtime telemetry with it.
            }
            finally
            {
                lock (appMonitorLock)
                    monitoredAppTargets.Remove(target);
            }
        }

        private static bool IsTargetRunning(string target)
        {
            string processName;
            try
            {
                processName = Path.GetFileNameWithoutExtension(target);
            }
            catch
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(processName))
                return false;

            Process[] processes;
            try
            {
                processes = Process.GetProcessesByName(processName);
            }
            catch
            {
                return false;
            }

            var targetPath = Path.IsPathRooted(target) ? Path.GetFullPath(target) : null;
            foreach (var candidate in processes)
            {
                try
                {
                    if (targetPath is null)
                        return true;

                    var candidatePath = candidate.MainModule?.FileName;
                    if (string.IsNullOrWhiteSpace(candidatePath) ||
                        string.Equals(Path.GetFullPath(candidatePath), targetPath, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
                catch
                {
                    // Access-denied process metadata is still a useful name-level match.
                    return true;
                }
                finally
                {
                    candidate.Dispose();
                }
            }

            return false;
        }

        public void Terminate()
        {
            if (IsExited)
                return;

            try
            {
                process.Kill();
            }
            catch { }
        }

        public void SetPlaybackPos(float pos, PlaybackPosType type)
        {
            if (pos == 0 && type != PlaybackPosType.relativePercent)
            {
                SendMessage(new LivelyReloadCmd());
            }
        }

        public async Task ScreenCapture(string filePath)
        {
            await WaitForContentReadyAsync(TimeSpan.FromSeconds(5));

            var tcs = new TaskCompletionSource();
            void LocalOutputDataReceived(object sender, DataReceivedEventArgs e)
            {
                if (string.IsNullOrEmpty(e.Data))
                {
                    tcs.TrySetException(new InvalidOperationException("Process exited unexpectedly."));
                }
                else
                {
                    var obj = JsonConvert.DeserializeObject<IpcMessage>(e.Data, new JsonSerializerSettings() { Converters = { new IpcMessageConverter() } });
                    if (obj.Type == MessageType.msg_screenshot)
                    {
                        var msg = (LivelyMessageScreenshot)obj;
                        if (msg.FileName == Path.GetFileName(filePath))
                        {
                            process.OutputDataReceived -= LocalOutputDataReceived;
                            if (msg.Success)
                                tcs.TrySetResult();
                            else
                                tcs.TrySetException(new InvalidOperationException($"Failed to take screenshot."));
                        }
                    }
                }
            }
            process.OutputDataReceived += LocalOutputDataReceived;

            Logger.Info($"Wv2{uniqueId}: Taking screenshot: {filePath}");
            SendMessage(new LivelyScreenshotCmd()
            {
                FilePath = Path.GetExtension(filePath) != ".jpg" ? filePath + ".jpg" : filePath,
                Format = ScreenshotFormat.jpeg,
                Delay = 0 //unused
            });

            // Timeout
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using (cts.Token.Register(() =>
            {
                if (!IsExited)
                    process.OutputDataReceived -= LocalOutputDataReceived;

                tcs.TrySetException(new TimeoutException($"Screenshot timed out."));
            }))

            await tcs.Task;
        }

        public void Dispose()
        {
            // Process object is disposed in Exit event.
            Terminate();
        }

        private async Task WaitForContentReadyAsync(TimeSpan timeout)
        {
            using var cts = new CancellationTokenSource(timeout);
            await contentReadyTcs.Task.WaitAsync(cts.Token);
        }

        private static string ResolveFilePath(string path, LibraryModel model)
        {
            var filePath = path;
            if (PackageUtil.IsRunningAsPackaged)
            {
                try
                {
                    if (!model.LivelyInfo.Type.IsOnlineWallpaper())
                        filePath = PackageUtil.ValidateAndResolvePath(path);
                }
                catch (Exception ex)
                {
                    Logger.Error(ex);
                }
            }

            return filePath;
        }

        /// <summary>
        /// Backward compatibility, appends --wallpaper to arguments if required.
        /// </summary>
        private static bool TryParseUserCommandArgs(string args, out string result)
        {
            if (string.IsNullOrWhiteSpace(args))
            {
                result = null;
                return false;
            }

            var words = args.Split(' ');
            for (int i = 0; i < words.Length; i++)
            {
                if (words[i].StartsWith("--"))
                {
                    words[i] = string.Concat("--wallpaper-", words[i].AsSpan(2));
                }
            }
            result = string.Join(" ", words);
            return true;
        }
    }
}
