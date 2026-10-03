using Dext.Core.Rooms;
using Lively.Models.Message;

static partial class RoomActionChecks
{
    private static void PreciseInputChecks(Action<string,Action> check)
    {
        var view=new RoomNativeViewport((nint)10,100,200,1000,1000,8);
        LivelyRoomNativePoint P(double x,double y)=>new(){X=x,Y=y};
        LivelyRoomNativePoint[] Triangle()=>[P(.1,.1),P(.3,.1),P(.1,.3)];
        LivelyRoomNativePoint[] Square(double left=.1,double right=.3)=>[P(left,.1),P(right,.1),P(right,.3),P(left,.3)];
        RoomNativeButton Entry(string? id="button.open",LivelyRoomNativePoint[][]? polygons=null,string consumer="scene")=>new(consumer,"open",.1,.1,.2,.2,0,id,polygons??[Triangle()]);
        RoomNativeInputAuthority Native(ActionFixture f){var n=f.Actions.CreateNativeInput();n.Initialize(1,f.Kernel.Snapshot!);return n;}
        bool Publish(ActionFixture f,RoomNativeInputAuthority n,RoomNativeButton[] entries,long version=1)=>n.PublishGeometry(1,f.Session,f.Kernel.Snapshot!.Revision,version,view,entries);
        RoomNativeInputProof? Click(RoomNativeInputAuthority n,int x,int y){n.MouseDown(view,x,y,true);n.MouseUp(view,x,y,true);return n.GetProof(1,n.State!.GeometryVersion,"scene","open");}
        void Tab(RoomNativeInputAuthority n,bool reverse=false){n.Key(view,9,true,reverse,true);n.Key(view,9,false,reverse,true);}
        foreach(var reverse in new[]{false,true})check("polygon winding keeps strict interior and rejects every boundary "+reverse,()=>{
            using var f=new ActionFixture();var n=Native(f);var triangle=Triangle();if(reverse)Array.Reverse(triangle);
            Eq(true,Publish(f,n,[Entry(polygons:[triangle])]));
            Eq(true,Click(n,250,350)!=null); // (.15,.15), strictly inside.
            foreach(var point in new[]{(200,300),(300,300),(300,400),(360,460)})Eq<RoomNativeInputProof?>(null,Click(n,point.Item1,point.Item2));
        });
        check("polygon pieces preserve a gap while both visible islands activate",()=>{
            using var f=new ActionFixture();var n=Native(f);Eq(true,Publish(f,n,[Entry(polygons:[Square(.1,.15),Square(.25,.3)])]));
            Eq(true,Click(n,225,400)!=null);Eq<RoomNativeInputProof?>(null,Click(n,300,400));Eq(true,Click(n,375,400)!=null);
        });
        check("one action has independent presentation clicks and Tab focus",()=>{
            using var f=new ActionFixture();var n=Native(f);
            Eq(true,Publish(f,n,[Entry("icon.home/one",[Square(.1,.2)]) with{Width=.1},Entry("icon.home/two",[Square(.2,.3)]) with{X=.2,Width=.1,TabIndex=1}]));
            Eq("icon.home/one",Click(n,250,400)?.Button.EntryId);Eq("icon.home/two",Click(n,350,400)?.Button.EntryId);
            Tab(n);Eq("icon.home/one",n.FocusedButton?.EntryId);Tab(n);Eq("icon.home/two",n.State!.Focus?.EntryId);Tab(n,true);Eq("icon.home/one",n.FocusedButton?.EntryId);
            n.Key(view,13,true,false,true);n.Key(view,13,false,false,true);var proof=n.GetProof(1,1,"scene","open")!;
            Eq("icon.home/one",proof.Button.EntryId);var ticket=f.Actions.IssueHostInput(f.View,f.Peer,f.Session,"scene","open",proof);
            Eq(RoomActionStatus.Accepted,f.Invoke("open",ticket.Ticket).Status);Eq(1,f.Launched.Count);
        });
        check("down and up on distinct entries cannot share one action proof",()=>{
            using var f=new ActionFixture();var n=Native(f);
            Eq(true,Publish(f,n,[Entry("one",[Square(.1,.2)]) with{Width=.1},Entry("two",[Square(.2,.3)]) with{X=.2,Width=.1}]));
            n.MouseDown(view,299,400,true);n.MouseUp(view,301,400,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","open"));
        });
        check("polygon pieces share one Tab stop and invalidation preserves held edges",()=>{
            using var f=new ActionFixture();var n=Native(f);var entry=Entry(polygons:[Square(.1,.15),Square(.25,.3)]);
            Eq(true,Publish(f,n,[entry]));Tab(n);n.Key(view,32,true,false,true);Eq(true,Publish(f,n,[entry],2));Tab(n);
            n.Key(view,32,true,false,true);n.Key(view,32,false,false,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,2,"scene","open"));
            n.Key(view,32,true,false,true);n.Key(view,32,false,false,true);Eq("button.open",n.GetProof(1,2,"scene","open")?.Button.EntryId);
            Tab(n);Eq("button.open",n.FocusedButton?.EntryId);
        });
        check("published geometry and exposed focus never retain caller mutable points",()=>{
            using var f=new ActionFixture();var n=Native(f);var point=Triangle();var pieces=new[]{point};var entries=new[]{Entry(polygons:pieces)};
            Eq(true,Publish(f,n,entries));Tab(n);var focus=n.FocusedButton!;var stateFocus=n.State!.Focus!;
            point[0].X=.9;point[1]=P(.9,.9);pieces[0]=Square();entries[0]=Entry("replaced",[Square()]);
            foreach(var exposed in new[]{focus,stateFocus})if(exposed.Polygons is{} data){data[0][0].X=.9;data[0]=Square();}
            Eq<RoomNativeInputProof?>(null,Click(n,360,460));var proof=Click(n,250,350)!;Eq("button.open",proof.Button.EntryId);
            if(proof.Button.Polygons is{} proofData)proofData[0][0].X=.9;
            Eq(true,Click(n,250,350)!=null);Eq<RoomNativeInputProof?>(null,Click(n,360,460));
        });
        check("explicit presentation identifiers are scoped by consumer",()=>{
            using var f=new ActionFixture();var n=Native(f);Eq(true,Publish(f,n,[Entry(),Entry(consumer:"component.shared")]));
        });
        foreach(var bad in new[]{"sameEntry","legacyFirst","legacyLast","missingEntry","emptyEntry","longEntry","controlEntry","emptyPieces","nullPiece","tooManyPieces","tooFewPoints","tooManyPoints","nullPoint","nan","infinity","outside","duplicatePoint","closingPoint","degenerate","concave","bowtie","star","bboxExpanded","bboxShifted"})
            check("Core rejects malformed precise geometry "+bad,()=>{
                using var f=new ActionFixture();var n=Native(f);var entry=Entry();var entries=new[]{entry};
                LivelyRoomNativePoint[] Regular(int count)=>Enumerable.Range(0,count).Select(i=>P(.2+.1*Math.Cos(i*2*Math.PI/count),.2+.1*Math.Sin(i*2*Math.PI/count))).ToArray();
                switch(bad){
                    case "sameEntry":entries=[entry,entry with{Button="other"}];break;
                    case "legacyFirst":entries=[entry with{EntryId=null,Polygons=null},entry];break;
                    case "legacyLast":entries=[entry,entry with{EntryId=null,Polygons=null}];break;
                    case "missingEntry":entries=[entry with{EntryId=null}];break;case "emptyEntry":entries=[entry with{EntryId=""}];break;
                    case "longEntry":entries=[entry with{EntryId=new string('x',193)}];break;case "controlEntry":entries=[entry with{EntryId="bad\n"}];break;
                    case "emptyPieces":entries=[entry with{Polygons=[]}];break;case "nullPiece":entries=[entry with{Polygons=[null!]}];break;
                    case "tooManyPieces":entries=[entry with{Polygons=Enumerable.Range(0,65).Select(_=>Triangle()).ToArray()}];break;
                    case "tooFewPoints":entries=[entry with{Polygons=[[P(.1,.1),P(.3,.3)]]}];break;
                    case "tooManyPoints":entries=[entry with{Polygons=[Regular(33)]}];break;
                    case "nullPoint":entry.Polygons![0][0]=null!;break;case "nan":entry.Polygons![0][0].X=double.NaN;break;
                    case "infinity":entry.Polygons![0][0].Y=double.PositiveInfinity;break;case "outside":entry.Polygons![0][0].X=-.01;break;
                    case "duplicatePoint":entry.Polygons![0][1]=P(.1,.1);break;
                    case "closingPoint":entries=[entry with{Polygons=[[P(.1,.1),P(.3,.1),P(.1,.3),P(.1,.1)]]}];break;
                    case "degenerate":entries=[entry with{Polygons=[[P(.1,.1),P(.2,.2),P(.3,.3)]]}];break;
                    case "concave":entries=[entry with{Polygons=[[P(.1,.1),P(.3,.1),P(.15,.15),P(.1,.3)]]}];break;
                    case "bowtie":entries=[entry with{Polygons=[[P(.1,.1),P(.3,.3),P(.3,.1),P(.1,.3)]]}];break;
                    case "star":entries=[entry with{Polygons=[[P(.2,.1),P(.26,.3),P(.1,.175),P(.3,.175),P(.14,.3)]]}];break;
                    case "bboxExpanded":entries=[entry with{Width=.21}];break;case "bboxShifted":entries=[entry with{X=.11}];break;
                }
                Eq(false,Publish(f,n,entries));Eq<RoomNativeInputProof?>(null,Click(n,250,350));
            });
        check("polygon vertex budget accepts 65536 points then rejects one extra piece",()=>{
            using var f=new ActionFixture();var n=Native(f);
            LivelyRoomNativePoint[] Circle()=>Enumerable.Range(0,32).Select(i=>P(.5+.25*Math.Cos(i*Math.PI/16),.5+.25*Math.Sin(i*Math.PI/16))).ToArray();
            RoomNativeButton Dense(int i)=>new("scene","open",.25,.25,.5,.5,i,"entry."+i,Enumerable.Range(0,64).Select(_=>Circle()).ToArray());
            var entries=Enumerable.Range(0,32).Select(Dense).ToArray();Eq(true,Publish(f,n,entries));
            Eq(false,Publish(f,n,entries.Append(Entry("extra")).ToArray(),2));Eq<RoomNativeButton?>(null,n.FocusedButton);
        });
        check("legacy rectangle capacity and half-open edges remain unchanged",()=>{
            using var f=new ActionFixture();var n=Native(f);var entries=Enumerable.Range(0,4096).Select(i=>new RoomNativeButton("scene","button"+i,.125,.125,.25,.25,i)).ToArray();
            Eq(true,Publish(f,n,entries));n.MouseDown(view,225,325,true);n.MouseUp(view,225,325,true);Eq(true,n.GetProof(1,1,"scene","button0")!=null);
            n.MouseDown(view,475,575,true);n.MouseUp(view,475,575,true);Eq<RoomNativeInputProof?>(null,n.GetProof(1,1,"scene","button0"));
            Eq(false,Publish(f,n,entries.Append(new RoomNativeButton("scene","extra",.1,.1,.2,.2,0)).ToArray(),2));
        });
    }
}