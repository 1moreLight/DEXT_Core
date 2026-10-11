using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
namespace Dext.Core.Rooms;

public sealed record RoomPersonalButtonSettings(string? Action = null, string? DeskId = null, string? TargetId = null, string? Skin = null);
public sealed record RoomPersonalEditorButton(string Id, string Name, string Scope, string? DefaultAction, string? DefaultDeskId,
    string? EffectiveAction, string? EffectiveDeskId, bool IsBound, RoomPersonalButtonSettings? Personal);
public sealed record RoomPersonalEditorTarget(string Id, string Name, string Kind, string Target, string Arguments, string WorkingDirectory, int UseCount);
public sealed record RoomPersonalSkin(string Id, string Name);
public sealed record RoomDesktopSyncSettings(bool Enabled, string DeskId, int ItemCount, string ScanState = "pending", int IssueCount = 0);
public sealed record RoomPersonalEditorSnapshot(long Revision, RoomPersonalEditorButton[] Buttons, RoomPersonalEditorTarget[] Targets, RoomPersonalSkin[] Skins, RoomDesktopSyncSettings? DesktopSync = null);
public sealed record RoomPersonalEditorReply(string Status, string RoomId = "", string InstallationStamp = "", RoomPersonalEditorSnapshot? Editor = null);

internal sealed record RoomButtonLocator(string RequestId,string ButtonId);
internal sealed record RoomPresentationSnapshot(long Revision,Dictionary<string,string?> Skins,RoomButtonLocator? Locator,RoomDesktopView? Desktop=null);
internal sealed record RoomPresentationReply(RoomActionStatus Status,RoomPresentationSnapshot? Presentation=null);

internal sealed partial class RoomActionAuthority
{
    private readonly object roomCopyLifecycleGate = new();
    private readonly HashSet<string> cancelledRoomCopyIds = new(StringComparer.Ordinal);

