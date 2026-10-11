using Dext.Core.Rooms;
using Lively.Services.DesktopSync;
using System;
using System.Diagnostics;
using System.Linq;
using System.Threading;
namespace Lively.Core.Wallpapers;

public partial class WebWebView2
{
    internal Func<int,int,bool> NativeContextIsDesktop { private get; set; }
    internal DesktopFileContextOffer CaptureDesktopContextOffer(IntPtr[] roots,long expires)
    {
        var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;
        if(nativeDock||state is null||IsExited||roots.Length==0)return null;
        var viewport=ReadNativeViewport();if(viewport is null)return null;
        var regions=a.Input.CaptureContextGeometry(viewport);
        if(regions is null||!regions.Any(value=>value.Consumer=="official.desktop"&&value.Button.StartsWith("desktop-",StringComparison.Ordinal)))return null;
        long sequence=0;
        return new(expires,roots[0],viewport.X,viewport.Y,viewport.Width,viewport.Height,viewport.DragTolerance,regions,edge=>{
            var before=a.Input.State;var measured=ReadNativeViewport();
            var valid=!IsExited&&ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a)&&measured==viewport&&before is not null&&
                before.Generation==state.Generation&&before.Session==state.Session&&before.Revision==state.Revision&&before.GeometryVersion==state.GeometryVersion&&
                NativeContextIsDesktop?.Invoke(edge.X,edge.Y)==true;
            if(edge.Down){
                if(valid&&Stopwatch.GetTimestamp()<=expires)
                    sequence=a.Input.ContextDown(viewport,state.Generation,state.Revision,state.GeometryVersion,edge.At,edge.X,edge.Y,edge.Button,edge.EntryId,true);
            }else a.Input.ContextUp(measured??MissingViewport,sequence,edge.X,edge.Y,valid,edge.Cancelled);
            NotifyNative(a,before,!edge.Down);
        },roots.Skip(1));
    }
}
