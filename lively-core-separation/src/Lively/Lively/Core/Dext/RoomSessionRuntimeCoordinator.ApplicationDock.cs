using System;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    internal RoomDockNavigation? ReadApplicationDockNavigation()
    {
        lock (gate)
        {
            var snapshot = CurrentSnapshot;
            if (!activeNativeRoom || snapshot is null || activePlayer?.IsExited != false) return null;
            var installation = authority.Admit(new RoomSessionPeer("core-runtime"),
                new(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, snapshot.RoomId))?.Installation;
            return installation?.RuntimeContext is { } context && installation.InstallationStamp == snapshot.InstallationStamp
                ? RoomDockNavigation.Create(snapshot, context.Manifest) : null;
        }
    }

    internal PersonalTarget[]? ReadApplicationDockPins(RoomDockNavigation context) =>
        actions.ReadApplicationDockPins(context.RoomId, context.CurrentDeskId);

    internal void SetApplicationDockPins(Guid sessionId, string roomId, string deskId, PersonalTarget[]? pins)
    {
        if (ReadApplicationDockNavigation()?.MatchesPinEdit(sessionId, roomId, deskId) != true)
            throw new InvalidOperationException("当前 Room/Desk 已改变，请重新选择固定应用。");
        // Persist to the explicit checked identity. A later page change never redirects this write.
        actions.SetApplicationDockPins(roomId, deskId, pins);
    }

    // Only the official Core WPF button calls this. No RPC or author SDK entry.
    internal bool NavigateApplicationDock(Guid expectedSession, int direction)
    {
        lock (gate)
        {
            if (dockOwnership.Owner != DockHost.Application) return false;
            var navigation = ReadApplicationDockNavigation();
            if (navigation?.SessionId != expectedSession || navigation.Target(direction) is not { } target) return false;
            return kernel.RequestFromDock(expectedSession, target).Status is RoomCommandStatus.Accepted or RoomCommandStatus.Queued;
        }
    }
}
