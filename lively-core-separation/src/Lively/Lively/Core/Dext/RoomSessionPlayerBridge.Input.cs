using System.Linq;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Dext.Core.Rooms;

internal sealed record RoomNativeActionReply(RoomActionStatus Status,long InputSequence=0,bool InputConsumed=false,
    [property:System.Text.Json.Serialization.JsonIgnore][property:Newtonsoft.Json.JsonIgnore] RoomExitConfirmation? Exit=null);

internal sealed partial class RoomSessionPlayerBridge
{
    internal RoomNativeActionReply ActivateNative(RoomActionAuthority actions,RoomNativeInputAuthority native,
        long generation,Guid session,long revision,long geometry,string consumer,string button,long inputSequence)
    {
        if(disposed)return new(RoomActionStatus.StaleSession);
        var current=native.State;
        if(current==null || current.Generation!=generation || current.Session!=session || current.Revision!=revision)return new(RoomActionStatus.StaleInput);
        var proof=native.GetProof(generation,geometry,consumer,button,inputSequence);
        if(proof==null)return new(inputSequence==0?RoomActionStatus.InputRequired:RoomActionStatus.StaleInput);
        var issued=actions.IssueHostInput(connectionId,peer,session,consumer,button,proof);
        var reply=issued.Status==RoomActionStatus.Accepted?actions.InvokeButton(connectionId,peer,session,consumer,button,issued.Ticket):new(issued.Status);
        return new(reply.Status,proof.Sequence,proof.IsConsumed,reply.Exit);
    }
    internal RoomActionReply ConfirmNativeExit(RoomActionAuthority actions,RoomNativeInputAuthority native,
        long generation,RoomExitConfirmation confirmation,bool approved)
    {
        var current=native.State;
        if(disposed||current==null||current.Generation!=generation||current.Session!=confirmation.Session){
            actions.ConfirmExit(connectionId,peer,confirmation,false);
            return new(disposed?RoomActionStatus.StaleSession:RoomActionStatus.StaleInput);
        }
        return actions.ConfirmExit(connectionId,peer,confirmation,approved);
    }

    internal RoomNativeActionReply NavigateNative(RoomActionAuthority actions,RoomNativeInputAuthority native,
        long generation,Guid session,long revision,long geometry,string consumer,RoomButtonAction action,long inputSequence)
    {
        if(disposed)return new(RoomActionStatus.StaleSession);
        var current=native.State;
        if(current==null || current.Generation!=generation || current.Session!=session || current.Revision!=revision)return new(RoomActionStatus.StaleInput);
        var completed=current.Completed;
        var proof=completed==null?null:native.GetProof(generation,geometry,consumer,completed.Button.Button,inputSequence);
        if(proof==null)return new(inputSequence==0?RoomActionStatus.InputRequired:RoomActionStatus.StaleInput);
        var issued=actions.IssueHostInput(connectionId,peer,session,consumer,proof.Button.Button,proof);
        var reply=issued.Status==RoomActionStatus.Accepted
            ?actions.InvokeNavigation(connectionId,peer,session,consumer,proof.Button.Button,issued.Ticket,action):new(issued.Status);
        return new(reply.Status,proof.Sequence,proof.IsConsumed);
    }
    internal async Task<RoomNativeActionReply> ControlNativeAsync(RoomActionAuthority actions,RoomNativeInputAuthority native,
        long generation,Guid session,long revision,long geometry,string consumer,RoomSystemControl control,
        Func<RoomSystemControl,Task<bool>> dispatch,long inputSequence,Action<RoomNativeInputProof>? attempted=null)
    {
        if(disposed)return new(RoomActionStatus.StaleSession);
        var current=native.State;
        if(current==null||current.Generation!=generation||current.Session!=session||current.Revision!=revision)return new(RoomActionStatus.StaleInput);
        var completed=current.Completed;
        var proof=completed==null?null:native.GetProof(generation,geometry,consumer,completed.Button.Button,inputSequence);
        if(proof==null)return new(inputSequence==0?RoomActionStatus.InputRequired:RoomActionStatus.StaleInput);
        attempted?.Invoke(proof);
        var issued=actions.IssueHostInput(connectionId,peer,session,consumer,proof.Button.Button,proof);
        var reply=issued.Status==RoomActionStatus.Accepted
            ?await actions.InvokeSystemControlAsync(connectionId,peer,session,consumer,proof.Button.Button,issued.Ticket,control,dispatch):new(issued.Status);
        return new(reply.Status,proof.Sequence,proof.IsConsumed);
    }

    internal RoomButtonsReply NativeButtons(RoomActionAuthority actions,Guid session,string consumer) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadButtons(connectionId,peer,session,consumer);

    internal RoomCapabilitiesReply NativeCapabilities(RoomActionAuthority actions,Guid session,long revision,string consumer) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadCapabilities(connectionId,peer,session,consumer,revision);

    internal RoomDataReply NativeData(RoomActionAuthority actions,Guid session,long revision,string consumer,string capability,Func<RoomDataSample> capture) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadData(connectionId,peer,session,revision,consumer,capability,capture);

