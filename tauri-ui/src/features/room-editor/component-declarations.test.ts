import { describe, expect, it } from "vitest";
import {
  addComponentButton,
  parsePublicConfigJson,
  removeComponentButtonRef,
  setComponentCapabilities,
  setComponentConfig,
  updateComponentButton,
  V3_CAPABILITIES,
} from "./component-declarations";
import { attachDockTemplate, type DockTemplateDescriptor } from "./dock-template";
import { createRoomV3, readRoomV3, serializeRoomV3, type RoomV3, type V3Component } from "./v3-document";

function localDock(room: RoomV3, overrides: Partial<V3Component> = {}): RoomV3 {
  const next = structuredClone(room);
  const dock: V3Component = {
    id: "dock-local",
    role: "dock",
    entry: "assets/dock/index.html",
    placement: { x: 0, y: 960, width: 1920, height: 120 },
    capabilities: [],
    ...overrides,
  };
  next.components = [dock];
  next.dockComponentId = dock.id;
  for (const desk of next.desks) if (!desk.components.includes(dock.id)) desk.components.push(dock.id);
  return next;
}

const descriptor: DockTemplateDescriptor = {
  formatVersion: 1,
  id: "demo",
  name: "Demo",
  entry: "index.html",
  placement: { x: 0, y: 960, width: 1920, height: 120 },
  parameters: [{ id: "height", name: "高度", type: "number", default: 120, min: 80, max: 240 }],
  regions: [
    { id: "prev", name: "上一页", kind: "button", defaultAction: { type: "desk.previous" } },
    { id: "clock", name: "时钟", kind: "data", defaultSource: { capability: "time.read", path: ["unixMilliseconds"], format: "clock" } },
  ],
  examples: [],
};

describe("component-declarations", () => {
  it("keeps local dock capabilities empty by default and never auto-fills the template set", () => {
    const room = localDock(createRoomV3("声明"));
    expect(room.components![0].capabilities).toEqual([]);
    expect(room.components![0].buttonIds).toBeUndefined();
    expect(room.components![0].config).toBeUndefined();
    expect(V3_CAPABILITIES.map(([id]) => id)).toContain("time.read");
    expect(V3_CAPABILITIES).toHaveLength(12);
  });

  it("round-trips capabilities, buttons, and config through serialize/read", () => {
    let room = localDock(createRoomV3("声明"));
    room = setComponentCapabilities(room, "dock-local", ["time.read", "desk.navigate"]);
    room = addComponentButton(room, "dock-local", { name: "上一页", action: { type: "desk.previous" } });
    room = setComponentConfig(room, "dock-local", { theme: "clock" });
    const restored = readRoomV3(serializeRoomV3(room));
    const dock = restored.components!.find((c) => c.id === "dock-local")!;
    expect(dock.capabilities).toEqual(["time.read", "desk.navigate"]);
    expect(dock.config).toEqual({ theme: "clock" });
    expect(dock.buttonIds).toHaveLength(1);
    expect(restored.buttons).toEqual([
      expect.objectContaining({ id: dock.buttonIds![0], name: "上一页", scope: "room", action: { type: "desk.previous" } }),
    ]);
  });

  it("removes unused buttons but keeps ones still referenced by icons", () => {
    let room = localDock(createRoomV3("声明"));
    room = addComponentButton(room, "dock-local", { name: "上一页", action: { type: "desk.previous" } });
    room = addComponentButton(room, "dock-local", { name: "启动", action: { type: "binding.launch" } });
    const [keep, drop] = room.components![0].buttonIds!;
    room.desks[0].icons.push({ id: "icon-1", buttonId: keep, x: 0, y: 0, label: "图标" });
    room = removeComponentButtonRef(room, "dock-local", keep);
    room = removeComponentButtonRef(room, "dock-local", drop);
    expect(room.components![0].buttonIds).toBeUndefined();
    expect(room.buttons?.map((b) => b.id)).toEqual([keep]);
  });

  it("rejects unknown capabilities and private config", () => {
    const room = localDock(createRoomV3("声明"));
    expect(() => setComponentCapabilities(room, "dock-local", ["time.read", "evil.power"])).toThrow(/未知能力/);
    expect(() => parsePublicConfigJson("[1]")).toThrow(/必须是对象/);
    expect(() => parsePublicConfigJson('{"token":"x"}')).toThrow(/私有字段/);
    expect(() => setComponentConfig(room, "dock-local", { target: "C:\\\\Apps\\\\a.exe" })).toThrow(/私有字段/);
    expect(parsePublicConfigJson('{"theme":"x"}')).toEqual({ theme: "x" });
    expect(parsePublicConfigJson("")).toBeUndefined();
  });

  it("updates button names and actions, and refuses template-managed docks", () => {
    let room = localDock(createRoomV3("声明"));
    room = addComponentButton(room, "dock-local", { name: "上一页" });
    const buttonId = room.components![0].buttonIds![0];
    room = updateComponentButton(room, "dock-local", buttonId, {
      name: "回到上一页",
      action: { type: "desk.go", deskId: room.desks[0].id },
    });
    expect(room.buttons![0]).toMatchObject({
      name: "回到上一页",
      action: { type: "desk.go", deskId: room.desks[0].id },
    });
    room = updateComponentButton(room, "dock-local", buttonId, { action: null });
    expect(room.buttons![0].action).toBeUndefined();

    const templated = attachDockTemplate(createRoomV3("模板"), descriptor, { entry: "dock/index.html", resources: ["dock/index.html"] });
    const id = templated.dockComponentId!;
    expect(() => setComponentCapabilities(templated, id, ["time.read"])).toThrow(/模板/);
    expect(() => addComponentButton(templated, id, { name: "x" })).toThrow(/模板/);
  });
});
