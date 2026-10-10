#nullable enable
using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using System;

namespace Lively.Services.ApplicationDock;

internal sealed record DockTaskCompletion(long Sequence,string ContextId,string ItemId,string? WindowId,string Action,RoomNativeInputGesture Gesture,long CancellationVersion);

// Per native attachment, fed only by Core raw gestures and Player dispatch receipts.
// The caller checks current native visibility/viewport and author input exclusion.
// This correlates input; resolving app IDs and executing actions remains in the service.
internal sealed class DockTaskInput(TimeProvider clock)
{
    private readonly object gate=new();
    private long highestSequence;
    private DockTaskCompletion? down;

    public DockTaskCompletion? Sample(RoomNativeInputGesture? physical,DextNativePointerPacket packet,LivelyRoomNativeTaskHit hit,long cancellationVersion=0)
    {
        lock(gate)
        {
            if(cancellationVersion<0||!Matches(physical,packet)||!DextNativeTaskSample.Valid(hit)||!Contains(hit,packet)) { down=null;return null; }
            var identity=physical! with{Released=false,ReleaseX=null,ReleaseY=null};
            if(packet.Kind=="down")
            {
                if(packet.GestureId<=highestSequence)return null;
                highestSequence=packet.GestureId;
                down=new(packet.GestureId,hit.ContextId,hit.ItemId,hit.WindowId,hit.Action,identity,cancellationVersion);
                return null;
            }
            var previous=down;down=null;
            if(previous==null||previous.CancellationVersion!=cancellationVersion||previous.Gesture!=identity||previous.ContextId!=hit.ContextId||
                previous.ItemId!=hit.ItemId||previous.WindowId!=hit.WindowId||previous.Action!=hit.Action)return null;
            return previous with{Gesture=physical!};
        }
    }
    public static bool IsCurrent(DockTaskCompletion completion,RoomNativeInputState? current,RoomNativeViewport? viewport,TimeProvider clock)
    {
        if(completion==null||current==null)return false;
        var g=completion.Gesture;var elapsed=((decimal)clock.GetTimestamp()-g.IssuedAt)/clock.TimestampFrequency;
        return elapsed>=0&&elapsed<1.5m&&g.Released&&current.Generation==g.Generation&&current.Session==g.Session&&
            current.Revision==g.Revision&&current.GeometryVersion==g.GeometryVersion&&viewport==g.Viewport&&current.CancellationVersion==completion.CancellationVersion;
    }
    public void Clear(){lock(gate)down=null;}
    private bool Matches(RoomNativeInputGesture? g,DextNativePointerPacket p)
    {
        if(g==null||p==null||g.Key!=0||p.Key!=0||!g.SampleMouse||!p.SampleMouse||p.Kind!="down"&&p.Kind!="up")return false;
        var v=g.Viewport;
        if(v==null||g.Sequence!=p.GestureId||g.Generation!=p.RuntimeGeneration||g.Session!=p.SessionId||g.Revision!=p.Revision||
            g.GeometryVersion!=p.GeometryVersion||g.IssuedAt!=p.IssuedAt||v.Handle.ToInt64()!=p.InputHandle||v.X!=p.OriginX||v.Y!=p.OriginY||
            v.Width!=p.PixelWidth||v.Height!=p.PixelHeight||v.Dpi!=p.Dpi)return false;
        var elapsed=((decimal)clock.GetTimestamp()-g.IssuedAt)/clock.TimestampFrequency;
        if(elapsed<0||elapsed>=1.5m)return false;
        if(p.Kind=="down")return p.X==g.X&&p.Y==g.Y;
        return g.Released&&p.X==g.ReleaseX&&p.Y==g.ReleaseY&&
            Math.Abs((double)p.X-g.X)<=v.DragTolerance&&Math.Abs((double)p.Y-g.Y)<=v.DragTolerance;
    }
    private static bool Contains(LivelyRoomNativeTaskHit hit,DextNativePointerPacket p)
    {
        var x=((double)p.X-p.OriginX)/p.PixelWidth;var y=((double)p.Y-p.OriginY)/p.PixelHeight;
        return x>=hit.X&&x<hit.X+hit.Width&&y>=hit.Y&&y<hit.Y+hit.Height;
    }
}
