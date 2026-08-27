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
  magnify?: boolean | number;
  indicator?: "text" | "dots";
  style?: DockStyle;
  icons?: DockIconItem[];
}

export const DOCK_POSITIONS = ["bottom", "top", "left", "right"] as const;

export const DEFAULT_DOCK: DockConfig = {
  enabled: true,
  position: "bottom",
  autoHide: false,
  magnify: true,
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

// 皮肤预设片段（实际写入房间的 room.css；UI 侧先存 localStorage 标记所选皮肤）
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
