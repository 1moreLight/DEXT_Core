import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Code,
  Dock,
  Film,
  FolderOpen,
  LayoutGrid,
  MonitorPlay,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Redo2,
  Save,
  Square,
  Sun,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DockLibrary, RoomDockPicker } from "@/components/DockLibrary";
import { DockEditor } from "@/components/DockEditor";
import { RoomToolbar } from "@/components/RoomToolbar";
import { SettingsPage } from "@/components/SettingsPage";
import { deleteDeskGraph } from "@/lib/desk";
import {
  type DockConfig,
  type DockPresetInfo,
  DEFAULT_DOCK,
  DOCK_PRESET_CATALOG,
  dockSkinName,
  newLocalDockPresetId,
  parseDockPresetFile,
  withDockPreset,
} from "@/lib/dock";

interface AppInfo {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
  source: string;
}

interface CoreIdentity {
  product_name: string;
  runtime_identity: string;
  process_id: number;
  base_directory: string;
  app_data_directory: string;
  grpc_pipe_name: string;
  assembly_version: string;
  is_core_initialized: boolean;
}

interface ActiveRoom {
  sourcePath: string;
  runtimePath: string;
}

interface RoomIcon {
  label: string;
  icon_png: string;
  launch: { target: string; args: string; workdir: string };
  x?: number;
  y?: number;
}

type ContentType = "image" | "video" | "html";

interface Content {
  name: string;
  type: ContentType;
  src: string;
}

type Background = Content | null;
type TransitionPreset = "slide" | "fade" | "zoom" | "none";
type Transition = TransitionPreset | Content;

interface Desk {
  name: string;
  background: Background;
  icons: RoomIcon[];
  iconSize?: string;
  dock?: DockConfig;
}

function bgLabel(bg: Background): string {
  if (!bg) return "黑底（未设置）";
  return `${bg.type === "image" ? "🖼" : bg.type === "video" ? "🎬" : "代码"} ${bg.name}`;
}

interface CoverRef {
  kind: "image" | "video";
  src: string;
}

interface RoomInfo {
  name: string;
  path: string;
  desks: number;
  icons: number;
  covers?: CoverRef[];
}

type Mode = "use" | "edit" | "workshop" | "settings";

type Theme = "light" | "dark";

type EditNav = "library" | "room" | "dock";

/* ---- room 思维导图 ----
   拓扑：启动画面只直连一个可选 Desk（无 switch，未指定时默认 d0）；
   Desk 相邻上下双向连接，3 个以上时首尾从侧边双向环回。 */
type GEdge = { id: string; from: string; to: string; trans: Transition | null };
type Snapshot = {
  edges: GEdge[];
  desks: Desk[];
  startName: string;
  hasStart: boolean;
  startDesk: number;
};
type GraphNodeRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};
type GraphGeometry = {
  width: number;
  height: number;
  nodes: Record<string, GraphNodeRect>;
};
type GraphSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const EMPTY_GRAPH_GEOMETRY: GraphGeometry = { width: 0, height: 0, nodes: {} };
const GRAPH_ROW_GAP = 32;

const TRANSITION_OPTIONS: [TransitionPreset, string][] = [
  ["slide", "滑动"],
  ["fade", "淡入淡出"],
  ["zoom", "缩放"],
  ["none", "无"],
];

function seedEdges(
  ds: Desk[],
  hasStart: boolean,
  startDesk = 0,
  switches: Record<string, Transition> = {}
): GEdge[] {
  const edges: GEdge[] = [];
  if (hasStart && ds.length > 0) {
    const target = Math.min(Math.max(startDesk, 0), ds.length - 1);
    edges.push({ id: "start-in", from: "start", to: `d${target}`, trans: null });
  }
  for (let i = 1; i < ds.length; i++) {
    edges.push(
      { id: `s${i}f`, from: `d${i - 1}`, to: `d${i}`, trans: switches[`${i - 1}>${i}`] ?? null },
      { id: `s${i}b`, from: `d${i}`, to: `d${i - 1}`, trans: switches[`${i}>${i - 1}`] ?? null }
    );
  }
  if (ds.length > 2) {
    const last = ds.length - 1;
    edges.push(
      { id: "s-wrap-f", from: `d${last}`, to: "d0", trans: switches[`${last}>0`] ?? null },
      { id: "s-wrap-b", from: "d0", to: `d${last}`, trans: switches[`0>${last}`] ?? null }
    );
  }
  return edges;
}

function pairKey(e: GEdge): string {
  return [e.from, e.to].sort().join("|");
}

function visualGraphEdges(edges: GEdge[]): GEdge[] {
  const pairs = new Set<string>();
  return edges.filter((edge) => {
    if (edge.from === "start" || edge.to === "start") return true;
    const key = pairKey(edge);
    if (pairs.has(key)) return false;
    pairs.add(key);
    return true;
  });
}

function reconcileGraphEdges(
  current: GEdge[],
  desks: Desk[],
  hasStart: boolean,
  startDesk: number
): GEdge[] {
  const byRoute = new Map(current.map((edge) => [`${edge.from}>${edge.to}`, edge.trans]));
  return seedEdges(desks, hasStart, startDesk).map((edge) => ({
    ...edge,
    trans: byRoute.get(`${edge.from}>${edge.to}`) ?? null,
  }));
}

function relativeGraphRect(node: HTMLElement, canvas: DOMRect): GraphNodeRect {
  const rect = node.getBoundingClientRect();
  const left = rect.left - canvas.left;
  const top = rect.top - canvas.top;
  return {
    left,
    right: left + rect.width,
    top,
    bottom: top + rect.height,
    width: rect.width,
    height: rect.height,
    cx: left + rect.width / 2,
    cy: top + rect.height / 2,
  };
}

function sameGraphGeometry(a: GraphGeometry, b: GraphGeometry): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5;
  const aKeys = Object.keys(a.nodes);
  const bKeys = Object.keys(b.nodes);
  if (!close(a.width, b.width) || !close(a.height, b.height) || aKeys.length !== bKeys.length)
    return false;
  return aKeys.every((key) => {
    const x = a.nodes[key];
    const y = b.nodes[key];
    return (
      !!y &&
      close(x.left, y.left) &&
      close(x.right, y.right) &&
      close(x.top, y.top) &&
      close(x.bottom, y.bottom)
    );
  });
}

function routeGraphEdge(edge: GEdge, nodes: Record<string, GraphNodeRect>): GraphSegment[] {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (!from || !to) return [];

  if (edge.from === "start") {
    const elbowX = from.right + Math.max(18, (to.left - from.right) / 2);
    return [
      { x1: from.right, y1: from.cy, x2: elbowX, y2: from.cy },
      { x1: elbowX, y1: from.cy, x2: elbowX, y2: to.cy },
      { x1: elbowX, y1: to.cy, x2: to.left, y2: to.cy },
    ];
  }

  const fromIndex = parseInt(edge.from.slice(1), 10);
  const toIndex = parseInt(edge.to.slice(1), 10);
  const deskCount = Object.keys(nodes).filter((id) => /^d\d+$/.test(id)).length;
  const wraps = deskCount > 2 && Math.abs(fromIndex - toIndex) === deskCount - 1;

  if (!wraps) {
    const down = toIndex > fromIndex;
    const fromX = from.cx;
    const toX = to.cx;
    const fromY = down ? from.bottom : from.top;
    const toY = down ? to.top : to.bottom;
    const middleY = (fromY + toY) / 2;
    return [
      { x1: fromX, y1: fromY, x2: fromX, y2: middleY },
      { x1: fromX, y1: middleY, x2: toX, y2: middleY },
      { x1: toX, y1: middleY, x2: toX, y2: toY },
    ];
  }

  const maxRight = Math.max(from.right, to.right);
  const laneX = maxRight + 48;
  const fromY = from.cy;
  const toY = to.cy;
  return [
    { x1: from.right, y1: fromY, x2: laneX, y2: fromY },
    { x1: laneX, y1: fromY, x2: laneX, y2: toY },
    { x1: laneX, y1: toY, x2: to.right, y2: toY },
  ];
}

function graphSwitchPosition(
  edge: GEdge,
  nodes: Record<string, GraphNodeRect>
): { left: number; top: number } | null {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (!from || !to) return null;
  const fromIndex = parseInt(edge.from.slice(1), 10);
  const toIndex = parseInt(edge.to.slice(1), 10);
  const deskCount = Object.keys(nodes).filter((id) => /^d\d+$/.test(id)).length;
  const wraps = deskCount > 2 && Math.abs(fromIndex - toIndex) === deskCount - 1;
  if (!wraps) {
    const upper = fromIndex < toIndex ? from : to;
    const lower = fromIndex < toIndex ? to : from;
    return {
      left: (from.cx + to.cx) / 2,
      top: (upper.bottom + lower.top) / 2,
    };
  }
  return {
    left: Math.max(from.right, to.right) + 48,
    top: (from.cy + to.cy) / 2,
  };
}

const DEFAULT_LIB = "D:\\use\\Orca\\DEXT\\DEXT_Core\\rooms";
const LOCAL_DOCK_PRESETS_KEY = "dext.localDockPresets.v1";

function loadLocalDockPresets(): DockPresetInfo[] {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_DOCK_PRESETS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (preset): preset is DockPresetInfo =>
            preset &&
            typeof preset.id === "string" &&
            preset.id.startsWith("local-") &&
            typeof preset.name === "string" &&
            typeof preset.css === "string"
        )
      : [];
  } catch {
    return [];
  }
}

// stale lib paths (repo moved) should not stick via localStorage
function initialLibDir(): string {
  const saved = localStorage.getItem("dext.libDir");
  if (saved && !saved.includes("midDOW")) return saved;
  if (saved) localStorage.removeItem("dext.libDir");
  return DEFAULT_LIB;
}

// browser (non-Tauri) = UI design mode: mock data, no backend calls
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function mockIcon(name: string, color: string): string {
  const cv = document.createElement("canvas");
  cv.width = 48;
  cv.height = 48;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(4, 4, 40, 40, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px 'Segoe UI'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name[0], 24, 26);
  return cv.toDataURL("image/png").slice("data:image/png;base64,".length);
}

const MOCK_APPS: AppInfo[] = (
  [
    ["Edge", "#3b82f6"], ["Steam", "#1e293b"], ["VSCode", "#2563eb"], ["Obsidian", "#7c3aed"],
    ["Spotify", "#10b981"], ["Telegram", "#0ea5e9"], ["Figma", "#f43f5e"], ["Notion", "#111827"],
    ["QQ", "#ef4444"], ["微信", "#22c55e"], ["B站", "#fb7185"], ["网易云", "#dc2626"],
    ["PotPlayer", "#f59e0b"], ["7-Zip", "#64748b"], ["OBS", "#0f172a"], ["Discord", "#6366f1"],
    ["Chrome", "#f97316"], ["Termius", "#14b8a6"],
  ] as [string, string][]
).map(([name, color]) => ({
  name,
  target: `C:\\mock\\${name}.exe`,
  arguments: "",
  working_dir: "",
  icon_png: mockIcon(name, color),
  source: "mock",
}));

