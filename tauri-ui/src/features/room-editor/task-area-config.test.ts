import { describe, it, expect } from "vitest";
import { createRoomV3, readRoomV3, serializeRoomV3 } from "./v3-document";
import {
  ensureTaskArea,
  effectiveTaskArea,
  setTaskAreaValue,
  resetTaskAreaValue,
  DEFAULT_TASK_AREA_STYLE,
} from "./task-area-config";

function roomWithLocalDock() {
  const room = createRoomV3("TaskArea");
  const dockId = "dock-local";
  room.components = [
    {
      id: dockId,
      role: "dock",
      entry: "assets/dock/index.html",
      placement: { x: 0, y: 960, width: 1920, height: 120 },
      capabilities: [],
    },
  ];
  room.dockComponentId = dockId;
  for (const desk of room.desks) desk.components = [dockId];
  room.resources = ["assets/dock/index.html"];
  return room;
}

describe("task-area-config authoring", () => {
  it("creates a default declaration without requiring an official template", () => {
    const room = ensureTaskArea(roomWithLocalDock());
    const area = effectiveTaskArea(room);
    expect(area?.version).toBe(1);
    expect(area?.style).toEqual(DEFAULT_TASK_AREA_STYLE);
    expect(area!.rect.width).toBeGreaterThan(0);
    expect(room.components![0].config!.template).toBeUndefined();
  });

  it("stores only Desk style leaves and keeps other Desk on shared values", () => {
    let room = ensureTaskArea(roomWithLocalDock());
    const deskA = room.desks[0].id;
    const deskB = room.desks[1].id;
    room = setTaskAreaValue(room, ["style", "surface"], "#101b24aa");
    room = setTaskAreaValue(room, ["style", "iconSizeDip"], 48);
    room = setTaskAreaValue(room, ["style", "surface"], "#ff0000", deskA);
    room = setTaskAreaValue(room, ["style", "iconSizeDip"], 32, deskA);

    expect(effectiveTaskArea(room, deskA)?.style.surface).toBe("#ff0000");
    expect(effectiveTaskArea(room, deskA)?.style.iconSizeDip).toBe(32);
    expect(effectiveTaskArea(room, deskB)?.style.surface).toBe("#101b24aa");
    expect(effectiveTaskArea(room, deskB)?.style.iconSizeDip).toBe(48);
    expect(room.desks[0].componentOverrides![room.dockComponentId!]).toEqual({
      dextTaskArea: { style: { surface: "#ff0000", iconSizeDip: 32 } },
    });
    expect(room.desks[1].componentOverrides).toBeUndefined();
  });

  it("reset restores inheritance and serialize/reopen keeps Desk differences", () => {
    let room = ensureTaskArea(roomWithLocalDock());
    const deskA = room.desks[0].id;
    room = setTaskAreaValue(room, ["style", "surface"], "#aabbcc");
    room = setTaskAreaValue(room, ["style", "surface"], "#112233", deskA);
    room = setTaskAreaValue(room, ["style", "iconSizeDip"], 28, deskA);

    const reopened = readRoomV3(serializeRoomV3(room));
    expect(effectiveTaskArea(reopened, deskA)?.style.surface).toBe("#112233");
    expect(effectiveTaskArea(reopened, deskA)?.style.iconSizeDip).toBe(28);
    expect(effectiveTaskArea(reopened)?.style.surface).toBe("#aabbcc");

    room = resetTaskAreaValue(reopened, ["style", "surface"], deskA);
    expect(effectiveTaskArea(room, deskA)?.style.surface).toBe("#aabbcc");
    expect(room.desks[0].componentOverrides![room.dockComponentId!]).toEqual({
      dextTaskArea: { style: { iconSizeDip: 28 } },
    });
    room = resetTaskAreaValue(room, ["style", "iconSizeDip"], deskA);
    expect(room.desks[0].componentOverrides).toBeUndefined();
    expect(effectiveTaskArea(room, deskA)?.style.iconSizeDip).toBe(40);
  });

  it("rejects out-of-range style and colors before writing", () => {
    const room = ensureTaskArea(roomWithLocalDock());
    expect(() => setTaskAreaValue(room, ["style", "iconSizeDip"], 65)).toThrow(/iconSizeDip/);
    expect(() => setTaskAreaValue(room, ["style", "surface"], "red")).toThrow(/surface/);
    expect(() => setTaskAreaValue(room, ["rect", "width"], 10)).toThrow(/过小|超出|矩形/);
  });
});
