using NAudio.CoreAudioApi;
using Windows.Media;
using Windows.Media.Core;
using Windows.Media.Playback;

// Owned, muted publisher and the exact original audio endpoint. No command is
// sent until actual Core reports this unique title as its current media session.
internal sealed class NativeControlProbeDevices : IDisposable
{
    private readonly MMDeviceEnumerator enumerator=new();
    private readonly MMDevice endpoint;
    private readonly float level;
    private readonly bool muted;
    private MediaPlayer? player;
    private SystemMediaTransportControls? controls;
    private int commands;
    public string Title { get; } = "Dext owned native control probe "+Guid.NewGuid();
    public double OriginalLevel=>level;
    public bool OriginalMuted=>muted;
    public double TestLevel=>level>=.05?level-.05:.05;
    public string DeviceId=>endpoint.ID;
    public int Commands=>Volatile.Read(ref commands);
    public NativeControlProbeDevices()
    {
        endpoint=enumerator.GetDefaultAudioEndpoint(DataFlow.Render,Role.Multimedia);
        level=endpoint.AudioEndpointVolume.MasterVolumeLevelScalar;muted=endpoint.AudioEndpointVolume.Mute;
    }
    public void StartMedia(string path)
    {
        player=new MediaPlayer{IsMuted=true,IsLoopingEnabled=true};
        player.CommandManager.IsEnabled=false;controls=player.SystemMediaTransportControls;
        controls.IsEnabled=true;controls.IsPlayEnabled=true;controls.IsPauseEnabled=true;controls.IsNextEnabled=true;controls.IsPreviousEnabled=true;
        controls.ButtonPressed+=OnButton;
        player.Source=MediaSource.CreateFromUri(new Uri(Path.GetFullPath(path)));
        controls.DisplayUpdater.Type=MediaPlaybackType.Music;controls.DisplayUpdater.MusicProperties.Title=Title;controls.DisplayUpdater.Update();
        player.Play();controls.PlaybackStatus=MediaPlaybackStatus.Playing;
    }
    private void OnButton(SystemMediaTransportControls sender,SystemMediaTransportControlsButtonPressedEventArgs args)
    {
        if(args.Button==SystemMediaTransportControlsButton.Play){player?.Play();sender.PlaybackStatus=MediaPlaybackStatus.Playing;}
        else if(args.Button==SystemMediaTransportControlsButton.Pause){player?.Pause();sender.PlaybackStatus=MediaPlaybackStatus.Paused;}
        Interlocked.Increment(ref commands);
    }
    public bool IsRestored()=>endpoint.AudioEndpointVolume.MasterVolumeLevelScalar==level&&endpoint.AudioEndpointVolume.Mute==muted;
    public void Restore(){endpoint.AudioEndpointVolume.MasterVolumeLevelScalar=level;endpoint.AudioEndpointVolume.Mute=muted;if(!IsRestored())throw new Exception("original endpoint volume/mute restoration failed");}
    public void Dispose()
    {
        try{Restore();}
        finally{if(controls!=null){controls.ButtonPressed-=OnButton;controls.IsEnabled=false;}player?.Dispose();endpoint.Dispose();enumerator.Dispose();}
    }
}
