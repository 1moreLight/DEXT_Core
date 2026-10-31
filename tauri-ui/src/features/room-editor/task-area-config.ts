import type { RoomV3, V3Component } from "./v3-document";
import { dockComponent } from "./dock-template";

export type TaskAreaRect = { x: number; y: number; width: number; height: number };
export type TaskAreaStyle = {
  iconSizeDip: number;
  gapDip: number;
  radiusDip: number;
  surface: string;
  accent: string;
};
export type TaskAreaConfig = { version: 1; rect: TaskAreaRect; style: TaskAreaStyle };

export const DEFAULT_TASK_AREA_STYLE: TaskAreaStyle = {
  iconSizeDip: 40,
  gapDip: 8,
  radiusDip: 16,
  surface: "#172031dd",
  accent: "#a5d8ff",
};

const STYLE_RANGES = {
  iconSizeDip: [24, 64] as const,
  gapDip: [0, 24] as const,
  radiusDip: [0, 32] as const,
};

const copy = <T,>(value: T): T => structuredClone(value);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const hexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(value);

function merge(shared: unknown, override: unknown): unknown {
  if (!object(shared) || !object(override)) return copy(override);
  return Object.fromEntries(
    [...new Set([...Object.keys(shared), ...Object.keys(override)])].map((key) => [
      key,
      own(override, key)
        ? object(shared[key]) && object(override[key])
          ? merge(shared[key], override[key])
          : copy(override[key])
        : copy(shared[key]),
    ]),
  );
}

function difference(shared: unknown, override: unknown): unknown {
  if (JSON.stringify(shared) === JSON.stringify(override)) return undefined;
  if (!object(shared) || !object(override)) return copy(override);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(override)) {
    const changed = difference(shared[key], value);
    if (changed !== undefined) result[key] = changed;
  }
  return Object.keys(result).length ? result : undefined;
}

