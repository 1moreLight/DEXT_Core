using Dext.Core.Rooms;

static partial class RoomActionChecks
{
    private static void GestureChecks(Action<string,Action> check)
    {
        var view=new RoomNativeViewport((nint)10,100,200,1000,1000,8,144);
        RoomNativeInputAuthority Native(ActionFixture f,bool empty=false){
            var n=f.Actions.CreateNativeInput();n.Initialize(1,f.Kernel.Snapshot!);
            Eq(true,n.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,1,view,
                empty?[]:[new RoomNativeButton("scene","open",.1,.1,.2,.2,0,"button.open")]));
            return n;
        }
        RoomNativeInputGesture Gesture(RoomNativeInputAuthority n)=>n.State?.Gesture??throw new Exception("physical DOWN gesture missing");
        RoomNativeInputProof? Proof(RoomNativeInputAuthority n,long? sequence=null)=>n.GetProof(1,n.State!.GeometryVersion,"scene","open",sequence??n.State!.Completed?.Sequence??0);
        check("physical DOWN freezes positive sequence scope native viewport point and timestamp",()=>{
            using var f=new ActionFixture();var n=Native(f);f.Clock.Advance(TimeSpan.FromMilliseconds(12));
            n.MouseDown(view,300,400,true);var g=Gesture(n);
            Eq(1L,g.Sequence);Eq(1L,g.Generation);Eq(f.Session,g.Session);Eq(f.Kernel.Snapshot!.Revision,g.Revision);
            Eq(1L,g.GeometryVersion);Eq(view,g.Viewport);Eq(144,g.Viewport.Dpi);Eq(300,g.X);Eq(400,g.Y);
            Eq(0,g.Key);Eq(false,g.Released);Eq(f.Clock.GetTimestamp(),g.IssuedAt);Eq<RoomNativeInputProof?>(null,Proof(n));
            f.Clock.Advance(TimeSpan.FromMilliseconds(100));n.MouseUp(view,300,400,true);
            Eq(g.Sequence,Proof(n)!.Sequence);Eq(g.IssuedAt,Proof(n)!.IssuedAt);Eq(true,Gesture(n).Released);Eq(false,g.Released);
        });
        check("held primary repeat retains the exact DOWN sequence and deadline",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);var g=Gesture(n);
            f.Clock.Advance(TimeSpan.FromMilliseconds(400));n.MouseDown(view,300,400,true);Eq(g,Gesture(n));
            n.MouseUp(view,300,400,true);Eq(g.Sequence,Proof(n)!.Sequence);
            n.MouseDown(view,300,400,true);Eq(2L,Gesture(n).Sequence);Eq<RoomNativeInputProof?>(null,Proof(n));
        });
        check("unmatched UP does not create a gesture or completion",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseUp(view,300,400,true);
            Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);Eq<RoomNativeInputProof?>(null,Proof(n));
        });
        foreach(var invalid in new[]{"foreground","viewport","outside-left","outside-right"})
        check("native DOWN rejects unavailable or outside viewport without allocating "+invalid,()=>{
            using var f=new ActionFixture();var n=Native(f);
            var v=invalid=="viewport"?view with{Dpi=96}:view;
            n.MouseDown(v,invalid=="outside-left"?99:invalid=="outside-right"?1100:300,400,invalid!="foreground");
            Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);n.MouseUp(v,300,400,true);
            n.MouseDown(view,300,400,true);Eq(1L,Gesture(n).Sequence);
        });
        check("empty static regions can record a raw point but cannot complete an action",()=>{
            using var f=new ActionFixture();var n=Native(f,true);n.MouseDown(view,300,400,true);var g=Gesture(n);
            Eq(1L,g.Sequence);Eq<RoomNativeInputProof?>(null,Proof(n));n.MouseUp(view,300,400,true);
            Eq(true,Gesture(n).Released);Eq<RoomNativeInputProof?>(null,Proof(n));
        });
        check("drag beyond native tolerance cancels pending gesture and completion",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);Eq(1L,Gesture(n).Sequence);
            n.MouseMove(view,309,400,true);Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);
            n.MouseUp(view,300,400,true);Eq<RoomNativeInputProof?>(null,Proof(n));
            n.MouseDown(view,300,400,true);Eq(2L,Gesture(n).Sequence);
        });
        check("UP at physical 1500ms cannot renew the DOWN deadline or complete",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);
            f.Clock.Advance(TimeSpan.FromMilliseconds(1500));n.MouseUp(view,300,400,true);
            Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);Eq<RoomNativeInputProof?>(null,Proof(n));
            n.MouseDown(view,300,400,true);Eq(2L,Gesture(n).Sequence);
        });
        check("in-tolerance movement keeps DOWN deadline and completed proof expires from DOWN",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);var g=Gesture(n);
            f.Clock.Advance(TimeSpan.FromMilliseconds(1400));n.MouseMove(view,302,401,true);Eq(g,Gesture(n));
            f.Clock.Advance(TimeSpan.FromMilliseconds(99));n.MouseUp(view,302,401,true);Eq(g.Sequence,Proof(n)!.Sequence);
            f.Clock.Advance(TimeSpan.FromMilliseconds(1));Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);
            Eq(RoomActionStatus.ExpiredInput,f.Actions.IssueHostInput(f.View,f.Peer,f.Session,"scene","open",Proof(n,g.Sequence)).Status);
        });
        check("expired held DOWN cannot rearm through repeat before its UP",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);
            f.Clock.Advance(TimeSpan.FromMilliseconds(1500));Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);
            n.MouseDown(view,300,400,true);Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);n.MouseUp(view,300,400,true);
            n.MouseDown(view,300,400,true);Eq(2L,Gesture(n).Sequence);
        });
        foreach(var key in new[]{13,32})
        check("controlled keyboard DOWN repeat and UP use one physical sequence "+key,()=>{
            using var f=new ActionFixture();var n=Native(f);n.Key(view,9,true,false,true);n.Key(view,9,false,false,true);
            Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);
            n.Key(view,key,true,false,true);var g=Gesture(n);Eq(1L,g.Sequence);Eq(key,g.Key);Eq(0,g.X);Eq(0,g.Y);
            n.Key(view,key,true,false,true);Eq(g,Gesture(n));n.Key(view,key,false,false,true);
            Eq(g.Sequence,Proof(n)!.Sequence);Eq(true,Gesture(n).Released);
        });
        check("geometry change cancels gesture and held repeat cannot borrow new geometry",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);var old=Gesture(n);
            Eq(true,n.PublishGeometry(1,f.Session,1,2,view,[new("scene","open",.1,.1,.2,.2,0)]));
            Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);n.MouseDown(view,300,400,true);Eq<RoomNativeInputGesture?>(null,n.State!.Gesture);
            n.MouseUp(view,300,400,true);Eq<RoomNativeInputProof?>(null,Proof(n));n.MouseDown(view,300,400,true);
            Eq(2L,Gesture(n).Sequence);Eq(2L,Gesture(n).GeometryVersion);Eq(1L,old.GeometryVersion);
        });
        check("mouse DOWN replaces pending keyboard and late keyboard UP cannot borrow mouse",()=>{
            using var f=new ActionFixture();var n=Native(f);n.Key(view,9,true,false,true);n.Key(view,9,false,false,true);
            n.Key(view,13,true,false,true);Eq(1L,Gesture(n).Sequence);n.MouseDown(view,300,400,true);Eq(2L,Gesture(n).Sequence);
            n.Key(view,13,false,false,true);Eq<RoomNativeInputProof?>(null,Proof(n));n.MouseUp(view,300,400,true);Eq(2L,Proof(n)!.Sequence);
        });
        check("keyboard DOWN replaces pending mouse and late mouse UP leaves keyboard pair intact",()=>{
            using var f=new ActionFixture();var n=Native(f);n.MouseDown(view,300,400,true);n.Key(view,13,true,false,true);
            Eq(2L,Gesture(n).Sequence);n.MouseUp(view,300,400,true);Eq<RoomNativeInputProof?>(null,Proof(n));
            n.Key(view,13,false,false,true);Eq(2L,Proof(n)!.Sequence);
        });
    }
}
