using System;
using System.Diagnostics;
using System.Threading;
using Dext.Core.Rooms;
using Lively.Models.Message;
namespace Lively.Core.Wallpapers
{
    public partial class WebWebView2
    {
        private sealed class DockTouchContact
        {
            internal int Id,X,Y;
            internal long Started,Generation,Revision;
            internal Guid Session;
            internal bool Released;
            internal RoomNativeViewport Viewport;
        }
        private DockTouchContact dockTouchContact;
        private Guid dockTouchDocument;
        private long dockTouchSequence;
        private bool NativeDockTouchAvailable()
        {
            var touch=dockTouchContact;
            var scope=Volatile.Read(ref roomNativeAttachment)?.Input.State;
            return touch!=null&&scope!=null&&scope.Generation==touch.Generation&&scope.Session==touch.Session&&scope.Revision==touch.Revision&&
                (Stopwatch.GetTimestamp()-touch.Started)/(double)Stopwatch.Frequency<1.5&&
                ReadNativeViewport()==touch.Viewport&&NativeDockAt(touch.X,touch.Y);
        }
        private void CancelNativeDockTouch()
        {
            if(dockTouchContact==null)return;
            dockTouchContact=null;
            NativeMouseMove(0,0,false);
            NativeMouseUp(0,0,false);
        }
        private void AcceptNativeDockTouch(LivelyMessageRoomDockTouch value)
        {
            lock(nativeDockInputGate)
            {
                var current=Volatile.Read(ref roomNativeAttachment)?.Input.State;
                if(!nativeDock||!Volatile.Read(ref nativeDockRouteConnected)||current==null||value.WindowHwnd!=Handle.ToInt64()||
                    value.RuntimeGeneration!=current.Generation||value.SessionId!=current.Session||value.Revision!=current.Revision||
                    value.Sequence<=0||value.DocumentNonce==Guid.Empty||value.IssuedAt<=0)return;
                var elapsed=(Stopwatch.GetTimestamp()-value.IssuedAt)/(double)Stopwatch.Frequency;
                if(elapsed<0||elapsed>=1.5)return;
                if(dockTouchDocument!=value.DocumentNonce){CancelNativeDockTouch();dockTouchDocument=value.DocumentNonce;dockTouchSequence=0;}
                if(value.Sequence<=dockTouchSequence)return;
                dockTouchSequence=value.Sequence;
                if(value.Kind=="cancel"){if(dockTouchContact?.Id==value.PointerId)CancelNativeDockTouch();return;}
                if(value.Kind!="down"&&value.Kind!="up")return;
                var viewport=ReadNativeViewport();
                if(viewport==null||!(value.X>=0&&value.X<1&&value.Y>=0&&value.Y<1)){CancelNativeDockTouch();return;}
                var x=viewport.X+(int)Math.Floor(value.X*viewport.Width);
                var y=viewport.Y+(int)Math.Floor(value.Y*viewport.Height);
                if(!NativeDockAt(x,y)){CancelNativeDockTouch();return;}
                if(dockTouchContact!=null&&!NativeDockTouchAvailable())CancelNativeDockTouch();
                if(value.Kind=="down")
                {
                    if(dockTouchContact is {Released:false}){CancelNativeDockTouch();return;}
                    if(nativeDockMouseOwned||nativeDockKeysOwned.Count!=0)return;
                    dockTouchContact=new DockTouchContact{Id=value.PointerId,X=x,Y=y,Started=value.IssuedAt,Viewport=viewport,Generation=current.Generation,Session=current.Session,Revision=current.Revision};
                    NativeMouseDown(x,y,true);
                }
                else
                {
                    var touch=dockTouchContact;
                    if(touch==null||touch.Id!=value.PointerId||touch.Released)return;
                    if(touch.Viewport!=viewport||!NativeDockTouchAvailable()){CancelNativeDockTouch();return;}
                    touch.X=x;touch.Y=y;touch.Released=true;
                    NativeMouseUp(x,y,true);
                }
                Logger.Debug($"Dock touch edge={value.Kind} sequence={value.Sequence} pointer={value.PointerId}");
            }
        }
    }
}
