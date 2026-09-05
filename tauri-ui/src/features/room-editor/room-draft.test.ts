import { describe, expect, it } from "vitest";
import { DEFAULT_DOCK } from "@/lib/dock";
import type { Desk } from "@/lib/room-v2";
import { cleanContent, cleanDesk, serializeRoomV2 } from "./room-draft";

describe("Room v2 draft conversion", () => {
  it("accepts only local content in the requested directory", () => {
    expect(cleanContent({ name: " Clock ", type: "html", src: "background/clock/index.html", permissions: ["time.read", "unknown"] }, "background"))
      .toEqual({ name: "Clock", type: "html", src: "background/clock/index.html", permissions: ["time.read"] });
    expect(cleanContent({ name: "Escape", type: "html", src: "background/../secret.html" }, "background")).toBeNull();
    expect(cleanContent({ name: "Wrong slot", type: "image", src: "idle/a.png" }, "background")).toBeNull();
  });

  it("normalizes every Desk to native v2 collections", () => {
    expect(cleanDesk({ name: "", iconSize: "huge", icons: [{}], widgets: [{}] }, 1)).toMatchObject({
      name: "Desk 2",
      background: null,
      iconSize: "medium",
      icons: [{ label: "图标 1", x: 0, y: 0 }],
      widgets: [],
    });
  });

  it("serializes Scene, switches, widgets and Dock through one v2 writer", () => {
    const desks: Desk[] = [{
      name: " Main ",
      background: null,
      iconSize: "medium",
      icons: [],
      widgets: [{
        id: "clock",
        name: "Clock",
        src: "widgets/clock/index.html",
        resources: ["widgets/clock/index.html"],
        placement: { x: 10, y: 20, width: 200, height: 100, z: 2 },
        config: {},
        permissions: ["time.read"],
        hotspots: [],
      }],
    }];
    const room = serializeRoomV2({
      desks,
      startDesk: 99,
      transition: "fade",
      edges: [{ id: "unused", from: "start", to: "d0", trans: null }],
      startContent: { name: "Start", type: "html", src: "start/index.html" },
      startName: " Welcome ",
      idleContent: null,
      idleName: "Idle",
      dock: DEFAULT_DOCK,
    });
    expect(room).toMatchObject({
      version: 2,
      startDesk: 0,
      switch: "fade",
      start: { name: "Welcome", type: "html", src: "start/index.html" },
      desks: [{ name: "Main", widgets: [{ id: "clock" }] }],
      dock: { enabled: true, position: "bottom", icons: [] },
    });
  });
});
