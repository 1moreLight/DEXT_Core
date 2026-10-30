import type { RoomV3, V3Button, V3Component } from "./v3-document";
import { readDockDescriptor } from "./dock-template";

export const V3_CAPABILITIES = [
  ["desk.read", "Desk 状态"],
  ["desk.navigate", "Desk 导航"],
  ["time.read", "时间数据"],
  ["hardware.read", "硬件数据"],
  ["media.read", "媒体数据"],
  ["media.control", "媒体控制"],
  ["audio.read", "音量数据"],
  ["audio.control", "音量控制"],
  ["storage.read", "本机记忆读"],
  ["storage.write", "本机记忆写"],
  ["binding.launch", "启动绑定应用"],
  ["dext.exit", "退出 Dext"],
] as const;

export type V3CapabilityId = (typeof V3_CAPABILITIES)[number][0];

const ALLOWED = new Set<string>(V3_CAPABILITIES.map(([id]) => id));
const PRIVATE_CONFIG_KEYS = new Set([
  "target", "args", "workdir", "password", "token", "secret", "bindings", "grants", "__source",
]);

const copy = <T,>(value: T): T => structuredClone(value);
const freshId = (prefix: string) => prefix + "-" + crypto.randomUUID();
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function requireLocalDock(room: RoomV3, componentId: string): { next: RoomV3; dock: V3Component } {
  const next = copy(room);
  const dock = next.components?.find((c) => c.id === componentId && c.role === "dock");
  if (!dock) throw new Error("Dock 组件已不存在");
  if (readDockDescriptor(dock.config?.template) && Array.isArray(dock.config?.enabledRegions)) {
    throw new Error("官方模板 Dock 请使用模板区域编辑器");
  }
  return { next, dock };
}

function referencedButtons(room: RoomV3): Set<string> {
  return new Set([
    ...(room.components ?? []).flatMap((c) => c.buttonIds ?? []),
    ...room.desks.flatMap((d) => [...d.icons.map((i) => i.buttonId), ...(d.background?.buttonIds ?? [])]),
    ...(room.start?.buttonIds ?? []),
    ...(room.idle?.buttonIds ?? []),
  ]);
}

function validateCapabilities(caps: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const cap of caps) {
    if (!ALLOWED.has(cap)) throw new Error("未知能力：" + cap);
    if (seen.has(cap)) continue;
    seen.add(cap);
    next.push(cap);
  }
  return next;
}

function validateAction(room: RoomV3, action: V3Button["action"] | undefined): void {
  if (!action) return;
  const allowed = ["desk.next", "desk.previous", "desk.go", "binding.launch", "dext.exit"] as const;
  if (!allowed.includes(action.type as (typeof allowed)[number])) throw new Error("不支持的按钮动作");
  if (action.type === "desk.go" && !room.desks.some((d) => d.id === action.deskId)) {
    throw new Error("目标 Desk 已不存在");
  }
}

function assertPublicConfig(value: unknown, depth = 0): void {
  if (depth === 0 && !object(value)) throw new Error("公开 config 必须是对象");
  if (depth > 12) throw new Error("config 嵌套超过 12 层");
  if (Array.isArray(value)) {
    if (value.length > 256) throw new Error("config 数组超过 256 项");
    for (const item of value) assertPublicConfig(item, depth + 1);
    return;
  }
  if (object(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (PRIVATE_CONFIG_KEYS.has(key.toLowerCase())) throw new Error("公开 config 不能包含私有字段：" + key);
      assertPublicConfig(child, depth + 1);
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > 8192) throw new Error("config 文本过长");
    const privatePath =
      value.startsWith("\\\\") ||
      value.slice(0, 5).toLowerCase() === "file:" ||
      (value.length > 2 && value.charAt(1) === ":" && /[A-Za-z]/.test(value.charAt(0)));
    if (privatePath) throw new Error("公开 config 不能包含本机绝对路径");
  }
}

export function parsePublicConfigJson(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("公开 config 不是合法 JSON");
  }
  assertPublicConfig(parsed);
  return parsed as Record<string, unknown>;
}

export function setComponentCapabilities(room: RoomV3, componentId: string, capabilities: string[]): RoomV3 {
  const { next, dock } = requireLocalDock(room, componentId);
  dock.capabilities = validateCapabilities(capabilities);
  return next;
}

export function setComponentConfig(
  room: RoomV3,
  componentId: string,
  config: Record<string, unknown> | undefined,
): RoomV3 {
  const { next, dock } = requireLocalDock(room, componentId);
  if (config === undefined) delete dock.config;
  else {
    assertPublicConfig(config);
    dock.config = copy(config);
  }
  return next;
}

export function addComponentButton(
  room: RoomV3,
  componentId: string,
  options: { name: string; action?: V3Button["action"]; scope?: string } = { name: "按钮" },
): RoomV3 {
  const { next, dock } = requireLocalDock(room, componentId);
  if ((next.buttons?.length ?? 0) >= 1024) throw new Error("这个 Room 的按钮数量已达上限");
  const name = options.name.trim() || "按钮";
  validateAction(next, options.action);
  const scope = options.scope ?? "room";
  if (scope !== "room" && !next.desks.some((d) => d.id === scope)) throw new Error("按钮作用域 Desk 已不存在");
  const buttonId = freshId("button");
  (next.buttons ??= []).push({
    id: buttonId,
    name,
    scope,
    ...(options.action ? { action: copy(options.action) } : {}),
  });
  dock.buttonIds = [...new Set([...(dock.buttonIds ?? []), buttonId])];
  return next;
}

export function updateComponentButton(
  room: RoomV3,
  componentId: string,
  buttonId: string,
  patch: { name?: string; action?: V3Button["action"] | null },
): RoomV3 {
  const { next, dock } = requireLocalDock(room, componentId);
  if (!(dock.buttonIds ?? []).includes(buttonId)) throw new Error("按钮未声明在这个 Dock");
  const button = next.buttons?.find((b) => b.id === buttonId);
  if (!button) throw new Error("按钮已不存在");
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("按钮名称不能为空");
    button.name = name;
  }
  if (patch.action !== undefined) {
    if (patch.action === null) delete button.action;
    else {
      validateAction(next, patch.action);
      button.action = copy(patch.action);
    }
  }
  return next;
}

export function removeComponentButtonRef(room: RoomV3, componentId: string, buttonId: string): RoomV3 {
  const { next, dock } = requireLocalDock(room, componentId);
  dock.buttonIds = (dock.buttonIds ?? []).filter((id) => id !== buttonId);
  if (!dock.buttonIds.length) delete dock.buttonIds;
  const used = referencedButtons(next);
  next.buttons = (next.buttons ?? []).filter((b) => b.id !== buttonId || used.has(b.id));
  if (!next.buttons.length) delete next.buttons;
  return next;
}

export function isTemplateManagedDock(component: V3Component | undefined): boolean {
  return !!component && !!readDockDescriptor(component.config?.template) && Array.isArray(component.config?.enabledRegions);
}