    internal RoomStorageReply NativeReadStorage(RoomActionAuthority actions,Guid session,long revision,string consumer,string key) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadStorage(connectionId,peer,session,revision,consumer,key);
    internal RoomActionReply NativeWriteStorage(RoomActionAuthority actions,Guid session,long revision,string consumer,string key,System.Text.Json.JsonElement value) =>
        disposed?new(RoomActionStatus.StaleSession):actions.WriteStorage(connectionId,peer,session,revision,consumer,key,value);

    internal RoomPresentationReply NativeReadPresentation(RoomActionAuthority actions,Guid session,long revision,string? desktopContextId=null) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadPresentation(connectionId,peer,session,revision,desktopContextId);

    internal RoomLayoutReply NativeReadLayout(RoomActionAuthority actions,Guid session,long revision) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadLayout(connectionId,peer,session,revision);
    internal RoomLayoutReply NativeSaveLayout(RoomActionAuthority actions,Guid session,long revision,long layoutRevision,RoomLayoutChange change) =>
        disposed?new(RoomActionStatus.StaleSession):actions.SaveLayout(connectionId,peer,session,revision,layoutRevision,change);

    internal bool PublishNativeGeometry(RoomNativeInputAuthority native,long generation,Guid session,long revision,
        long version,RoomNativeViewport viewport,IReadOnlyList<RoomNativeButton> entries,bool sampleMouse=false)
    {
        if(disposed || entries==null || entries.Count>4096)return false;
        return gateway.TryWithActionContext(connectionId,peer,session,(status,context)=>
        {
            if(status!=RoomProtocolStatus.Accepted || context!.Snapshot.Revision!=revision || context.Installation.ActionCatalog is not{} catalog)return false;
            foreach(var entry in entries)
            {
                if(entry==null || entry.Consumer==null || entry.Button==null || !catalog.Consumers.TryGetValue(entry.Consumer,out var owner) ||
                    !owner.IsActive(context.Role,context.Snapshot) || !owner.HasButton(entry.Button) || !catalog.Buttons.TryGetValue(entry.Button,out var button) ||
                    button.Scope!="room" && button.Scope!=(context.Snapshot.TargetDeskId??context.Snapshot.CurrentDeskId))return false;
            }
            return native.PublishGeometry(generation,session,revision,version,viewport,entries,sampleMouse);
        },out bool accepted) && accepted;
    }
    internal bool SampleNativeGeometry(RoomNativeInputAuthority native,long generation,Guid session,long revision,
        long version,long sequence,string edge,RoomNativeViewport viewport,IReadOnlyList<RoomNativeButton> entries,bool foreground,
        int key=0,string? consumer=null,string? buttonId=null,string? entryId=null,bool reverse=false,IReadOnlyList<RoomNativeButton>? officialTaskEntries=null)
    {
        if(disposed || entries==null || entries.Count>4096)return false;
        return gateway.TryWithActionContext(connectionId,peer,session,(status,context)=>{
            if(status!=RoomProtocolStatus.Accepted || context!.Snapshot.Revision!=revision || context.Installation.ActionCatalog is not{} catalog)return false;
            foreach(var entry in entries){
                if(entry==null || entry.Consumer==null || entry.Button==null || !catalog.Consumers.TryGetValue(entry.Consumer,out var owner) ||
                    (!owner.IsActive(context.Role,context.Snapshot) && !(context.Role==RoomClientRole.DesktopPlayer && context.Snapshot.TargetDeskId!=null &&
                        owner.IsActive(context.Role,context.Snapshot,context.Snapshot.CurrentDeskId))) ||
                    !owner.HasButton(entry.Button) || !catalog.Buttons.TryGetValue(entry.Button,out var button) ||
                    button.Scope!="room" && button.Scope!=(context.Snapshot.TargetDeskId??context.Snapshot.CurrentDeskId) &&
                        !(context.Role==RoomClientRole.DesktopPlayer && context.Snapshot.TargetDeskId!=null && button.Scope==context.Snapshot.CurrentDeskId))return false;
            }
            if(officialTaskEntries is {Count:>0})
            {
                // Only private Core-validated task targets enter the input leaf.
                // Author entries above still pass their original manifest catalog.
                if(context.Role!=RoomClientRole.Dock||key==0||entries.Count+officialTaskEntries.Count>4096||
                    officialTaskEntries.Any(entry=>entry.Consumer!=Lively.Common.Helpers.DextNativeTaskSample.Consumer))return false;
                var authorOrder=entries.OrderBy(entry=>entry.TabIndex);
                var menu=officialTaskEntries.Any(entry=>entry.EntryId?.Contains("/dismissMenu/")==true);
                entries=(menu?officialTaskEntries.Concat(authorOrder):authorOrder.Concat(officialTaskEntries))
                    .Select((entry,index)=>entry with{TabIndex=entry.TabIndex<0?-1:index}).ToArray();
            }
            if(key==9)return native.SampleFocus(generation,session,revision,version,sequence,viewport,entries,foreground,reverse);
            return key==0?native.SampleMouse(generation,session,revision,version,sequence,edge,viewport,entries,foreground):
                native.SampleKeyboard(generation,session,revision,version,sequence,edge,viewport,entries,foreground,key,consumer!,buttonId!,entryId!);
        },out bool accepted) && accepted;
    }
}
