import {
  ROOM_CANVAS,
  type Desk,
  type RoomIcon,
  type WidgetDefinition,
  type WidgetPlacement,
} from "@/lib/room-v2";
import type { DockConfig } from "@/lib/dock";
import { resolveDesktopIconGeometry, type DesktopIconPreferences } from "@/lib/desktop-icon-preferences";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IconGrid {
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
}

export interface IconAvoidanceResult {
  icons: RoomIcon[];
  moved: number[];
  unresolved: number[];
  committed: boolean;
}

export const DESKTOP_ICON_GRIDS = {
  large: { cellWidth: 124, cellHeight: 152, columns: 14, rows: 6 },
  medium: { cellWidth: 96, cellHeight: 120, columns: 19, rows: 7 },
  small: { cellWidth: 64, cellHeight: 84, columns: 28, rows: 11 },
} as const;

export function desktopIconGrid(iconSize: Desk["iconSize"]): IconGrid {
  return DESKTOP_ICON_GRIDS[iconSize === "large" || iconSize === "small" ? iconSize : "medium"];
}

export function desktopIconGridForPreferences(preferences: DesktopIconPreferences, viewport: { width: number; height: number }): IconGrid {
  const geometry = resolveDesktopIconGeometry(preferences);
  return {
    cellWidth: ROOM_CANVAS.width / viewport.width * geometry.cellW,
    cellHeight: ROOM_CANVAS.height / viewport.height * geometry.cellH,
    columns: Math.floor(viewport.width / geometry.cellW),
    rows: Math.floor(viewport.height / geometry.cellH),
  };
}

export type WidgetAlignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const ICON_SAFETY_MARGIN = 40;

function withIconSafetyMargin(rect: Rect): Rect {
  return {
    x: rect.x - ICON_SAFETY_MARGIN,
    y: rect.y - ICON_SAFETY_MARGIN,
    width: rect.width + ICON_SAFETY_MARGIN * 2,
    height: rect.height + ICON_SAFETY_MARGIN * 2,
  };
}

export function clampPlacement(
  placement: WidgetPlacement,
  canvas: Rect = { x: 0, y: 0, ...ROOM_CANVAS }
): WidgetPlacement {
  const width = Math.min(Math.max(Math.round(placement.width), 64), canvas.width);
  const height = Math.min(Math.max(Math.round(placement.height), 64), canvas.height);
  return {
    x: Math.min(Math.max(Math.round(placement.x), canvas.x), canvas.x + canvas.width - width),
    y: Math.min(Math.max(Math.round(placement.y), canvas.y), canvas.y + canvas.height - height),
    width,
    height,
    z: Math.min(Math.max(Math.round(placement.z), 0), 255),
  };
}

export function canvasTransform(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth = ROOM_CANVAS.width,
  canvasHeight = ROOM_CANVAS.height
) {
  const scale = Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
  const widthLimited = viewportWidth / canvasWidth <= viewportHeight / canvasHeight;
  const width = widthLimited ? viewportWidth : canvasWidth * scale;
  const height = widthLimited ? canvasHeight * scale : viewportHeight;
  return {
    scale,
    width,
    height,
    offsetX: (viewportWidth - width) / 2,
    offsetY: (viewportHeight - height) / 2,
  };
}

function nearestSnap(value: number, targets: number[], threshold: number) {
  let best = value;
  let distance = threshold + 1;
  for (const target of targets) {
    const nextDistance = Math.abs(target - value);
    if (nextDistance < distance) {
      best = target;
      distance = nextDistance;
    }
  }
  return { value: best, distance };
}

