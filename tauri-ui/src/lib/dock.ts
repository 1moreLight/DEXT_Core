// dock 配置的共享类型与默认值（配置器 / 渲染器契约一致，见 wallpapers/dext-room/main.js dockCfg）

export interface DockStyle {
  bg?: string;
  blur?: number;
  radius?: string;
  gap?: number;
  pad?: string;
  icon?: number;
}

export interface DockIconItem {
  label?: string;
  icon_png?: string;
  glyph?: string;
  color?: string;
  action?: string;
  launch?: { target: string; args: string; workdir: string };
}

export interface DockConfig {
  enabled?: boolean;
  position?: "bottom" | "top" | "left" | "right";
  autoHide?: boolean;
  indicator?: "text" | "dots";
  style?: DockStyle;
  icons?: DockIconItem[];
}

export const DOCK_POSITIONS = ["bottom", "top", "left", "right"] as const;

export const DEFAULT_DOCK: DockConfig = {
  enabled: true,
  position: "bottom",
  autoHide: false,
  indicator: "text",
  style: {},
  icons: [],
};

export const DEFAULT_DOCK_STYLE: DockStyle = {
  bg: "rgba(20,20,20,0.55)",
  blur: 12,
  radius: "999px",
  gap: 16,
  pad: "10px 20px",
  icon: 40,
};

// 皮肤预设片段。写入时放进受管标记块，只替换 Dock 皮肤区域，保留作者的其他 room.css。
export const DOCK_SKIN_PRESETS: Record<string, string> = {
  hud: `/* HUD-flavoured dock skin (from cockpit-room) */
.icon-label { letter-spacing: 0.14em; text-transform: uppercase; color: rgba(220,228,236,0.92); text-shadow: 0 0 6px rgba(140,190,255,0.35); font-family: Consolas, monospace; }
.icon-glyph { border: 1px solid rgba(200,215,230,0.35); box-shadow: 0 0 12px rgba(120,170,255,0.12) inset; }
#desk-indicator { font-family: Consolas, monospace; letter-spacing: 0.2em; color: rgba(215,222,230,0.75); }
#size-group .size-btn { font-family: Consolas, monospace; }
#dock.dots #desk-indicator i { background-color: rgba(215,222,230,0.35); }
#dock.dots #desk-indicator i.on { background-color: #8ccfff; box-shadow: 0 0 8px rgba(140,207,255,0.6); }
.dock-icon .icon-glyph { border: 1px solid rgba(200,215,230,0.35); box-shadow: 0 0 12px rgba(120,170,255,0.12) inset; }`,
  minimal: `/* Minimal dock skin: keep the stock glass look, only flatten it */
#dock .dock-inner { background-color: rgba(10,10,12,0.72); box-shadow: none; }
.icon-label { font-weight: 500; }`,
  glass: `/* Glass dock skin: lighter frosted bar */
#dock .dock-inner { background-color: rgba(255,255,255,0.12); box-shadow: 0 6px 24px rgba(0,0,0,0.25); }
.dock-btn { background-color: rgba(255,255,255,0.18); }
.dock-btn:hover { background-color: rgba(255,255,255,0.3); }`,
};

export interface DockPresetInfo {
  id: string;
  name: string;
  description: string;
  source: "builtin" | "local";
  css: string;
  surface: string;
  backdrop: string;
  accent: string;
  traits: string[];
}

export interface DockPresetFileV1 {
  version: 1;
  name: string;
  description?: string;
  css: string;
  preview?: {
    surface?: string;
    backdrop?: string;
    accent?: string;
  };
  traits?: string[];
}

