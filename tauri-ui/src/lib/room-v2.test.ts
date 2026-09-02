import { describe, expect, it } from "vitest";
import { cleanHotspots, cleanWidget, WIDGET_PERMISSIONS } from "./room-v2";

describe("Room v2 capabilities", () => {
  it("keeps only closed, in-bounds trusted hotspots", () => {
    expect(cleanHotspots([
      { id: "play", label: "播放", placement: { x: 1, y: 2, width: 80, height: 32, z: 1 }, action: { id: "system.media.play" } },
      { id: "shell", label: "危险", placement: { x: 0, y: 0, width: 80, height: 32, z: 1 }, action: { id: "shell.execute" } },
      { id: "loud", label: "越界", placement: { x: 0, y: 0, width: 80, height: 32, z: 1 }, action: { id: "system.volume.set", value: 2 } },
    ])).toEqual([
      { id: "play", label: "播放", placement: { x: 1, y: 2, width: 80, height: 32, z: 1 }, action: { id: "system.media.play" } },
    ]);
  });

  it("does not expose unimplemented network, navigation or general storage permissions", () => {
    expect(WIDGET_PERMISSIONS).not.toContain("network.proxy");
    expect(WIDGET_PERMISSIONS).not.toContain("navigation.go");
    expect(WIDGET_PERMISSIONS).not.toContain("storage.kv");
  });

  it("normalizes Widget hotspots against the Widget rectangle", () => {
    const widget = cleanWidget({
      id: "clock", name: "Clock", src: "widgets/clock/index.html",
      resources: ["widgets/clock/index.html"],
      placement: { x: 0, y: 0, width: 120, height: 80, z: 1 },
      config: {}, permissions: ["action.invoke"],
      hotspots: [
        { id: "inside", label: "inside", placement: { x: 0, y: 0, width: 120, height: 80, z: 1 }, action: { id: "system.media.pause" } },
        { id: "outside", label: "outside", placement: { x: 100, y: 0, width: 40, height: 40, z: 1 }, action: { id: "system.media.pause" } },
      ],
    });
    expect(widget?.hotspots.map((item) => item.id)).toEqual(["inside"]);
  });
});