export function snapPlacement(
  placement: WidgetPlacement,
  neighbors: WidgetPlacement[],
  threshold = 12,
): WidgetPlacement {
  const xTargets = [0, ROOM_CANVAS.width / 2, ROOM_CANVAS.width];
  const yTargets = [0, ROOM_CANVAS.height / 2, ROOM_CANVAS.height];
  for (const neighbor of neighbors) {
    xTargets.push(neighbor.x, neighbor.x + neighbor.width / 2, neighbor.x + neighbor.width);
    yTargets.push(neighbor.y, neighbor.y + neighbor.height / 2, neighbor.y + neighbor.height);
  }
  const xEdges = [placement.x, placement.x + placement.width / 2, placement.x + placement.width];
  const yEdges = [placement.y, placement.y + placement.height / 2, placement.y + placement.height];
  let snappedX = placement.x;
  let snappedY = placement.y;
  let xDistance = threshold + 1;
  let yDistance = threshold + 1;
  xEdges.forEach((edge) => {
    const target = nearestSnap(edge, xTargets, threshold);
    const distance = target.distance;
    if (distance < xDistance) {
      xDistance = distance;
      snappedX = placement.x + target.value - edge;
    }
  });
  yEdges.forEach((edge) => {
    const target = nearestSnap(edge, yTargets, threshold);
    const distance = target.distance;
    if (distance < yDistance) {
      yDistance = distance;
      snappedY = placement.y + target.value - edge;
    }
  });
  return clampPlacement({ ...placement, x: snappedX, y: snappedY });
}

export function alignWidgetPlacements(
  placements: WidgetPlacement[],
  alignment: WidgetAlignment,
): WidgetPlacement[] {
  if (placements.length < 2) return placements.map((placement) => ({ ...placement }));
  const left = Math.min(...placements.map((placement) => placement.x));
  const right = Math.max(...placements.map((placement) => placement.x + placement.width));
  const top = Math.min(...placements.map((placement) => placement.y));
  const bottom = Math.max(...placements.map((placement) => placement.y + placement.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return placements.map((placement) => clampPlacement({
    ...placement,
    x: alignment === "left" ? left
      : alignment === "center-x" ? centerX - placement.width / 2
      : alignment === "right" ? right - placement.width
      : placement.x,
    y: alignment === "top" ? top
      : alignment === "center-y" ? centerY - placement.height / 2
      : alignment === "bottom" ? bottom - placement.height
      : placement.y,
  }));
}

function iconRect(x: number, y: number, grid: IconGrid): Rect {
  return {
    x: x * grid.cellWidth,
    y: y * grid.cellHeight,
    width: grid.cellWidth,
    height: grid.cellHeight,
  };
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function deskDockReserve(_desk: Desk, _roomDock?: DockConfig): Rect | null {
  return null;
  const position = dock?.position ?? "bottom";
  if (position === "top") return { x: 0, y: 0, width: ROOM_CANVAS.width, height: 100 };
  if (position === "left") return { x: 0, y: 0, width: 120, height: ROOM_CANVAS.height };
  if (position === "right") {
    return { x: ROOM_CANVAS.width - 120, y: 0, width: 120, height: ROOM_CANVAS.height };
  }
  return { x: 0, y: ROOM_CANVAS.height - 100, width: ROOM_CANVAS.width, height: 100 };
}

export function widgetPlacementObstacles(widgets: WidgetDefinition[]): Rect[] {
  return widgets.map(({ placement }) => withIconSafetyMargin({
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  }));
}

export function findOpenDeskIconCell(
  desk: Desk,
  grid: IconGrid = desktopIconGrid(desk.iconSize),
  roomDock?: DockConfig,
): { x: number; y: number } | null {
  if (grid.cellWidth <= 0 || grid.cellHeight <= 0 || grid.columns <= 0 || grid.rows <= 0) {
    throw new Error("icon grid dimensions must be positive");
  }
  const occupied = new Set<string>();
  const occupiedCells: Array<{ x: number; y: number }> = [];
  desk.icons.forEach((icon, index) => {
    const x = Math.min(Math.max(Math.round(icon.x ?? index % grid.columns), 0), grid.columns - 1);
    const y = Math.min(Math.max(Math.round(icon.y ?? Math.floor(index / grid.columns)), 0), grid.rows - 1);
    if (!occupied.has(cellKey(x, y))) {
      occupied.add(cellKey(x, y));
      occupiedCells.push({ x, y });
    }
  });
  const dock = deskDockReserve(desk, roomDock);
  const blocked = [
    ...widgetPlacementObstacles(desk.widgets ?? []),
    ...(dock ? [withIconSafetyMargin(dock)] : []),
  ];

  const candidates: Array<{ x: number; y: number; adjacent: number; distance: number }> = [];
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (occupied.has(cellKey(x, y))) continue;
      if (blocked.some((rect) => overlaps(iconRect(x, y, grid), rect))) continue;
      if (occupiedCells.length === 0) return { x, y };
      const distances = occupiedCells.map((cell) => Math.abs(x - cell.x) + Math.abs(y - cell.y));
      candidates.push({
        x,
        y,
        adjacent: distances.filter((distance) => distance === 1).length,
        distance: Math.min(...distances),
      });
    }
  }
  candidates.sort((a, b) =>
    b.adjacent - a.adjacent || a.distance - b.distance || a.y - b.y || a.x - b.x
  );
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
}

function candidates(originX: number, originY: number, grid: IconGrid) {
  const result: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      result.push({ x, y, distance: Math.abs(x - originX) + Math.abs(y - originY) });
    }
  }
  return result.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
}

