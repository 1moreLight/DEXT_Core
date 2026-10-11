using Dext.Core.Rooms;
using Lively.Services.DesktopSync;
using System;
using System.Diagnostics;
using System.Threading;
namespace Lively.Core.Wallpapers;

public partial class WebWebView2
{
    internal event Action NativeDesktopKeyboardChanged;
    internal DesktopFileKeyboardOffer CaptureDesktopFileKeyboardOffer(IntPtr foreground,long expires)
    {
        var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;
        if(nativeDock||state?.Focus is not{Consumer:RoomActionAuthority.DesktopConsumer} focus||!state.KeyReady)return null;
        var snapshot=a.Bridge.Read().Snapshot;
        if(snapshot is null||!snapshot.IsActive||!snapshot.IsDesktopForeground||snapshot.Lifecycle.Locked||snapshot.Lifecycle.PlaybackPaused||
            snapshot.Lifecycle.Stage!=RoomLifecycleStage.Desktop||snapshot.TransitionId is not null)return null;
        var viewport=ReadNativeViewport();if(viewport is null)return null;
        return new(expires,foreground,viewport.X,viewport.Y,viewport.Width,viewport.Height,focus.Button,edge=>{
            var current=a.Input.State;
            var valid=(!edge.Down||Stopwatch.GetTimestamp()<=expires)&&!IsExited&&ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a)&&current is not null&&
                current.Generation==state.Generation&&current.Session==state.Session&&current.Revision==state.Revision&&
                current.GeometryVersion==state.GeometryVersion&&current.CancellationVersion==state.CancellationVersion&&current.Focus==focus&&
                NativeInputIsForeground?.Invoke()==true;
            if(valid)NativeKey(edge.Key,edge.Down,false,true,edge.ScanCode,edge.Extended,exclusiveDesktop:true,modifiers:edge.Modifiers);
            else if(!edge.Down){
                // Release the old attachment's held key, never deliver it to a new focus.
                a.Input.Key(viewport,edge.Key,false,false,false,edge.Modifiers);a.KeyDelivery?.Up(edge.Key);
            }
        });
    }
}
