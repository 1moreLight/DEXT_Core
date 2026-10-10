using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Lively.Services.ApplicationDock;

internal static class DockTaskInputChecks
{
    public static void Run()
    {
        var clock=new TestClock();
        var input=new DockTaskInput(clock);
        var viewport=new RoomNativeViewport((nint)15,-100,200,1000,200,4,144);
        var gesture=new RoomNativeInputGesture(1,2,Guid.NewGuid(),3,4,viewport,1000,0,250,0,SampleMouse:true);
        var hit=new LivelyRoomNativeTaskHit { ContextId=Guid.NewGuid().ToString("N"),ItemId=Guid.NewGuid().ToString("N"),Action="activate",X=.05,Y=.1,Width=.2,Height=.5 };
        DextNativePointerPacket Packet(RoomNativeInputGesture g,string edge)=>new(new LivelyMessageRoomNativePointer {
            Kind=edge,RuntimeGeneration=g.Generation,SessionId=g.Session,Revision=g.Revision,GeometryVersion=g.GeometryVersion,
            GestureId=g.Sequence,IssuedAt=g.IssuedAt,InputHandle=g.Viewport.Handle.ToInt64(),OriginX=g.Viewport.X,OriginY=g.Viewport.Y,
            PixelWidth=g.Viewport.Width,PixelHeight=g.Viewport.Height,Dpi=g.Viewport.Dpi,X=edge=="up"?g.ReleaseX??g.X:g.X,Y=edge=="up"?g.ReleaseY??g.Y:g.Y,SampleMouse=true });
        RoomNativeInputGesture Up(RoomNativeInputGesture g)=>g with {Released=true,ReleaseX=g.X,ReleaseY=g.Y};
        void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS task input: "+label);}
        Check(input.Sample(gesture,Packet(gesture,"down"),hit)==null,"down alone cannot complete");
        var up=Up(gesture);var completed=input.Sample(up,Packet(up,"up"),hit);
        Check(completed?.ItemId==hit.ItemId&&completed?.Sequence==1,"matching raw pair and sampled item complete");
        Check(input.Sample(up,Packet(up,"up"),hit)==null,"duplicate receipt cannot complete twice");
        gesture=gesture with{Sequence=2};up=Up(gesture);
        input.Sample(up,Packet(gesture,"down"),hit);
        Check(input.Sample(up,Packet(up,"up"),hit)!=null,"fast physical up before down receipt is supported");
        gesture=gesture with{Sequence=3};input.Sample(gesture,Packet(gesture,"down"),hit);up=Up(gesture);
        var other=new LivelyRoomNativeTaskHit{ContextId=Guid.NewGuid().ToString("N"),ItemId=hit.ItemId,Action=hit.Action,X=hit.X,Y=hit.Y,Width=hit.Width,Height=hit.Height};
        Check(input.Sample(up,Packet(up,"up"),other)==null,"Desk/context replacement cancels");
        gesture=gesture with{Sequence=4};input.Sample(gesture,Packet(gesture,"down"),hit);
        Check(input.Sample(gesture,Packet(gesture,"up"),hit)==null,"sample without physical up is insufficient");
        Check(input.Sample(Up(gesture),Packet(Up(gesture),"up"),hit)==null,"invalid pair cannot be revived by later receipt");
        gesture=gesture with{Sequence=5};input.Sample(gesture,Packet(gesture,"down"),hit);up=Up(gesture);
        Check(input.Sample(up with{Viewport=viewport with{Dpi=192}},Packet(up,"up"),hit)==null,"viewport/DPI replacement cancels");
        gesture=gesture with{Sequence=6};input.Sample(gesture,Packet(gesture,"down"),hit);
        Check(input.Sample(null,Packet(Up(gesture),"up"),hit)==null,"revoked raw input cancels");
        gesture=gesture with{Sequence=7};input.Sample(gesture,Packet(gesture,"down"),hit);clock.Now=2600;
        Check(input.Sample(Up(gesture),Packet(Up(gesture),"up"),hit)==null,"original down deadline is retained");
        clock.Now=1000;gesture=gesture with{Sequence=8};input.Sample(gesture,Packet(gesture,"down"),hit);up=Up(gesture);
        other.ContextId=hit.ContextId;other.ItemId=Guid.NewGuid().ToString("N");
        Check(input.Sample(up,Packet(up,"up"),other)==null,"different button after refresh cancels");
        gesture=gesture with{Sequence=9};input.Sample(gesture,Packet(gesture,"down"),hit);up=Up(gesture) with{ReleaseX=50};
        Check(input.Sample(up,Packet(up,"up"),hit)==null,"drag release is not a click");
        gesture=gesture with{Sequence=10};input.Sample(gesture,Packet(gesture,"down"),hit);up=Up(gesture);
        other.ItemId=hit.ItemId;other.X=.3;
        Check(input.Sample(up,Packet(up,"up"),other)==null,"raw release must lie in sampled clipped rectangle");
        Check(DextNativeTaskSample.TryParse(Newtonsoft.Json.Linq.JObject.FromObject(hit),out var parsed)&&parsed.ItemId==hit.ItemId,"Player preserves private target fields");
        Check(!DextNativeTaskSample.TryParse(Newtonsoft.Json.Linq.JObject.Parse("{\"contextId\":3}"),out _),"malformed sample fails closed");
        Check(DextNativeTaskSample.TryParse(null,out var absent)&&absent==null,"legacy absent task sample stays compatible");
        var authority=new RoomNativeInputAuthority(clock,RoomClientRole.Dock);
        authority.Initialize(2,new RoomSessionSnapshot(1,gesture.Session,"room","desk",null,null,null,3,true,null));
        authority.PublishGeometry(2,gesture.Session,3,4,viewport,[],true);
        authority.MouseDown(viewport,0,250,true);
        var taskInput=new DockTaskInput(clock);var actualDown=authority.State!.Gesture!;
        taskInput.Sample(actualDown,Packet(actualDown,"down"),hit,authority.State!.CancellationVersion);
        authority.SampleMouse(2,gesture.Session,3,4,actualDown.Sequence,"down",viewport,[],true);
        authority.MouseUp(viewport,0,250,true);var actualUp=authority.State!.Gesture!;
        var queued=taskInput.Sample(actualUp,Packet(actualUp,"up"),hit,authority.State!.CancellationVersion)!;
        authority.SampleMouse(2,gesture.Session,3,4,actualUp.Sequence,"up",viewport,[],true);
        Check(DockTaskInput.IsCurrent(queued,authority.State,viewport,clock),"queued task survives author empty-hit retirement");
        authority.InvalidateGeometry(2,gesture.Session,3);
        Check(!DockTaskInput.IsCurrent(queued,authority.State,viewport,clock),"queued task is revoked by geometry invalidation before dispatcher execution");
        authority.PublishGeometry(2,gesture.Session,3,5,viewport,[],true);
        authority.MouseDown(viewport,0,250,true);actualDown=authority.State!.Gesture!;
        taskInput.Sample(actualDown,Packet(actualDown,"down"),hit,authority.State.CancellationVersion);
        authority.SampleMouse(2,gesture.Session,3,5,actualDown.Sequence,"down",viewport,[],true);
        authority.MouseUp(viewport,0,250,true);actualUp=authority.State!.Gesture!;
        queued=taskInput.Sample(actualUp,Packet(actualUp,"up"),hit,authority.State.CancellationVersion)!;
        authority.SampleMouse(2,gesture.Session,3,5,actualUp.Sequence,"up",viewport,[],true);
        Check(DockTaskInput.IsCurrent(queued,authority.State,viewport,clock),"new valid pair works after republishing geometry");
        authority.CheckNativeViewport(viewport,false);authority.CheckNativeViewport(viewport,true);
        Check(!DockTaskInput.IsCurrent(queued,authority.State,viewport,clock),"hide and reshow cannot revive a queued completion with unchanged geometry");
        // A held contact and a queued completion must both stay revoked after
        // navigating away and back, even when the same task occupies the same pixel.
        var initial=new RoomSessionSnapshot(1,gesture.Session,"room","desk",null,null,null,3,true,null);
        var switching=new RoomNativeInputAuthority(clock,RoomClientRole.Dock);
        switching.Initialize(2,initial);
        switching.PublishGeometry(2,gesture.Session,3,1,viewport,[],true);
        switching.MouseDown(viewport,0,250,true);
        var held=switching.State!.Gesture!;
        var switchingTasks=new DockTaskInput(clock);
        switchingTasks.Sample(held,Packet(held,"down"),hit,switching.State.CancellationVersion);
        switching.ObserveSnapshot(initial with {Revision=4,CurrentDeskId="other"});
        switching.PublishGeometry(2,gesture.Session,4,2,viewport,[],true);
        switching.MouseUp(viewport,0,250,true);
        Check(switching.State!.Gesture==null,"Desk change retires held contact before release");
        Check(switchingTasks.Sample(switching.State.Gesture,Packet(Up(held),"up"),hit,switching.State.CancellationVersion)==null,"late old release after Desk change cannot complete task");
        switching.ObserveSnapshot(initial with {Revision=5});
        switching.PublishGeometry(2,gesture.Session,5,3,viewport,[],true);
        Check(switchingTasks.Sample(switching.State!.Gesture,Packet(Up(held),"up"),hit,switching.State.CancellationVersion)==null,"return to original Desk cannot revive held contact");
        switching.MouseDown(viewport,0,250,true);
        var freshDown=switching.State.Gesture!;
        switchingTasks.Sample(freshDown,Packet(freshDown,"down"),hit,switching.State.CancellationVersion);
        switching.MouseUp(viewport,0,250,true);
        var freshUp=switching.State.Gesture!;
        var freshCompletion=switchingTasks.Sample(freshUp,Packet(freshUp,"up"),hit,switching.State.CancellationVersion)!;
        Check(DockTaskInput.IsCurrent(freshCompletion,switching.State,viewport,clock),"fresh click works after returning to original Desk");
        switching.ObserveSnapshot(initial with {Revision=6,CurrentDeskId="other"});
        switching.ObserveSnapshot(initial with {Revision=7});
        switching.PublishGeometry(2,gesture.Session,7,4,viewport,[],true);
        Check(!DockTaskInput.IsCurrent(freshCompletion,switching.State,viewport,clock),"queued completion cannot revive after Desk round trip");
    }
    private sealed class TestClock:TimeProvider
    {
        public long Now=1000;
        public override long GetTimestamp()=>Now;
        public override long TimestampFrequency=>1000;
    }
}
