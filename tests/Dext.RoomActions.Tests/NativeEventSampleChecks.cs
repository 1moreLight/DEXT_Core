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
        void Focus(RoomNativeInputAuthority n,bool reverse=false,RoomNativeButton[]? entries=null){
            n.Key(viewport,9,true,reverse,true);
            Require(n.SampleFocus(1,session,1,1,n.State!.Gesture!.Sequence,viewport,entries??Region(),true,reverse),"current Tab sample");
            n.Key(viewport,9,false,reverse,true);
        }
        check("event Tab chooses current visible entries rather than the boundary table without completing input",()=>{
            var (n,clock)=Create();n.Key(viewport,9,true,false,true);var sequence=n.State!.Gesture!.Sequence;
            Require(n.State.Focus==null,"Tab used the old boundary before sample");
            var entries=new[]{Region("icon.home/moving")[0] with{TabIndex=1},Region("icon.home/first")[0] with{TabIndex=0}};
            Require(n.SampleFocus(1,session,1,1,sequence,viewport,entries,true,false),"current Tab sample");
            Require(n.State!.Focus!.EntryId=="icon.home/first"&&n.State.Completed==null&&n.State.Gesture==null,"Tab created action or wrong focus");
            Require(!n.SampleFocus(1,session,1,1,sequence,viewport,entries,true,false),"duplicate Tab replaced focus");
        });
        check("event Tab cycles distinct presentations by stable identity and ShiftTab reverses",()=>{
            var (n,clock)=Create();var entries=new[]{Region()[0],Region("icon.home/other")[0] with{TabIndex=1}};
            Focus(n,entries:entries);Require(n.State!.Focus!.EntryId=="icon.home/open","first Tab");
            Focus(n,entries:entries.Select(b=>b with{X=.6}).ToArray());Require(n.State!.Focus!.EntryId=="icon.home/other","copied moving table lost identity");
            Focus(n,true,entries);Require(n.State!.Focus!.EntryId=="icon.home/open","ShiftTab not reversed");
            Focus(n,true,entries);Require(n.State!.Focus!.EntryId=="icon.home/other","ShiftTab not wrapped");
        });
        check("two physical Tabs queued before either reply preserve both focus advances",()=>{
            var (n,clock)=Create();var entries=new[]{Region()[0],Region("icon.home/other")[0] with{TabIndex=1}};
            n.Key(viewport,9,true,false,true);var first=n.State!.Gesture!.Sequence;n.Key(viewport,9,false,false,true);
            n.Key(viewport,9,true,false,true);var second=n.State!.Gesture!.Sequence;n.Key(viewport,9,false,false,true);
            Require(n.SampleFocus(1,session,1,1,first,viewport,entries,true,false),"first queued Tab lost");
            Require(n.State!.Focus!.EntryId=="icon.home/open","first focus");
            Require(n.SampleFocus(1,session,1,1,second,viewport,entries,true,false),"second queued Tab lost");
            Require(n.State!.Focus!.EntryId=="icon.home/other"&&n.State.Completed==null,"second advance not preserved");
        });
        foreach(var key in new[]{13,32})check("early "+key+" UP waits for preceding Tabs and emits one original pair",()=>{
            var (n,clock)=Create();var entries=new[]{Region()[0],Region("icon.home/other")[0] with{TabIndex=1}};
            n.Key(viewport,9,true,false,true);var first=n.State!.Gesture!.Sequence;n.Key(viewport,9,false,false,true);
            n.Key(viewport,9,true,false,true);var second=n.State!.Gesture!.Sequence;n.Key(viewport,9,false,false,true);clock.Now=100;
            n.Key(viewport,key,true,false,true);Require(n.State!.Gesture!=null,"raw activation DOWN not recorded while focus pending");var original=n.State.Gesture!;
            var emitted=new List<(long Sequence,long Issued,string Kind,string? Entry)>();
            var delivery=new RoomNativeKeyDelivery(n,(g,f,kind,scan,extended)=>emitted.Add((g.Sequence,g.IssuedAt,kind,f.EntryId)));
            delivery.Down(original,key==13?28:57,false);n.Key(viewport,key,false,false,true);delivery.Up(key);
            Require(emitted.Count==0&&!n.State!.KeyReady,"activation crossed unresolved focus");
            clock.Now=200;n.SampleFocus(1,session,1,1,first,viewport,entries,true,false);delivery.Flush();
            Require(emitted.Count==0,"first Tab released activation");
            clock.Now=300;n.SampleFocus(1,session,1,1,second,viewport,entries,true,false);delivery.Flush();delivery.Up(key);
            Require(emitted.SequenceEqual(new[]{(original.Sequence,100L,"down",(string?)"icon.home/other"),(original.Sequence,100L,"up",(string?)"icon.home/other")}),
                "deferred pair lost original time/entry or duplicated UP");
            Require(n.SampleKeyboard(1,session,1,1,original.Sequence,"down",viewport,entries,true,key,"official","open","icon.home/other"),"deferred visible DOWN");
            Require(n.SampleKeyboard(1,session,1,1,original.Sequence,"up",viewport,entries,true,key,"official","open","icon.home/other"),"deferred visible UP");
            Require(n.State!.Completed?.IssuedAt==100,"focus wait renewed physical deadline");
        });
        check("expired preceding Tab does not release a deferred key into the previous focus",()=>{
            var (n,clock)=Create();n.Key(viewport,9,true,false,true);var tab=n.State!.Gesture!.Sequence;n.Key(viewport,9,false,false,true);
            clock.Now=100;n.Key(viewport,13,true,false,true);Require(n.State!.Gesture!=null,"raw activation DOWN not recorded");var key=n.State.Gesture!;var sent=0;
            var delivery=new RoomNativeKeyDelivery(n,(g,f,kind,scan,extended)=>sent++);delivery.Down(key,28,false);
            n.Key(viewport,13,false,false,true);clock.Now=1500;
            Require(!n.SampleFocus(1,session,1,1,tab,viewport,Region(),true,false),"expired focus completed");
            delivery.Flush();Require(sent==0&&n.State!.Completed==null,"expired focus released key");
        });
        check("empty current Tab sample clears focus and never creates completion",()=>{
            var (n,clock)=Create();Focus(n);Focus(n,entries:[]);
            Require(n.State!.Focus==null&&n.State.Completed==null,"empty visible Tab retained old focus");
        });
        bool KeySample(RoomNativeInputAuthority n,string edge,RoomNativeButton[] entries,int key=13,string entry="icon.home/open")=>
            n.SampleKeyboard(1,session,1,1,n.State!.Gesture!.Sequence,edge,viewport,entries,true,key,"official","open",entry);
        foreach(var key in new[]{13,32})check("sampled key "+key+" waits for both current visible focus edges",()=>{
            var (n,clock)=Create();Focus(n);
            n.Key(viewport,key,true,false,true);var sequence=n.State!.Gesture!.Sequence;n.Key(viewport,key,false,false,true);
            Require(n.State!.Completed==null,"raw key UP completed before visibility");
            Require(KeySample(n,"down",Region(x:.35),key),"key DOWN sample");Require(n.State!.Completed==null,"one key sample completed");
            Require(KeySample(n,"up",Region(x:.45),key),"key UP sample");
            var proof=n.GetProof(1,1,"official","open",sequence);
            Require(proof?.SampledVisual==true&&proof.IssuedAt==0,"moving key lost visual proof or original QPC");
        });
        foreach(var edge in new[]{"down","up"})check("sampled keyboard "+edge+" cannot activate a hidden focus entry",()=>{
            var (n,clock)=Create();Focus(n);
            n.Key(viewport,13,true,false,true);KeySample(n,"down",edge=="down"?[]:Region());
            n.Key(viewport,13,false,false,true);KeySample(n,"up",edge=="up"?[]:Region());
            Require(n.State!.Completed==null,"hidden keyboard focus activated");
        });
        check("sampled keyboard keeps the Core focus entry despite another same-button presentation",()=>{
            var (n,clock)=Create();Focus(n);n.Key(viewport,13,true,false,true);
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