    internal RoomPersonalLifecycleReply CopyRoomPersonal(string sourceRoomId, string newRoomId)
    {
        try
        {
            lock (roomCopyLifecycleGate)
            {
                if (cancelledRoomCopyIds.Contains(newRoomId))
                    return new("cancelled", "该副本复制已取消，请重新另存。");
                store.CopyRoom(sourceRoomId, newRoomId);
                return new("accepted");
            }
        }
        catch (InvalidDataException error) { return new("denied", error.Message); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { return new("storageUnavailable", error.Message); }
    }

    internal RoomPersonalLifecycleReply DeleteRoomPersonal(string roomId, bool dryRun)
    {
        try
        {
            RoomPersonalStore.Uuid(roomId);
            lock (roomCopyLifecycleGate)
            {
                if (dryRun) store.Read();
                else
                {
                    store.DeleteRoom(roomId);
                    // A late copy RPC for an abandoned fresh UUID must not
                    // recreate settings after recovery already removed them.
                    cancelledRoomCopyIds.Add(roomId);
                }
                return new("accepted");
            }
        }
        catch (InvalidDataException error) { return new("denied", error.Message); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { return new("storageUnavailable", error.Message); }
    }

    internal PersonalTarget[]? ReadApplicationDockPins(string roomId, string deskId) =>
        store.ReadDockPins(roomId, deskId);

    internal void SetApplicationDockPins(string roomId, string deskId, PersonalTarget[]? pins)
    {
        lock (roomCopyLifecycleGate)
        {
            if (cancelledRoomCopyIds.Contains(roomId)) throw new InvalidOperationException("Room 已删除，请重新选择。");
            store.SetDockPins(roomId, deskId, pins);
        }
    }

    internal RoomDesktopSync? ReadDesktopSync(string roomId) => store.ReadDesktopSync(roomId);

    internal void SetDesktopSync(string roomId, string deskId, bool enabled,
        IReadOnlyCollection<string>? currentIds = null, bool complete = true)
    {
        lock (roomCopyLifecycleGate)
        {
            if (cancelledRoomCopyIds.Contains(roomId)) throw new InvalidOperationException("Room 已删除，请重新选择。");
            store.SetDesktopSync(roomId, deskId, enabled, currentIds, complete);
        }
    }

    // Called only by the Core scan worker; the configurator cannot supply item IDs.
    internal RoomDesktopSync? CommitDesktopScan(Guid connection, RoomSessionPeer peer, Guid session,
        string roomId, string stamp, long expectedRevision, string deskId,
        IReadOnlyCollection<string> itemIds, bool complete, IReadOnlyDictionary<string, string>? renames = null)
    {
        var spin = new SpinWait();
        while (true)
        {
            var attempt = store.UpdateForDispatch(state =>
            {
                var admitted = gateway.TryWithCoordinatorContext(connection, peer, session, (status, context) =>
                {
                    if (status != RoomProtocolStatus.Accepted || GrantIdentity(context!, roomId, stamp) != RoomActionStatus.Accepted ||
                        state.Revision != expectedRevision || !context!.Installation.DeskIds.Contains(deskId, StringComparer.Ordinal) ||
                        !state.Rooms.TryGetValue(roomId, out var room) || room.DesktopSync is not { Enabled: true } previous || previous.DeskId != deskId)
                        return (Publish: false, Settings: (RoomDesktopSync?)null);
                    var next = RoomDesktopSync.Reconcile(previous, deskId, true, itemIds, complete, renames);
                    var changed = previous.Slots.Count != next.Slots.Count || previous.Slots.Any(p => !next.Slots.TryGetValue(p.Key, out var slot) || slot != p.Value);
                    if (changed) room.DesktopSync = next;
                    return (Publish: changed, Settings: (RoomDesktopSync?)next);
                }, out (bool Publish, RoomDesktopSync? Settings) result);
                return (admitted && result.Publish, (Admitted: admitted, Settings: result.Settings));
            });
            if (attempt.Admitted) return attempt.Settings;
            spin.SpinOnce();
        }
    }

    private sealed record PersonalLocator(Guid Session,string Stamp,string Room,string Button,string Request,long IssuedAt);
    private PersonalLocator? personalLocator;
    private sealed record DesktopPresentation(Guid Session,string Room,string Stamp,RoomDesktopView View,IReadOnlyDictionary<string,PersonalTarget> Targets);
    private DesktopPresentation? desktopPresentation;
    private sealed record DesktopProgress(string Room,string Desk,string State,int Issues);
    private DesktopProgress? desktopProgress;
    internal void SetDesktopProgress(string room,string desk,string state,int issues=0) => Volatile.Write(ref desktopProgress,new(room,desk,state,issues));
    internal void PublishDesktopPresentation(Guid session,string room,string stamp,RoomDesktopView view,IReadOnlyDictionary<string,PersonalTarget>? targets=null) =>
        Volatile.Write(ref desktopPresentation,new(session,room,stamp,view,new Dictionary<string,PersonalTarget>(targets??new Dictionary<string,PersonalTarget>(),StringComparer.Ordinal)));
    internal const string DesktopConsumer = "official.desktop";
    internal bool IsDesktopEntry(RoomActionContext context,RoomNativeButton entry)
    {
        return IsDesktopEntry(context,entry,Volatile.Read(ref desktopPresentation));
    }
    private static bool IsDesktopEntry(RoomActionContext context,RoomNativeButton entry,DesktopPresentation? value)
    {
        var snapshot=context.Snapshot;
        return value is not null&&context.Role==RoomClientRole.DesktopPlayer&&snapshot.Lifecycle.Stage==RoomLifecycleStage.Desktop&&
            snapshot.TransitionId is null&&snapshot.SessionId==value.Session&&context.Installation.RoomId==value.Room&&
            context.Installation.InstallationStamp==value.Stamp&&snapshot.CurrentDeskId==value.View.DeskId&&
            entry.Consumer==DesktopConsumer&&entry.EntryId=="desktop."+value.View.ContextId+"/"+entry.Button&&(value.Targets.ContainsKey(entry.Button)||entry.Button is "desktop.page.previous" or "desktop.page.next" or "desktop.paste");
    }
    internal (RoomActionStatus Status, PersonalTarget? Target) PrepareDesktopRename(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof)
    {
        if(proof.Key!=113)return (RoomActionStatus.NotOperable,null);
        var prepared=PrepareDesktopTarget(connection,peer,session,proof);
        if(prepared.Status==RoomActionStatus.Accepted&&prepared.Target is null)return (RoomActionStatus.NotOperable,null);
        return prepared;
    }
    internal (RoomActionStatus Status, PersonalTarget[]? Targets) PrepareDesktopClipboard(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof,string[] ids,bool cut)
    {
        if(proof.Key!=(cut?88:67)||proof.Modifiers!=1||ids is null)return (RoomActionStatus.NotOperable,null);
        return PrepareDesktopTargets(connection,peer,session,proof,ids);
    }
    internal (RoomActionStatus Status, PersonalTarget[]? Targets) PrepareDesktopMenu(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof,string[] ids)
    {
        if(!(proof.ContextMenu||proof.Key==93&&proof.Modifiers==0||proof.Key==121&&proof.Modifiers==2)||ids is null)return (RoomActionStatus.NotOperable,null);
        return PrepareDesktopTargets(connection,peer,session,proof,ids);
    }
    internal (RoomActionStatus Status, PersonalTarget[]? Targets) PrepareDesktopDelete(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof,string[] ids)
    {
        if(proof.Key!=46||proof.Modifiers!=0||ids is null)return (RoomActionStatus.NotOperable,null);
        return PrepareDesktopTargets(connection,peer,session,proof,ids);
    }
    internal RoomActionStatus AuthorizeDesktopPaste(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof)
    {
        if(!(proof.Key==86&&proof.Modifiers==1)&&!(proof.Button.Button=="desktop.paste"&&proof.Key is 0 or 13 or 32))return RoomActionStatus.NotOperable;
        return PrepareDesktopTargets(connection,peer,session,proof).Status;
    }
    private (RoomActionStatus Status, PersonalTarget? Target) PrepareDesktopTarget(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof)
    {
        var prepared=PrepareDesktopTargets(connection,peer,session,proof);
        return (prepared.Status,prepared.Targets?.FirstOrDefault());
    }
    private (RoomActionStatus Status, PersonalTarget[]? Targets) PrepareDesktopTargets(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof,string[]? selection=null)
    {
        var now=clock.GetTimestamp();
        if(Expired(proof.IssuedAt,now))return (RoomActionStatus.ExpiredInput,null);
        (RoomActionStatus Status,PersonalTarget[]? Targets) prepared;
        try
        {
            var spin=new SpinWait();
            while(true)
            {
                var attempt=store.ReadForDispatch(state=>{
                    var admitted=gateway.TryWithActionContext(connection,peer,session,(status,context)=>{
                        if(status!=RoomProtocolStatus.Accepted)return(Status(status),(PersonalTarget[]?)null);
                        var value=Volatile.Read(ref desktopPresentation);
                        if(!IsDesktopEntry(context!,proof.Button,value)||value is null||
                            !state.Rooms.TryGetValue(value.Room,out var room)||room.DesktopSync is not{Enabled:true} sync||sync.DeskId!=value.View.DeskId)return(RoomActionStatus.NotOperable,(PersonalTarget[]?)null);
                        PersonalTarget[] targets;
                        if(selection is not null){
                            if(selection.Length is <1 or >256 || selection.Distinct(StringComparer.Ordinal).Count()!=selection.Length ||
                                !selection.Contains(proof.Button.Button,StringComparer.Ordinal) || selection.Any(id=>id is null || !value.Targets.ContainsKey(id)))
                                return(RoomActionStatus.NotOperable,(PersonalTarget[]?)null);
                            targets=selection.Select(id=>value.Targets[id]).ToArray();
                        }else targets=value.Targets.TryGetValue(proof.Button.Button,out var target)?new[]{target}:Array.Empty<PersonalTarget>();
                        if(!proof.Validate(context!.Snapshot,DesktopConsumer,proof.Button.Button,true))return(RoomActionStatus.StaleInput,(PersonalTarget[]?)null);
                        return(RoomActionStatus.Accepted,(PersonalTarget[]?)targets);
                    },out (RoomActionStatus Status,PersonalTarget[]? Targets) result);
                    return(admitted,result);
                });
                if(attempt.admitted){prepared=attempt.result;break;}spin.SpinOnce();
            }
        }
        catch(Exception error) when(StorageFailure(error)){return (RoomActionStatus.StorageUnavailable,null);}
        if(prepared.Status==RoomActionStatus.Accepted&&Expired(proof.IssuedAt,clock.GetTimestamp()))return (RoomActionStatus.ExpiredInput,null);
        return prepared;
    }
    internal RoomActionReply OpenDesktopSelection(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof,string[] selectedIds,Func<bool>? permitted=null)
    {
        if(proof.Key!=13||selectedIds is null)return new(RoomActionStatus.NotOperable);
        var prepared=PrepareDesktopTargets(connection,peer,session,proof,selectedIds);
        if(prepared.Status!=RoomActionStatus.Accepted)return new(prepared.Status);
        var result=RoomActionStatus.Accepted;
        foreach(var target in prepared.Targets!){
            if(permitted?.Invoke()==false)return new(RoomActionStatus.Cancelled);
            try{launch(target);}
            catch(Exception error) when(error is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or InvalidOperationException or ArgumentException)
            {result=RoomActionStatus.LaunchFailed;}
        }
        return new(result);
    }
    internal RoomActionReply InvokeDesktop(Guid connection,RoomSessionPeer peer,Guid session,RoomNativeInputProof proof)
    {
        // File command proofs must never fall through to application launch.
        if(proof.ContextMenu||proof.Key is 46 or 113 or 67 or 88 or 86 or 93 or 121)return new(RoomActionStatus.NotOperable);
        var prepared=PrepareDesktopTarget(connection,peer,session,proof);
        if(prepared.Status!=RoomActionStatus.Accepted)return new(prepared.Status);
        if(Expired(proof.IssuedAt,clock.GetTimestamp()))return new(RoomActionStatus.ExpiredInput);
        try{if(prepared.Target is not null)launch(prepared.Target);return new(RoomActionStatus.Accepted);}
        catch(Exception error) when(error is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or InvalidOperationException or ArgumentException)
        {return new(RoomActionStatus.LaunchFailed);}
    }
    // Recheck immediately before starting a native file operation. Explorer owns
    // foreground during an external drag; wallpaper playback pause is not a veto.
    internal RoomActionStatus PlaceDesktopDrop(Guid connection, RoomSessionPeer peer, Guid session, string deskId,
        IReadOnlyCollection<string> ids, int targetSlot, int columns, int capacity)
    {
        try
        {
            var spin = new SpinWait();
            while (true)
            {
                var result = store.UpdateForDispatch(state =>
                {
                    var admitted = gateway.TryWithActionContext(connection, peer, session, (status, context) =>
                    {
                        if (status != RoomProtocolStatus.Accepted) return (Status(status), (RoomDesktopSync?)null);
                        var snapshot = context!.Snapshot;
                        var eligibility = LayoutEligibility(context, snapshot.Revision, false);
                        if (eligibility != RoomActionStatus.Accepted) return (eligibility, (RoomDesktopSync?)null);
                        if (!snapshot.IsActive || snapshot.Lifecycle.Locked || snapshot.TransitionId is not null ||
                            snapshot.Lifecycle.Stage != RoomLifecycleStage.Desktop || snapshot.CurrentDeskId != deskId ||
                            !state.Rooms.TryGetValue(context.Installation.RoomId, out var room) ||
                            room.DesktopSync is not { Enabled: true } previous || previous.DeskId != deskId)
                            return (RoomActionStatus.NotOperable, (RoomDesktopSync?)null);
                        var next = RoomDesktopSync.PlaceDropped(previous, ids, targetSlot, columns, capacity);
                        room.DesktopSync = next;
                        return (RoomActionStatus.Accepted, (RoomDesktopSync?)next);
                    }, out (RoomActionStatus Status, RoomDesktopSync? Settings) response);
                    return (admitted && response.Settings is not null, (admitted, response));
                });
                if (!result.admitted) { spin.SpinOnce(); continue; }
                if (result.response.Settings is { } saved)
                {
                    var current = Volatile.Read(ref desktopPresentation);
                    if (current is not null && current.Session == session && current.View.DeskId == deskId && current.View.Items is { } items)
                    {
                        var updated = current with { View = current.View with { ContextId = Guid.NewGuid().ToString("N"),
                            Items = items.Select(item => saved.Slots.TryGetValue(item.Id, out var slot) ? item with { Slot = slot } : item).ToArray() } };
                        Interlocked.CompareExchange(ref desktopPresentation, updated, current);
                    }
                }
                return result.response.Status;
            }
        }
        catch (Exception error) when (StorageFailure(error)) { return RoomActionStatus.StorageUnavailable; }
    }
    internal RoomActionStatus CheckDesktopDrop(Guid connection, RoomSessionPeer peer, Guid session,
        long revision, string desktopContextId, string deskId)
    {
        try
        {
            var spin = new SpinWait();
            while (true)
            {
                var attempt = store.ReadForDispatch(state =>
                {
                    var admitted = gateway.TryWithActionContext(connection, peer, session, (status, context) =>
                    {
                        if (status != RoomProtocolStatus.Accepted) return Status(status);
                        var eligibility = LayoutEligibility(context!, revision, false);
                        if (eligibility != RoomActionStatus.Accepted) return eligibility;
                        var snapshot = context!.Snapshot;
                        var desktop = Volatile.Read(ref desktopPresentation);
                        if (!snapshot.IsActive || snapshot.Lifecycle.Locked || snapshot.TransitionId is not null ||
                            snapshot.Lifecycle.Stage != RoomLifecycleStage.Desktop || snapshot.CurrentDeskId != deskId ||
                            desktop is null || desktop.Session != session || desktop.Room != context.Installation.RoomId ||
                            desktop.Stamp != context.Installation.InstallationStamp || desktop.View.ContextId != desktopContextId ||
                            desktop.View.DeskId != deskId || !state.Rooms.TryGetValue(desktop.Room, out var room) ||
                            room.DesktopSync is not { Enabled: true } sync || sync.DeskId != deskId)
                            return RoomActionStatus.NotOperable;
                        return RoomActionStatus.Accepted;
                    }, out RoomActionStatus result);
                    return (admitted, result);
                });
                if (attempt.admitted) return attempt.result;
                spin.SpinOnce();
            }
        }
        catch (Exception error) when (StorageFailure(error)) { return RoomActionStatus.StorageUnavailable; }
    }
    // Presentation belongs to the Room; file-drop admission remains Desk-scoped.
    internal RoomActionStatus CheckDesktopSurface(Guid connection,RoomSessionPeer peer,Guid session,long revision)
    {
        try
        {
            var spin=new SpinWait();
            while(true)
            {
                var attempt=store.ReadForDispatch(state=>{
                    var admitted=gateway.TryWithActionContext(connection,peer,session,(status,context)=>{
                        if(status!=RoomProtocolStatus.Accepted)return Status(status);
                        var eligible=LayoutEligibility(context!,revision,false);
                        if(eligible!=RoomActionStatus.Accepted)return eligible;
                        var snapshot=context!.Snapshot;
                        return snapshot.IsActive && !snapshot.Lifecycle.Locked && snapshot.Lifecycle.Stage==RoomLifecycleStage.Desktop &&
                            state.Rooms.TryGetValue(context.Installation.RoomId,out var room) && room.DesktopSync is {Enabled:true}
                            ? RoomActionStatus.Accepted : RoomActionStatus.NotOperable;
                    },out RoomActionStatus result);
                    return(admitted,result);
                });
                if(attempt.admitted)return attempt.result;
                spin.SpinOnce();
            }
        }
        catch(Exception error) when(StorageFailure(error)){return RoomActionStatus.StorageUnavailable;}
    }
    internal void ClearDesktopPresentation() { Volatile.Write(ref desktopPresentation,null); Volatile.Write(ref desktopProgress,null); }

    internal RoomPresentationReply ReadPresentation(Guid connection,RoomSessionPeer peer,Guid session,long revision,string? desktopContextId=null)
    {
        var initial=gateway.ReadActionContext(connection,peer,session,out var early);
        if(initial!=RoomProtocolStatus.Accepted)return new(Status(initial));
        var eligible=LayoutEligibility(early!,revision,false);if(eligible!=RoomActionStatus.Accepted)return new(eligible);
        try
        {
            var spin=new SpinWait();
            while(true)
            {
                var result=store.ReadForDispatch(state=>{
                    var completed=gateway.TryWithActionContext(connection,peer,session,(admitted,context)=>{
                        if(admitted!=RoomProtocolStatus.Accepted)return new RoomPresentationReply(Status(admitted));
                        var current=LayoutEligibility(context!,revision,false);if(current!=RoomActionStatus.Accepted)return new(current);
                        state.Rooms.TryGetValue(context!.Installation.RoomId,out var room);
                        var skins=context.Installation.ActionCatalog!.Buttons.Keys.ToDictionary(id=>id,id=>{
                            var skin=room?.Buttons.GetValueOrDefault(id)?.Skin;
                            return EditorSkins.Any(s=>s.Id==skin)?skin:null;
                        },StringComparer.Ordinal);
                        var locator=Volatile.Read(ref personalLocator);
                        var valid=locator is not null&&locator.Session==session&&locator.Stamp==context.Installation.InstallationStamp&&
                            locator.Room==context.Installation.RoomId&&clock.GetElapsedTime(locator.IssuedAt,clock.GetTimestamp())<TimeSpan.FromSeconds(3);
                        var desktop=Volatile.Read(ref desktopPresentation);
                        var desktopValid=desktop is not null&&desktop.Session==session&&desktop.Room==context.Installation.RoomId&&
                            desktop.Stamp==context.Installation.InstallationStamp&&room?.DesktopSync is {Enabled:true} sync&&sync.DeskId==desktop.View.DeskId;
                        var desktopView=desktopValid?desktop!.View:null;
                        if(desktopView?.ContextId==desktopContextId&&desktopView is not null)desktopView=desktopView with{Items=null};
                        return new(RoomActionStatus.Accepted,new(state.Revision,skins,valid?new(locator!.Request,locator.Button):null,desktopView));
                    },out RoomPresentationReply reply);
                    return(completed,reply);
                });
                if(result.completed)return result.reply;spin.SpinOnce();
            }
        }
        catch(Exception error) when(StorageFailure(error)){return new(RoomActionStatus.StorageUnavailable);}
    }
    private sealed record PersonalEdit(string Operation, string? ButtonId = null, string? Action = null, string? DeskId = null,
        string? TargetId = null, string? Skin = null, string? Name = null, string? Kind = null, string? Target = null,
        string? Arguments = null, string? WorkingDirectory = null, bool? Enabled = null);
    private static readonly JsonSerializerOptions EditorJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 24 };
    private static readonly RoomPersonalSkin[] EditorSkins = { new("classic","经典"), new("glass","玻璃"), new("outline","描边") };
    private static RoomPersonalEditorReply EditorFailure(RoomActionStatus status) => new(GrantFailure(status).Status);

    public RoomPersonalEditorReply GetPersonalEditor(Guid connection, RoomSessionPeer peer, Guid session, string roomId, string stamp) =>
        PersonalEditorOperation(connection,peer,session,roomId,stamp,null);

    public RoomPersonalEditorReply EditPersonal(Guid connection, RoomSessionPeer peer, Guid session, string roomId, string stamp, string editJson)
    {
        PersonalEdit edit;
        try
        {
            if (editJson is null || Encoding.UTF8.GetByteCount(editJson) > 32768) return EditorFailure(RoomActionStatus.Denied);
            using var document = JsonDocument.Parse(editJson,new JsonDocumentOptions { MaxDepth=24 });
            var root=document.RootElement;
            if (root.ValueKind!=JsonValueKind.Object) return EditorFailure(RoomActionStatus.Denied);
            RoomV3Installation.CheckUniqueJson(root);
            edit=JsonSerializer.Deserialize<PersonalEdit>(editJson,EditorJson) ?? throw new InvalidDataException();
            string[] keys=edit.Operation switch {
                "enableNavigation" or "refreshDesktopSync"=>new[]{"operation"},
                "setDesktopSync"=>new[]{"operation","deskId","enabled"},
                "setButton"=>new[]{"operation","buttonId","action","deskId","targetId","skin"},
                "resetButton" or "locateButton"=>new[]{"operation","buttonId"},
                "upsertTarget"=>new[]{"operation","targetId","name","kind","target","arguments","workingDirectory"},
                "removeTarget"=>new[]{"operation","targetId"},
                _=>Array.Empty<string>() };
            if(keys.Length==0 || root.EnumerateObject().Any(p=>!keys.Contains(p.Name,StringComparer.Ordinal))) return EditorFailure(RoomActionStatus.Denied);
            if(edit.Operation is "setButton" or "resetButton" or "locateButton") RoomPersonalStore.Id(edit.ButtonId!);
            if(edit.Operation=="setDesktopSync")
            {
                RoomPersonalStore.Id(edit.DeskId!);
                if(edit.Enabled is null)return EditorFailure(RoomActionStatus.Denied);
            }
            if(edit.TargetId is not null) RoomPersonalStore.Uuid(edit.TargetId);
            if(edit.Operation is "upsertTarget" or "removeTarget" && edit.TargetId is null) return EditorFailure(RoomActionStatus.Denied);
            if(edit.Operation=="upsertTarget") RoomPersonalStore.ValidateTarget(EditTarget(edit));
            if(edit.Operation=="setButton")
            {
                if(edit.Action is not null && !RoomPersonalStore.ActionNames.Contains(edit.Action,StringComparer.Ordinal)) return EditorFailure(RoomActionStatus.Denied);
                if(edit.Skin is not null) RoomPersonalStore.Id(edit.Skin);
                if(edit.DeskId is not null) RoomPersonalStore.Id(edit.DeskId);
                if(edit.Action=="desk.go" ? edit.DeskId is null : edit.DeskId is not null) return EditorFailure(RoomActionStatus.Denied);
            }
        }
        catch(Exception error) when(error is InvalidDataException or JsonException or InvalidOperationException or ArgumentException)
        { return EditorFailure(RoomActionStatus.Denied); }
        return PersonalEditorOperation(connection,peer,session,roomId,stamp,edit);
    }

    private static PersonalTarget EditTarget(PersonalEdit edit) =>
        new(edit.Name??"",edit.Kind??"",edit.Target??"",edit.Arguments??"",edit.WorkingDirectory??"");

    private RoomPersonalEditorReply PersonalEditorOperation(Guid connection,RoomSessionPeer peer,Guid session,string room,string stamp,PersonalEdit? edit)
    {
        try
        {
            var initial=gateway.ReadCoordinatorContext(connection,peer,session,out var early);
            if(initial!=RoomProtocolStatus.Accepted)return EditorFailure(Status(initial));
            var identity=GrantIdentity(early!,room,stamp);if(identity!=RoomActionStatus.Accepted)return EditorFailure(identity);
            var spin=new SpinWait();
            while(true)
            {
                (bool Completed,bool Publish,RoomPersonalEditorReply Reply) Attempt(RoomPersonalState state)
                {
                    var complete=gateway.TryWithCoordinatorContext(connection,peer,session,(status,context)=>{
                        if(status!=RoomProtocolStatus.Accepted)return(false,EditorFailure(Status(status)));
                        var current=GrantIdentity(context!,room,stamp);
                        return current==RoomActionStatus.Accepted?PrepareEditor(state,context!.Installation,context.Snapshot,edit):(false,EditorFailure(current));
                    },out (bool Publish,RoomPersonalEditorReply Reply) outcome);
                    return(complete,complete&&outcome.Publish,outcome.Reply);
                }
                var result=edit is null?store.ReadForDispatch(Attempt):
                    store.UpdateForDispatch(state=>{var candidate=Attempt(state);return(candidate.Publish,candidate);});
                if(result.Completed)return result.Reply;spin.SpinOnce();
            }
        }
        catch(Exception error) when(StorageFailure(error)||error is OverflowException)
        {return EditorFailure(RoomActionStatus.StorageUnavailable);}
    }

    private (bool Publish,RoomPersonalEditorReply Reply) PrepareEditor(RoomPersonalState state,VerifiedRoomInstallation installed,RoomSessionSnapshot snapshot,PersonalEdit? edit)
    {
        var changed=false;
        if(edit?.Operation=="setDesktopSync")
        {
            if(!installed.DeskIds.Contains(edit.DeskId!,StringComparer.Ordinal))return(false,EditorFailure(RoomActionStatus.Denied));
            state.Rooms.TryGetValue(installed.RoomId,out var existing);var room=existing??new RoomPersonalData();
            if(room.DesktopSync is not { } old || old.DeskId!=edit.DeskId || old.Enabled!=edit.Enabled)
            {
                room.DesktopSync=RoomDesktopSync.Reconcile(room.DesktopSync,edit.DeskId!,edit.Enabled!.Value,null,false);
                state.Rooms[installed.RoomId]=room;changed=true;
            }
        }
        else if(edit?.Operation=="enableNavigation")
        {
            state.Rooms.TryGetValue(installed.RoomId,out var existing);var room=existing??new RoomPersonalData();
            foreach(var button in installed.ActionCatalog!.Buttons.Values)
            {
                var action=Resolve(state,installed.RoomId,button,out _);
                if(action?.Type is not ("desk.next" or "desk.previous" or "desk.go"))continue;
                foreach(var (id,owner) in installed.ActionCatalog.Consumers)
                {
                    if(!owner.HasButton(button.Id)||!owner.HasCapability("desk.navigate"))continue;
                    var capabilities=room.Grants.TryGetValue(id,out var grant)&&grant.InstallationStamp==installed.InstallationStamp
                        ?grant.Capabilities.ToHashSet(StringComparer.Ordinal):new HashSet<string>(StringComparer.Ordinal);
                    if(capabilities.Add("desk.navigate")){room.Grants[id]=new(installed.InstallationStamp,capabilities.OrderBy(x=>x,StringComparer.Ordinal).ToArray());changed=true;}
                }
            }
            if(changed&&existing is null)state.Rooms[installed.RoomId]=room;
        }
        else if(edit?.Operation=="locateButton")
        {
            if(!installed.ActionCatalog!.Buttons.TryGetValue(edit.ButtonId!,out var button))return(false,EditorFailure(RoomActionStatus.InvalidButton));
            if(snapshot.Lifecycle.Stage!=RoomLifecycleStage.Desktop||snapshot.TransitionId is not null||
                button.Scope!="room"&&button.Scope!=snapshot.CurrentDeskId)return(false,EditorFailure(RoomActionStatus.NotOperable));
            Volatile.Write(ref personalLocator,new(snapshot.SessionId,installed.InstallationStamp,installed.RoomId,button.Id,Guid.NewGuid().ToString("D"),clock.GetTimestamp()));
        }
        else if(edit?.Operation is "setButton" or "resetButton")
        {
            if(!installed.ActionCatalog!.Buttons.TryGetValue(edit.ButtonId!,out var authored))
                return(false,EditorFailure(RoomActionStatus.InvalidButton));
            state.Rooms.TryGetValue(installed.RoomId,out var existing);var room=existing??new RoomPersonalData();
            room.Buttons.TryGetValue(edit.ButtonId!,out var old);
            if(edit.Operation=="resetButton") changed=room.Buttons.Remove(edit.ButtonId!);
            else
            {
                if(edit.TargetId is not null && !state.Targets.ContainsKey(edit.TargetId))return(false,EditorFailure(RoomActionStatus.MissingBinding));
                if(edit.Action=="desk.go"&&!installed.DeskIds.Contains(edit.DeskId!,StringComparer.Ordinal))return(false,EditorFailure(RoomActionStatus.Denied));
                if(edit.Skin is not null && !EditorSkins.Any(s=>s.Id==edit.Skin) && edit.Skin!=old?.Skin)return(false,EditorFailure(RoomActionStatus.Denied));
                var value=new PersonalButtonOverride(edit.Action,edit.DeskId,edit.TargetId,edit.Skin);
                var empty=value==new PersonalButtonOverride();
                if(empty) changed=room.Buttons.Remove(edit.ButtonId!);
                else if(value!=old){room.Buttons[edit.ButtonId!]=value;changed=true;}
                var action=edit.Action??authored.Action?.Type??(edit.TargetId is not null?"binding.launch":null);
                var required=action switch {"binding.launch"=>"binding.launch","dext.exit"=>"dext.exit","desk.next" or "desk.previous" or "desk.go"=>"desk.navigate",_=>null};
                if(required is not null)foreach(var (id,owner) in installed.ActionCatalog.Consumers)
                {
                    if(!owner.HasButton(edit.ButtonId!)||!owner.HasCapability(required))continue;
                    var current=room.Grants.TryGetValue(id,out var grant)&&grant.InstallationStamp==installed.InstallationStamp
                        ?grant.Capabilities.ToHashSet(StringComparer.Ordinal):new HashSet<string>(StringComparer.Ordinal);
                    if(current.Add(required)){room.Grants[id]=new(installed.InstallationStamp,current.OrderBy(x=>x,StringComparer.Ordinal).ToArray());changed=true;}
                }
            }
            if(changed&&existing is null)state.Rooms[installed.RoomId]=room;
        }
        else if(edit?.Operation=="upsertTarget")
        {
            var value=EditTarget(edit);
            if(!state.Targets.TryGetValue(edit.TargetId!,out var old)||old!=value){state.Targets[edit.TargetId!]=value;changed=true;}
        }
        else if(edit?.Operation=="removeTarget")
        {
            changed=state.Targets.Remove(edit.TargetId!);
            foreach(var room in state.Rooms.Values)foreach(var (id,button) in room.Buttons.ToArray())
                if(button.TargetId==edit.TargetId){var value=button with{TargetId=null};if(value==new PersonalButtonOverride())room.Buttons.Remove(id);else room.Buttons[id]=value;changed=true;}
        }
        return(changed,new("accepted",installed.RoomId,installed.InstallationStamp,ProjectEditor(state,installed,changed)));
    }

    private RoomPersonalEditorSnapshot ProjectEditor(RoomPersonalState state,VerifiedRoomInstallation installed,bool publish)
    {
        state.Rooms.TryGetValue(installed.RoomId,out var room);
        var buttons=installed.ActionCatalog!.Buttons.Values.OrderBy(b=>b.Id,StringComparer.Ordinal).Select(b=>{
            PersonalButtonOverride? value=null;room?.Buttons.TryGetValue(b.Id,out value);
            var action=Resolve(state,installed.RoomId,b,out var target);
            return new RoomPersonalEditorButton(b.Id,b.Name,b.Scope,b.Action?.Type,b.Action?.DeskId,action?.Type,action?.DeskId,target is not null,
                value is null?null:new RoomPersonalButtonSettings(value.Action,value.DeskId,value.TargetId,value.Skin));
        }).ToArray();
        var uses=state.Rooms.Values.SelectMany(r=>r.Buttons.Values).Where(b=>b.TargetId is not null).GroupBy(b=>b.TargetId!)
            .ToDictionary(group=>group.Key,group=>group.Count(),StringComparer.Ordinal);
        var targets=state.Targets.OrderBy(pair=>pair.Value.Name,StringComparer.Ordinal).ThenBy(pair=>pair.Key,StringComparer.Ordinal)
            .Select(pair=>new RoomPersonalEditorTarget(pair.Key,pair.Value.Name,pair.Value.Kind,pair.Value.Target,pair.Value.Arguments,pair.Value.WorkingDirectory,uses.GetValueOrDefault(pair.Key))).ToArray();
        var progress=Volatile.Read(ref desktopProgress);
        var matching=progress?.Room==installed.RoomId&&progress?.Desk==room?.DesktopSync?.DeskId;
        return new(checked(state.Revision+(publish?1:0)),buttons,targets,EditorSkins.ToArray(),
            room?.DesktopSync is { } sync ? new(sync.Enabled,sync.DeskId,sync.Slots.Count,!sync.Enabled?"disabled":matching?progress!.State:"pending",matching?progress!.Issues:0) : null);
    }
}
