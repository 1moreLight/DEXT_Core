using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace Lively.Services.ApplicationDock;

// Official task targets have their own Core projection; no author catalog entries
// are created for apps, windows or local menu commands.
internal sealed class DockTaskKeyboard
{
    private DockTaskViewSnapshot snapshot;
    public void Update(DockTaskViewSnapshot value)=>Volatile.Write(ref snapshot,value);
    private static bool Allowed(DockTaskViewSnapshot view,string context,string itemId,string windowId,string action)
    {
        if(view==null||context!=view.ContextId)return false;
        var item=view.Items.FirstOrDefault(value=>value.Id==itemId);if(item==null)return false;
        if(action=="chooseWindow")return windowId!=null&&item.Windows.Any(window=>window.Id==windowId);
        if(windowId!=null)return false;
        return action switch {"activate"=>item.Windows.Count<=1,"openWindows"=>item.Windows.Count>1,"togglePin" or "dismissMenu"=>true,_=>false};
    }
    public bool TryRegions(LivelyRoomNativeTaskHit[] targets,out IReadOnlyList<RoomNativeButton> regions)
    {
        regions=Array.Empty<RoomNativeButton>();
        if(targets==null||targets.Length==0)return true;
        if(targets.Length>4096)return false;
        var view=Volatile.Read(ref snapshot);var result=new List<RoomNativeButton>();var ids=new HashSet<string>(StringComparer.Ordinal);
        foreach(var target in targets)
        {
            if(!DextNativeTaskSample.Valid(target)||!Allowed(view,target.ContextId,target.ItemId,target.WindowId,target.Action))return false;
            var entry=DextNativeTaskSample.EntryId(target);
            if(!ids.Add(target.ItemId+"/"+entry))return false;
            result.Add(new(DextNativeTaskSample.Consumer,target.ItemId,target.X,target.Y,target.Width,target.Height,result.Count,entry));
        }
        regions=result.AsReadOnly();return true;
    }
    public DockTaskCompletion Complete(RoomNativeInputState state)
    {
        var proof=state?.Completed;var g=state?.Gesture;
        if(proof==null||proof.IsConsumed||proof.Button.Consumer!=DextNativeTaskSample.Consumer||g is not{Released:true}||
            g.Key!=13&&g.Key!=32||proof.Sequence!=g.Sequence)return null;
        var parts=proof.Button.EntryId?.Split('/');
        if(parts?.Length!=3)return null;
        var window=parts[2]=="-"?null:parts[2];
        if(!Allowed(Volatile.Read(ref snapshot),parts[0],proof.Button.Button,window,parts[1]))return null;
        return new(g.Sequence,parts[0],proof.Button.Button,window,parts[1],g,state.CancellationVersion);
    }
}
