import { assertRoomV2WritePayload } from "@/lib/room-contract";
import type { DockConfig } from "@/lib/dock";
import {
  cleanHotspots,
  cleanWidget,
  isRecord,
  WIDGET_PERMISSIONS,
  type Content,
  type ContentType,
  type Desk,
  type RoomIcon,
  type Transition,
  type TransitionPreset,
} from "@/lib/room-v2";
import type { GEdge } from "./graph";

export type ContentDirectory = "background" | "start" | "switch" | "idle";

export function cleanContent(value: unknown, directory: ContentDirectory): Content | null {
  if (!isRecord(value) || !["image", "video", "html"].includes(String(value.type))) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const src = typeof value.src === "string" ? value.src.replace(/\\/g, "/") : "";
  if (!name || !src.startsWith(`${directory}/`) || src.split("/").some((part) => !part || part === "." || part === "..")) return null;
  const permissions = Array.isArray(value.permissions)
    ? [...new Set(value.permissions.filter((item): item is typeof WIDGET_PERMISSIONS[number] =>
        typeof item === "string" && WIDGET_PERMISSIONS.includes(item as typeof WIDGET_PERMISSIONS[number])
      ))]
    : [];
  return {
    name,
    type: value.type as ContentType,
    src,
    ...(permissions.length ? { permissions } : {}),
    ...(Array.isArray(value.hotspots) ? { hotspots: cleanHotspots(value.hotspots) } : {}),
  };
}

export function cleanTransition(value: unknown): Transition | null {
  if (["slide", "fade", "zoom", "none"].includes(String(value))) return value as TransitionPreset;
  return cleanContent(value, "switch");
}

export function cleanRoomIcon(value: unknown, index: number): RoomIcon {
  const icon = isRecord(value) ? value : {};
  const launch = isRecord(icon.launch) ? icon.launch : {};
  return {
    label: typeof icon.label === "string" && icon.label.trim() ? icon.label.trim() : `图标 ${index + 1}`,
    icon_png: typeof icon.icon_png === "string" ? icon.icon_png : "",
    launch: {
      target: typeof launch.target === "string" ? launch.target : "",
      args: typeof launch.args === "string" ? launch.args : "",
      workdir: typeof launch.workdir === "string" ? launch.workdir : "",
    },
    x: Number.isInteger(icon.x) && Number(icon.x) >= 0 ? Number(icon.x) : index % 4,
    y: Number.isInteger(icon.y) && Number(icon.y) >= 0 ? Number(icon.y) : Math.floor(index / 4),
    ...(typeof icon.glyph === "string" ? { glyph: icon.glyph } : {}),
    ...(typeof icon.color === "string" ? { color: icon.color } : {}),
    ...(typeof icon.action === "string" ? { action: icon.action } : {}),
  } as RoomIcon;
}

export function cleanDesk(value: unknown, index: number): Desk {
  const desk = isRecord(value) ? value : {};
  const iconSize = ["large", "medium", "small"].includes(String(desk.iconSize))
    ? String(desk.iconSize)
    : "medium";
  return {
    name: typeof desk.name === "string" && desk.name.trim() ? desk.name.trim() : `Desk ${index + 1}`,
    background: cleanContent(desk.background, "background"),
    iconSize,
    icons: Array.isArray(desk.icons) ? desk.icons.map(cleanRoomIcon) : [],
    widgets: Array.isArray(desk.widgets) ? desk.widgets.map(cleanWidget).filter((widget) => widget !== null) : [],
    ...(isRecord(desk.dock) ? { dock: desk.dock as DockConfig } : {}),
  };
}

