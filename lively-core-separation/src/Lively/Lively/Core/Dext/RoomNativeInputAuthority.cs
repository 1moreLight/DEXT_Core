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
    RoomNativeViewport Viewport,long IssuedAt,int X,int Y,int Key,bool Released=false,int? ReleaseX=null,int? ReleaseY=null,bool SampleMouse=false,bool SampleKeyboard=false,bool Reverse=false,int Modifiers=0);
internal sealed record RoomNativeInputState(long Generation, Guid Session, long Revision, long GeometryVersion, RoomNativeButton? Focus, RoomNativeInputProof? Completed,RoomNativeInputGesture? Gesture=null,bool KeyReady=true,long CancellationVersion=0);

internal sealed class RoomNativeInputProof
{
    private readonly RoomNativeInputAuthority owner;
    private int consumed;
    internal RoomNativeInputProof(RoomNativeInputAuthority owner, RoomNativeButton button, long issuedAt,long sequence,bool sampledMouse=false,bool sampledKeyboard=false,int key=0,int modifiers=0,int x=0,int y=0)
    { this.owner=owner; Button=button; IssuedAt=issuedAt; Sequence=sequence; SampledMouse=sampledMouse; SampledVisual=sampledMouse||sampledKeyboard; Key=key; Modifiers=modifiers; X=x; Y=y; }
    internal long Sequence { get; }
    internal int X { get; }
    internal int Y { get; }
    internal int Key { get; }
    internal int Modifiers { get; }
    internal bool SampledMouse { get; }
    internal bool SampledVisual { get; }
    internal bool IsConsumed => Volatile.Read(ref consumed)!=0;
    internal void MarkConsumed() => Volatile.Write(ref consumed,1);
    internal RoomNativeButton Button { get; }
    internal long IssuedAt { get; }
    internal bool Validate(RoomSessionSnapshot snapshot,string consumer,string button,bool consume=false) =>
        owner.Validate(this,snapshot,consumer,button,consume);
}

