import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Code,
  Dock,
  Film,
  FolderOpen,
  Image,
  LayoutGrid,
  MonitorPlay,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Redo2,
  Save,
  Share2,
  Sun,
  Undo2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppInfo {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
  source: string;
}

interface RoomIcon {
  label: string;
  icon_png: string;
  launch: { target: string; args: string; workdir: string };
  x?: number;
  y?: number;
}

type Background = string | { type: "video"; src: string } | null;

interface Desk {
  name: string;
  background: Background;
  icons: RoomIcon[];
  iconSize?: string;
}

function bgLabel(bg: Background): string {
  if (!bg) return "黑底（未设置）";
  if (typeof bg === "string") return bg;
  return `🎬 视频 ${bg.src}`;
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

type EditNav = "library" | "room" | "dock";

/* ---- room 思维导图 ----
   拓扑：启动画面 → 主 Desk 直连（无 switch）；switch 只存在于相邻 desk 之间（一来一回）。
   主 Desk = 启动后默认看到的第一个 desk，即 desks[0]。 */
type GEdge = { id: string; from: string; to: string; trans: string };
type Snapshot = { edges: GEdge[]; desks: Desk[]; startName: string; hasStart: boolean };

const TRANSITION_OPTIONS: [string, string][] = [
  ["slide", "滑动"],
  ["fade", "淡入淡出"],
  ["zoom", "缩放"],
  ["flip", "翻转"],
  ["none", "无"],
  ["code", "代码"],
  ["video", "视频"],
];

function seedEdges(ds: Desk[], hasStart: boolean): GEdge[] {
  const edges: GEdge[] = [];
  if (hasStart && ds.length > 0)
    edges.push({ id: "start-in", from: "start", to: "d0", trans: "slide" });
  for (let i = 1; i < ds.length; i++) {
    edges.push(
      { id: `s${i}f`, from: `d${i - 1}`, to: `d${i}`, trans: "slide" },
      { id: `s${i}b`, from: `d${i}`, to: `d${i - 1}`, trans: "fade" }
    );
  }
  return edges;
}

function pairKey(e: GEdge): string {
  return [e.from, e.to].sort().join("|");
}

const DEFAULT_LIB = "D:\\midDOW\\lively-core-separation\\rooms";

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
    background: "",
    iconSize: "medium",
    icons: MOCK_APPS.slice(0, 6).map((a, i) => ({
      label: a.name,
      icon_png: a.icon_png,
      launch: { target: a.target, args: "", workdir: "" },
      x: i % 4,
      y: Math.floor(i / 4),
    })),
  },
  { name: "游戏", background: "", iconSize: "large", icons: [] },
];

function newDesk(index: number): Desk {
  return { name: `Desk ${index + 1}`, background: "", icons: [] };
}

function AppIcon({ app, size = "h-10 w-10" }: { app: AppInfo; size?: string }) {
  return app.icon_png ? (
    <img src={`data:image/png;base64,${app.icon_png}`} alt="" className={size} />
  ) : (
    <div className={`${size} rounded bg-muted`} />
  );
}

type Transition = string | { type: "video"; src: string };

