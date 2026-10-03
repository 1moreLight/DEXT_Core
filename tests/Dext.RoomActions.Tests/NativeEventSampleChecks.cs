using Dext.Core.Rooms;
internal static class NativeEventSampleChecks
{
    internal static void Run(Action<string,Action> check)
    {
        void Require(bool ok,string detail){if(!ok)throw new Exception(detail);}
        RoomNativeButton[] Region(string entry="icon.home/open",double x=.4,double width=.2)=>
            [new("official","open",x,.2,width,.3,0,entry)];
        RoomNativeViewport viewport=new(42,-800,120,1000,500,6,144);
        var session=Guid.NewGuid();
        RoomSessionSnapshot snapshot=new(1,session,"room","home",null,null,null,1,true,null){InstallationStamp="stamp"};
        (RoomNativeInputAuthority input,Clock clock) Create(bool sampled=true){
            var clock=new Clock();var input=new RoomNativeInputAuthority(clock);input.Initialize(1,snapshot);
            Require(input.PublishGeometry(1,session,1,1,viewport,Region(x:.1),sampled),"geometry mode");
            return(input,clock);
        }
        void Down(RoomNativeInputAuthority input)=>input.MouseDown(viewport,-300,300,true);
        void Up(RoomNativeInputAuthority input)=>input.MouseUp(viewport,-300,300,true);
        bool Sample(RoomNativeInputAuthority input,string edge,RoomNativeButton[]? entries=null,long? sequence=null,RoomNativeViewport? current=null,bool foreground=true)=>
            input.SampleMouse(1,session,1,1,sequence??input.State!.Gesture!.Sequence,edge,current??viewport,entries??Region(),foreground);
        check("event sample mode waits for both visual edges despite native UP",()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;Up(n);
            Require(n.State!.Completed==null,"raw UP completed without samples");
            Require(Sample(n,"down"),"late DOWN sample");Require(n.State!.Completed==null,"one sample completed");
            Require(Sample(n,"up"),"late UP sample");
            Require(n.GetProof(1,1,"official","open",sequence)?.IssuedAt==0,"paired moved region lost original DOWN");
        });
        check("event samples may bracket the native UP without extending time",()=>{
            var (n,clock)=Create();Down(n);Require(Sample(n,"down"),"DOWN sample");clock.Now=1400;Up(n);
            Require(Sample(n,"up"),"UP sample");Require(n.State!.Completed?.IssuedAt==0,"sample renewed time");
        });
        check("same moving entry can change polygon bounds between DOWN and UP",()=>{
            var (n,clock)=Create();Down(n);Require(Sample(n,"down",Region(x:.35,width:.2)),"first visual");
            Up(n);Require(Sample(n,"up",Region(x:.45,width:.2)),"second visual");
            Require(n.State!.Completed!=null,"same presentation motion was rejected");
        });
        check("UP on another presentation of the same action does not complete",()=>{
            var (n,clock)=Create();Down(n);Sample(n,"down");Up(n);Sample(n,"up",Region("icon.home/other"));
            Require(n.State!.Completed==null,"two entries joined");
        });
        foreach(var edge in new[]{"down","up"})check("occluded "+edge+" visual sample remains empty",()=>{
            var (n,clock)=Create();Down(n);Sample(n,"down",edge=="down"?[]:Region());Up(n);Sample(n,"up",edge=="up"?[]:Region());
            Require(n.State!.Completed==null,"occlusion granted completion");
        });
        check("one visual edge cannot be replaced by a newer sample",()=>{
            var (n,clock)=Create();Down(n);Require(Sample(n,"down"),"initial sample");
            Require(!Sample(n,"down",Region("other")),"duplicate replaced DOWN");
            Up(n);Sample(n,"up");Require(n.State!.Completed?.Button.EntryId=="icon.home/open","original sample changed");
        });
        check("UP sample waits for its recorded physical UP",()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;
            Require(!Sample(n,"up",sequence:sequence),"unreleased UP sampled");Require(n.State!.Completed==null,"early completion");
            Sample(n,"down");Up(n);Require(Sample(n,"up"),"real UP sample");Require(n.State!.Completed!=null,"real pair lost");
        });
        check("sampled polygon coordinates retain the negative origin and measured DPI mapping",()=>{
            var (n,clock)=Create();Down(n);Sample(n,"down");Up(n);Sample(n,"up");
            Require(n.State!.Completed!=null&&n.State.Gesture!.Viewport==viewport,"native viewport mapping changed");
        });
        check("native drag cancels both delayed visual samples",()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;Sample(n,"down");
            n.MouseMove(viewport,-293,300,true);Up(n);Require(!Sample(n,"up",sequence:sequence),"drag sample accepted");
            Require(n.State!.Completed==null,"drag completed");
        });
        check("sample arrival at physical DOWN plus 1500ms cannot complete",()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;Sample(n,"down");Up(n);clock.Now=1500;
            Require(!Sample(n,"up",sequence:sequence),"expired sample accepted");Require(n.State!.Completed==null,"expired pair completed");
        });
        foreach(var change in new[]{"window","dpi","foreground"})check("sample rechecks native "+change,()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;Sample(n,"down");Up(n);
            var measured=change=="window"?viewport with{Handle=43}:change=="dpi"?viewport with{Dpi=96}:viewport;
            Require(!Sample(n,"up",sequence:sequence,current:measured,foreground:change!="foreground"),"changed native facts accepted");
            Require(n.State!.Completed==null,"changed native facts completed");
        });
        check("late samples from a previous pair leave the new gesture unchanged",()=>{
            var (n,clock)=Create();Down(n);var old=n.State!.Gesture!.Sequence;Up(n);Down(n);var next=n.State!.Gesture!.Sequence;
            Require(!Sample(n,"down",sequence:old),"old sample accepted");Sample(n,"down");Up(n);Sample(n,"up");
            Require(n.State!.Completed?.Sequence==next,"new pair lost");
        });
        check("visual samples own their region copies",()=>{
            var (n,clock)=Create();Down(n);var data=Region();Require(Sample(n,"down",data),"owned DOWN");
            data[0]=data[0] with{EntryId="changed",X=.9};Up(n);Sample(n,"up");
            Require(n.State!.Completed?.Button.EntryId=="icon.home/open","sample retained caller data");
        });
        check("geometry revision invalidation rejects delayed visual edges",()=>{
            var (n,clock)=Create();Down(n);var sequence=n.State!.Gesture!.Sequence;Up(n);
            n.ObserveSnapshot(snapshot with{Revision=2});Require(!Sample(n,"down",sequence:sequence),"old revision sample accepted");
            Require(n.State!.Completed==null,"stale geometry completion");
        });
        bool KeySample(RoomNativeInputAuthority n,string edge,RoomNativeButton[] entries,int key=13,string entry="icon.home/open")=>
            n.SampleKeyboard(1,session,1,1,n.State!.Gesture!.Sequence,edge,viewport,entries,true,key,"official","open",entry);
        foreach(var key in new[]{13,32})check("sampled key "+key+" waits for both current visible focus edges",()=>{
            var (n,clock)=Create();n.Key(viewport,9,true,false,true);n.Key(viewport,9,false,false,true);
            n.Key(viewport,key,true,false,true);var sequence=n.State!.Gesture!.Sequence;n.Key(viewport,key,false,false,true);
            Require(n.State!.Completed==null,"raw key UP completed before visibility");
            Require(KeySample(n,"down",Region(x:.35),key),"key DOWN sample");Require(n.State!.Completed==null,"one key sample completed");
            Require(KeySample(n,"up",Region(x:.45),key),"key UP sample");
            var proof=n.GetProof(1,1,"official","open",sequence);
            Require(proof?.SampledVisual==true&&proof.IssuedAt==0,"moving key lost visual proof or original QPC");
        });
        foreach(var edge in new[]{"down","up"})check("sampled keyboard "+edge+" cannot activate a hidden focus entry",()=>{
            var (n,clock)=Create();n.Key(viewport,9,true,false,true);n.Key(viewport,9,false,false,true);
            n.Key(viewport,13,true,false,true);KeySample(n,"down",edge=="down"?[]:Region());
            n.Key(viewport,13,false,false,true);KeySample(n,"up",edge=="up"?[]:Region());
            Require(n.State!.Completed==null,"hidden keyboard focus activated");
        });
        check("sampled keyboard keeps the Core focus entry despite another same-button presentation",()=>{
            var (n,clock)=Create();n.Key(viewport,9,true,false,true);n.Key(viewport,9,false,false,true);n.Key(viewport,13,true,false,true);
            KeySample(n,"down",Region());n.Key(viewport,13,false,false,true);KeySample(n,"up",Region("icon.home/other"));
            Require(n.State!.Completed==null,"keyboard joined another entry");
        });
        check("stationary compatibility keeps native hit pairing and rejects event samples",()=>{
            var (n,clock)=Create(false);n.MouseDown(viewport,-600,300,true);var sequence=n.State!.Gesture!.Sequence;n.MouseUp(viewport,-600,300,true);
            Require(n.State!.Completed!=null,"stationary pair changed");Require(!Sample(n,"down",sequence:sequence),"stationary mode sampled");
        });
    }
    private sealed class Clock : TimeProvider { public long Now;public override long TimestampFrequency=>1000;public override long GetTimestamp()=>Now; }
}