// Leaf lock only: never call gateway, personal storage, IPC, JS or native APIs
// while holding gate. Snapshot observers and dispatch may enter in that order.
internal sealed class RoomNativeInputAuthority(TimeProvider clock, RoomClientRole role = RoomClientRole.DesktopPlayer)
{
    private readonly object gate=new();
    private long generation, geometryVersion, inputSequence, cancellationVersion;
    private RoomSessionSnapshot? snapshot;
    private RoomNativeViewport? viewport;
    private AcceptedEntry[] buttons=Array.Empty<AcceptedEntry>();
    private AcceptedEntry? focused;
    private RoomNativeInputProof? completed;
    private RoomNativeInputGesture? gesture;
    private Press? mouse, keyboard;
    private bool mouseHeld;
    private bool sampledMouse,downSampleReceived,upSampleReceived;
    private AcceptedEntry? downSample,upSample,keyTarget;
    private readonly HashSet<int> keysHeld=new();
    private readonly Queue<RoomNativeInputGesture> focusRequests=new();
    private long keyFocusBarrier;
    private sealed record Press(AcceptedEntry? Entry,long IssuedAt,long Sequence,int X=0,int Y=0,int Key=0);
    private sealed class AcceptedEntry(DextNativeGeometryEntry region)
    {
        internal DextNativeGeometryEntry Region {get;}=region;
        internal RoomNativeButton Button {get;}=new(region.Consumer,region.Button,region.X,region.Y,region.Width,region.Height,region.TabIndex,region.EntryId);
    }
    internal RoomNativeInputState? State
    {
        get {
            var now=clock.GetTimestamp();
            lock(gate){ExpireGesture(now);return snapshot==null?null:new(generation,snapshot.SessionId,snapshot.Revision,geometryVersion,focused?.Button,completed,gesture,keyFocusBarrier==0,cancellationVersion);}
        }
    }
    internal void InvalidateDocument(long document){lock(gate){if(document==generation)Revoke();}}
    internal void CheckNativeViewport(RoomNativeViewport? current,bool foreground)
    {lock(gate){if(current==null || viewport!=null && current!=viewport)ClearGeometry();else if(!foreground)ClearInput();}}
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
        RoomNativeViewport nativeViewport,IReadOnlyList<RoomNativeButton> entries,bool sampleMouse=false)
    {
        lock(gate)
        {
            if(!Identity(document,session,revision)||version<=geometryVersion)return false;
            geometryVersion=version;ClearGeometry();
            if(nativeViewport==null || nativeViewport.Handle==0 || nativeViewport.Width<=0 || nativeViewport.Height<=0 ||
                nativeViewport.Dpi<=0 || nativeViewport.DragTolerance<1 || nativeViewport.DragTolerance>256 || entries==null || entries.Count>4096)return false;
            if(!AcceptRegions(entries,out var accepted))return false;
            viewport=nativeViewport;buttons=accepted;sampledMouse=sampleMouse;return true;
        }
    }
    internal void MouseDown(RoomNativeViewport current,int x,int y,bool foreground,int modifiers=0)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(mouseHeld)return;
            mouseHeld=true;completed=null;mouse=null;keyboard=null;gesture=null;focusRequests.Clear();ResetSamples();
            if(!Available(current,foreground) || !Inside(current,x,y)){focused=null;return;}
            focused=sampledMouse?null:Hit(x,y);
            // A raw point can later be resolved against an event-time visual
            // sample. Recording it alone never creates an action completion.
            if(!BeginGesture(now,x,y,0,modifiers:modifiers & 3))return;
            if(focused!=null)mouse=new(focused,now,gesture!.Sequence,x,y);
        }
    }
    internal void MouseMove(RoomNativeViewport current,int x,int y,bool foreground)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(viewport!=null && viewport!=current){ClearGeometry();return;}
            if(!foreground){ClearInput();return;}
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
            gesture=pending with{Released=true,ReleaseX=x,ReleaseY=y};
            if(sampledMouse)CompleteSamples(now);
            else if(down!=null && Hit(x,y)==down.Entry)Complete(down,now);
        }
    }
    // Called only with native Player event-time geometry. Geometry is not input:
    // the matching raw DOWN/UP, original QPC, HWND and OS facts remain required.
    internal bool SampleMouse(long document,Guid session,long revision,long version,long sequence,string edge,
        RoomNativeViewport current,IReadOnlyList<RoomNativeButton> entries,bool foreground)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(!sampledMouse || !Identity(document,session,revision) || geometryVersion!=version ||
                gesture is not{Key:0} pending || pending.Sequence!=sequence ||
                edge!="down"&&edge!="up")return false;
            if(!Available(current,foreground)){CheckNativeViewport(current,foreground);ClearInput();return false;}
            if(edge=="down"&&downSampleReceived || edge=="up"&&(upSampleReceived||!pending.Released))return false;
            if(!AcceptRegions(entries,out var accepted)){gesture=null;completed=null;ResetSamples();return false;}
            var x=edge=="down"?pending.X:pending.ReleaseX!.Value;
            var y=edge=="down"?pending.Y:pending.ReleaseY!.Value;
            var hit=Hit(accepted,current,x,y);
            if(edge=="down"){downSampleReceived=true;downSample=hit;focused=hit;}
            else{upSampleReceived=true;upSample=hit;}
            CompleteSamples(now);return true;
        }
    }
    internal bool SampleKeyboard(long document,Guid session,long revision,long version,long sequence,string edge,
        RoomNativeViewport current,IReadOnlyList<RoomNativeButton> entries,bool foreground,int key,string consumer,string button,string entry)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(!sampledMouse || !Identity(document,session,revision) || geometryVersion!=version ||
                gesture is not{SampleKeyboard:true} pending || pending.Sequence!=sequence || pending.Key!=key ||
                keyTarget==null || keyTarget.Button.Consumer!=consumer || keyTarget.Button.Button!=button ||
                (keyTarget.Button.EntryId??keyTarget.Button.Button)!=entry || edge!="down"&&edge!="up")return false;
            if(!Available(current,foreground)){CheckNativeViewport(current,foreground);ClearInput();return false;}
            if(edge=="down"&&downSampleReceived || edge=="up"&&(upSampleReceived||!pending.Released))return false;
            if(!AcceptRegions(entries,out var accepted)){gesture=null;completed=null;ResetSamples();return false;}
            var visible=accepted.FirstOrDefault(value=>SameEntry(value,keyTarget));
            if(edge=="down"){downSampleReceived=true;downSample=visible;}
            else{upSampleReceived=true;upSample=visible;}
            CompleteSamples(now);return true;
        }
    }
    internal bool SampleFocus(long document,Guid session,long revision,long version,long sequence,
        RoomNativeViewport current,IReadOnlyList<RoomNativeButton> entries,bool foreground,bool reverse)
    {
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(!sampledMouse || !Identity(document,session,revision) || geometryVersion!=version ||
                focusRequests.Count==0 || focusRequests.Peek() is not{} pending || pending.Sequence!=sequence || pending.Reverse!=reverse)return false;
            if(!Available(current,foreground)){CheckNativeViewport(current,foreground);ClearInput();return false;}
            if(!AcceptRegions(entries,out var accepted)){focusRequests.Clear();gesture=null;focused=null;keyboard=null;ResetSamples();return false;}
            focusRequests.Dequeue();SelectFocus(accepted,reverse);
            if(keyFocusBarrier==pending.Sequence){
                keyFocusBarrier=0;
                if(focused==null){gesture=null;keyboard=null;ResetSamples();}
                else{
                    keyTarget=focused;
                    if(keyboard!=null)keyboard=keyboard with{Entry=focused};
                }
            }
            if(gesture is{Key:9} tab&&tab.Sequence==pending.Sequence){gesture=null;ResetSamples();}
            completed=null;return true;
        }
    }
    private void SelectFocus(AcceptedEntry[] visible,bool reverse)
    {
        var order=visible.Where(b=>b.Button.TabIndex>=0).OrderBy(b=>b.Button.TabIndex).ToArray();
        if(order.Length==0){focused=null;return;}
        var index=focused==null?-1:Array.FindIndex(order,value=>SameEntry(value,focused));
        // The official task row may scroll its next item into view before Tab is
        // sampled. If the old task is now clipped away, continue within that row
        // instead of jumping to the first authored navigation button.
        if(index<0&&role==RoomClientRole.Dock&&focused?.Button.Consumer==DextNativeTaskSample.Consumer)
        {
            var tasks=order.Where(value=>value.Button.Consumer==DextNativeTaskSample.Consumer).ToArray();
            if(tasks.Length>0){focused=tasks[reverse?tasks.Length-1:0];return;}
        }
        var next=index<0?(reverse?order.Length-1:0):(index+(reverse?-1:1)+order.Length)%order.Length;
        focused=order[next];
    }
    private static bool SameEntry(AcceptedEntry a,AcceptedEntry b)=>a.Button.Consumer==b.Button.Consumer &&
        a.Button.Button==b.Button.Button && a.Button.EntryId==b.Button.EntryId;
    private void CompleteSamples(long now)
    {
        if(!downSampleReceived || !upSampleReceived || gesture is not{Released:true} pending)return;
        if(downSample!=null && upSample!=null && SameEntry(downSample,upSample) &&
            (pending.Key==0 || keyTarget!=null&&SameEntry(downSample,keyTarget)))
            Complete(new(downSample,pending.IssuedAt,pending.Sequence,pending.X,pending.Y,pending.Key),now);
        else{completed=null;gesture=null;}
    }
    private void ResetSamples(){downSample=null;upSample=null;keyTarget=null;keyFocusBarrier=0;downSampleReceived=false;upSampleReceived=false;}
    private static bool AcceptRegions(IReadOnlyList<RoomNativeButton> entries,out AcceptedEntry[] result)
    {
        result=Array.Empty<AcceptedEntry>();if(entries==null || entries.Count>4096)return false;
        var copy=entries.ToArray();var input=new LivelyRoomNativeButton[copy.Length];
        for(int i=0;i<copy.Length;i++){
            var entry=copy[i];if(entry==null)return false;
            input[i]=new(){Consumer=entry.Consumer,Button=entry.Button,EntryId=entry.EntryId,
                X=entry.X,Y=entry.Y,Width=entry.Width,Height=entry.Height,TabIndex=entry.TabIndex,Polygons=entry.Polygons};
        }
        if(!DextNativeGeometry.TryCreate(input,out var accepted))return false;
        result=accepted.Select(region=>new AcceptedEntry(region)).ToArray();return true;
    }
    internal void Key(RoomNativeViewport current,int key,bool down,bool reverse,bool foreground,int modifiers=0)
    {
        if(key!=9 && key!=13 && key!=32 && key!=114)return;
        var now=clock.GetTimestamp();
        lock(gate)
        {
            ExpireGesture(now);
            if(down)
            {
                if(key==114&&(role!=RoomClientRole.DesktopPlayer||focused?.Button.Consumer!="official.desktop"||!focused.Button.Button.StartsWith("desktop-",StringComparison.Ordinal)))return;
                if(!keysHeld.Add(key))return;
                completed=null;keyboard=null;mouse=null;gesture=null;ResetSamples();
                if(!Available(current,foreground)){focusRequests.Clear();return;}
                if(key==9)
                {
                    if(sampledMouse){
                        if(focusRequests.Count>=64){ClearGeometry();return;}
                        if(BeginGesture(now,0,0,key,reverse))focusRequests.Enqueue(gesture!);
                    }
                    else SelectFocus(buttons,reverse);
                    return;
                }
                if((focused!=null||focusRequests.Count>0) && BeginGesture(now,0,0,key,modifiers:modifiers & 3)){
                    keyboard=new(focused,now,gesture!.Sequence,Key:key);
                    if(focusRequests.Count>0)keyFocusBarrier=focusRequests.Last().Sequence;
                    else keyTarget=focused;
                }
            }
            else
            {
                if(!keysHeld.Remove(key))return;
                var press=keyboard;if(press==null || press.Key!=key)return;
                keyboard=null;
                if(gesture==null || gesture.Key!=key || gesture.Released)return;
                if(!Available(current,foreground) || keyFocusBarrier==0&&focused!=press.Entry){gesture=null;return;}
                gesture=gesture with{Released=true};if(gesture.SampleKeyboard)CompleteSamples(now);else Complete(press,now);
            }
        }
    }
    // Correlation is private routing metadata, never evidence of a gesture.
    // Every action must name its original positive edge; zero never selects a recent proof.
    internal RoomNativeInputProof? GetProof(long document,long version,string consumer,string button,long sequence)
    {
        lock(gate)return generation==document && geometryVersion==version && completed is{} proof &&
            sequence>0 && sequence==proof.Sequence &&
            proof.Button.Consumer==consumer && proof.Button.Button==button ? proof : null;
    }
    private bool BeginGesture(long now,int x,int y,int key,bool reverse=false,int modifiers=0)
    {
        if(inputSequence>=9007199254740991){ClearGeometry();return false;}
        gesture=new(++inputSequence,generation,snapshot!.SessionId,snapshot.Revision,geometryVersion,viewport!,now,x,y,key,SampleMouse:key==0&&sampledMouse,SampleKeyboard:key!=0&&key!=9&&sampledMouse,Reverse:reverse,Modifiers:modifiers);
        return true;
    }
    private void Complete(Press press,long now)
    {
        if(press.Entry==null || gesture is not{Released:true} current || current.Sequence!=press.Sequence || Expired(press.IssuedAt,now))return;
        completed=new(this,press.Entry.Button,press.IssuedAt,press.Sequence,current.SampleMouse,current.SampleKeyboard,current.Key,current.Modifiers,current.X,current.Y);
    }
    private bool Expired(long issued,long now)
    {
        var elapsed=((decimal)now-issued)/clock.TimestampFrequency;
        return elapsed<0 || elapsed>=1.5m;
    }
    private void ExpireGesture(long now)
    {
        while(focusRequests.Count>0&&Expired(focusRequests.Peek().IssuedAt,now)){
            var expired=focusRequests.Dequeue();
            if(keyFocusBarrier!=0&&expired.Sequence<=keyFocusBarrier || gesture is{Key:9} tab&&tab.Sequence==expired.Sequence){
                gesture=null;keyboard=null;completed=null;ResetSamples();
            }
        }
        if(gesture!=null && Expired(gesture.IssuedAt,now))
        {
            gesture=null;mouse=null;keyboard=null;ResetSamples();
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
            if(consume){proof.MarkConsumed();completed=null;gesture=null;ResetSamples();}
            return true;
        }
    }
    private bool Identity(long document,Guid session,long revision) => generation==document && snapshot is{IsActive:true} && snapshot.SessionId==session && snapshot.Revision==revision;
    private bool CanInput()=>snapshot is{IsActive:true} && !snapshot.Lifecycle.Locked &&
        (role==RoomClientRole.Dock?snapshot.Lifecycle.Stage==RoomLifecycleStage.Desktop:
            snapshot.IsDesktopForeground&&!snapshot.Lifecycle.PlaybackPaused);
    private bool Available(RoomNativeViewport current,bool foreground)=>foreground && CanInput() && viewport!=null && current==viewport;
    private AcceptedEntry? Hit(int x,int y)
    {
        return Hit(buttons,viewport!,x,y);
    }
    private static AcceptedEntry? Hit(AcceptedEntry[] entries,RoomNativeViewport measured,int x,int y)
    {
        var px=((double)x-measured.X)/measured.Width;var py=((double)y-measured.Y)/measured.Height;
        return entries.FirstOrDefault(b=>b.Region.Contains(px,py));
    }
    private void ClearGeometry()
    {
        viewport=null;buttons=Array.Empty<AcceptedEntry>();sampledMouse=false;ClearInput();
    }
    private void ClearInput()
    {
        cancellationVersion++; // Retire native task completions queued outside this leaf lock.
        // Focus changes cancel physical input but keep the unchanged published regions.
        focused=null;completed=null;mouse=null;keyboard=null;gesture=null;focusRequests.Clear();ResetSamples();
        // Preserve held edges until UP. Auto-repeat after refresh/geometry change
        // must not turn into a new physical DOWN.
    }
}
