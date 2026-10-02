using System;
using System.Collections.Generic;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionPlayerBridge
{
    internal RoomActionReply ActivateNative(RoomActionAuthority actions,RoomNativeInputAuthority native,
        long generation,Guid session,long revision,long geometry,string consumer,string button)
    {
        if(disposed)return new(RoomActionStatus.StaleSession);
        var current=native.State;
        if(current==null || current.Generation!=generation || current.Session!=session || current.Revision!=revision)return new(RoomActionStatus.StaleInput);
        var proof=native.GetProof(generation,geometry,consumer,button);
        if(proof==null)return new(RoomActionStatus.InputRequired);
        var issued=actions.IssueHostInput(connectionId,peer,session,consumer,button,proof);
        return issued.Status==RoomActionStatus.Accepted?actions.InvokeButton(connectionId,peer,session,consumer,button,issued.Ticket):new(issued.Status);
    }
    internal RoomButtonsReply NativeButtons(RoomActionAuthority actions,Guid session,string consumer) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadButtons(connectionId,peer,session,consumer);

    internal RoomCapabilitiesReply NativeCapabilities(RoomActionAuthority actions,Guid session,long revision,string consumer) =>
        disposed?new(RoomActionStatus.StaleSession):actions.ReadCapabilities(connectionId,peer,session,consumer,revision);

    internal bool PublishNativeGeometry(RoomNativeInputAuthority native,long generation,Guid session,long revision,
        long version,RoomNativeViewport viewport,IReadOnlyList<RoomNativeButton> entries)
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
            return native.PublishGeometry(generation,session,revision,version,viewport,entries);
        },out bool accepted) && accepted;
    }
}