// Dock 模板库的统一数据入口。DOCK-LIB-001 接入本地/创意工坊模板时扩展同一结构。
export const DOCK_PRESET_CATALOG: DockPresetInfo[] = [
  {
    id: "hud",
    name: "HUD",
    description: "驾驶舱式高对比 Dock，适合深色、科技感 Room。",
    source: "builtin",
    css: DOCK_SKIN_PRESETS.hud,
    surface: "rgba(10, 22, 34, 0.86)",
    backdrop: "#071019",
    accent: "#8ccfff",
    traits: ["Consolas 标识", "青色状态点", "高对比边框"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "扁平、克制的暗色 Dock，把注意力留给 Room 内容。",
    source: "builtin",
    css: DOCK_SKIN_PRESETS.minimal,
    surface: "rgba(10, 10, 12, 0.82)",
    backdrop: "#19191c",
    accent: "#f4f4f5",
    traits: ["低装饰", "暗色平面", "紧凑信息"],
  },
  {
    id: "glass",
    name: "Glass",
    description: "轻透毛玻璃 Dock，适合明亮壁纸和柔和视觉风格。",
    source: "builtin",
    css: DOCK_SKIN_PRESETS.glass,
    surface: "rgba(255, 255, 255, 0.2)",
    backdrop: "#7c8da4",
    accent: "#ffffff",
    traits: ["浅色玻璃", "柔和阴影", "轻量按钮"],
  },
];

function dockPresetSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "dock";
}

export function newLocalDockPresetId(name: string): string {
  return `local-${dockPresetSlug(name)}-${Date.now().toString(36)}`;
}

export function parseDockPresetFile(value: unknown): DockPresetInfo {
  if (!value || typeof value !== "object") throw new Error("Dock 文件必须是 JSON 对象");
  const file = value as Partial<DockPresetFileV1>;
  if (file.version !== 1) throw new Error("仅支持 Dock 文件 version: 1");
  const name = typeof file.name === "string" ? file.name.trim() : "";
  if (!name) throw new Error("Dock 文件缺少 name");
  if (typeof file.css !== "string" || !file.css.trim()) throw new Error("Dock 文件缺少 css");
  const preview = file.preview && typeof file.preview === "object" ? file.preview : {};
  const traits = Array.isArray(file.traits)
    ? file.traits.filter((item): item is string => typeof item === "string").slice(0, 6)
    : [];

  return {
    id: newLocalDockPresetId(name),
    name,
    description:
      typeof file.description === "string" && file.description.trim()
        ? file.description.trim()
        : "从本地文件导入的 Dock 模板。",
    source: "local",
    css: file.css,
    surface: typeof preview.surface === "string" ? preview.surface : "rgba(20,20,20,0.72)",
    backdrop: typeof preview.backdrop === "string" ? preview.backdrop : "#17181b",
    accent: typeof preview.accent === "string" ? preview.accent : "#ffffff",
    traits: traits.length ? traits : ["本地模板"],
  };
}

const DOCK_SKIN_START_PREFIX = "/* dext-dock-skin:start name=";
const DOCK_SKIN_END = "/* dext-dock-skin:end */";

export function dockSkinName(css: string): string | null {
  const matches = [...css.matchAll(/\/\* dext-dock-skin:start name=([a-z0-9_-]+) \*\//gi)];
  const name = matches.length ? matches[matches.length - 1][1] : undefined;
  return name ?? null;
}

function withDockCss(css: string, name: string, presetCss: string): string {
  if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error(`invalid Dock id: ${name}`);
  if (!presetCss.trim()) throw new Error(`Dock ${name} has no CSS`);
  const block = `${DOCK_SKIN_START_PREFIX}${name} */\n${presetCss.trim()}\n${DOCK_SKIN_END}`;
  const start = css.lastIndexOf(DOCK_SKIN_START_PREFIX);
  const end = start >= 0 ? css.indexOf(DOCK_SKIN_END, start) : -1;
  if (start >= 0 && end >= start) {
    return `${css.slice(0, start)}${block}${css.slice(end + DOCK_SKIN_END.length)}`;
  }

  const existing = css.trimEnd();
  return existing ? `${existing}\n\n${block}\n` : `${block}\n`;
}

export function withDockPreset(css: string, preset: DockPresetInfo): string {
  return withDockCss(css, preset.id, preset.css);
}

export function withDockSkin(css: string, name: string): string {
  const preset = DOCK_SKIN_PRESETS[name];
  if (!preset) throw new Error(`unknown Dock skin: ${name}`);
  return withDockCss(css, name, preset);
}
