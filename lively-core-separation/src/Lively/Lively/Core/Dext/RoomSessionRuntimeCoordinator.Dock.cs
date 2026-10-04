using System;
using System.Linq;

namespace Dext.Core.Rooms;

internal sealed partial class RoomSessionRuntimeCoordinator
{
    public RoomDockStatusReply GetRoomDockStatus() => DockReply(dockPreferences.Read());

    public RoomDockStatusReply SetRoomDockPreference(string patchJson) => DockReply(dockPreferences.Patch(patchJson));

    private RoomDockStatusReply DockReply(RoomDockPreferenceResult result)
    {
        lock (gate)
        {
            var snapshot = CurrentSnapshot;
            var context = snapshot is null ? null : authority.Admit(new RoomSessionPeer("core-runtime"),
                new RoomSessionHello(RoomSessionKernel.ProtocolVersion, RoomClientRole.Coordinator, snapshot.RoomId))?.Installation.RuntimeContext;
            var deskId = snapshot?.TargetDeskId ?? snapshot?.CurrentDeskId;
            var hasDock = false;
            if (context is not null && deskId is not null &&
                context.Manifest.TryGetProperty("dockComponentId", out var nativeDock) &&
                context.Manifest.TryGetProperty("components", out var components))
            {
                var desk = context.Manifest.GetProperty("desks").EnumerateArray()
                    .FirstOrDefault(item => item.GetProperty("id").GetString() == deskId);
                if (desk.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    var referenced = desk.GetProperty("components").EnumerateArray().Select(item => item.GetString()).ToHashSet();
                    hasDock = components.EnumerateArray().Any(item =>
                        item.GetProperty("id").GetString() == nativeDock.GetString() &&
                        item.GetProperty("role").GetString() == "dock" && referenced.Contains(item.GetProperty("id").GetString()));
                }
            }
            var phase = result.Status != "accepted" ? "settingsUnavailable" :
                result.Preferences?.Enabled != true ? "disabled" :
                context is null ? "noNativeRoom" : !hasDock ? "noDock" :
                result.Preferences?.Mode == "reserve" ? "unsupportedMode" : "hostPending";
            // Task2 replaces this pending state with the actual Core-owned process
            // and window initialization facts. Preference acceptance is never "running".
            return new(result.Status, result.Preferences,
                new(phase, 0, snapshot?.RoomId, deskId, hasDock, false, false, false,
                    phase == "hostPending" ? "Dock 宿主尚未连接。" : phase == "unsupportedMode" ? "常驻占位暂不可运行。" : null), result.Message);
        }
    }
}