function setLeaf(config: Record<string, unknown>, path: string[], value: unknown): void {
  let node = config;
  for (const key of path.slice(0, -1)) {
    if (!object(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = copy(value);
}

function deleteLeaf(config: Record<string, unknown>, path: string[]): void {
  const key = path[0];
  if (path.length === 1) {
    delete config[key];
    return;
  }
  if (!object(config[key])) return;
  deleteLeaf(config[key] as Record<string, unknown>, path.slice(1));
  if (Object.keys(config[key] as Record<string, unknown>).length === 0) delete config[key];
}

function requiredDock(room: RoomV3): V3Component {
  const dock = dockComponent(room);
  if (!dock) throw new Error("请先添加主题 Dock");
  return dock;
}

function deskReference(room: RoomV3, dock: V3Component, deskId: string) {
  const desk = room.desks.find((d) => d.id === deskId);
  if (!desk) throw new Error("Desk 已不存在");
  if (!desk.components.includes(dock.id)) throw new Error("这个 Desk 尚未引用 Dock");
  return desk;
}

function writeOverride(room: RoomV3, dock: V3Component, deskId: string, override: Record<string, unknown>): void {
  const desk = deskReference(room, dock, deskId);
  const changed = difference(dock.config ?? {}, override);
  if (object(changed) && Object.keys(changed).length) (desk.componentOverrides ??= {})[dock.id] = changed;
  else if (desk.componentOverrides) delete desk.componentOverrides[dock.id];
  if (desk.componentOverrides && !Object.keys(desk.componentOverrides).length) delete desk.componentOverrides;
}

export function defaultTaskAreaRect(placement: V3Component["placement"]): TaskAreaRect {
  const insetX = Math.min(48, Math.max(0, Math.floor(placement.width * 0.05)));
  const insetY = Math.min(12, Math.max(0, Math.floor(placement.height * 0.1)));
  return {
    x: insetX,
    y: insetY,
    width: Math.max(1, placement.width - insetX * 2),
    height: Math.max(1, placement.height - insetY * 2),
  };
}

export function ensureTaskAreaDeclaration(area: unknown, placement: V3Component["placement"]): TaskAreaConfig {
  const base: TaskAreaConfig = {
    version: 1,
    rect: defaultTaskAreaRect(placement),
    style: { ...DEFAULT_TASK_AREA_STYLE },
  };
  if (!object(area)) return base;
  if (area.version !== 1) throw new Error("应用任务区版本必须是 1");
  if (object(area.rect)) {
    for (const key of ["x", "y", "width", "height"] as const) {
      if (finite(area.rect[key])) base.rect[key] = area.rect[key] as number;
    }
  }
  if (object(area.style)) {
    for (const key of Object.keys(DEFAULT_TASK_AREA_STYLE) as (keyof TaskAreaStyle)[]) {
      if (area.style[key] !== undefined) (base.style as Record<string, unknown>)[key] = area.style[key];
    }
  }
  validateTaskArea(base, placement);
  return base;
}

export function validateTaskArea(area: TaskAreaConfig, placement: V3Component["placement"]): void {
  const { rect, style } = area;
  if (area.version !== 1) throw new Error("应用任务区版本必须是 1");
  if (![rect.x, rect.y, rect.width, rect.height].every(finite)) throw new Error("任务区矩形无效");
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) throw new Error("任务区矩形必须落在 Dock 内");
  if (rect.x + rect.width > placement.width || rect.y + rect.height > placement.height) {
    throw new Error("任务区矩形超出 Dock 占位");
  }
  for (const [key, range] of Object.entries(STYLE_RANGES) as [keyof typeof STYLE_RANGES, readonly [number, number]][]) {
    const value = style[key];
    if (!finite(value) || value < range[0] || value > range[1]) {
      throw new Error(`${key} 必须在 ${range[0]}..${range[1]}`);
    }
  }
  if (!hexColor(style.surface) || !hexColor(style.accent)) {
    throw new Error("surface / accent 必须是 #RRGGBB 或 #RRGGBBAA");
  }
  if (rect.width < style.iconSizeDip + 32 || rect.height < style.iconSizeDip + 16) {
    throw new Error("任务区相对图标尺寸过小");
  }
}

function rawEffective(room: RoomV3, dock: V3Component, deskId?: string): unknown {
  const shared = dock.config?.dextTaskArea;
  if (!deskId) return shared;
  const desk = deskReference(room, dock, deskId);
  const override = desk.componentOverrides?.[dock.id]?.dextTaskArea;
  if (override === undefined) return shared;
  if (!object(shared)) return override;
  return merge(shared, override);
}

export function effectiveTaskArea(room: RoomV3, deskId?: string): TaskAreaConfig | null {
  const dock = requiredDock(room);
  const raw = rawEffective(room, dock, deskId);
  if (raw === undefined || raw === null) return null;
  return ensureTaskAreaDeclaration(raw, dock.placement);
}

export function ensureTaskArea(room: RoomV3): RoomV3 {
  const next = copy(room);
  const dock = requiredDock(next);
  dock.config ??= {};
  dock.config.dextTaskArea = ensureTaskAreaDeclaration(dock.config.dextTaskArea, dock.placement);
  return next;
}

function checkPath(path: string[]): void {
  if (!path.length || path.some((key) => !key.length)) throw new Error("不是可编辑的任务区参数");
  const [root, ...rest] = path;
  if (root === "rect") {
    if (rest.length !== 1 || !["x", "y", "width", "height"].includes(rest[0])) {
      throw new Error("不是可编辑的任务区参数");
    }
    return;
  }
  if (root === "style") {
    if (rest.length !== 1 || !Object.prototype.hasOwnProperty.call(DEFAULT_TASK_AREA_STYLE, rest[0])) {
      throw new Error("不是可编辑的任务区参数");
    }
    return;
  }
  throw new Error("不是可编辑的任务区参数");
}

export function setTaskAreaValue(room: RoomV3, path: string[], value: unknown, deskId?: string): RoomV3 {
  checkPath(path);
  const next = ensureTaskArea(room);
  const dock = requiredDock(next);
  const sharedArea = ensureTaskAreaDeclaration(dock.config!.dextTaskArea, dock.placement);

  if (!deskId) {
    const area = copy(sharedArea);
    setLeaf(area as unknown as Record<string, unknown>, path, value);
    validateTaskArea(area, dock.placement);
    dock.config!.dextTaskArea = area;
    return next;
  }

  const desk = deskReference(next, dock, deskId);
  const prior = copy(desk.componentOverrides?.[dock.id] ?? {});
  const current = object(prior.dextTaskArea)
    ? (merge(sharedArea, prior.dextTaskArea) as TaskAreaConfig)
    : copy(sharedArea);
  const effective = ensureTaskAreaDeclaration(current, dock.placement);
  setLeaf(effective as unknown as Record<string, unknown>, path, value);
  validateTaskArea(effective, dock.placement);

  const priorWithoutArea = copy(prior);
  delete priorWithoutArea.dextTaskArea;
  const areaDiff = difference(sharedArea, effective);
  const mergedOverride = {
    ...priorWithoutArea,
    ...(areaDiff !== undefined ? { dextTaskArea: areaDiff } : {}),
  };
  writeOverride(next, dock, deskId, mergedOverride as Record<string, unknown>);
  return next;
}

export function resetTaskAreaValue(room: RoomV3, path: string[], deskId: string): RoomV3 {
  checkPath(path);
  const next = copy(room);
  const dock = requiredDock(next);
  const override = copy(deskReference(next, dock, deskId).componentOverrides?.[dock.id] ?? {});
  deleteLeaf(override, ["dextTaskArea", ...path]);
  writeOverride(next, dock, deskId, override);
  return next;
}

export function clearTaskArea(room: RoomV3, deskId?: string): RoomV3 {
  const next = copy(room);
  const dock = requiredDock(next);
  if (!deskId) {
    if (dock.config) delete dock.config.dextTaskArea;
    if (dock.config && !Object.keys(dock.config).length) delete dock.config;
    return next;
  }
  const override = copy(deskReference(next, dock, deskId).componentOverrides?.[dock.id] ?? {});
  deleteLeaf(override, ["dextTaskArea"]);
  writeOverride(next, dock, deskId, override);
  return next;
}
