using Lively.Services;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading;

namespace Dext.Core.Rooms;

internal sealed partial class RoomNativeDataSource
{
    public static RoomNativeDataSource ForWindows(ISystemControlService systemControl) => new(
        () => {
            var media=systemControl.GetMediaAsync(CancellationToken.None).GetAwaiter().GetResult();
            return !media.HasSession?new("missing"):new("available",JsonSerializer.SerializeToElement(new{
                sourceAppId=PublicSourceAppId(media.SourceAppId),title=media.Title,artist=media.Artist,albumTitle=media.AlbumTitle,albumArtist=media.AlbumArtist,
                playbackStatus=media.PlaybackStatus,positionMs=media.PositionMs,durationMs=media.DurationMs,
                canPlay=media.CanPlay,canPause=media.CanPause,canTogglePlayPause=media.CanTogglePlayPause,canNext=media.CanNext,canPrevious=media.CanPrevious}));
        },
        () => {var volume=systemControl.GetVolume();return new("available",JsonSerializer.SerializeToElement(new{level=volume.Level,muted=volume.Muted}));},
        () => new Lively.Common.Services.HardwareUsageService());

    // Windows may return an executable path instead of a public application ID.
    private static string PublicSourceAppId(string value) =>
        string.IsNullOrWhiteSpace(value) || value.Length > 160 || value.Any(char.IsControl) ||
        value.Contains(':') || value.Contains('/') || value.Contains('\\')
            ? string.Empty : value;
}
