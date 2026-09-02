import { describe, expect, it } from "vitest";
import type { RoomIcon, WidgetPlacement } from "./room-v2";
import { avoidIconObstacles, canvasTransform, clampPlacement } from "./widget-layout";

const icon = (label: string, x: number, y: number): RoomIcon => ({
  label,
  icon_png: "",
  launch: { target: "", args: "", workdir: "" },
  x,
  y,
});

describe("widget layout", () => {
  it("maps a logical canvas into wide and tall viewports with contain", () => {
    expect(canvasTransform(960, 540)).toEqual({ scale: 0.5, width: 960, height: 540, offsetX: 0, offsetY: 0 });
    expect(canvasTransform(1000, 1000)).toEqual({
      scale: 1000 / 1920,
      width: 1000,
      height: 562.5,
      offsetX: 0,
      offsetY: 218.75,
    });
  });

  it("clamps resize and movement inside the logical canvas", () => {
    const input: WidgetPlacement = { x: 1900, y: -20, width: 400, height: 10, z: 999 };
    expect(clampPlacement(input)).toEqual({ x: 1520, y: 0, width: 400, height: 64, z: 255 });
  });

  it("moves a covered icon to the nearest stable free cell", () => {
    const result = avoidIconObstacles(
      [icon("covered", 0, 0), icon("fixed", 1, 0)],
      [{ x: 0, y: 0, width: 100, height: 100 }],
      { cellWidth: 100, cellHeight: 100, columns: 4, rows: 2 }
    );
    expect(result.icons.map(({ x, y }) => [x, y])).toEqual([[0, 1], [1, 0]]);
    expect(result.moved).toEqual([0]);
    expect(result.unresolved).toEqual([]);
  });

  it("respects dock reserves and reports an icon when no cell is legal", () => {
    const result = avoidIconObstacles(
      [icon("blocked", 0, 0)],
      [{ x: 0, y: 0, width: 100, height: 100 }],
      { cellWidth: 100, cellHeight: 100, columns: 2, rows: 1 },
      [{ x: 100, y: 0, width: 100, height: 100 }]
    );
    expect(result.icons[0]).toMatchObject({ x: 0, y: 0 });
    expect(result.moved).toEqual([]);
    expect(result.unresolved).toEqual([0]);
  });

  it("uses row-major order to break equal-distance ties deterministically", () => {
    const run = () =>
      avoidIconObstacles(
        [icon("covered", 1, 1)],
        [{ x: 100, y: 100, width: 100, height: 100 }],
        { cellWidth: 100, cellHeight: 100, columns: 3, rows: 3 }
      );
    expect(run().icons[0]).toMatchObject({ x: 1, y: 0 });
    expect(run()).toEqual(run());
  });
});
