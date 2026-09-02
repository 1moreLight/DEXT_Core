import type { DockConfig } from "@/lib/dock";

export const ROOM_CANVAS = { width: 1920, height: 1080 } as const;

export type ContentType = "image" | "video" | "html";

export interface Content {
  name: string;
  type: ContentType;
  src: string;
}

export type Background = Content | null;
export type TransitionPreset = "slide" | "fade" | "zoom" | "none";
export type Transition = TransitionPreset | Content;

export interface RoomIcon {
  label: string;
  icon_png: string;
  launch: { target: string; args: string; workdir: string };
  x?: number;
  y?: number;
  glyph?: string;
  color?: string;
  action?: string;
}

export type WidgetPermission =
  | "time.read"
  | "locale.read"
  | "viewport.read"
  | "desk.read"
  | "playback.read"
  | "audio.spectrum"
  | "hardware.cpu.read"
  | "hardware.gpu.read"
  | "hardware.memory.read"
  | "now-playing.read"
  | "now-playing.artwork.read"
  | "hardware.network.read"
  | "network.proxy"
  | "storage.kv"
  | "navigation.go"
  | "notification.show"
  | "action.invoke";

export const WIDGET_PERMISSIONS: readonly WidgetPermission[] = [
  "time.read",
  "locale.read",
  "viewport.read",
  "desk.read",
  "playback.read",
  "audio.spectrum",
  "hardware.cpu.read",
  "hardware.gpu.read",
  "hardware.memory.read",
  "now-playing.read",
  "now-playing.artwork.read",
  "hardware.network.read",
  "network.proxy",
  "storage.kv",
  "navigation.go",
  "notification.show",
  "action.invoke",
] as const;

export interface WidgetPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export interface WidgetDefinition {
  id: string;
  name: string;
  src: string;
  resources: string[];
  placement: WidgetPlacement;
  config: Record<string, unknown>;
  permissions: WidgetPermission[];
}

export interface Desk {
  name: string;
  background: Background;
  icons: RoomIcon[];
  iconSize?: string;
  dock?: DockConfig;
  widgets: WidgetDefinition[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function cloneWidget(widget: WidgetDefinition): WidgetDefinition {
  return {
    ...widget,
    resources: [...widget.resources],
    placement: { ...widget.placement },
    config: structuredClone(widget.config),
    permissions: [...widget.permissions],
  };
}

export function cleanWidget(value: unknown): WidgetDefinition | null {
  if (!isRecord(value) || !isRecord(value.placement) || !isRecord(value.config)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const src = typeof value.src === "string" ? value.src.replace(/\\/g, "/") : "";
  const resources = Array.isArray(value.resources)
    ? value.resources.filter((item): item is string => typeof item === "string")
    : [];
  const permissions = Array.isArray(value.permissions)
    ? value.permissions.filter((item): item is WidgetPermission =>
        typeof item === "string" && WIDGET_PERMISSIONS.includes(item as WidgetPermission)
      )
    : [];
  const placement = value.placement;
  if (!id || !name || !src || resources.length === 0) return null;
  if (![placement.x, placement.y, placement.width, placement.height, placement.z].every(Number.isInteger)) {
    return null;
  }
  return {
    id,
    name,
    src,
    resources: [...new Set(resources)],
    placement: {
      x: Number(placement.x),
      y: Number(placement.y),
      width: Number(placement.width),
      height: Number(placement.height),
      z: Number(placement.z),
    },
    config: structuredClone(value.config),
    permissions: [...new Set(permissions)],
  };
}