const MOCK_ROOMS: RoomInfo[] = [
  {
    name: "my-room",
    path: "C:\\mock\\my-room",
    desks: 2,
    icons: 8,
    covers: [
      { kind: "video", src: "background/bg.mp4" },
      { kind: "image", src: "background/bg.png" },
    ],
  },
  { name: "black-room", path: "C:\\mock\\black-room", desks: 1, icons: 0, covers: [] },
  {
    name: "game-room",
    path: "C:\\mock\\game-room",
    desks: 3,
    icons: 15,
    covers: [
      { kind: "image", src: "background/1.png" },
      { kind: "image", src: "background/2.png" },
      { kind: "image", src: "background/3.png" },
    ],
  },
  {
    name: "neon-city",
    path: "C:\\mock\\neon-city",
    desks: 2,
    icons: 6,
    covers: [
      { kind: "image", src: "background/a.png" },
      { kind: "image", src: "background/b.png" },
    ],
  },
  {
    name: "sunset",
    path: "C:\\mock\\sunset",
    desks: 3,
    icons: 12,
    covers: [
      { kind: "video", src: "background/sun.mp4" },
      { kind: "image", src: "background/1.png" },
      { kind: "image", src: "background/2.png" },
    ],
  },
  { name: "minimal", path: "C:\\mock\\minimal", desks: 1, icons: 3, covers: [] },
  {
    name: "retro",
    path: "C:\\mock\\retro",
    desks: 2,
    icons: 9,
    covers: [{ kind: "image", src: "background/crt.png" }],
  },
];

const MOCK_DESKS: Desk[] = [
  {
    name: "主页",
    background: null,
    iconSize: "medium",
    icons: MOCK_APPS.slice(0, 6).map((a, i) => ({
      label: a.name,
      icon_png: a.icon_png,
      launch: { target: a.target, args: "", workdir: "" },
      x: i % 4,
      y: Math.floor(i / 4),
    })),
  },
  { name: "游戏", background: null, iconSize: "large", icons: [] },
];

function newDesk(index: number): Desk {
  return { name: `Desk ${index + 1}`, background: null, iconSize: "medium", icons: [] };
}

function AppIcon({ app, size = "h-10 w-10" }: { app: AppInfo; size?: string }) {
  return app.icon_png ? (
    <img src={`data:image/png;base64,${app.icon_png}`} alt="" className={size} />
  ) : (
    <div className={`${size} rounded bg-muted`} />
  );
}

function transitionLabel(t: Transition): string {
  if (typeof t === "string") {
    return { slide: "滑动", fade: "淡入", zoom: "缩放", none: "无" }[t] ?? t;
  }
  return `${t.type === "image" ? "🖼" : t.type === "video" ? "🎬" : "代码"} ${t.name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanContent(value: unknown, directory: "background" | "start" | "switch" | "end"): Content | null {
  if (!isRecord(value) || !["image", "video", "html"].includes(String(value.type))) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const src = typeof value.src === "string" ? value.src.replace(/\\/g, "/") : "";
  if (!name || !src.startsWith(`${directory}/`) || src.split("/").some((part: string) => !part || part === "." || part === "..")) return null;
  return { name, type: value.type as ContentType, src };
}

function cleanTransition(value: unknown): Transition | null {
  if (["slide", "fade", "zoom", "none"].includes(String(value))) return value as TransitionPreset;
  return cleanContent(value, "switch");
}

function cleanRoomIcon(value: unknown, index: number): RoomIcon {
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

function cleanDesk(value: unknown, index: number): Desk {
  const desk = isRecord(value) ? value : {};
  const iconSize = ["large", "medium", "small"].includes(String(desk.iconSize))
    ? String(desk.iconSize)
    : "medium";
  return {
    name: typeof desk.name === "string" && desk.name.trim() ? desk.name.trim() : `Desk ${index + 1}`,
    background: cleanContent(desk.background, "background"),
    iconSize,
    icons: Array.isArray(desk.icons) ? desk.icons.map(cleanRoomIcon) : [],
    ...(isRecord(desk.dock) ? { dock: desk.dock as DockConfig } : {}),
  };
}

function roomIconForWrite(icon: RoomIcon, index: number, desktop: boolean) {
  const out: Record<string, unknown> = {
    label: icon.label?.trim() || `图标 ${index + 1}`,
  };
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

function dockForWrite(value: DockConfig | undefined): Record<string, unknown> | undefined {
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

/* ===== room cover collage ===== */

type CoverTile =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string }
  | { kind: "gradient"; from: string; to: string };

const GRADIENTS: [string, string][] = [
  ["#0f172a", "#334155"],
  ["#1e1b4b", "#6d28d9"],
  ["#064e3b", "#0f766e"],
  ["#7c2d12", "#c2410c"],
  ["#831843", "#be185d"],
  ["#082f49", "#0369a1"],
];

function nameGradient(name: string): CoverTile {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  return { kind: "gradient", from, to };
}

function coverTileOf(c: CoverRef, room: RoomInfo): CoverTile {
  // real backend serves room files via the lib:// protocol; browser mock has no files
  const url =
    IS_TAURI && c.src
      ? `http://lib.localhost/${encodeURIComponent(room.name)}/${c.src
          .split(/[\\/]/)
          .map(encodeURIComponent)
          .join("/")}`
      : "";
  if (c.kind === "video") return { kind: "video", url };
  if (!url) return nameGradient(room.name);
  return { kind: "image", url };
}

function roomCovers(r: RoomInfo): CoverTile[] {
  const tiles = (r.covers ?? []).map((c) => coverTileOf(c, r));
  return tiles.length ? tiles : [nameGradient(r.name)];
}

function RoomBackgroundPreview({
  room,
  className = "",
  label,
}: {
  room: RoomInfo;
  className?: string;
  label: string;
}) {
  return (
    <div
      className={`aspect-video overflow-hidden border border-border bg-muted/40 ${className}`}
      aria-label={label}
    >
      <CoverTileBox tile={roomCovers(room)[0]} autoPlay />
    </div>
  );
}

// video cover: show first frame (preload=metadata only fetches headers, no decoding);
// autoPlay=true (hero main slot) plays immediately, otherwise play while hovered, rewind on leave
function VideoTile({ url, autoPlay = false }: { url: string; autoPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  if (!url)
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-black">
        <Film className="h-5 w-5 text-white/40" />
      </div>
    );
  return (
    <video
      ref={ref}
      src={url}
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload={autoPlay ? "auto" : "metadata"}
      className="h-full w-full object-cover"
      onMouseEnter={autoPlay ? undefined : () => {
        // play() rejects when interrupted (e.g. quick leave) — that is fine to ignore
        ref.current?.play().catch(() => {});
      }}
      onMouseLeave={autoPlay ? undefined : () => {
        const v = ref.current;
        if (v) {
          v.pause();
          v.currentTime = 0;
        }
      }}
    />
  );
}

function CoverTileBox({ tile, autoPlay = false }: { tile: CoverTile; autoPlay?: boolean }) {
  if (tile.kind === "gradient")
    return (
      <div
        className="h-full w-full"
        style={{ background: `linear-gradient(135deg, ${tile.from}, ${tile.to})` }}
      />
    );
  if (tile.kind === "video") return <VideoTile url={tile.url} autoPlay={autoPlay} />;
  return <img src={tile.url} alt="" draggable={false} className="h-full w-full object-cover" />;
}

// photo-stack cover: first background fills the card, the rest pile up
// as small tilted photos in the bottom-right corner (max 2 + "+N" badge);
// clicking a piled photo swaps it into the main slot
function CoverStack({ tiles, autoPlayMain = false }: { tiles: CoverTile[]; autoPlayMain?: boolean }) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, tiles.length - 1);
  const base = tiles[safeIdx];
  const piled = tiles.filter((_, i) => i !== safeIdx).slice(0, 2);
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <CoverTileBox tile={base} autoPlay={autoPlayMain} />
      {piled.length > 0 && (
        // proportional sizing (w-% + aspect-video) so small cards look identical to big panels
        <div className="absolute inset-0 flex items-end justify-end p-[4%]">
          {piled.map((t, pi) => {
            const realIdx = tiles.indexOf(t);
            return (
              <div
                key={realIdx}
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(realIdx);
                }}
                title="点击换到主展示位"
                className="w-[30%] aspect-video cursor-pointer overflow-hidden rounded-md border border-white/90 bg-black shadow-lg transition-transform hover:scale-105"
                style={{
                  transform: `rotate(${(pi - (piled.length - 1) / 2) * 5}deg)`,
                  marginLeft: pi > 0 ? "-8%" : undefined,
                  zIndex: piled.length - pi,
                }}
              >
                <CoverTileBox tile={t} />
              </div>
            );
          })}
        </div>
      )}
      {tiles.length > 1 + piled.length && (
        <span className="absolute bottom-[5%] left-[3.5%] rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          +{tiles.length - 1 - piled.length}
        </span>
      )}
    </div>
  );
}

function ContentInspector({
  content,
  roomPath,
  emptyLabel,
}: {
  content: Content | null;
  roomPath: string | null;
  emptyLabel: string;
}) {
  const url = roomContentUrl(content, roomPath);
  const typeLabel = content?.type === "image" ? "图片" : content?.type === "video" ? "视频" : content?.type === "html" ? "HTML" : "未选择";
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex aspect-video w-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {!content ? (
          <span className="px-3 text-center text-[11px] text-muted-foreground">{emptyLabel}</span>
        ) : content.type === "image" ? (
          <img src={url} alt={content.name} className="h-full w-full object-cover" />
        ) : content.type === "video" ? (
          <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground"><Code className="h-5 w-5" /><span className="text-[10px]">HTML 场景</span></div>
        )}
      </div>
      <dl className="w-44 space-y-1 text-[11px]">
        <div><dt className="text-muted-foreground">素材</dt><dd className="truncate font-medium" title={content?.name}>{content?.name ?? "未选择"}</dd></div>
        <div><dt className="text-muted-foreground">路径</dt><dd className="truncate font-mono" title={content?.src}>{content?.src ?? "—"}</dd></div>
        <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${content ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" /><span>{typeLabel}</span></div>
      </dl>
    </div>
  );
}

function roomContentUrl(content: Content | null, roomPath: string | null): string {
  const roomName = roomPath?.split(/[\\/]/).filter(Boolean).pop();
  return content && roomName
    ? `http://lib.localhost/${encodeURIComponent(roomName)}/${content.src.split("/").map(encodeURIComponent).join("/")}`
    : "";
}

