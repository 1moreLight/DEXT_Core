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
    internal Func<IntPtr> NativeDesktopMenuTarget { private get; set; }
    private void RestoreDesktopMenuFocus(NativeAttachment attachment)
    {
        var before=attachment.Input.State;
        if(!IsExited&&ReferenceEquals(Volatile.Read(ref roomNativeAttachment),attachment)&&
            attachment.Input.TryRestoreDesktopMenuFocus(ReadNativeViewport(),NativeInputIsForeground?.Invoke()==true))
            NotifyNative(attachment,before,false);
    }
    internal DesktopFileContextOffer CaptureDesktopContextOffer(IntPtr[] roots,long expires)
    {
        var a=Volatile.Read(ref roomNativeAttachment);var state=a?.Input.State;
        if(nativeDock||state is null||IsExited||roots.Length==0)return null;
        var viewport=ReadNativeViewport();if(viewport is null)return null;
        var regions=a.Input.CaptureContextGeometry(viewport);
        if(regions is null)return null;
        var view=a.Bridge.NativeReadPresentation(a.Actions,state.Session,state.Revision).Presentation?.Desktop;
        var blankAllowed=view is not null&&a.Bridge.NativeCheckDesktopDrop(a.Actions,state.Session,state.Revision,view.ContextId,view.DeskId)==RoomActionStatus.Accepted;
        if(!blankAllowed&&!regions.Any(value=>value.Consumer=="official.desktop"&&value.Button.StartsWith("desktop-",StringComparison.Ordinal)))return null;
        bool blankDown=false;
        long sequence=0;
        return new(expires,roots[0],viewport.X,viewport.Y,viewport.Width,viewport.Height,viewport.DragTolerance,regions,edge=>{
            var before=a.Input.State;var measured=ReadNativeViewport();
            var valid=!IsExited&&ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a)&&measured==viewport&&before is not null&&
                before.Generation==state.Generation&&before.Session==state.Session&&before.Revision==state.Revision&&before.GeometryVersion==state.GeometryVersion&&
                NativeContextIsDesktop?.Invoke(edge.X,edge.Y)==true;
            if(edge.Button=="desktop.background"){
                if(edge.Down)blankDown=blankAllowed&&valid&&Stopwatch.GetTimestamp()<=expires;
                else {var admitted=blankDown&&valid&&!edge.Cancelled;blankDown=false;if(admitted)_=ShowDesktopBackgroundMenuAsync(a,state,view.ContextId,view.DeskId,edge.X,edge.Y);}
                return;
            }
            if(edge.Down){
                if(valid&&Stopwatch.GetTimestamp()<=expires)
                    sequence=a.Input.ContextDown(viewport,state.Generation,state.Revision,state.GeometryVersion,edge.At,edge.X,edge.Y,edge.Button,edge.EntryId,true);
            }else a.Input.ContextUp(measured??MissingViewport,sequence,edge.X,edge.Y,valid,edge.Cancelled);
            NotifyNative(a,before,!edge.Down);
        },roots.Skip(1),allowBackground:blankAllowed);
    }
    private async System.Threading.Tasks.Task ShowDesktopBackgroundMenuAsync(NativeAttachment a,RoomNativeInputState initial,string context,string desk,int x,int y)
    {
        if(!a.DesktopTransfers.Wait(0))return;
        bool Permitted(){var current=a.Input.State;return !IsExited&&ReferenceEquals(Volatile.Read(ref roomNativeAttachment),a)&&current is not null&&
            current.Generation==initial.Generation&&current.Session==initial.Session&&a.Bridge.NativeCheckDesktopDrop(a.Actions,current.Session,current.Revision,context,desk)==RoomActionStatus.Accepted;}
        try {await DesktopContextMenuWindow.ShowAsync(Array.Empty<string>(),x,y,Permitted,NativeDesktopMenuTarget,()=>{},background:true);}
        catch(Exception error){Logger.Error(error,"Desktop background menu failed");}
        finally{a.DesktopTransfers.Release();}
    }
}
