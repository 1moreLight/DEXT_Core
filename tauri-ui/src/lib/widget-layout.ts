import { ROOM_CANVAS, type RoomIcon, type WidgetPlacement } from "@/lib/room-v2";

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
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

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

  const moved: number[] = [];
  const unresolved: number[] = [];
  for (const index of conflicts) {
    const icon = icons[index];
    const originX = icon.x ?? 0;
    const originY = icon.y ?? 0;
    const target = candidates(originX, originY, grid).find(({ x, y }) => {
      if (occupied.has(cellKey(x, y))) return false;
      return !blocked.some((rect) => overlaps(iconRect(x, y, grid), rect));
    });
    if (!target) {
      unresolved.push(index);
      continue;
    }
    icon.x = target.x;
    icon.y = target.y;
    occupied.add(cellKey(target.x, target.y));
    if (target.x !== originX || target.y !== originY) moved.push(index);
  }
  return { icons, moved, unresolved };
}