export function avoidIconObstacles(
  sourceIcons: RoomIcon[],
  obstacles: Rect[],
  grid: IconGrid,
  reserved: Rect[] = []
): IconAvoidanceResult {
  if (grid.cellWidth <= 0 || grid.cellHeight <= 0 || grid.columns <= 0 || grid.rows <= 0) {
    throw new Error("icon grid dimensions must be positive");
  }
  const blocked = [...obstacles, ...reserved];
  const originalIcons = sourceIcons.map((icon) => ({ ...icon, launch: { ...icon.launch } }));
  const icons = sourceIcons.map((icon) => ({ ...icon, launch: { ...icon.launch } }));
  const conflicts = new Set<number>();
  const occupied = new Set<string>();

  icons.forEach((icon, index) => {
    const x = Math.min(Math.max(Math.round(icon.x ?? index % grid.columns), 0), grid.columns - 1);
    const y = Math.min(Math.max(Math.round(icon.y ?? Math.floor(index / grid.columns)), 0), grid.rows - 1);
    icon.x = x;
    icon.y = y;
    const key = cellKey(x, y);
    if (blocked.some((rect) => overlaps(iconRect(x, y, grid), rect)) || occupied.has(key)) {
      conflicts.add(index);
    } else {
      occupied.add(key);
    }
  });

  const pending = [...conflicts];
  const moved: number[] = [];
  while (pending.length) {
    const options = pending.map((index) => {
      const icon = icons[index];
      const originX = icon.x ?? 0;
      const originY = icon.y ?? 0;
      const targets = candidates(originX, originY, grid).filter(({ x, y }) =>
        !occupied.has(cellKey(x, y)) && !blocked.some((rect) => overlaps(iconRect(x, y, grid), rect))
      );
      return { index, originX, originY, targets };
    }).sort((a, b) => a.targets.length - b.targets.length || a.index - b.index);
    const next = options[0];
    if (!next.targets.length) {
      return {
        icons: originalIcons,
        moved: [],
        unresolved: [...conflicts],
        committed: false,
      };
    }
    const { index, originX, originY } = next;
    const target = next.targets[0];
    const icon = icons[index];
    icon.x = target.x;
    icon.y = target.y;
    occupied.add(cellKey(target.x, target.y));
    if (target.x !== originX || target.y !== originY) moved.push(index);
    pending.splice(pending.indexOf(index), 1);
  }
  return { icons, moved, unresolved: [], committed: true };
}