function DeskBackgroundCanvas({
  desks,
  roomPath,
  selectedIndex,
  onSelect,
}: {
  desks: Desk[];
  roomPath: string | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex h-full w-[52vw] min-w-[32rem] max-w-3xl shrink-0 flex-col justify-center gap-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-[0.14em]">Desk 画布</span>
        <span>{desks.length} 个 Desk · 点击切换</span>
      </div>
      <div role="listbox" aria-label="Desk 背景画布" className="flex gap-2 overflow-x-auto pb-1">
        {desks.map((item, index) => {
          const content = item.background;
          const url = roomContentUrl(content, roomPath);
          const selected = index === selectedIndex;
          return (
            <button
              key={index}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(index)}
              className={`group relative aspect-video w-44 shrink-0 overflow-hidden rounded-lg border-2 bg-black text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 ${
                selected ? "border-primary" : "border-border hover:border-primary/55"
              }`}
              title={`选择 ${item.name}`}
            >
              {!content ? (
                <div className="flex h-full w-full items-center justify-center bg-muted/50 text-[11px] text-muted-foreground">
                  未设置背景
                </div>
              ) : content.type === "image" ? (
                <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
              ) : content.type === "video" ? (
                <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/55 text-muted-foreground">
                  <Code className="h-5 w-5" />
                  <span className="text-[10px]">HTML 场景</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-1.5 pt-6 text-white">
                <span className="min-w-0 truncate text-xs font-medium">{item.name}</span>
                <span className="shrink-0 text-[9px] text-white/70">{index === 0 ? "主 Desk" : `${index + 1}`}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("use");
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [desks, setDesks] = useState<Desk[]>([newDesk(0)]);
  const [activeDesk, setActiveDesk] = useState(0);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [status, setStatus] = useState("loading...");
  const [coreIdentity, setCoreIdentity] = useState<CoreIdentity | null>(null);
  const [coreIdentityError, setCoreIdentityError] = useState<string | null>(null);
  const [libDir, setLibDir] = useState(
    () => initialLibDir()
  );
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [roomPath, setRoomPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [appliedRoom, setAppliedRoom] = useState<string | null>(null);
  const [roomMultiMode, setRoomMultiMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [roomBusy, setRoomBusy] = useState<string | null>(null);
  const roomOperationRef = useRef(false);
  const [showPreview, setShowPreview] = useState(false);
  const [transition, setTransition] = useState<Transition>("slide");
  const [startContent, setStartContent] = useState<Content | null>(null);
  const [endContent, setEndContent] = useState<Content | null>(null);
  const [roomVersion, setRoomVersion] = useState<number | null>(1);
  const [roomCompatibilityFields, setRoomCompatibilityFields] = useState<Record<string, unknown>>({});
  const [dock, setDock] = useState<DockConfig>(DEFAULT_DOCK);
  const [roomCss, setRoomCss] = useState("");
  const [localDockPresets, setLocalDockPresets] = useState<DockPresetInfo[]>(loadLocalDockPresets);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [appPickerDesk, setAppPickerDesk] = useState<number | null>(null);
  const [libSource, setLibSource] = useState<"auto" | "custom">("auto");
  const [heroPath, setHeroPath] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomPage, setRoomPage] = useState(1);
  const [editNav, setEditNav] = useState<EditNav>("room");
  const [navOpen, setNavOpen] = useState(true);
  const [roomEntered, setRoomEntered] = useState(false);
  const [roomPickPath, setRoomPickPath] = useState<string | null>(null);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [graphSel, setGraphSel] = useState<string | null>(null);
  const [startName, setStartName] = useState("启动画面");
  const [hasStart, setHasStart] = useState(true);
  const [startDesk, setStartDesk] = useState(0);
  const [propsH, setPropsH] = useState(210);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const startNodeRef = useRef<HTMLButtonElement>(null);
  const deskNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [geom, setGeom] = useState<GraphGeometry>(EMPTY_GRAPH_GEOMETRY);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("dext.theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const previewRef = useRef<HTMLIFrameElement>(null);
  const dockPresets = [...DOCK_PRESET_CATALOG, ...localDockPresets];
  const coreUnavailable = coreIdentityError?.includes("pipe connect failed") ?? false;

  function buildRoomV1() {
    const room: Record<string, unknown> = {
      ...roomCompatibilityFields,
      version: 1,
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
          iconSize: ["large", "medium", "small"].includes(String(desk.iconSize))
            ? desk.iconSize
            : "medium",
          icons: desk.icons.map((icon, index) => roomIconForWrite(icon, index, true)),
        };
        const deskDock = dockForWrite(desk.dock);
        if (deskDock) next.dock = deskDock;
        return next;
      }),
    };
    if (startContent) room.start = { ...startContent, name: startName.trim() || startContent.name };
    if (endContent) room.end = endContent;
    const roomDock = dockForWrite(dock);
    if (roomDock) room.dock = roomDock;
    return room;
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dext.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LOCAL_DOCK_PRESETS_KEY, JSON.stringify(localDockPresets));
  }, [localDockPresets]);

  useEffect(() => {
    if (!IS_TAURI) return;
    let disposed = false;
    let checking = false;
    const refreshCoreIdentity = async () => {
      if (checking) return;
      checking = true;
      try {
        const identity = await invoke<CoreIdentity>("core_identity");
        if (!disposed) {
          setCoreIdentity(identity);
          setCoreIdentityError(null);
        }
      } catch (error) {
        if (!disposed) {
          setCoreIdentity(null);
          setCoreIdentityError(String(error));
        }
      } finally {
        checking = false;
      }
    };
    void refreshCoreIdentity();
    const timer = window.setInterval(() => void refreshCoreIdentity(), 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!IS_TAURI || !coreIdentity) {
      setAppliedRoom(null);
      return;
    }
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const active = await invoke<ActiveRoom | null>("active_room");
        if (!disposed) setAppliedRoom(active?.sourcePath ?? null);
      } catch {
        if (!disposed) setAppliedRoom(null);
      } finally {
        checking = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [coreIdentity]);

  useEffect(() => {
    if (!IS_TAURI) {
      setApps(MOCK_APPS);
      setRooms(MOCK_ROOMS);
      setDesks(MOCK_DESKS);
      setRoomPath(MOCK_ROOMS[0].path);
      setLibSource("custom");
      setStatus("UI 设计模式（浏览器 · mock 数据）");
      return;
    }
    (async () => {
      // curated library wins; fall back to live start-menu scan
      try {
        const lib = await invoke<string | null>("load_library", { dir: libDir });
        if (lib) {
          const list = JSON.parse(lib) as AppInfo[];
          setApps(list);
          setLibSource("custom");
          setStatus(`${list.length} apps（手动库）`);
          return;
        }
      } catch {
        // fall through
      }
      invoke<AppInfo[]>("get_installed_apps")
        .then((list) => {
          setApps(list);
          setStatus(`${list.length} apps`);
        })
        .catch((e) => setStatus(`error: ${e}`));
    })();
  }, []);

  useEffect(() => {
    if (!IS_TAURI) return;
    refreshRooms(libDir).then(async (list) => {
      const last = localStorage.getItem("dext.roomPath");
      const target = list.find((r) => r.path === last)?.path ?? list[0]?.path;
      if (target) await openRoom(target, false);
    });
  }, []);

  async function refreshRooms(dir: string): Promise<RoomInfo[]> {
    try {
      const list = await invoke<RoomInfo[]>("list_rooms", { dir });
      setRooms(list);
      return list;
    } catch (e) {
      setStatus(`error: ${e}`);
      return [];
    }
  }

  async function openRoom(path: string, checkDirty = true) {
    if (!IS_TAURI) {
      setDesks(MOCK_DESKS);
      setActiveDesk(0);
      setRoomPath(path);
      setRoomCss("");
      setStartContent(null);
      setEndContent(null);
      setRoomCompatibilityFields({});
      setRoomVersion(1);
      setStartDesk(0);
      setEdges(seedEdges(MOCK_DESKS, true, 0));
      setDirty(false);
      setStatus(`已打开 ${path.split("\\").pop()}（mock）`);
      return true;
    }
    if (
      checkDirty &&
      dirty &&
      !confirm("当前房间有未保存的修改，丢弃并切换？")
    )
      return false;
    try {
      const json = await invoke<string>("read_room", { path: `${path}\\room.json` });
      const css = await invoke<string>("read_room", { path: `${path}\\room.css` }).catch(() => "");
      const room = JSON.parse(json);
      const nextDesks = Array.isArray(room.desks) && room.desks.length
        ? room.desks.map(cleanDesk)
        : [newDesk(0)];
      const nextStartDesk = Number.isInteger(room.startDesk) && room.startDesk >= 0 && room.startDesk < nextDesks.length
        ? room.startDesk
        : 0;
      const nextStart = cleanContent(room.start, "start");
      const nextEnd = cleanContent(room.end, "end");
      const rawSwitches = isRecord(room.switches) ? room.switches : {};
      const nextSwitches = Object.fromEntries(
        Object.entries(rawSwitches).flatMap(([key, value]) => {
          const parsed = cleanTransition(value);
          return parsed ? [[key, parsed]] : [];
        })
      );
      setDesks(nextDesks);
      setDock(room.dock ? { ...DEFAULT_DOCK, ...room.dock } : DEFAULT_DOCK);
      setTransition(cleanTransition(room.switch) ?? "slide");
      setStartContent(nextStart);
      setEndContent(nextEnd);
      setStartName(nextStart?.name ?? "启动画面");
      setHasStart(true);
      setStartDesk(nextStartDesk);
      setEdges(seedEdges(nextDesks, true, nextStartDesk, nextSwitches));
      setRoomVersion(typeof room.version === "number" ? room.version : null);
      setRoomCompatibilityFields(
        Object.prototype.hasOwnProperty.call(room, "idle") ? { idle: room.idle } : {}
      );
      setRoomCss(css);
      setActiveDesk(nextStartDesk);
      setRoomPath(path);
      setDirty(false);
      localStorage.setItem("dext.roomPath", path);
      setStatus(
        room.version === 1
          ? `已打开 ${path.split("\\").pop()}`
          : "该 Room 不是 v1：可查看，但必须另存为 v1，不能覆盖或应用"
      );
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  function touch() {
    setDirty(true);
  }

  async function saveRoom(): Promise<boolean> {
    if (!roomPath) return false;
    if (roomVersion !== 1) {
      setStatus("非 v1 Room 不能覆盖保存；请另存为新的 v1 Room");
      return false;
    }
    try {
      await invoke("write_room", {
        path: `${roomPath}\\room.json`,
        roomJson: JSON.stringify(buildRoomV1(), null, 2),
      });
      setDirty(false);
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function applyRoomDir(dir: string) {
    if (roomOperationRef.current || roomBusy) return;
    if (!IS_TAURI) {
      setAppliedRoom(dir);
      setStatus(`已应用 ${dir.split("\\").pop()}（UI 设计模式）`);
      return;
    }
    if (IS_TAURI && !coreIdentity) {
      setStatus(
        coreUnavailable
          ? "Dext Core 已退出；请重新运行 scripts/start.ps1 后再应用 Room"
          : "Dext Core 身份尚未通过验证，不能应用 Room"
      );
      return;
    }
    roomOperationRef.current = true;
    setRoomBusy(`正在应用 ${dir.split(/[\\/]/).filter(Boolean).pop() ?? "Room"}…`);
    try {
      await invoke("apply_room", { roomDir: dir });
      setAppliedRoom(dir);
      setStatus(`已应用 ${dir.split("\\").pop()}`);
    } catch (e) {
      const message = String(e);
      if (message.includes("pipe connect failed")) {
        setCoreIdentity(null);
        setCoreIdentityError(message);
        setStatus("Dext Core 已断开；请重新运行 scripts/start.ps1 后再应用 Room");
      } else {
        setStatus(`error: ${message}`);
      }
    } finally {
      roomOperationRef.current = false;
      setRoomBusy(null);
    }
  }

  async function applyCurrent() {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    if (roomVersion !== 1) {
      setStatus("非 v1 Room 不能覆盖或应用；请另存为 v1");
      return;
    }
    setStatus("saving...");
    if (dirty && !(await saveRoom())) return;
    await applyRoomDir(roomPath);
  }

  async function applyDockPreset(preset: DockPresetInfo): Promise<boolean> {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return false;
    }
    try {
      const css = withDockPreset(roomCss, preset);
      if (IS_TAURI) {
        await invoke("save_room_css", { roomDir: roomPath, css });
      }
      setRoomCss(css);
      const roomName = roomPath.split("\\").pop() ?? roomPath;
      setStatus(
        IS_TAURI
          ? `Dock「${preset.name}」已保存到 ${roomName} / room.css`
          : `Dock「${preset.name}」已应用（UI 设计模式）`
      );
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function importDockPreset(): Promise<string | null> {
    if (!IS_TAURI) {
      setStatus("Dock 文件导入请在桌面配置器中使用");
      return null;
    }
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Dext Dock 模板", extensions: ["json", "dock"] }],
      });
      if (typeof selected !== "string") return null;
      const text = await invoke<string>("read_room", { path: selected });
      const preset = parseDockPresetFile(JSON.parse(text));
      setLocalDockPresets((current) => [...current, preset]);
      setStatus(`已导入 Dock「${preset.name}」`);
      return preset.id;
    } catch (error) {
      setStatus(`Dock 导入失败：${error}`);
      return null;
    }
  }

  function saveDockPreset(preset: DockPresetInfo): DockPresetInfo {
    const saved =
      preset.source === "builtin"
        ? { ...preset, id: newLocalDockPresetId(preset.name), source: "local" as const }
        : preset;
    setLocalDockPresets((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
    });
    setStatus(
      preset.source === "builtin"
        ? `已从「${preset.name}」创建本地 Dock 副本`
        : `已保存 Dock「${preset.name}」`
    );
    return saved;
  }

  async function newRoom(): Promise<string | null> {
    const name = prompt("房间名（建议英文）");
    if (!name) return null;
    try {
      const path = await invoke<string>("create_room", { dir: libDir, name });
      await refreshRooms(libDir);
      await openRoom(path, false);
      return path;
    } catch (e) {
      setStatus(`error: ${e}`);
      return null;
    }
  }

  async function saveAs() {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    const name = prompt("另存为（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("save_room_as", {
        roomDir: roomPath,
        dir: libDir,
        name,
        roomJson: JSON.stringify(buildRoomV1(), null, 2),
      });
      await refreshRooms(libDir);
      await openRoom(path, false);
      setRoomPickPath(path);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function changeLib(dir: string) {
    const d = dir.trim();
    setLibDir(d);
    localStorage.setItem("dext.libDir", d);
    refreshRooms(d);
  }

  function postRoom() {
    if (!roomPath) return;
    const roomName = roomPath.split(/[\\/]/).filter(Boolean).pop();
    if (!roomName) return;
    previewRef.current?.contentWindow?.postMessage(
      {
        type: "dext:room",
        room: buildRoomV1(),
        deskIndex: activeDesk,
        assetBase: `http://lib.localhost/${encodeURIComponent(roomName)}/`,
      },
      "http://dext.localhost"
    );
  }

  useEffect(() => {
    if (showPreview) postRoom();
  }, [desks, dock, activeDesk, showPreview, transition, edges, startContent, endContent, startDesk, startName]);

  useEffect(() => {
    setSelected(new Set());
  }, [activeDesk]);

  function toggleSelect(app: AppInfo) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(app.target)) next.delete(app.target);
      else next.add(app.target);
      return next;
    });
  }

  async function persistLibrary(next: AppInfo[]): Promise<boolean> {
    if (!IS_TAURI) {
      setLibSource("custom");
      return true;
    }
    try {
      await invoke("save_library", {
        dir: libDir,
        libraryJson: JSON.stringify(next, null, 2),
      });
      setLibSource("custom");
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function deleteFromLibrary() {
    const next = apps.filter((a) => !selected.has(a.target));
    const count = apps.length - next.length;
    if (!count || !(await persistLibrary(next))) return;
    setApps(next);
    setSelected(new Set());
    setStatus(`已从库中删除 ${count} 项`);
  }

  async function scanMerge() {
    try {
      setStatus("scanning...");
      const list = await invoke<AppInfo[]>("get_installed_apps");
      const byTarget = new Map(apps.map((a) => [a.target, a]));
      for (const a of list) if (!byTarget.has(a.target)) byTarget.set(a.target, a);
      const merged = [...byTarget.values()];
      if (!(await persistLibrary(merged))) return;
      setApps(merged);
      setSelected(new Set());
      setStatus(`扫描合并完成：${merged.length} 项`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function manualAdd() {
    const picked = await open({
      filters: [{ name: "快捷方式/程序", extensions: ["lnk", "exe"] }],
      multiple: true,
    });
    const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (!paths.length) return;
    try {
      setStatus("resolving...");
      const additions: AppInfo[] = [];
      const existing = new Set(apps.map((a) => a.target));
      for (const p of paths) {
        try {
          const info = await invoke<AppInfo>("resolve_app", { path: p });
          if (info.target && !existing.has(info.target)) {
            additions.push(info);
            existing.add(info.target);
          }
        } catch {
          // skip unresolvable entries
        }
      }
      if (!additions.length) {
        setStatus("没有新增（重复或无法解析）");
        return;
      }
      const next = [...apps, ...additions];
      if (!(await persistLibrary(next))) return;
      setApps(next);
      setStatus(`已添加 ${additions.length} 项`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function pickRoomContent(
    slot: "background" | "start" | "switch" | "end",
    contentType: ContentType,
  ): Promise<Content | null> {
    if (!IS_TAURI) {
      setStatus("请在桌面配置器中选择 Room 素材");
      return null;
    }
    if (!roomPath) {
      setStatus("请先新建或打开一个 Room");
      return null;
    }
    const filters = {
      image: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"] }],
      html: [{ name: "网页代码", extensions: ["html", "htm"] }],
      video: [{ name: "视频", extensions: ["mp4", "webm"] }],
    }[contentType];
    try {
      const picked = await open({ filters, multiple: false });
      if (typeof picked !== "string") return null;
      setStatus("正在复制素材...");
      const imported = await invoke<Content>("import_background", {
        roomDir: roomPath,
        srcPath: picked,
        slot,
        contentType,
      });
      const content = cleanContent(imported, slot);
      if (!content) throw new Error("导入结果不是有效的 Room 内容");
      setStatus("素材已选择，保存后写入 room.json");
      return content;
    } catch (e) {
      setStatus(`素材导入失败：${e}`);
      return null;
    }
  }

  async function setGraphNodeContent(nodeId: string, contentType: ContentType) {
    const isStart = nodeId === "start";
    const deskIndex = isStart ? -1 : Number(nodeId.slice(1));
    if (!isStart && (!Number.isInteger(deskIndex) || !desks[deskIndex])) return;
    const content = await pickRoomContent(isStart ? "start" : "background", contentType);
    if (!content) return;
    pushHistory();
    touch();
    if (isStart) {
      setHasStart(true);
      setStartContent({ ...content, name: startName.trim() || content.name });
    } else {
      setDesks((prev) =>
        prev.map((desk, index) => index === deskIndex ? { ...desk, background: content } : desk)
      );
    }
  }

  async function setEdgeContent(edgeId: string, contentType: ContentType) {
    const content = await pickRoomContent("switch", contentType);
    if (!content) return;
    pushHistory();
    touch();
    setEdges((prev) => prev.map((edge) => edge.id === edgeId ? { ...edge, trans: content } : edge));
  }

  function clearBackground() {
    touch();
    setDesks((prev) =>
      prev.map((d, i) => (i === activeDesk ? { ...d, background: null } : d))
    );
  }

  async function changeTransition(value: string) {
    if (value !== "video") {
      touch();
      setTransition(value as TransitionPreset);
      return;
    }
    const content = await pickRoomContent("switch", "video");
    if (!content) return;
    touch();
    setTransition(content);
  }

  function toggleDeskApp(app: AppInfo, deskIndex = activeDesk) {
    const targetDesk = desks[deskIndex];
    if (!targetDesk) return;
    const alreadyAdded = targetDesk.icons.some((icon) => icon.launch.target === app.target);
    touch();
    setDesks((prev) =>
      prev.map((d, i) => {
        if (i !== deskIndex) return d;
        const has = d.icons.some((x) => x.launch.target === app.target);
        return {
          ...d,
          icons: has
            ? d.icons.filter((x) => x.launch.target !== app.target)
            : [...d.icons, { label: app.name, icon_png: app.icon_png, launch: { target: app.target, args: app.arguments, workdir: app.working_dir } }],
        };
      })
    );
    setStatus(
      alreadyAdded
        ? `已从 ${targetDesk.name} 移除 ${app.name}`
        : `已将 ${app.name} 放入 ${targetDesk.name}；可在桌面长按图标拖动位置`
    );
  }

  function removeIcon(target: string) {
    touch();
    setDesks((prev) =>
      prev.map((d, i) =>
        i === activeDesk ? { ...d, icons: d.icons.filter((x) => x.launch.target !== target) } : d
      )
    );
  }

  function addDesk() {
    const newIndex = desks.length;
    const nextDesks = [...desks, newDesk(newIndex)];
    pushHistory();
    touch();
    setDesks(nextDesks);
    setEdges((current) => reconcileGraphEdges(current, nextDesks, hasStart, startDesk));
    setActiveDesk(newIndex);
    setGraphSel(`d${newIndex}`);
  }

  function removeDesk(i: number) {
    if (desks.length === 1) return;
    pushHistory();
    const next = deleteDeskGraph<Desk, Transition>({
      desks,
      edges,
      deleteIndex: i,
      startDesk,
      activeDesk,
      graphSelection: graphSel,
      hasStart,
    });
    touch();
    setDesks(next.desks);
    setEdges(next.edges);
    setStartDesk(next.startDesk);
    setActiveDesk(next.activeDesk);
    setGraphSel(next.graphSelection);
    setStatus("Desk 已删除；新形成的相邻方向需要单独补充 switch");
  }

  const desk = desks[activeDesk];
  const measuredDeskHeights = Object.entries(geom.nodes)
    .filter(([id]) => id.startsWith("d"))
    .map(([, rect]) => rect.height);
  const graphRowHeight = Math.max(56, ...measuredDeskHeights) + GRAPH_ROW_GAP;
  const graphMinHeight = Math.max(240, (desks.length + 1) * graphRowHeight);
  /* header controls (room select / 新建 / 另存为 / 库路径 / 转场 / 保存 / 应用) removed from UI;
     functions kept here until the Room view re-homes them */
  void [
    newRoom,
    saveAs,
    changeLib,
    changeTransition,
    transitionLabel,
    applyCurrent,
    removeDesk,
    clearBackground,
    removeIcon,
    bgLabel,
    renaming,
    setRenaming,
    desk,
    touch,
  ];
  const heroRoom =
    rooms.find((r) => r.path === heroPath) ??
    rooms.find((r) => r.path === appliedRoom) ??
    rooms[0] ??
    null;
  const roomActionPaths = roomMultiMode
    ? [...selectedRooms]
    : heroRoom
      ? [heroRoom.path]
      : [];
  const pickedRoom =
    rooms.find((r) => r.path === roomPickPath) ??
    rooms.find((r) => r.path === appliedRoom) ??
    rooms[0] ??
    null;
  function addMockRoom() {
    let n = rooms.length + 1;
    while (rooms.some((r) => r.name === `new-room-${n}`)) n++;
    const name = `new-room-${n}`;
    const room: RoomInfo = { name, path: `C:\\mock\\${name}`, desks: 1, icons: 0, covers: [] };
    setRooms([...rooms, room]);
    setRoomPickPath(room.path);
  }
  async function addRoomFromList() {
    if (!IS_TAURI) {
      addMockRoom();
      return;
    }
    const path = await newRoom();
    if (!path) return;
    setRoomPickPath(path);
    setRoomEntered(true);
  }
  function toggleRoomSelection(path: string) {
    setSelectedRooms((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  function selectRoom(room: RoomInfo) {
    if (roomBusy) return;
    setHeroPath(room.path);
    if (roomMultiMode) {
      toggleRoomSelection(room.path);
    }
  }
  async function applyRoomFromCard(room: RoomInfo) {
    if (roomBusy || roomMultiMode || room.path === appliedRoom) return;
    setHeroPath(room.path);
    await applyRoomDir(room.path);
  }
  async function enterRoomEditor(room: RoomInfo) {
    const opened = await openRoom(room.path);
    if (!opened) return;
    setRoomPickPath(room.path);
    setEditNav("room");
    setRoomEntered(true);
    setMode("edit");
  }
  async function stopWallpaper() {
    if (roomOperationRef.current || roomBusy) return;
    if (!IS_TAURI) {
      setAppliedRoom(null);
      setStatus("壁纸已停止（UI 设计模式）");
      return;
    }
    if (!coreIdentity) return;
    roomOperationRef.current = true;
    setRoomBusy("正在停止壁纸…");
    try {
      await invoke("stop_wallpapers");
      setAppliedRoom(null);
      setStatus("壁纸已停止，Dext Core 保持连接");
    } catch (error) {
      setStatus(`停止壁纸失败：${String(error)}`);
    } finally {
      roomOperationRef.current = false;
      setRoomBusy(null);
    }
  }
  async function importRooms() {
    if (!IS_TAURI) {
      addMockRoom();
      return;
    }
    const picked = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Dext Room", extensions: ["zip"] }],
    });
    const archives = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (!archives.length) return;
    setRoomBusy(`正在导入 0 / ${archives.length}`);
    let imported = 0;
    try {
      for (let index = 0; index < archives.length; index += 1) {
        const archivePath = archives[index];
        setRoomBusy(`正在导入 ${index + 1} / ${archives.length}`);
        try {
          await invoke<string>("import_room_zip", {
            libraryDir: libDir,
            archivePath,
            requestedName: null,
          });
        } catch (error) {
          const message = String(error);
          if (!message.includes("already exists")) throw error;
          const fallback = archivePath.split(/[\\/]/).pop()?.replace(/\.zip$/i, "") ?? "imported-room";
          const renamed = prompt(`Room「${fallback}」已存在，请输入新名称`, `${fallback}-copy`);
          if (!renamed) continue;
          await invoke<string>("import_room_zip", {
            libraryDir: libDir,
            archivePath,
            requestedName: renamed,
          });
        }
        imported += 1;
      }
      const next = await refreshRooms(libDir);
      if (next.length) setHeroPath(next[next.length - 1].path);
      setStatus(`已安全导入 ${imported} 个 Room`);
    } catch (error) {
      setStatus(`Room 导入失败：${String(error)}`);
    } finally {
      setRoomBusy(null);
    }
  }
  async function exportRooms(paths: string[]) {
    if (!IS_TAURI || !paths.length) return;
    const items = paths.map((path) => rooms.find((room) => room.path === path)).filter(Boolean) as RoomInfo[];
    if (!items.length) return;
    setRoomBusy(`准备导出 ${items.length} 个 Room…`);
    try {
      if (items.length === 1) {
        const destination = await save({
          defaultPath: `${items[0].name}.zip`,
          filters: [{ name: "Dext Room", extensions: ["zip"] }],
        });
        if (!destination) return;
        await invoke("export_room_zip", {
          libraryDir: libDir,
          roomDir: items[0].path,
          destination,
        });
      } else {
        const destinationDir = await open({ directory: true, multiple: false });
        if (typeof destinationDir !== "string") return;
        for (let index = 0; index < items.length; index += 1) {
          setRoomBusy(`正在导出 ${index + 1} / ${items.length}`);
          await invoke("export_room_zip", {
            libraryDir: libDir,
            roomDir: items[index].path,
            destination: `${destinationDir}\\${items[index].name}.zip`,
          });
        }
      }
      setStatus(`已导出 ${items.length} 个独立 Room zip`);
    } catch (error) {
      setStatus(`Room 导出失败：${String(error)}`);
    } finally {
      setRoomBusy(null);
    }
  }
  async function deleteRooms(paths: string[]) {
    if (!paths.length) return;
    const names = paths
      .map((path) => rooms.find((room) => room.path === path)?.name)
      .filter(Boolean)
      .join("、");
    if (!confirm(`把 ${paths.length} 个 Room 移到 Windows 回收站？\n${names}`)) return;
    setRoomBusy(`准备删除 ${paths.length} 个 Room…`);
    const failures: string[] = [];
    try {
      if (appliedRoom && paths.includes(appliedRoom)) await invoke("stop_wallpapers");
      for (let index = 0; index < paths.length; index += 1) {
        setRoomBusy(`正在移到回收站 ${index + 1} / ${paths.length}`);
        try {
          await invoke("delete_room", { libraryDir: libDir, roomDir: paths[index] });
        } catch (error) {
          failures.push(`${paths[index]}：${String(error)}`);
        }
      }
      const next = await refreshRooms(libDir);
      setSelectedRooms(new Set());
      setRoomMultiMode(false);
      setHeroPath(next[0]?.path ?? null);
      setAppliedRoom((current) => current && paths.includes(current) ? null : current);
      setStatus(
        failures.length
          ? `部分删除失败：${failures.join("；")}`
          : `已把 ${paths.length} 个 Room 移到回收站`
      );
    } finally {
      setRoomBusy(null);
    }
  }
  function renameGraphNode(id: string, name: string) {
    if (id === "start") {
      setStartName(name);
      setStartContent((current) => current ? { ...current, name } : current);
    }
    else {
      const i = parseInt(id.slice(1), 10);
      setDesks((prev) => prev.map((d, xi) => (xi === i ? { ...d, name } : d)));
    }
  }
  function setEdgeTrans(edgeId: string, trans: string) {
    setEdges((prev) => prev.map((e) =>
      e.id === edgeId ? { ...e, trans: trans as TransitionPreset } : e
    ));
  }
  function changeStartDesk(nextDesk: number) {
    if (nextDesk === startDesk || nextDesk < 0 || nextDesk >= desks.length) return;
    pushHistory();
    setStartDesk(nextDesk);
    setEdges((prev) => {
      const startEdge = prev.find((edge) => edge.id === "start-in");
      if (!hasStart) return prev.filter((edge) => edge.id !== "start-in");
      if (startEdge)
        return prev.map((edge) =>
          edge.id === "start-in" ? { ...edge, to: `d${nextDesk}` } : edge
        );
      return [
        { id: "start-in", from: "start", to: `d${nextDesk}`, trans: null },
        ...prev,
      ];
    });
    touch();
    setStatus("启动目标已切换，保存后写入 startDesk");
  }
  function snapshot(): Snapshot {
    return { edges, desks: desks.map((d) => ({ ...d })), startName, hasStart, startDesk };
  }
  function applySnapshot(s: Snapshot) {
    setEdges(s.edges);
    setDesks(s.desks);
    setStartName(s.startName);
    setHasStart(s.hasStart);
    setStartDesk(s.startDesk);
    setActiveDesk((current) => Math.min(current, Math.max(0, s.desks.length - 1)));
    setGraphSel((current) => {
      if (!current || !/^d\d+$/.test(current)) return current;
      return parseInt(current.slice(1), 10) < s.desks.length ? current : null;
    });
  }
  function pushHistory() {
    setPast((p) => [...p.slice(-49), snapshot()]);
    setFuture([]);
  }
  function undo() {
    if (past.length === 0) return;
    const s = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([snapshot(), ...future]);
    applySnapshot(s);
  }
  function redo() {
    if (future.length === 0) return;
    const s = future[0];
    setFuture(future.slice(1));
    setPast([...past, snapshot()]);
    applySnapshot(s);
  }
  function onDividerDown(e: PointerEvent<HTMLDivElement>) {
    dragRef.current = { startY: e.clientY, startH: propsH };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDividerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    setPropsH(Math.min(420, Math.max(64, dragRef.current.startH + dy)));
  }
  function onDividerUp() {
    dragRef.current = null;
  }
  useEffect(() => {
    if (roomEntered) {
      setPast([]);
      setFuture([]);
      setGraphSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomEntered, roomPath]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!roomEntered || !canvas || edges.length === 0) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentCanvas = canvasRef.current;
        if (!currentCanvas) return;
        const canvasRect = currentCanvas.getBoundingClientRect();
        const nodes: Record<string, GraphNodeRect> = {};
        if (startNodeRef.current)
          nodes.start = relativeGraphRect(startNodeRef.current, canvasRect);
        desks.forEach((_, index) => {
          const id = `d${index}`;
          const node = deskNodeRefs.current.get(id);
          if (node) nodes[id] = relativeGraphRect(node, canvasRect);
        });
        const next = { width: canvasRect.width, height: canvasRect.height, nodes };
        setGeom((current) => (sameGraphGeometry(current, next) ? current : next));
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    if (startNodeRef.current) observer.observe(startNodeRef.current);
    desks.forEach((_, index) => {
      const node = deskNodeRefs.current.get(`d${index}`);
      if (node) observer.observe(node);
    });
    window.addEventListener("resize", measure);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [roomEntered, edges.length, desks.length]);
  useEffect(() => {
    if (appPickerDesk === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAppPickerDesk(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [appPickerDesk]);
  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(roomQuery.toLowerCase())
  );
  const ROOMS_PER_PAGE = 6;
  const roomPageCount = Math.max(1, Math.ceil(filteredRooms.length / ROOMS_PER_PAGE));
  const roomPageCur = Math.min(roomPage, roomPageCount);
  const pagedRooms = filteredRooms.slice(
    (roomPageCur - 1) * ROOMS_PER_PAGE,
    roomPageCur * ROOMS_PER_PAGE
  );
  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );
  const pickerDesk = appPickerDesk === null ? null : desks[appPickerDesk] ?? null;
  const tabCls = (on: boolean) =>
    `rounded px-3 py-1 text-sm whitespace-nowrap ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* top bar */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3">
        <div className="flex shrink-0 items-center gap-3">
          <h1 className="text-lg font-semibold">Dext</h1>
          <div className="flex shrink-0 rounded-md border border-border p-0.5">
            <button className={tabCls(mode === "use")} onClick={() => setMode("use")}>
              使用
            </button>
            <button className={tabCls(mode === "edit")} onClick={() => setMode("edit")}>
              编辑
            </button>
            <button className={tabCls(mode === "workshop")} onClick={() => setMode("workshop")}>
              创意工坊
            </button>
            <button className={tabCls(mode === "settings")} onClick={() => setMode("settings")}>
              设置
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`切换到${theme === "dark" ? "浅色" : "深色"}主题`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <span
            className={`rounded-full border px-2 py-1 text-xs font-medium ${
              !IS_TAURI
                ? "border-border text-muted-foreground"
                : coreIdentity
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
            title={
              !IS_TAURI
                ? "UI 设计模式未连接 Core"
                : coreIdentity
                  ? `PID ${coreIdentity.process_id}\nCore ${coreIdentity.base_directory}\nPipe ${coreIdentity.grpc_pipe_name}\nData ${coreIdentity.app_data_directory}\nIdentity ${coreIdentity.runtime_identity}`
                  : coreIdentityError ?? "正在验证 Dext Core 身份"
            }
          >
            {!IS_TAURI
              ? "Dext Core · mock"
              : coreIdentity
                ? "Dext Core 已连接"
                : coreIdentityError
                  ? coreUnavailable
                    ? "Dext Core 未运行"
                    : "Dext Core 身份拒绝"
                  : "正在验证 Dext Core"}
          </span>
          <span className="text-sm text-muted-foreground">{status}</span>
          {mode === "edit" && IS_TAURI && (
            <Button
              variant={showPreview ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setShowPreview((v) => !v);
                if (!showPreview) setEditNav("room");
              }}
            >
              预览
            </Button>
          )}
        </div>
      </header>

      {mode === "use" ? (
        <section className="flex min-h-0 flex-1 gap-5 p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <RoomToolbar
              multiMode={roomMultiMode}
              selectedCount={roomActionPaths.length}
              totalCount={filteredRooms.length}
              busy={roomBusy}
              onNew={() => void (async () => {
                if (!IS_TAURI) return addMockRoom();
                const path = await newRoom();
                if (path) setHeroPath(path);
              })()}
              onImport={() => void importRooms()}
              onToggleMulti={() => {
                if (roomMultiMode) {
                  setRoomMultiMode(false);
                  setSelectedRooms(new Set());
                } else {
                  setRoomMultiMode(true);
                  setSelectedRooms(heroRoom ? new Set([heroRoom.path]) : new Set());
                }
              }}
              onSelectAll={() => setSelectedRooms(new Set(filteredRooms.map((room) => room.path)))}
              onClear={() => setSelectedRooms(new Set())}
              onExport={() => void exportRooms(roomActionPaths)}
              onDelete={() => void deleteRooms(roomActionPaths)}
            />
            <Input
              placeholder="搜索 Room"
              value={roomQuery}
              onChange={(event) => {
                setRoomQuery(event.target.value);
                setRoomPage(1);
              }}
            />
            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-x-4 gap-y-5 overflow-y-auto pr-2 xl:grid-cols-3">
              {pagedRooms.map((room) => {
                const focused = room.path === heroRoom?.path;
                const active = room.path === appliedRoom;
                const picked = selectedRooms.has(room.path);
                return (
                  <button
                    key={room.path}
                    disabled={Boolean(roomBusy)}
                    onClick={() => selectRoom(room)}
                    onDoubleClick={() => void applyRoomFromCard(room)}
                    title={roomMultiMode ? "单击选择" : "单击查看详情，双击应用"}
                    aria-pressed={roomMultiMode ? picked : focused}
                    className={`group overflow-hidden text-left transition-opacity disabled:cursor-wait ${
                      roomMultiMode && !picked ? "opacity-60 hover:opacity-100" : "opacity-100"
                    }`}
                  >
                    <div className={`relative aspect-video overflow-hidden rounded-lg border-2 ${
                      picked || focused ? "border-primary" : "border-transparent group-hover:border-border"
                    }`}>
                      <CoverStack tiles={roomCovers(room)} />
                      {roomMultiMode && (
                        <span className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                          picked ? "border-primary bg-primary text-primary-foreground" : "border-white/70 bg-black/30 text-white"
                        }`}>
                          {picked ? "✓" : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{room.name}</span>
                          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="正在使用" />}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{room.desks} Desk · {room.icons} 图标</div>
                      </div>
                      {active && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">使用中</span>}
                    </div>
                  </button>
                );
              })}
              {rooms.length === 0 && (
                <div className="col-span-full py-20 text-center text-sm text-muted-foreground">
                  Room 库为空。使用“新增”创建，或导入一个安全的 Room zip。
                </div>
              )}
              {rooms.length > 0 && filteredRooms.length === 0 && (
                <div className="col-span-full py-20 text-center text-sm text-muted-foreground">
                  没有匹配“{roomQuery}”的 Room
                </div>
              )}
            </div>
            {roomPageCount > 1 && (
              <div className="flex items-center gap-1 border-t border-border pt-3">
                <Button variant="ghost" size="icon-sm" disabled={roomPageCur === 1} title="第一页" onClick={() => setRoomPage(1)}><ChevronsLeft /></Button>
                <Button variant="ghost" size="icon-sm" disabled={roomPageCur === 1} title="上一页" onClick={() => setRoomPage(roomPageCur - 1)}><ChevronLeft /></Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">{roomPageCur} / {roomPageCount}</span>
                <Button variant="ghost" size="icon-sm" disabled={roomPageCur === roomPageCount} title="下一页" onClick={() => setRoomPage(roomPageCur + 1)}><ChevronRight /></Button>
                <span className="ml-auto text-xs text-muted-foreground">共 {filteredRooms.length} 个 Room</span>
              </div>
            )}
          </div>

          <aside className="flex w-[360px] shrink-0 flex-col border-l border-border pl-5">
            {heroRoom ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <RoomBackgroundPreview room={heroRoom} className="rounded-lg" label={`${heroRoom.name} 背景预览`} />
                <div className="mt-5 flex items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{heroRoom.name}</h2>
                  {heroRoom.path === appliedRoom && (
                    <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">使用中</span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-3 border-y border-border py-4 text-xs">
                  <div><dt className="text-muted-foreground">Desk</dt><dd className="mt-0.5 font-medium">{heroRoom.desks}</dd></div>
                  <div><dt className="text-muted-foreground">图标</dt><dd className="mt-0.5 font-medium">{heroRoom.icons}</dd></div>
                  <div className="col-span-2"><dt className="text-muted-foreground">源目录</dt><dd className="mt-0.5 truncate font-mono" title={heroRoom.path}>{heroRoom.path}</dd></div>
                </dl>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                  <Button
                    variant="outline"
                    disabled={Boolean(roomBusy)}
                    onClick={() => void enterRoomEditor(heroRoom)}
                  >
                    <Pencil className="h-4 w-4" /> 编辑
                  </Button>
                  <Button
                    variant={heroRoom.path === appliedRoom ? "outline" : "default"}
                    disabled={Boolean(roomBusy) || (IS_TAURI && !coreIdentity)}
                    title={IS_TAURI && !coreIdentity ? "Dext Core 未连接，仍可浏览本地 Room" : undefined}
                    onClick={() => heroRoom.path === appliedRoom ? void stopWallpaper() : void applyRoomDir(heroRoom.path)}
                  >
                    {heroRoom.path === appliedRoom ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {heroRoom.path === appliedRoom ? "停止壁纸" : "应用此 Room"}
                  </Button>
                  {!coreIdentity && IS_TAURI && <p className="col-span-2 mt-1 text-xs text-destructive">Dext Core 未连接；Room 浏览和文件管理仍可使用。</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">选择一个 Room 查看详情</div>
            )}
          </aside>
        </section>
      ) : mode === "edit" ? (
        /* ===== edit mode ===== */
        <div className="flex min-h-0 flex-1">
          {/* edit nav sidebar (collapsible) */}
          <aside
            className={`flex shrink-0 flex-col border-r border-border py-2 transition-all ${
              navOpen ? "w-44 px-2" : "w-12 items-center px-1"
            }`}
          >
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              title={navOpen ? "折叠侧栏" : "展开侧栏"}
            >
              {navOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
            <nav className="flex flex-col gap-1">
              {(
                [
                  ["room", "Room", FolderOpen],
                  ["library", "应用库", LayoutGrid],
                  ["dock", "Dock", Dock],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => {
                    setEditNav(key);
                    if (key === "room") setRoomEntered(false);
                  }}
                  title={label}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${
                    editNav === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  } ${navOpen ? "" : "justify-center"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {navOpen && <span className="whitespace-nowrap">{label}</span>}
                </button>
              ))}
            </nav>
          </aside>

          {/* content: library / room(preview) */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {showPreview ? (
              <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
                <iframe
                  ref={previewRef}
                  src="http://dext.localhost/index.html?preview=1"
                  onLoad={postRoom}
                  title="Room 预览"
                  className="aspect-video w-full max-w-4xl rounded-lg border border-border"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  实时预览 · 只使用内存中的 room.json v1 草稿，不写源文件或运行包
                </p>
              </div>
            ) : editNav === "library" ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      libSource === "custom"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={libSource === "custom" ? "library.json（可增删）" : "在线枚举（未持久化）"}
                  >
                    {libSource === "custom" ? "手动库" : "自动扫描"}
                  </span>
                  <Button variant="outline" size="sm" className="h-7" onClick={manualAdd}>
                    + 添加
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    disabled={!selected.size}
                    onClick={() => void deleteFromLibrary()}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" onClick={scanMerge}>
                    扫描合并
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">已选 {selected.size} 项供删除</span>
                </div>
                <Input
                  placeholder="搜索应用..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-6 gap-2 overflow-y-auto pr-1">
                  {apps.length === 0 && (
                    <div className="col-span-6 py-16 text-center text-sm text-muted-foreground">
                      库为空——点「扫描合并」一键读取开始菜单，或「+ 添加」手动加入 lnk/exe
                    </div>
                  )}
                  {filtered.map((app) => {
                    const on = desk.icons.some((x) => x.launch.target === app.target);
                    const picked = selected.has(app.target);
                    return (
                      <div
                        key={app.source + app.target}
                        className={`relative rounded-lg border transition-colors ${picked ? "border-destructive/60" : on ? "border-primary" : "border-transparent"}`}
                      >
                        <button
                          onClick={() => toggleDeskApp(app)}
                          className={`flex h-full w-full flex-col items-center gap-1.5 rounded-lg p-3 ${on ? "bg-primary/10" : "hover:bg-accent"}`}
                          title={`${app.target}\n单击${on ? "从" : "加入"}当前 Desk`}
                        >
                          <AppIcon app={app} />
                          <span className="line-clamp-2 text-center text-xs leading-tight">{app.name}</span>
                          {on && <span className="absolute right-1.5 top-1.5 text-[10px] font-bold text-primary">Desk ✓</span>}
                        </button>
                        <button
                          type="button"
                          aria-label={`${picked ? "取消选择" : "选择删除"} ${app.name}`}
                          aria-pressed={picked}
                          onClick={() => toggleSelect(app)}
                          className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border text-[10px] ${picked ? "border-destructive bg-destructive text-white" : "border-border bg-background/90 text-muted-foreground"}`}
                        >
                          {picked ? "✓" : ""}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : editNav === "dock" ? (
              <DockLibrary
                presets={dockPresets}
                onImport={importDockPreset}
                onSave={saveDockPreset}
              />
            ) : editNav === "room" && !roomEntered ? (
              /* room list + WE-style detail panel */
              <div className="flex min-h-0 flex-1 gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="text-sm text-muted-foreground">
                    选择房间查看详情；「编辑」进入 Desk 编辑
                  </div>
                  <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 content-start gap-3 overflow-y-auto pr-1">
                    {rooms.map((r) => (
                      <button
                        key={r.path}
                        onClick={() => setRoomPickPath(r.path)}
                        className={`overflow-hidden rounded-xl border text-left transition-colors ${
                          pickedRoom && r.path === pickedRoom.path
                            ? "border-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="aspect-video w-full">
                          <CoverStack tiles={roomCovers(r)} />
                        </div>
                        <div className="p-3">
                          <div className="truncate text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.desks} Desk · {r.icons} 图标
                          </div>
                        </div>
                      </button>
                    ))}
                    {rooms.length === 0 && (
                      <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
                        房间库为空——点下方「新增 Room」创建一个吧
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end border-t border-border pt-3">
                    <Button variant="outline" onClick={addRoomFromList}>
                      <Plus className="h-4 w-4" /> 新增 Room
                    </Button>
                  </div>
                </div>

                {pickedRoom && (
                  <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border pl-4">
                    <RoomBackgroundPreview room={pickedRoom} className="rounded-lg" label={`${pickedRoom.name} 背景预览`} />
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-medium">{pickedRoom.name}</span>
                        {pickedRoom.path === appliedRoom && (
                          <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-medium text-white">
                            应用中
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {pickedRoom.desks} Desk · {pickedRoom.icons} 图标
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => void enterRoomEditor(pickedRoom)}
                      >
                        编辑
                      </Button>
                      <Button
                        className="flex-1"
                        variant={pickedRoom.path === appliedRoom ? "secondary" : "outline"}
                        disabled={Boolean(roomBusy) || (IS_TAURI && !coreIdentity)}
                        title={IS_TAURI && !coreIdentity ? "Dext Core 未连接" : undefined}
                        onClick={() => void applyRoomDir(pickedRoom.path)}
                      >
                        {pickedRoom.path === appliedRoom ? "重新应用" : "应用"}
                      </Button>
                    </div>
                  </aside>
                )}
              </div>
            ) : (
              /* entered a room: desk editing */
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setRoomEntered(false)}>
                    ← 房间列表
                  </Button>
                  <span className="text-sm font-medium">
                    {roomPath?.split("\\").pop() ?? "（未选房间）"}
                  </span>
	                  {dirty && <span className="text-xs font-medium text-amber-500">● 未保存</span>}
	                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
	                    <Button size="sm" className="font-semibold shadow-sm" onClick={addDesk}>
	                      <Plus className="h-3.5 w-3.5" /> 新增 Desk
	                    </Button>
	                    <Button variant="outline" size="sm" disabled={past.length === 0} onClick={undo}>
                      <Undo2 className="h-3.5 w-3.5" /> 撤回
                    </Button>
                    <Button variant="outline" size="sm" disabled={future.length === 0} onClick={redo}>
                      <Redo2 className="h-3.5 w-3.5" /> 重做
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (IS_TAURI) await saveRoom();
                        else {
                          setDirty(false);
                          setStatus("已保存（mock，未写盘）");
                        }
                      }}
                    >
                      <Save className="h-3.5 w-3.5" /> 保存
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (IS_TAURI) saveAs();
                        else setStatus("另存为请在桌面配置器中使用");
                      }}
                    >
                      另存为
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={IS_TAURI && !coreIdentity}
                      title={IS_TAURI && !coreIdentity ? "Dext Core 未连接" : undefined}
                      onClick={applyCurrent}
                    >
                      <Play className="h-3.5 w-3.5" /> 应用
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={desks.length <= 1 || !desks[activeDesk]}
                      onClick={() => {
                        const current = desks[activeDesk];
                        if (current && confirm(`删除「${current.name}」？此操作可用撤销恢复。`)) removeDesk(activeDesk);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 删除 Desk
                    </Button>
                  </div>
                </div>
                <details className="shrink-0 rounded-lg border border-border bg-background">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                    当前 Room Dock · {dockSkinName(roomCss)}
                  </summary>
                  <div className="max-h-[58vh] space-y-3 overflow-y-auto border-t border-border p-3">
                    <RoomDockPicker
                      presets={dockPresets}
                      activePreset={dockSkinName(roomCss)}
                      onApplyPreset={applyDockPreset}
                    />
                    <div className="border-t border-border pt-3">
                    <DockEditor
                      dock={dock}
                      setDock={setDock}
                      apps={apps}
                      desks={desks}
                      setDesks={setDesks}
                      activeDesk={activeDesk}
                      touch={touch}
                      setStatus={setStatus}
                    />
                    </div>
                  </div>
                </details>
                {edges.length > 0 ? (
                  <>
                    {/* 上：Room 结构思维导图（Desk 对视觉上合并为一条双向线） */}
	                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20">
	                      <div
	                        ref={canvasRef}
	                        data-testid="graph-canvas"
	                        className="relative h-full w-full"
	                        style={{ minHeight: graphMinHeight, minWidth: 720 }}
	                      >
	                        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
	                          <defs>
                            <marker
                              id="garrow"
                              viewBox="0 0 10 10"
                              refX="9"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M0,0L10,5L0,10z" fill="currentColor" />
	                            </marker>
	                          </defs>
	                          {visualGraphEdges(edges).map((edge) => {
	                            const segments = routeGraphEdge(edge, geom.nodes);
	                            const bidirectional = edge.from !== "start" && edge.to !== "start";
	                            return (
	                              <g key={edge.id} data-graph-edge={edge.id} className="text-foreground/60">
	                                {segments.map((segment, index) => (
	                                  <line
	                                    key={index}
	                                    {...segment}
	                                    fill="none"
	                                    stroke="currentColor"
	                                    strokeWidth={2.2}
	                                    strokeLinecap="round"
	                                    vectorEffect="non-scaling-stroke"
	                                    markerStart={
	                                      bidirectional && index === 0 ? "url(#garrow)" : undefined
	                                    }
	                                    markerEnd={index === segments.length - 1 ? "url(#garrow)" : undefined}
	                                  />
	                                ))}
	                              </g>
	                            );
	                          })}
	                        </svg>
	                        {/* switch 标记（每条双向视觉线一个） */}
	                        {visualGraphEdges(edges)
	                          .filter((edge) => edge.from !== "start" && edge.to !== "start")
	                          .map((e) => {
	                          const k = pairKey(e);
	                          const position = graphSwitchPosition(e, geom.nodes);
	                          if (!position) return null;
	                          return (
	                            <button
	                              key={k}
	                              data-graph-switch={k}
	                              onClick={() => setGraphSel(k)}
	                              style={{ left: position.left, top: position.top }}
                              className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] transition-colors ${
                                graphSel === k
                                  ? "border-primary bg-primary/10 font-medium text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              <ArrowRightLeft className="h-3 w-3" /> switch
                            </button>
                          );
	                          })}
	                        {/* 启动画面主节点 */}
	                        <button
	                          ref={startNodeRef}
	                          data-graph-node="start"
	                          title={startName}
	                          onClick={() => setGraphSel("start")}
                          className={`absolute left-[3%] top-1/2 z-10 flex w-[11%] min-w-24 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border-2 py-3 transition-colors ${
                            graphSel === "start"
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
	                        >
	                          <MonitorPlay className="h-5 w-5 text-primary" />
	                          <span className="w-full truncate px-1 text-xs font-medium">{startName}</span>
	                          <span
	                            aria-hidden="true"
	                            className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
	                          />
	                        </button>
                        {/* Desk 矩形节点（desks[0] = 主 Desk，启动后第一个看到） */}
                        {desks.map((d, i) => {
                          const y = ((i + 1) / (desks.length + 1)) * 100;
                          const active = graphSel === `d${i}`;
                          return (
	                            <button
	                              key={i}
	                              ref={(node) => {
	                                const id = `d${i}`;
	                                if (node) deskNodeRefs.current.set(id, node);
	                                else deskNodeRefs.current.delete(id);
	                              }}
	                              data-graph-node={`d${i}`}
	                              title={d.name}
	                              onClick={() => {
                                setGraphSel(`d${i}`);
                                setActiveDesk(i);
                              }}
                              style={{ left: "40%", top: `${y}%` }}
	                              className={`absolute z-10 max-w-[42%] -translate-y-1/2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                                active
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/50"
                              }`}
                            >
	                              <div className="truncate whitespace-nowrap text-sm font-medium">{d.name}</div>
	                              <div className="text-[10px] text-muted-foreground">
	                                {i === 0 ? "主 Desk" : `Desk ${i + 1}`} · {d.icons.length} 图标
	                              </div>
	                              <span
	                                aria-hidden="true"
	                                className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
	                              />
	                              {i > 0 && (
	                                <span
	                                  aria-hidden="true"
	                                  className="pointer-events-none absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background"
	                                />
	                              )}
	                              {i < desks.length - 1 && (
	                                <span
	                                  aria-hidden="true"
	                                  className="pointer-events-none absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background"
	                                />
	                              )}
	                              {desks.length > 2 && (i === 0 || i === desks.length - 1) && (
	                                <span
	                                  aria-hidden="true"
	                                  className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
	                                />
	                              )}
	                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* 可拖动分隔条 */}
                    <div
                      onPointerDown={onDividerDown}
                      onPointerMove={onDividerMove}
                      onPointerUp={onDividerUp}
                      className="h-1.5 shrink-0 cursor-row-resize rounded bg-border transition-colors hover:bg-primary/60"
                    />
                    {/* 下：属性栏 */}
                    <div
                      className="flex shrink-0 items-center gap-5 overflow-x-auto rounded-lg border border-border px-4 py-2.5"
                      style={{ height: propsH }}
                    >
                      {!graphSel ? (
                        <div className="w-full text-center text-sm text-muted-foreground">
                          点击上方节点或 switch 连线，在这里编辑属性
                        </div>
                      ) : graphSel === "start" || /^d\d+$/.test(graphSel) ? (
                        (() => {
                          const isStart = graphSel === "start";
                          const deskIndex = isStart ? -1 : parseInt(graphSel.slice(1), 10);
                          const name = isStart
                            ? startName
                            : (desks[deskIndex]?.name ?? "");
                          const content = isStart ? startContent : desks[deskIndex]?.background ?? null;
                          return (
                            <>
                              {!isStart && (
                                <DeskBackgroundCanvas
                                  desks={desks}
                                  roomPath={roomPath}
                                  selectedIndex={deskIndex}
                                  onSelect={(index) => {
                                    setActiveDesk(index);
                                    setGraphSel(`d${index}`);
                                  }}
                                />
                              )}
                              <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                {isStart ? (
                                  <MonitorPlay className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                                )}
                                {isStart ? "启动画面" : "Desk"}
                              </span>
                              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                改名
                                <Input
                                  value={name}
                                  onFocus={pushHistory}
                                  onChange={(ev) => renameGraphNode(graphSel, ev.target.value)}
                                  className="h-8 w-44"
                                />
	                              </label>
	                              {isStart && (
	                                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
	                                  连接到
	                                  <select
	                                    aria-label="启动画面连接到"
	                                    value={startDesk}
	                                    onChange={(event) => changeStartDesk(Number(event.target.value))}
	                                    className="h-8 min-w-36 rounded-md border border-border bg-background px-2 text-sm text-foreground"
	                                  >
	                                    {desks.map((item, index) => (
	                                      <option key={index} value={index}>
	                                        {item.name || `Desk ${index + 1}`}
	                                      </option>
	                                    ))}
	                                  </select>
	                                </label>
	                              )}
	                              {!isStart && (
	                                <Button
	                                  size="sm"
	                                  onClick={() => {
	                                    setActiveDesk(deskIndex);
	                                    setAppPickerDesk(deskIndex);
	                                    setStatus(`选择要放入 ${desks[deskIndex]?.name ?? "当前 Desk"} 的应用`);
	                                  }}
	                                >
	                                  <Plus className="h-3.5 w-3.5" /> 放入应用
	                                </Button>
	                              )}
	                              {isStart ? (
	                                <ContentInspector
	                                  content={content}
	                                  roomPath={roomPath}
	                                  emptyLabel="尚未选择启动画面"
	                                />
	                              ) : (
	                                <dl className="w-44 shrink-0 space-y-1 text-[11px]">
	                                  <div><dt className="text-muted-foreground">当前素材</dt><dd className="truncate font-medium" title={content?.name}>{content?.name ?? "未选择"}</dd></div>
	                                  <div><dt className="text-muted-foreground">路径</dt><dd className="truncate font-mono" title={content?.src}>{content?.src ?? "—"}</dd></div>
	                                </dl>
	                              )}
	                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {isStart ? "画面素材：" : "壁纸素材："}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="选择图片"
                                  onClick={() => void setGraphNodeContent(graphSel, "image")}
                                >
                                  <span className={`h-2 w-2 rounded-full ${content?.type === "image" ? "bg-primary" : "bg-muted-foreground/35"}`} /> 图片
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="选择自包含 HTML 文件"
                                  onClick={() => void setGraphNodeContent(graphSel, "html")}
                                >
                                  <span className={`h-2 w-2 rounded-full ${content?.type === "html" ? "bg-primary" : "bg-muted-foreground/35"}`} /> HTML
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="选择视频"
                                  onClick={() => void setGraphNodeContent(graphSel, "video")}
                                >
                                  <span className={`h-2 w-2 rounded-full ${content?.type === "video" ? "bg-primary" : "bg-muted-foreground/35"}`} /> 视频
                                </Button>
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        edges
                          .filter((e) => pairKey(e) === graphSel)
                          .map((e) => {
                            const nameOf = (id: string) =>
                              id === "start"
                                ? startName
                                : (desks[parseInt(id.slice(1), 10)]?.name ?? id);
                            const content = typeof e.trans === "object" ? e.trans : null;
                            return (
                              <div key={e.id} className="flex shrink-0 items-center gap-4 border-r border-border pr-5 text-xs text-muted-foreground last:border-r-0">
                                <div className="w-36 shrink-0">
                                  <div className="font-medium text-foreground">{nameOf(e.from)} → {nameOf(e.to)}</div>
                                  <div className="mt-1">{e.trans ? transitionLabel(e.trans) : "需要补充切换"}</div>
                                </div>
                                <ContentInspector content={content} roomPath={roomPath} emptyLabel={typeof e.trans === "string" ? `内置效果：${transitionLabel(e.trans)}` : "尚未选择切换内容"} />
                                <div className="flex w-44 shrink-0 flex-wrap gap-1.5">
                                  {(["image", "video", "html"] as ContentType[]).map((type) => (
                                    <Button key={type} variant="outline" size="sm" onClick={() => void setEdgeContent(e.id, type)}>
                                      <span className={`h-2 w-2 rounded-full ${content?.type === type ? "bg-primary" : "bg-muted-foreground/35"}`} />
                                      {type === "image" ? "图片" : type === "video" ? "视频" : "HTML"}
                                    </Button>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      pushHistory();
                                      setEdgeTrans(e.id, "slide");
                                      touch();
                                    }}
                                  >
                                    <span className={`h-2 w-2 rounded-full ${typeof e.trans === "string" ? "bg-primary" : "bg-muted-foreground/35"}`} /> 内置效果
                                  </Button>
                                  {typeof e.trans === "string" && (
                                    <select
                                      aria-label={`${nameOf(e.from)} 到 ${nameOf(e.to)}的内置效果`}
                                      value={e.trans}
                                      onChange={(event) => {
                                        pushHistory();
                                        setEdgeTrans(e.id, event.target.value);
                                        touch();
                                      }}
                                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                    >
                                      {TRANSITION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <p>Desk 编辑区（改造中）</p>
                    <p className="text-xs">
                      Desk 管理 / 背景 / 图标尺寸先沿用左侧栏，下一轮重排
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      ) : mode === "workshop" ? (
        <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border text-primary">
            <Film className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">创意工坊，敬请期待</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            未来这里会承接 Room 的发现、下载与订阅；真实服务上线前不提供无效的上传、登录或搜索入口。
          </p>
        </section>
      ) : (
        <SettingsPage
          theme={theme}
          setTheme={setTheme}
          libDir={libDir}
          onChangeLib={(path) => void changeLib(path)}
          coreIdentity={coreIdentity}
          setStatus={setStatus}
        />
      )}
      {pickerDesk && appPickerDesk !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setAppPickerDesk(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-picker-title"
            className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id="app-picker-title" className="text-base font-semibold">
                  放入应用 · {pickerDesk.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  点击应用即可加入或移出；加入后可在桌面长按图标拖动位置。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAppPickerDesk(null)}>
                完成
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {apps.length === 0 ? (
                <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
                  还没有可用应用。请先关闭此窗口，再到侧栏“应用库”添加或扫描应用。
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 md:grid-cols-5">
                  {apps.map((app) => {
                    const on = pickerDesk.icons.some((icon) => icon.launch.target === app.target);
                    return (
                      <button
                        key={app.source + app.target}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDeskApp(app, appPickerDesk)}
                        className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-colors ${
                          on
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-muted/45 hover:border-border hover:bg-accent"
                        }`}
                        title={`${app.target}\n单击${on ? "移出" : "加入"} ${pickerDesk.name}`}
                      >
                        <AppIcon app={app} />
                        <span className="line-clamp-2 text-xs leading-tight">{app.name}</span>
                        {on && (
                          <span className="absolute right-2 top-2 text-[10px] font-semibold text-primary">
                            已加入 ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