export function roomIconForWrite(icon: RoomIcon, index: number, desktop: boolean) {
  const out: Record<string, unknown> = { label: icon.label?.trim() || `图标 ${index + 1}` };
  if (icon.icon_png) out.icon_png = icon.icon_png;
  const value = icon as RoomIcon & { glyph?: string; color?: string; action?: string };
  if (value.glyph) out.glyph = value.glyph;
  if (value.color) out.color = value.color;
  if (value.action) out.action = value.action;
  if (icon.launch?.target?.trim()) {
    out.launch = {
      target: icon.launch.target.trim(),
      args: icon.launch.args ?? "",
      workdir: icon.launch.workdir ?? "",
    };
  }
  if (desktop) {
    out.x = Number.isInteger(icon.x) && Number(icon.x) >= 0 ? Number(icon.x) : index % 4;
    out.y = Number.isInteger(icon.y) && Number(icon.y) >= 0 ? Number(icon.y) : Math.floor(index / 4);
  }
  return out;
}

export function dockForWrite(value: DockConfig | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const out: Record<string, unknown> = {};
  if (typeof value.enabled === "boolean") out.enabled = value.enabled;
  if (["bottom", "top", "left", "right"].includes(String(value.position))) out.position = value.position;
  if (typeof value.autoHide === "boolean") out.autoHide = value.autoHide;
  if (["text", "dots"].includes(String(value.indicator))) out.indicator = value.indicator;
  if (value.style) {
    const style: Record<string, unknown> = {};
    for (const key of ["bg", "blur", "radius", "gap", "pad", "icon"] as const) {
      if (value.style[key] !== undefined) style[key] = value.style[key];
    }
    if (Object.keys(style).length) out.style = style;
  }
  if (Array.isArray(value.icons)) {
    out.icons = value.icons.map((icon, index) => roomIconForWrite({
      label: icon.label ?? `Dock ${index + 1}`,
      icon_png: icon.icon_png ?? "",
      launch: icon.launch ?? { target: "", args: "", workdir: "" },
      ...(icon.glyph ? { glyph: icon.glyph } : {}),
      ...(icon.color ? { color: icon.color } : {}),
      ...(icon.action ? { action: icon.action } : {}),
    } as RoomIcon, index, false));
  }
  return out;
}

export function serializeRoomV2({
  desks,
  startDesk,
  transition,
  edges,
  startContent,
  startName,
  idleContent,
  idleName,
  dock,
}: {
  desks: Desk[];
  startDesk: number;
  transition: Transition;
  edges: GEdge[];
  startContent: Content | null;
  startName: string;
  idleContent: Content | null;
  idleName: string;
  dock: DockConfig;
}) {
  const room: Record<string, unknown> = {
    version: 2,
    startDesk: Math.min(Math.max(startDesk, 0), Math.max(0, desks.length - 1)),
    switch: transition,
    switches: Object.fromEntries(
      edges.flatMap((edge) => {
        if (!edge.trans || !/^d\d+$/.test(edge.from) || !/^d\d+$/.test(edge.to)) return [];
        return [[`${Number(edge.from.slice(1))}>${Number(edge.to.slice(1))}`, edge.trans]];
      })
    ),
    desks: desks.map((desk, deskIndex) => {
      const next: Record<string, unknown> = {
        name: desk.name.trim() || `Desk ${deskIndex + 1}`,
        background: desk.background,
        iconSize: ["large", "medium", "small"].includes(String(desk.iconSize)) ? desk.iconSize : "medium",
        icons: desk.icons.map((icon, index) => roomIconForWrite(icon, index, true)),
        widgets: (desk.widgets ?? []).map((widget) => JSON.parse(JSON.stringify(widget)) as unknown),
      };
      const deskDock = dockForWrite(desk.dock);
      if (deskDock) next.dock = deskDock;
      return next;
    }),
  };
  if (startContent) room.start = { ...startContent, name: startName.trim() || startContent.name };
  if (idleContent) room.idle = { ...idleContent, name: idleName.trim() || idleContent.name };
  const roomDock = dockForWrite(dock);
  if (roomDock) room.dock = roomDock;
  return assertRoomV2WritePayload(room);
}
