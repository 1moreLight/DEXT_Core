import { describe, expect, it } from "vitest";
import type { Desk, RoomIcon, WidgetPlacement } from "./room-v2";
import {
  alignWidgetPlacements,
  avoidIconObstacles,
  canvasTransform,
  clampPlacement,
  desktopIconGridForPreferences,
  findOpenDeskIconCell,
  snapPlacement,
} from "./widget-layout";

const icon = (label: string, x: number, y: number): RoomIcon => ({
  label,
  icon_png: "",
  launch: { target: "", args: "", workdir: "" },
  x,
  y,
});

describe("widget layout", () => {
  it("projects the shared desktop footprint grid to Room logical coordinates", () => {
    expect(desktopIconGridForPreferences({ feedbackStyle: "halo", showLabels: true, hitTargetSize: "standard", visualSize: "standard", spacing: "standard" }, { width: 1840, height: 940 })).toMatchObject({ columns: 18, rows: 8 });
    expect(desktopIconGridForPreferences({ feedbackStyle: "halo", showLabels: false, hitTargetSize: "small", visualSize: "large", spacing: "compact" }, { width: 1840, height: 940 })).toEqual({
      cellWidth: 1920 / 1840 * 68,
      cellHeight: 1080 / 940 * 76,
      columns: 27,
      rows: 12,
    });
  });
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
    expect(result.committed).toBe(true);
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
    expect(result.committed).toBe(false);
  });

  it("returns every icon to its original position when one conflicted icon has no legal cell", () => {
    const source = [icon("covered", 0, 0), icon("fixed", 1, 0)];
    const before = structuredClone(source);

    const result = avoidIconObstacles(
      source,
      [{ x: 0, y: 0, width: 100, height: 100 }],
      { cellWidth: 100, cellHeight: 100, columns: 2, rows: 1 },
    );

    expect(result).toMatchObject({ committed: false, moved: [], unresolved: [0] });
    expect(result.icons).toEqual(before);
    expect(source).toEqual(before);
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

  it("snaps Widget edges and centers to canvas and neighboring Widgets", () => {
    const neighbor: WidgetPlacement = { x: 500, y: 300, width: 300, height: 200, z: 0 };
    expect(snapPlacement({ x: 310, y: 298, width: 180, height: 100, z: 1 }, [neighbor]))
      .toMatchObject({ x: 320, y: 300 });
    expect(snapPlacement({ x: 705, y: 505, width: 200, height: 80, z: 1 }, [neighbor]))
      .toMatchObject({ x: 700, y: 500 });
  });

  it("aligns a multi-selection while preserving sizes and canvas bounds", () => {
    const source: WidgetPlacement[] = [
      { x: 100, y: 120, width: 200, height: 100, z: 0 },
      { x: 500, y: 420, width: 300, height: 200, z: 1 },
    ];
    expect(alignWidgetPlacements(source, "left").map(({ x }) => x)).toEqual([100, 100]);
    expect(alignWidgetPlacements(source, "center-y").map(({ y }) => y)).toEqual([320, 270]);
    expect(alignWidgetPlacements(source, "bottom").map(({ y, height }) => y + height)).toEqual([620, 620]);
  });

  it("places a new Desk icon in the first sparse free cell without moving existing icons", () => {
    const desk: Desk = {
      name: "Sparse",
      background: null,
      iconSize: "medium",
      icons: [icon("first", 0, 0), icon("third", 2, 0)],
      widgets: [],
      dock: { enabled: false },
    };
    const before = structuredClone(desk);

    expect(findOpenDeskIconCell(desk, { cellWidth: 100, cellHeight: 100, columns: 3, rows: 2 }))
      .toEqual({ x: 1, y: 0 });
    expect(desk).toEqual(before);
  });

  it("places a new icon beside an existing group instead of taking a distant top-left cell", () => {
    const desk: Desk = {
      name: "Grouped",
      background: null,
      iconSize: "medium",
      icons: [icon("left", 2, 1), icon("right", 3, 1)],
      widgets: [],
      dock: { enabled: false },
    };
    const before = structuredClone(desk);

    expect(findOpenDeskIconCell(desk, { cellWidth: 100, cellHeight: 100, columns: 4, rows: 3 }))
      .toEqual({ x: 2, y: 0 });
    expect(desk).toEqual(before);
  });

  it("keeps a forty-pixel safety margin on every side of a Widget", () => {
    const desk: Desk = {
      name: "Widget margin",
      background: null,
      iconSize: "medium",
      icons: [],
      widgets: [{
        id: "widget",
        name: "Widget",
        src: "widgets/widget/index.html",
        resources: ["widgets/widget/index.html"],
        placement: { x: 0, y: 0, width: 100, height: 100, z: 0 },
        config: {},
        permissions: [],
        hotspots: [],
      }],
      dock: { enabled: false },
    };

    expect(findOpenDeskIconCell(desk, { cellWidth: 100, cellHeight: 100, columns: 3, rows: 1 }))
      .toEqual({ x: 2, y: 0 });
  });

  it("skips Widget and Dock regions when finding a Desk icon cell", () => {
    const desk: Desk = {
      name: "Blocked",
      background: null,
      iconSize: "medium",
      icons: [],
      widgets: [{
        id: "widget",
        name: "Widget",
        src: "widgets/widget/index.html",
        resources: ["widgets/widget/index.html"],
        placement: { x: 40, y: 140, width: 120, height: 100, z: 0 },
        config: {},
        permissions: [],
        hotspots: [],
      }],
    };

    expect(findOpenDeskIconCell(
      desk,
      { cellWidth: 100, cellHeight: 100, columns: 3, rows: 3 },
      { enabled: true, position: "top" },
    ))
      .toEqual({ x: 2, y: 2 });
  });

  it("returns null when every Desk icon cell is occupied", () => {
    const desk: Desk = {
      name: "Full",
      background: null,
      iconSize: "medium",
      icons: [icon("a", 0, 0), icon("b", 1, 0), icon("c", 0, 1), icon("d", 1, 1)],
      widgets: [],
      dock: { enabled: false },
    };

    expect(findOpenDeskIconCell(desk, { cellWidth: 100, cellHeight: 100, columns: 2, rows: 2 }))
      .toBeNull();
  });

  it("uses the persisted icon size grid instead of placing large icons in medium-only columns", () => {
    const desk: Desk = {
      name: "Large icons",
      background: null,
      iconSize: "large",
      icons: Array.from({ length: 14 }, (_, x) => icon(String(x), x, 0)),
      widgets: [],
      dock: { enabled: false },
    };

    expect(findOpenDeskIconCell(desk)).toEqual({ x: 0, y: 1 });
  });
});