function transitionLabel(t: Transition): string {
  if (typeof t === "string") {
    return { slide: "滑动", fade: "淡入", zoom: "缩放", none: "无" }[t] ?? t;
  }
  return "🎬 视频转场";
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

export default function App() {
  const [mode, setMode] = useState<Mode>("use");
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [desks, setDesks] = useState<Desk[]>([newDesk(0)]);
  const [activeDesk, setActiveDesk] = useState(0);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [status, setStatus] = useState("loading...");
  const [libDir, setLibDir] = useState(
    () => localStorage.getItem("dext.libDir") ?? DEFAULT_LIB
  );
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [roomPath, setRoomPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [appliedRoom, setAppliedRoom] = useState<string | null>(() =>
    localStorage.getItem("dext.appliedRoom")
  );
  const [showPreview, setShowPreview] = useState(false);
  const [transition, setTransition] = useState<Transition>("slide");
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [libSource, setLibSource] = useState<"auto" | "custom">("auto");
  const [heroPath, setHeroPath] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomPage, setRoomPage] = useState(1);
  const [editNav, setEditNav] = useState<EditNav>("library");
  const [navOpen, setNavOpen] = useState(true);
  const [roomEntered, setRoomEntered] = useState(false);
  const [roomPickPath, setRoomPickPath] = useState<string | null>(null);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [graphSel, setGraphSel] = useState<string | null>(null);
  const [startName, setStartName] = useState("启动画面");
  const [hasStart, setHasStart] = useState(true);
  const [propsH, setPropsH] = useState(150);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const seedKeyRef = useRef("");
  const [geom, setGeom] = useState({ w: 0, h: 0, startR: 0, deskL: 0, deskR: 0 });
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("dext.theme") as "light" | "dark") ?? "light"
  );
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dext.theme", theme);
  }, [theme]);

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
      setDirty(false);
      setStatus(`已打开 ${path.split("\\").pop()}（mock）`);
      return;
    }
    if (
      checkDirty &&
      dirty &&
      !confirm("当前房间有未保存的修改，丢弃并切换？")
    )
      return;
    try {
      const json = await invoke<string>("read_room", { path: `${path}\\room.json` });
      const room = JSON.parse(json);
      setDesks(room.desks?.length ? room.desks : [newDesk(0)]);
      setTransition(room.switch ?? room.transition ?? "slide");
      setActiveDesk(0);
      setRoomPath(path);
      setDirty(false);
      localStorage.setItem("dext.roomPath", path);
      setStatus(`已打开 ${path.split("\\").pop()}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  function touch() {
    setDirty(true);
  }

  async function saveRoom(): Promise<boolean> {
    if (!roomPath) return false;
    try {
      await invoke("write_room", {
        path: `${roomPath}\\room.json`,
        roomJson: JSON.stringify({ desks, switch: transition }, null, 2),
      });
      setDirty(false);
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function applyRoomDir(dir: string) {
    try {
      await invoke("apply_room", { roomDir: dir });
      setAppliedRoom(dir);
      localStorage.setItem("dext.appliedRoom", dir);
      setStatus(`已应用 ${dir.split("\\").pop()}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function applyCurrent() {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    setStatus("saving...");
    if (dirty && !(await saveRoom())) return;
    applyRoomDir(roomPath);
  }

  async function newRoom() {
    const name = prompt("房间名（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("create_room", { dir: libDir, name });
      await refreshRooms(libDir);
      await openRoom(path, false);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function saveAs() {
    const name = prompt("另存为（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("create_room", { dir: libDir, name });
      await invoke("write_room", {
        path: `${path}\\room.json`,
        roomJson: JSON.stringify({ desks, switch: transition }, null, 2),
      });
      await refreshRooms(libDir);
      await openRoom(path, false);
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
    previewRef.current?.contentWindow?.postMessage(
      { type: "dext:room", room: { desks }, deskIndex: activeDesk },
      "*"
    );
  }

  useEffect(() => {
    if (showPreview) postRoom();
  }, [desks, activeDesk, showPreview]);

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

  function exitMulti() {
    setMultiMode(false);
    setSelected(new Set());
  }

  function bulkAdd() {
    touch();
    setDesks((prev) =>
      prev.map((d, i) => {
        if (i !== activeDesk) return d;
        const existing = new Set(d.icons.map((x) => x.launch.target));
        const additions = apps
          .filter((a) => selected.has(a.target) && !existing.has(a.target))
          .map((a) => ({
            label: a.name,
            icon_png: a.icon_png,
            launch: { target: a.target, args: a.arguments, workdir: a.working_dir },
          }));
        return { ...d, icons: [...d.icons, ...additions] };
      })
    );
    setSelected(new Set());
  }

  async function persistLibrary(next: AppInfo[]) {
    try {
      await invoke("save_library", {
        dir: libDir,
        libraryJson: JSON.stringify(next, null, 2),
      });
      setLibSource("custom");
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  function deleteFromLibrary() {
    const next = apps.filter((a) => !selected.has(a.target));
    setApps(next);
    setSelected(new Set());
    persistLibrary(next);
    setStatus(`已从库中删除 ${apps.length - next.length} 项`);
  }

  async function scanMerge() {
    try {
      setStatus("scanning...");
      const list = await invoke<AppInfo[]>("get_installed_apps");
      const byTarget = new Map(apps.map((a) => [a.target, a]));
      for (const a of list) if (!byTarget.has(a.target)) byTarget.set(a.target, a);
      const merged = [...byTarget.values()];
      setApps(merged);
      setSelected(new Set());
      persistLibrary(merged);
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
      setApps(next);
      persistLibrary(next);
      setStatus(`已添加 ${additions.length} 项`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function pickBackground(kind: "image" | "video") {
    if (!roomPath) return;
    const filters = [
      kind === "video"
        ? { name: "视频", extensions: ["mp4", "webm", "mkv", "mov"] }
        : { name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] },
    ];
    const picked = await open({ filters, multiple: false });
    if (typeof picked !== "string") return;
    try {
      setStatus("copying...");
      const bg = await invoke<Background>("import_background", {
        roomDir: roomPath,
        srcPath: picked,
        kind,
      });
      touch();
      setDesks((prev) =>
        prev.map((d, i) => (i === activeDesk ? { ...d, background: bg } : d))
      );
      setStatus("背景已选择，记得保存并应用");
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  function clearBackground() {
    touch();
    setDesks((prev) =>
      prev.map((d, i) => (i === activeDesk ? { ...d, background: "" } : d))
    );
  }

  async function changeTransition(value: string) {
    touch();
    if (value !== "video") {
      setTransition(value);
      return;
    }
    if (!roomPath) return;
    const picked = await open({
      filters: [{ name: "视频", extensions: ["mp4", "webm", "mkv", "mov"] }],
      multiple: false,
    });
    if (typeof picked !== "string") return;
    try {
      setStatus("copying...");
      const t = await invoke<{ type: "video"; src: string }>("import_background", {
        roomDir: roomPath,
        srcPath: picked,
        kind: "transition",
      });
      setTransition(t);
      setStatus("视频转场已选择，记得保存并应用");
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  function toggle(app: AppInfo) {
    touch();
    setDesks((prev) =>
      prev.map((d, i) => {
        if (i !== activeDesk) return d;
        const has = d.icons.some((x) => x.launch.target === app.target);
        return {
          ...d,
          icons: has
            ? d.icons.filter((x) => x.launch.target !== app.target)
            : [...d.icons, { label: app.name, icon_png: app.icon_png, launch: { target: app.target, args: app.arguments, workdir: app.working_dir } }],
        };
      })
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
    touch();
    setDesks((prev) => [...prev, newDesk(prev.length)]);
    setActiveDesk(desks.length);
  }

  function removeDesk(i: number) {
    if (desks.length === 1) return;
    touch();
    setDesks((prev) => prev.filter((_, x) => x !== i));
    setActiveDesk(0);
  }

  const desk = desks[activeDesk];
  /* header controls (room select / 新建 / 另存为 / 库路径 / 转场 / 保存 / 应用) removed from UI;
     functions kept here until the Room view re-homes them */
  void [
    newRoom,
    saveAs,
    changeLib,
    changeTransition,
    transitionLabel,
    applyCurrent,
    addDesk,
    removeDesk,
    pickBackground,
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
  function renameGraphNode(id: string, name: string) {
    if (id === "start") setStartName(name);
    else {
      const i = parseInt(id.slice(1), 10);
      setDesks((prev) => prev.map((d, xi) => (xi === i ? { ...d, name } : d)));
    }
  }
  function setEdgeTrans(edgeId: string, trans: string) {
    setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, trans } : e)));
  }
  function snapshot(): Snapshot {
    return { edges, desks: desks.map((d) => ({ ...d })), startName, hasStart };
  }
  function applySnapshot(s: Snapshot) {
    setEdges(s.edges);
    setDesks(s.desks);
    setStartName(s.startName);
    setHasStart(s.hasStart);
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
      setEdges(seedEdges(desks));
      setPast([]);
      setFuture([]);
      setGraphSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomEntered, roomPath, desks.length]);
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
  const tabCls = (on: boolean) =>
    `rounded px-3 py-1 text-sm whitespace-nowrap ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`;

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
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
            title={theme === "dark" ? "切到浅色" : "切到深色"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
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
        /* ===== use mode: card grid (left) + hero (right half) ===== */
        <section className="flex min-h-0 flex-1 gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Input
              placeholder="搜索房间..."
              value={roomQuery}
              onChange={(e) => {
                setRoomQuery(e.target.value);
                setRoomPage(1);
              }}
            />
            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto pr-1">
              {pagedRooms.map((r) => {
                const isHero = r.path === heroRoom?.path;
                const on = r.path === appliedRoom;
                return (
                  <button
                    key={r.path}
                    onClick={() => setHeroPath(r.path)}
                    className={`overflow-hidden rounded-xl border text-left transition-colors ${
                      isHero ? "border-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="aspect-video w-full">
                      <CoverStack tiles={roomCovers(r)} />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{r.name}</span>
                          {on && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                              title="应用中"
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.desks} Desk · {r.icons} 图标
                        </div>
                      </div>
                      <Button
                        variant={on ? "secondary" : "outline"}
                        size="xs"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyRoomDir(r.path);
                        }}
                      >
                        {on ? "重应" : "应用"}
                      </Button>
                    </div>
                  </button>
                );
              })}
              {rooms.length === 0 && (
                <div className="col-span-2 py-16 text-center text-sm text-muted-foreground">
                  房间库为空——去「编辑」模式新建一个房间吧
                </div>
              )}
              {rooms.length > 0 && filteredRooms.length === 0 && (
                <div className="col-span-2 py-16 text-center text-sm text-muted-foreground">
                  没有匹配「{roomQuery}」的房间
                </div>
              )}
            </div>
            {roomPageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={roomPageCur === 1}
                  title="第一页"
                  onClick={() => setRoomPage(1)}
                >
                  <ChevronsLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={roomPageCur === 1}
                  title="上一页"
                  onClick={() => setRoomPage(roomPageCur - 1)}
                >
                  <ChevronLeft />
                </Button>
                {Array.from({ length: roomPageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRoomPage(p)}
                    className={`h-7 min-w-7 rounded-md px-2 text-xs ${
                      p === roomPageCur
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={roomPageCur === roomPageCount}
                  title="下一页"
                  onClick={() => setRoomPage(roomPageCur + 1)}
                >
                  <ChevronRight />
                </Button>
                <span className="ml-2 text-xs text-muted-foreground">
                  共 {filteredRooms.length} 个房间
                </span>
              </div>
            )}
          </div>

          {heroRoom && (
            <div className="relative w-1/2 shrink-0 overflow-hidden rounded-2xl border border-border shadow-sm">
              <CoverStack tiles={roomCovers(heroRoom)} autoPlayMain />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-24 text-white">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight">{heroRoom.name}</h2>
                  {heroRoom.path === appliedRoom && (
                    <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-medium">
                      应用中
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-white/70">
                  {heroRoom.desks} Desk · {heroRoom.icons} 图标
                </p>
                <Button
                  size="sm"
                  className="mt-4 px-4"
                  variant={heroRoom.path === appliedRoom ? "secondary" : "default"}
                  onClick={() => applyRoomDir(heroRoom.path)}
                >
                  {heroRoom.path === appliedRoom ? "重新应用" : "应用此房间"}
                </Button>
              </div>
            </div>
          )}
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
                  ["library", "应用库", LayoutGrid],
                  ["room", "Room", FolderOpen],
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
          <section className="flex min-h-0 flex-1 flex-col p-4">
            {editNav === "library" ? (
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
                  <Button variant="outline" size="sm" className="h-7" onClick={scanMerge}>
                    扫描合并
                  </Button>
                  <Button
                    variant={multiMode ? "secondary" : "outline"}
                    size="sm"
                    className="ml-auto h-7"
                    onClick={() => (multiMode ? exitMulti() : setMultiMode(true))}
                  >
                    多选
                  </Button>
                </div>
                {multiMode && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">已选 {selected.size}</span>
                    <Button size="sm" variant="outline" disabled={!selected.size} onClick={bulkAdd}>
                      添加到当前 Desk
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={!selected.size}
                      onClick={deleteFromLibrary}
                    >
                      从库中删除
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!selected.size}
                      onClick={() => setSelected(new Set())}
                    >
                      清除
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={exitMulti}>
                      退出
                    </Button>
                  </div>
                )}
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
                      <button
                        key={app.source + app.target}
                        onClick={() => (multiMode ? toggleSelect(app) : toggle(app))}
                        className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                          multiMode && picked
                            ? "border-amber-400 bg-amber-400/10 ring-2 ring-amber-400"
                            : on
                              ? "border-primary bg-primary/10"
                              : "border-transparent hover:bg-accent"
                        }`}
                        title={app.target}
                      >
                        <AppIcon app={app} />
                        <span className="line-clamp-2 text-center text-xs leading-tight">
                          {app.name}
                        </span>
                        {on && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : editNav === "dock" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <p>Dock 编辑（下一轮搭建）</p>
                <p className="text-xs">桌面底栏样式 / 指示器 / 尺寸切换入口将集中在这里</p>
              </div>
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
                </div>

                {pickedRoom && (
                  <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border pl-4">
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border">
                      <CoverStack tiles={roomCovers(pickedRoom)} autoPlayMain />
                    </div>
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
                        onClick={() => {
                          openRoom(pickedRoom.path);
                          setRoomEntered(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        className="flex-1"
                        variant={pickedRoom.path === appliedRoom ? "secondary" : "outline"}
                        onClick={() => applyRoomDir(pickedRoom.path)}
                      >
                        {pickedRoom.path === appliedRoom ? "重新应用" : "应用"}
                      </Button>
                    </div>
                    <div className="mt-auto border-t border-border pt-3">
                      <Button variant="outline" className="w-full" onClick={addMockRoom}>
                        <Plus className="h-4 w-4" /> 新增 Room
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
                      onClick={() => pickedRoom && applyRoomDir(pickedRoom.path)}
                    >
                      <Play className="h-3.5 w-3.5" /> 应用
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setStatus("分享功能规划中")}>
                      <Share2 className="h-3.5 w-3.5" /> 分享
                    </Button>
                  </div>
                </div>
                {edges.length > 0 ? (
                  <>
                    {/* 上：Room 结构思维导图（启动画面 → 主 Desk 直连；switch 只在相邻 desk 之间） */}
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20">
                      <div
                        className="relative h-full w-full"
                        style={{ minHeight: desks.length * 96 + 60 }}
                      >
                        <svg className="absolute inset-0 h-full w-full">
                          <defs>
                            <marker
                              id="garrow"
                              viewBox="0 0 10 10"
                              refX="9"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto"
                            >
                              <path d="M0,0L10,5L0,10z" fill="currentColor" />
                            </marker>
                          </defs>
                          {(() => {
                            const yOf = (id: string) => {
                              if (id === "start") return 50;
                              const i = parseInt(id.slice(1), 10);
                              return ((i + 1) / (desks.length + 1)) * 100;
                            };
                            const common = {
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: 1.6,
                            } as const;
                            const cls = "text-muted-foreground";
                            const segs: ReactElement[] = [];
                            edges.forEach((e) => {
                              if (e.from === "start") {
                                const y = yOf(e.to);
                                segs.push(
                                  <line key={e.id + "a"} x1="15%" y1="50%" x2="27%" y2="50%" {...common} className={cls} />,
                                  <line key={e.id + "b"} x1="27%" y1="50%" x2="27%" y2={`${y}%`} {...common} className={cls} />,
                                  <line key={e.id + "c"} x1="27%" y1={`${y}%`} x2="39%" y2={`${y}%`} {...common} className={cls} markerEnd="url(#garrow)" />
                                );
                              } else {
                                const down = parseInt(e.to.slice(1), 10) > parseInt(e.from.slice(1), 10);
                                const ya = yOf(e.from);
                                const yb = yOf(e.to);
                                const lane = down ? 59 : 62;
                                const y1 = down ? ya + 2.2 : ya - 2.2;
                                const y2 = down ? yb - 2.2 : yb + 2.2;
                                segs.push(
                                  <line key={e.id + "a"} x1="57%" y1={`${y1}%`} x2={`${lane}%`} y2={`${y1}%`} {...common} className={cls} />,
                                  <line key={e.id + "b"} x1={`${lane}%`} y1={`${y1}%`} x2={`${lane}%`} y2={`${y2}%`} {...common} className={cls} />,
                                  <line key={e.id + "c"} x1={`${lane}%`} y1={`${y2}%`} x2="57%" y2={`${y2}%`} {...common} className={cls} markerEnd="url(#garrow)" />
                                );
                              }
                            });
                            return segs;
                          })()}
                        </svg>
                        {/* switch 标记（仅 desk 之间，一对一来一回共用一个） */}
                        {Object.values(
                          edges.reduce<Record<string, GEdge>>((acc, e) => {
                            if (e.from === "start" || e.to === "start") return acc;
                            const k = pairKey(e);
                            if (!acc[k]) acc[k] = e;
                            return acc;
                          }, {})
                        ).map((e) => {
                          const yOf = (id: string) => {
                            const i = parseInt(id.slice(1), 10);
                            return ((i + 1) / (desks.length + 1)) * 100;
                          };
                          const my = (yOf(e.from) + yOf(e.to)) / 2;
                          const k = pairKey(e);
                          return (
                            <button
                              key={k}
                              onClick={() => setGraphSel(k)}
                              style={{ left: "60.5%", top: `${my}%` }}
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
                          onClick={() => setGraphSel("start")}
                          className={`absolute left-[3%] top-1/2 z-10 flex w-[11%] min-w-24 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border-2 py-3 transition-colors ${
                            graphSel === "start"
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          <MonitorPlay className="h-5 w-5 text-primary" />
                          <span className="truncate px-1 text-xs font-medium">{startName}</span>
                        </button>
                        {/* Desk 矩形节点（desks[0] = 主 Desk，启动后第一个看到） */}
                        {desks.map((d, i) => {
                          const y = ((i + 1) / (desks.length + 1)) * 100;
                          const active = graphSel === `d${i}`;
                          return (
                            <button
                              key={i}
                              onClick={() => setGraphSel(`d${i}`)}
                              style={{ left: "40%", top: `${y}%` }}
                              className={`absolute z-10 -translate-y-1/2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                                active
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/50"
                              }`}
                            >
                              <div className="whitespace-nowrap text-sm font-medium">{d.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {i === 0 ? "主 Desk" : `Desk ${i + 1}`} · {d.icons.length} 图标
                              </div>
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
                      className="flex shrink-0 items-center gap-8 overflow-x-auto rounded-lg border border-border px-4 py-2.5"
                      style={{ height: propsH }}
                    >
                      {!graphSel ? (
                        <div className="w-full text-center text-sm text-muted-foreground">
                          点击上方节点或 switch 连线，在这里编辑属性
                        </div>
                      ) : graphSel === "start" || /^d\d+$/.test(graphSel) ? (
                        (() => {
                          const isStart = graphSel === "start";
                          const name = isStart
                            ? startName
                            : (desks[parseInt(graphSel.slice(1), 10)]?.name ?? "");
                          return (
                            <>
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
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {isStart ? "画面素材：" : "壁纸素材："}
                                </span>
                                <Button variant="outline" size="sm" title="下一轮接真实导入">
                                  <Image className="h-3.5 w-3.5" /> 图片
                                </Button>
                                <Button variant="outline" size="sm" title="下一轮接真实导入">
                                  <Code className="h-3.5 w-3.5" /> 网页代码
                                </Button>
                                <Button variant="outline" size="sm" title="下一轮接真实导入">
                                  <Video className="h-3.5 w-3.5" /> 视频
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
                            return (
                              <label
                                key={e.id}
                                className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground"
                              >
                                {nameOf(e.from)} → {nameOf(e.to)}
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={e.trans}
                                    onChange={(ev) => {
                                      pushHistory();
                                      setEdgeTrans(e.id, ev.target.value);
                                    }}
                                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                                  >
                                    {TRANSITION_OPTIONS.map(([v, l]) => (
                                      <option key={v} value={v}>
                                        {l}
                                      </option>
                                    ))}
                                  </select>
                                  {(e.trans === "code" || e.trans === "video") && (
                                    <Button variant="outline" size="sm" title="下一轮接真实导入">
                                      {e.trans === "code" ? "选择代码" : "选择视频"}
                                    </Button>
                                  )}
                                </div>
                              </label>
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
        <section className="flex flex-1 flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <p>创意工坊（规划中）</p>
          <p className="text-xs">未来在这里浏览、订阅创作者分享的房间</p>
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <p>设置（规划中）</p>
          <p className="text-xs">房间库路径、主题等偏好将集中在这里</p>
        </section>
      )}
    </main>
  );
}
