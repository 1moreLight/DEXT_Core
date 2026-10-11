using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
namespace Dext.Core.Rooms;

public sealed record RoomReadGrantCapability(string Capability, bool Allowed);
public sealed record RoomReadGrantConsumer(string ConsumerId, RoomReadGrantCapability[] Capabilities);
public sealed record RoomReadGrantsReply(string Status, string RoomId = "", string InstallationStamp = "", RoomReadGrantConsumer[]? Consumers = null);

// Trusted configurator path. Author consumers never receive grant editing.
internal sealed partial class RoomActionAuthority
{
    private static readonly HashSet<string> ConfigurableData = new(StringComparer.Ordinal) { "time.read", "hardware.read", "media.read", "audio.read", "storage.read", "storage.write" };
    public RoomReadGrantsReply GetReadGrants(Guid connection, RoomSessionPeer peer, Guid session, string roomId, string installationStamp) =>
        ReadGrantOperation(connection, peer, session, roomId, installationStamp, null, null, null);
    public RoomReadGrantsReply SetReadGrant(Guid connection, RoomSessionPeer peer, Guid session, string roomId, string installationStamp,
        string consumerId, string[] capabilities, bool allow) =>
        ReadGrantOperation(connection, peer, session, roomId, installationStamp, consumerId, capabilities, allow);

    private static RoomReadGrantsReply GrantFailure(RoomActionStatus status)
    {
        var text = status.ToString(); return new(char.ToLowerInvariant(text[0]) + text.Substring(1));
    }
    private static RoomActionStatus GrantIdentity(RoomActionContext context, string room, string stamp) =>
        context.Role != RoomClientRole.Coordinator ? RoomActionStatus.Forbidden :
        context.Installation.RoomId != room || context.Installation.InstallationStamp != stamp ? RoomActionStatus.StaleSession :
        context.Installation.ActionCatalog is null ? RoomActionStatus.Denied : RoomActionStatus.Accepted;
    private RoomReadGrantsReply ReadGrantOperation(Guid connection, RoomSessionPeer peer, Guid session, string room, string stamp,
        string? consumer, string[]? capabilities, bool? allow)
    {
        try
        {
            var initial = gateway.ReadCoordinatorContext(connection, peer, session, out var early);
            if (initial != RoomProtocolStatus.Accepted) return GrantFailure(Status(initial));
            var identity = GrantIdentity(early!, room, stamp);
            if (identity != RoomActionStatus.Accepted) return GrantFailure(identity);
            if (allow is not null && (capabilities is null || capabilities.Length is < 1 or > 6 ||
                capabilities.Any(capability => capability is null || !ConfigurableData.Contains(capability))))
                return GrantFailure(RoomActionStatus.Forbidden);
            var selected = capabilities?.Distinct(StringComparer.Ordinal).ToArray();
            var spin = new SpinWait();
            while (true)
            {
                (bool Completed, bool Publish, RoomReadGrantsReply Reply) Attempt(RoomPersonalState state)
                {
                    var completed = gateway.TryWithCoordinatorContext(connection, peer, session, (status, context) =>
                    {
                        if (status != RoomProtocolStatus.Accepted) return (false, GrantFailure(Status(status)));
                        var current = GrantIdentity(context!, room, stamp);
                        if (current != RoomActionStatus.Accepted) return (false, GrantFailure(current));
                        return PrepareReadGrant(state, context!.Installation, consumer, selected, allow);
                    }, out (bool Publish, RoomReadGrantsReply Reply) outcome);
                    return (completed, completed && outcome.Publish, outcome.Reply);
                }
                var result = allow is null ? store.ReadForDispatch(Attempt) :
                    store.UpdateForDispatch(state => { var prepared = Attempt(state); return (prepared.Publish, prepared); });
                if (result.Completed) return result.Reply;
                spin.SpinOnce(); // Retry after releasing the private store.
            }
        }
        catch (Exception error) when (StorageFailure(error)) { return GrantFailure(RoomActionStatus.StorageUnavailable); }
    }
    private static (bool Publish, RoomReadGrantsReply Reply) PrepareReadGrant(RoomPersonalState state,
        VerifiedRoomInstallation installed, string? consumer, string[]? capabilities, bool? allow)
    {
        var changed = false;
        if (allow is not null)
        {
            if (consumer is null || !installed.ActionCatalog!.Consumers.TryGetValue(consumer, out var owner))
                return (false, GrantFailure(RoomActionStatus.UnknownConsumer));
            if (capabilities!.Any(capability => !owner.HasCapability(capability)))
                return (false, GrantFailure(RoomActionStatus.Forbidden));
            var current = ConfigurableData.Where(capability => Permission(state, installed, owner, consumer, capability) == RoomActionStatus.Accepted)
                .ToHashSet(StringComparer.Ordinal);
            var selected = new HashSet<string>(current, StringComparer.Ordinal);
            foreach (var capability in capabilities!) { if (allow.Value) selected.Add(capability); else selected.Remove(capability); }
            changed = !selected.SetEquals(current);
            if (changed)
            {
                if (!state.Rooms.TryGetValue(installed.RoomId, out var personal)) state.Rooms[installed.RoomId] = personal = new();
                // Keep the existing on-disk format: read overrides remain read-only,
                // storage edits touch only storage bits in the current installation grant.
                if (capabilities.Any(ReadableData.Contains))
                    personal.ReadGrants[consumer] = new(installed.InstallationStamp,
                        selected.Where(ReadableData.Contains).OrderBy(value => value, StringComparer.Ordinal).ToArray());
                if (capabilities.Any(capability => capability is "storage.read" or "storage.write"))
                {
                    var general = personal.Grants.TryGetValue(consumer, out var prior) && prior.InstallationStamp == installed.InstallationStamp
                        ? prior.Capabilities.ToHashSet(StringComparer.Ordinal) : new HashSet<string>(StringComparer.Ordinal);
                    foreach (var capability in capabilities.Where(capability => capability is "storage.read" or "storage.write"))
                    { if (allow.Value) general.Add(capability); else general.Remove(capability); }
                    personal.Grants[consumer] = new(installed.InstallationStamp, general.OrderBy(value => value, StringComparer.Ordinal).ToArray());
                }
            }
        }
        var consumers = installed.ActionCatalog!.Consumers.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair =>
            new RoomReadGrantConsumer(pair.Key, pair.Value.DeclaredCapabilities.Where(ConfigurableData.Contains)
                .Select(capability => new RoomReadGrantCapability(capability, Permission(state, installed, pair.Value, pair.Key, capability) == RoomActionStatus.Accepted))
                .ToArray())).Where(consumer => consumer.Capabilities.Length > 0).ToArray();
        return (changed, new("accepted", installed.RoomId, installed.InstallationStamp, consumers));
    }
}
