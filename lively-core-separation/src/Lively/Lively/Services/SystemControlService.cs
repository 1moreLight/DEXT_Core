using Lively.Grpc.Common.Proto.Desktop;
using NAudio.CoreAudioApi;
using NPSMLib;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services
{
    internal interface ISystemControlService
    {
        Task<SystemMediaSnapshot> GetMediaAsync(CancellationToken cancellationToken);
        Task<bool> ControlMediaAsync(SystemMediaAction action, CancellationToken cancellationToken);
        SystemVolumeSnapshot GetVolume();
        SystemVolumeSnapshot SetVolume(double? level, bool? muted);
    }

    internal sealed class SystemControlService : ISystemControlService
    {
        private readonly NowPlayingSessionManager mediaManager = new();
        private readonly object mediaLock = new();

        public Task<SystemMediaSnapshot> GetMediaAsync(CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            lock (mediaLock)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var session = mediaManager.CurrentSession;
                if (session is null)
                    return Task.FromResult(new SystemMediaSnapshot());

                var source = session.ActivateMediaPlaybackDataSource();
                var media = source.GetMediaObjectInfo();
                var playback = source.GetMediaPlaybackInfo();
                var timeline = source.GetMediaTimelineProperties();
                var capabilities = playback.PlaybackCaps;
                var snapshot = new SystemMediaSnapshot
                {
                    HasSession = true,
                    SourceAppId = session.SourceAppId ?? source.GetParentApplicationId() ?? string.Empty,
                    Title = media.Title ?? string.Empty,
                    Artist = media.Artist ?? string.Empty,
                    AlbumTitle = media.AlbumTitle ?? string.Empty,
                    AlbumArtist = media.AlbumArtist ?? string.Empty,
                    PlaybackStatus = playback.PlaybackState.ToString().ToLowerInvariant(),
                    PositionMs = ToMilliseconds(timeline.Position),
                    DurationMs = ToMilliseconds(timeline.EndTime),
                    CanPlay = capabilities.HasFlag(MediaPlaybackCapabilities.Play),
                    CanPause = capabilities.HasFlag(MediaPlaybackCapabilities.Pause),
                    CanTogglePlayPause = capabilities.HasFlag(MediaPlaybackCapabilities.PlayPauseToggle),
                    CanNext = capabilities.HasFlag(MediaPlaybackCapabilities.Next),
                    CanPrevious = capabilities.HasFlag(MediaPlaybackCapabilities.Previous),
                };
                return Task.FromResult(snapshot);
            }
        }

        public Task<bool> ControlMediaAsync(
            SystemMediaAction action,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            lock (mediaLock)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var session = mediaManager.CurrentSession;
                if (session is null)
                    return Task.FromResult(false);
                var source = session.ActivateMediaPlaybackDataSource();
                var command = action switch
                {
                    SystemMediaAction.Play => MediaPlaybackCommands.Play,
                    SystemMediaAction.Pause => MediaPlaybackCommands.Pause,
                    SystemMediaAction.TogglePlayPause => MediaPlaybackCommands.PlayPauseToggle,
                    SystemMediaAction.Next => MediaPlaybackCommands.Next,
                    SystemMediaAction.Previous => MediaPlaybackCommands.Previous,
                    _ => throw new ArgumentOutOfRangeException(nameof(action), action, "Unsupported media action"),
                };
                cancellationToken.ThrowIfCancellationRequested();
                return Task.FromResult(source.SendMediaPlaybackCommand(command));
            }
        }

        public SystemVolumeSnapshot GetVolume()
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            return Snapshot(device);
        }

        public SystemVolumeSnapshot SetVolume(double? level, bool? muted) => SetVolume(level,muted,CancellationToken.None);

        public SystemVolumeSnapshot SetVolume(double? level, bool? muted,CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (level.HasValue && (!double.IsFinite(level.Value) || level.Value < 0 || level.Value > 1))
                throw new ArgumentOutOfRangeException(nameof(level), "System volume must be between 0.0 and 1.0");
            if (!level.HasValue && !muted.HasValue)
                throw new ArgumentException("At least one system volume field must be set");

            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            if (level.HasValue)
            {
                cancellationToken.ThrowIfCancellationRequested();
                device.AudioEndpointVolume.MasterVolumeLevelScalar = (float)level.Value;
            }
            if (muted.HasValue)
            {
                cancellationToken.ThrowIfCancellationRequested();
                device.AudioEndpointVolume.Mute = muted.Value;
            }
            return Snapshot(device);
        }

        private static SystemVolumeSnapshot Snapshot(MMDevice device) => new()
        {
            Level = device.AudioEndpointVolume.MasterVolumeLevelScalar,
            Muted = device.AudioEndpointVolume.Mute,
            DeviceId = device.ID ?? string.Empty,
            DeviceName = device.FriendlyName ?? string.Empty,
        };

        private static long ToMilliseconds(TimeSpan? value) => value.HasValue
            ? Math.Max(0, (long)value.Value.TotalMilliseconds)
            : 0;

    }
}
