using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Lively.Services.ApplicationDock;

internal static class DockTaskKeyboardChecks
{
    public static void Run()
    {
        void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS task keyboard: "+label);}
        var context=Guid.NewGuid().ToString("N");var item=Guid.NewGuid().ToString("N");
        var model=new DockTaskKeyboard();
        DockTaskViewSnapshot View(string c,long sequence)=>new(c,sequence,new[]{new DockTaskViewItem(item,"Editor",true,false,Array.Empty<DockTaskViewWindow>())});
        model.Update(View(context,1));
        var target=new LivelyRoomNativeTaskHit{ContextId=context,ItemId=item,Action="activate",X=.1,Y=.2,Width=.1,Height=.5};
        Check(model.TryRegions([target],out var entries)&&entries.Count==1&&entries[0].Consumer==DextNativeTaskSample.Consumer,"maps current Core task to separate official focus namespace");
        Check(!model.TryRegions([target,target],out _),"duplicate focus entry rejected");
        target.Action="chooseWindow";target.WindowId=Guid.NewGuid().ToString("N");
        Check(!model.TryRegions([target],out _),"closed or unrelated window cannot become focus target");
        target.Action="activate";target.WindowId=null;
        var viewport=new RoomNativeViewport((nint)15,0,0,1000,200,4);
        var snapshot=new RoomSessionSnapshot(1,Guid.NewGuid(),"room","desk",null,null,null,1,true,null);
        var input=new RoomNativeInputAuthority(TimeProvider.System,RoomClientRole.Dock);input.Initialize(1,snapshot);
        Check(input.PublishGeometry(1,snapshot.SessionId,1,1,viewport,[],true),"task area reuses initialized native viewport");
        var packets=new List<(RoomNativeInputGesture Gesture,RoomNativeButton Focus,string Kind)>();
        var delivery=new RoomNativeKeyDelivery(input,(g,focus,edge,_,_)=>packets.Add((g,focus,edge)));
        input.Key(viewport,9,true,false,true);var tab=input.State!.Gesture!;delivery.FocusRequested();input.Key(viewport,9,false,false,true);
        input.Key(viewport,13,true,false,true);delivery.Down(input.State!.Gesture!,28,false);
        input.Key(viewport,13,false,false,true);delivery.Up(13);
        Check(packets.Count==0,"early Enter release waits for original Tab resolution");
        Check(input.SampleFocus(1,snapshot.SessionId,1,1,tab.Sequence,viewport,entries,true,false),"Tab resolves sampled task focus");delivery.Flush();
        Check(packets.Count==2&&packets[0].Kind=="down"&&packets[1].Kind=="up"&&packets[0].Focus.Button==item,"key delivery preserves selected task and physical pair");
        model.Update(View(context,2));
        var key=packets[0].Gesture;var focused=packets[0].Focus;
        Check(input.SampleKeyboard(1,snapshot.SessionId,1,1,key.Sequence,"down",viewport,entries,true,13,focused.Consumer,focused.Button,focused.EntryId!)&&
            input.SampleKeyboard(1,snapshot.SessionId,1,1,key.Sequence,"up",viewport,entries,true,13,focused.Consumer,focused.Button,focused.EntryId!),"keyboard samples complete across status refresh");
        var state=input.State!;var completion=model.Complete(state);
        Check(completion?.ItemId==item&&completion.Action=="activate"&&completion.Gesture.Key==13,"physical keyboard proof maps back to Core app identity");
        Check(state.Completed!.Validate(snapshot,focused.Consumer,focused.Button,true)&&model.Complete(input.State!)==null,"consumed keyboard proof cannot run twice");
        model.Update(View(Guid.NewGuid().ToString("N"),3));
        Check(!model.TryRegions([target],out _)&&model.Complete(state)==null,"Desk context change revokes old focused app");
        Check(model.TryRegions(null!,out var absent)&&absent.Count==0,"legacy no-task samples keep author keyboard path");
        var scrollInput=new RoomNativeInputAuthority(TimeProvider.System,RoomClientRole.Dock);scrollInput.Initialize(1,snapshot);
        var author=new RoomNativeButton("component.navigation","next",0,0,.1,.5,0,"author-next");
        var firstTask=entries[0] with{TabIndex=1};var nextTask=firstTask with{Button=Guid.NewGuid().ToString("N")};
        scrollInput.PublishGeometry(1,snapshot.SessionId,1,1,viewport,[author],true);
        void Tab(IReadOnlyList<RoomNativeButton> visible,bool reverse=false){scrollInput.Key(viewport,9,true,reverse,true);var g=scrollInput.State!.Gesture!;scrollInput.Key(viewport,9,false,reverse,true);if(!scrollInput.SampleFocus(1,snapshot.SessionId,1,1,g.Sequence,viewport,visible,true,reverse))throw new Exception("Tab sample failed");}
        Tab([author,firstTask]);Tab([author,firstTask]);Check(scrollInput.FocusedButton==firstTask,"Tab reaches task after authored navigation");
        Tab([author,nextTask]);Check(scrollInput.FocusedButton==nextTask,"scrolling focused task out of view does not jump back to author navigation");
        Tab([author,firstTask],true);Check(scrollInput.FocusedButton==firstTask,"reverse scroll retains task focus lane");
        Tab([author,firstTask]);Check(scrollInput.FocusedButton==author,"Tab at final task still cycles back to author navigation");
    }
}
