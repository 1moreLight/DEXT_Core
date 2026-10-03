using Lively.Models.Message;
using Lively.Common.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace Dext.Core.Rooms;

// Bounds are normalized to the actual native input HWND client viewport. The
// official host supplies clipped front-to-back regions; Core owns the mapping.
internal sealed record RoomNativeViewport(nint Handle, int X, int Y, int Width, int Height, int DragTolerance, int Dpi=96);
internal sealed record RoomNativeButton(string Consumer, string Button, double X, double Y,
    double Width, double Height, int TabIndex, string? EntryId=null, LivelyRoomNativePoint[][]? Polygons=null);

internal sealed record RoomNativeInputGesture(long Sequence,long Generation,Guid Session,long Revision,long GeometryVersion,
    RoomNativeViewport Viewport,long IssuedAt,int X,int Y,int Key,bool Released=false);
internal sealed record RoomNativeInputState(long Generation, Guid Session, long Revision, long GeometryVersion, RoomNativeButton? Focus, RoomNativeInputProof? Completed,RoomNativeInputGesture? Gesture=null);

internal sealed class RoomNativeInputProof
{
    private readonly RoomNativeInputAuthority owner;
    private int consumed;
    internal RoomNativeInputProof(RoomNativeInputAuthority owner, RoomNativeButton button, long issuedAt,long sequence)
    { this.owner=owner; Button=button; IssuedAt=issuedAt; Sequence=sequence; }
    internal long Sequence { get; }
    internal bool IsConsumed => Volatile.Read(ref consumed)!=0;
    internal void MarkConsumed() => Volatile.Write(ref consumed,1);
    internal RoomNativeButton Button { get; }
    internal long IssuedAt { get; }
    internal bool Validate(RoomSessionSnapshot snapshot,string consumer,string button,bool consume=false) =>
        owner.Validate(this,snapshot,consumer,button,consume);
}

// Leaf lock only: never call gateway, personal storage, IPC, JS or native APIs
// while holding gate. Snapshot observers and dispatch may enter in that order.
internal sealed class RoomNativeInputAuthority(TimeProvider clock)
{
    private readonly object gate=new();
    private long generation, geometryVersion, inputSequence;
    private RoomSessionSnapshot? snapshot;
    private RoomNativeViewport? viewport;
    private AcceptedEntry[] buttons=Array.Empty<AcceptedEntry>();
    private AcceptedEntry? focused;
    private RoomNativeInputProof? completed;
    private RoomNativeInputGesture? gesture;
    private Press? mouse, keyboard;
    private bool mouseHeld;
    private readonly HashSet<int> keysHeld=new();
    private sealed record Press(AcceptedEntry Entry,long IssuedAt,long Sequence,int X=0,int Y=0,int Key=0);
    private sealed class AcceptedEntry(DextNativeGeometryEntry region)
    {
        internal DextNativeGeometryEntry Region {get;}=region;
        internal RoomNativeButton Button {get;}=new(region.Consumer,region.Button,region.X,region.Y,region.Width,region.Height,region.TabIndex,region.EntryId);
    }
    internal RoomNativeInputState? State
    {
        get {
            var now=clock.GetTimestamp();
            lock(gate){ExpireGesture(now);return snapshot==null?null:new(generation,snapshot.SessionId,snapshot.Revision,geometryVersion,focused?.Button,completed,gesture);}
        }
    }
    internal void InvalidateDocument(long document){lock(gate){if(document==generation)Revoke();}}
    internal void CheckNativeViewport(RoomNativeViewport? current,bool foreground)
    {lock(gate){if(!foreground || current==null || viewport!=null && current!=viewport)ClearGeometry();}}
    internal RoomNativeButton? FocusedButton { get {lock(gate)return focused?.Button;} }

