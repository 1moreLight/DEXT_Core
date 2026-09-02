import type { DockConfig } from "@/lib/dock";

export const ROOM_CANVAS = { width: 1920, height: 1080 } as const;

export type ContentType = "image" | "video" | "html";

export type SystemActionId =
  | "system.media.play"
  | "system.media.pause"
  | "system.media.toggle-play-pause"
  | "system.media.next"
  | "system.media.previous"
  | "system.volume.set"
  | "system.volume.mute"
  | "system.volume.toggle-mute";

export const SYSTEM_ACTION_IDS: readonly SystemActionId[] = [
  "system.media.play",
  "system.media.pause",
  "system.media.toggle-play-pause",
  "system.media.next",
  "system.media.previous",
  "system.volume.set",
  "system.volume.mute",
  "system.volume.toggle-mute",
] as const;

export interface TrustedHotspot {
  id: string;
  label: string;
  placement: WidgetPlacement;
  action: {
    id: SystemActionId;
    value?: number | boolean;
  };
}

export interface Content {
  name: string;
  type: ContentType;
  src: string;
  permissions?: WidgetPermission[];
  hotspots?: TrustedHotspot[];
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
  | "system.volume.read"
  | "hardware.network.read"
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
  "system.volume.read",
  "hardware.network.read",
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
  hotspots: TrustedHotspot[];
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
    hotspots: widget.hotspots.map((hotspot) => ({
      ...hotspot,
      placement: { ...hotspot.placement },
      action: { ...hotspot.action },
    })),
  };
}

export function cleanHotspots(
  value: unknown,
  bounds: { width: number; height: number } = ROOM_CANVAS,
): TrustedHotspot[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.placement) || !isRecord(item.action)) return [];
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const actionId = item.action.id;
    const p = item.placement;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || ids.has(id) || !label ||
        typeof actionId !== "string" || !SYSTEM_ACTION_IDS.includes(actionId as SystemActionId) ||
        ![p.x, p.y, p.width, p.height, p.z].every(Number.isInteger)) return [];
    const placement = {
      x: Number(p.x), y: Number(p.y), width: Number(p.width), height: Number(p.height), z: Number(p.z),
    };
    if (placement.x < 0 || placement.y < 0 || placement.width < 16 || placement.height < 16 ||
        placement.x + placement.width > bounds.width || placement.y + placement.height > bounds.height ||
        placement.z < 0 || placement.z > 255) return [];
    const value = item.action.value;
    if (actionId === "system.volume.set" &&
        (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return [];
    if (actionId === "system.volume.mute" && typeof value !== "boolean") return [];
    if (!["system.volume.set", "system.volume.mute"].includes(actionId) && value !== undefined) return [];
    ids.add(id);
    return [{
      id,
      label,
      placement,
      action: value === undefined
        ? { id: actionId as SystemActionId }
        : { id: actionId as SystemActionId, value: value as number | boolean },
    }];
  });
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
    hotspots: cleanHotspots(value.hotspots, { width: Number(placement.width), height: Number(placement.height) }),
  };
}