    internal void Initialize(long nextGeneration,RoomSessionSnapshot next)
    {
        lock(gate)
        {
            if(nextGeneration<=generation || nextGeneration<=0)return;
            generation=nextGeneration;geometryVersion=0;snapshot=next;ClearGeometry();
        }
    }
    internal void ObserveSnapshot(RoomSessionSnapshot next)
    {
        lock(gate)
        {
            if(snapshot==null)return;
            if(next.SessionId!=snapshot.SessionId || next.InstallationStamp!=snapshot.InstallationStamp){Revoke();return;}
            if(next.Revision<=snapshot.Revision)return;
            snapshot=next;ClearGeometry();
        }
    }
    internal void Revoke(){lock(gate){snapshot=null;ClearGeometry();}}
    internal bool InvalidateGeometry(long document,Guid session,long revision)
    {lock(gate){if(!Identity(document,session,revision))return false;ClearGeometry();return true;}}

    internal bool PublishGeometry(long document,Guid session,long revision,long version,
        RoomNativeViewport nativeViewport,IReadOnlyList<RoomNativeButton> entries)
    {
        lock(gate)
        {
            if(!Identity(document,session,revision)||version<=geometryVersion)return false;
            geometryVersion=version;ClearGeometry();
            if(nativeViewport==null || nativeViewport.Handle==0 || nativeViewport.Width<=0 || nativeViewport.Height<=0 ||
                nativeViewport.Dpi<=0 || nativeViewport.DragTolerance<1 || nativeViewport.DragTolerance>256 || entries==null || entries.Count>4096)return false;
            var copy=entries.ToArray();
            var input=new LivelyRoomNativeButton[copy.Length];
            for(int i=0;i<copy.Length;i++)
            {
                var entry=copy[i];if(entry==null)return false;
                input[i]=new LivelyRoomNativeButton{Consumer=entry.Consumer,Button=entry.Button,EntryId=entry.EntryId,
                    X=entry.X,Y=entry.Y,Width=entry.Width,Height=entry.Height,TabIndex=entry.TabIndex,Polygons=entry.Polygons};
            }
            if(!DextNativeGeometry.TryCreate(input,out var accepted))return false;
            viewport=nativeViewport;buttons=accepted.Select(region=>new AcceptedEntry(region)).ToArray();return true;
        }
    }
    internal void MouseDown(RoomNativeViewport current,int x,int y,bool foreground)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(mouseHeld)return;
            mouseHeld=true;completed=null;mouse=null;keyboard=null;gesture=null;
            if(!Available(current,foreground) || !Inside(current,x,y)){focused=null;return;}
            focused=Hit(x,y);
            // A raw point can later be resolved against an event-time visual
            // sample. Recording it alone never creates an action completion.
            if(!BeginGesture(now,x,y,0))return;
            if(focused!=null)mouse=new(focused,now,gesture!.Sequence,x,y);
        }
    }
    internal void MouseMove(RoomNativeViewport current,int x,int y,bool foreground)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(!foreground || viewport!=null && viewport!=current){ClearGeometry();return;}
            if(gesture is not{Key:0,Released:false} down)return;
            if(!Available(current,foreground) || Math.Abs((double)x-down.X)>current.DragTolerance || Math.Abs((double)y-down.Y)>current.DragTolerance)
            {mouse=null;gesture=null;completed=null;}
        }
    }
    internal void MouseUp(RoomNativeViewport current,int x,int y,bool foreground)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(!mouseHeld)return;
            mouseHeld=false;var down=mouse;mouse=null;
            // A mouse UP from a superseded pair must not cancel a newer key.
            if(gesture is not{Key:0,Released:false} pending)return;
            if(!Available(current,foreground) || !Inside(current,x,y) ||
                Math.Abs((double)x-pending.X)>current.DragTolerance || Math.Abs((double)y-pending.Y)>current.DragTolerance)
            {gesture=null;return;}
            gesture=pending with{Released=true};
            if(down!=null && Hit(x,y)==down.Entry)Complete(down,now);
        }
    }
    internal void Key(RoomNativeViewport current,int key,bool down,bool reverse,bool foreground)
    {
        if(key!=9 && key!=13 && key!=32)return;
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(down)
            {
                if(!keysHeld.Add(key))return;
                completed=null;keyboard=null;mouse=null;gesture=null;
                if(!Available(current,foreground))return;
                if(key==9)
                {
                    var order=buttons.Where(b=>b.Button.TabIndex>=0).OrderBy(b=>b.Button.TabIndex).ToArray();
                    if(order.Length==0){focused=null;return;}
                    var index=Array.IndexOf(order,focused);
                    var next=index<0?(reverse?order.Length-1:0):(index+(reverse?-1:1)+order.Length)%order.Length;
                    focused=order[next];return;
                }
                if(focused!=null && BeginGesture(now,0,0,key))keyboard=new(focused,now,gesture!.Sequence,Key:key);
            }
            else
            {
                if(!keysHeld.Remove(key))return;
                var press=keyboard;if(press==null || press.Key!=key)return;
                keyboard=null;
                if(gesture==null || gesture.Key!=key || gesture.Released)return;
                if(!Available(current,foreground) || focused!=press.Entry){gesture=null;return;}
                gesture=gesture with{Released=true};Complete(press,now);
            }
        }
    }
    // Correlation is private routing metadata, never evidence of a gesture.
    // Zero asks for the current proof; delayed defaults must name an exact edge.
    internal RoomNativeInputProof? GetProof(long document,long version,string consumer,string button,long sequence=0)
    {
        lock(gate)return generation==document && geometryVersion==version && completed is{} proof &&
            sequence>=0 && (sequence==0 || sequence==proof.Sequence) &&
            proof.Button.Consumer==consumer && proof.Button.Button==button ? proof : null;
    }
    private bool BeginGesture(long now,int x,int y,int key)
    {
        if(inputSequence>=9007199254740991){ClearGeometry();return false;}
        gesture=new(++inputSequence,generation,snapshot!.SessionId,snapshot.Revision,geometryVersion,viewport!,now,x,y,key);
        return true;
    }
    private void Complete(Press press,long now)
    {
        if(gesture is not{Released:true} current || current.Sequence!=press.Sequence || Expired(press.IssuedAt,now))return;
        completed=new(this,press.Entry.Button,press.IssuedAt,press.Sequence);
    }
    private bool Expired(long issued,long now)
    {
        var elapsed=((decimal)now-issued)/clock.TimestampFrequency;
        return elapsed<0 || elapsed>=1.5m;
    }
    private void ExpireGesture(long now)
    {
        if(gesture!=null && Expired(gesture.IssuedAt,now))
        {
            gesture=null;mouse=null;keyboard=null;
            // Keep an already completed proof for the action authority to return
            // expiredInput consistently. Its original DOWN time never changes.
        }
    }
    private static bool Inside(RoomNativeViewport value,int x,int y)=>
        (double)x-value.X>=0 && (double)x-value.X<value.Width && (double)y-value.Y>=0 && (double)y-value.Y<value.Height;
    internal bool Validate(RoomNativeInputProof proof,RoomSessionSnapshot current,string consumer,string button,bool consume)
    {
        lock(gate)
        {
            if(completed!=proof || viewport==null || snapshot==null || !CanInput() ||
                current.SessionId!=snapshot.SessionId || current.RoomId!=snapshot.RoomId || current.InstallationStamp!=snapshot.InstallationStamp || current.Revision!=snapshot.Revision ||
                proof.Button.Consumer!=consumer || proof.Button.Button!=button)return false;
            if(consume){proof.MarkConsumed();completed=null;gesture=null;}
            return true;
        }
    }
    private bool Identity(long document,Guid session,long revision) => generation==document && snapshot is{IsActive:true} && snapshot.SessionId==session && snapshot.Revision==revision;
    private bool CanInput()=>snapshot is{IsActive:true,IsDesktopForeground:true} && !snapshot.Lifecycle.PlaybackPaused && !snapshot.Lifecycle.Locked;
    private bool Available(RoomNativeViewport current,bool foreground)=>foreground && CanInput() && viewport!=null && current==viewport;
    private AcceptedEntry? Hit(int x,int y)
    {
        var px=((double)x-viewport!.X)/viewport.Width;var py=((double)y-viewport.Y)/viewport.Height;
        return buttons.FirstOrDefault(b=>b.Region.Contains(px,py));
    }
    private void ClearGeometry()
    {
        viewport=null;buttons=Array.Empty<AcceptedEntry>();focused=null;completed=null;mouse=null;keyboard=null;gesture=null;
        // Preserve held edges until UP. Auto-repeat after refresh/geometry change
        // must not turn into a new physical DOWN.
    }
}
