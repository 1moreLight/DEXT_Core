import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, ChevronRight, ChevronsLeft, Film, Moon, Sun } from "lucide-react";
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
        <div className="absolute bottom-2.5 right-2.5 flex items-end">
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
                className="h-12 w-20 cursor-pointer overflow-hidden rounded-md border-2 border-white/90 bg-black shadow-lg transition-transform hover:scale-105"
                style={{
                  transform: `rotate(${(pi - (piled.length - 1) / 2) * 5}deg)`,
                  marginLeft: pi > 0 ? "-10px" : undefined,
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
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
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
  const heroRoom =
    rooms.find((r) => r.path === heroPath) ??
    rooms.find((r) => r.path === appliedRoom) ??
    rooms[0] ??
    null;
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

        {mode === "edit" && (
          <div className="flex items-center gap-2">
            <select
              value={roomPath ?? ""}
              onChange={(e) => openRoom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              title="当前房间"
            >
              {rooms.length === 0 && <option value="">（无房间）</option>}
              {rooms.map((r) => (
                <option key={r.path} value={r.path}>
                  {r.name}
                </option>
              ))}
            </select>
            {dirty && (
              <span className="text-xs font-medium text-amber-500" title="有未保存修改">
                ●
              </span>
            )}
            <Button variant="outline" size="sm" onClick={newRoom}>
              新建
            </Button>
            <Button variant="outline" size="sm" onClick={saveAs}>
              另存为
            </Button>
            <Input
              value={libDir}
              onChange={(e) => setLibDir(e.target.value)}
              onBlur={(e) => {
                if (e.target.value !== localStorage.getItem("dext.libDir"))
                  changeLib(e.target.value);
              }}
              className="h-8 w-56 text-xs"
              title="房间库路径"
            />
            <select
              value={typeof transition === "string" ? transition : "video"}
              onChange={(e) => changeTransition(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              title="切桌过渡效果"
            >
              <option value="slide">滑动</option>
              <option value="fade">淡入</option>
              <option value="zoom">缩放</option>
              <option value="none">无</option>
              <option value="video">{typeof transition === "string" ? "视频…" : transitionLabel(transition)}</option>
            </select>
          </div>
        )}

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
          {mode === "edit" && (
            <>
              {IS_TAURI && (
                <Button
                  variant={showPreview ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  预览
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={saveRoom}>
                保存
              </Button>
              <Button size="sm" onClick={applyCurrent}>
                应用
              </Button>
            </>
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
          {/* desk sidebar */}
          <aside className="flex w-64 flex-col border-r border-border">
            <div className="px-4 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Desks
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {desks.map((d, i) => (
                <div
                  key={i}
                  onClick={() => setActiveDesk(i)}
                  className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 ${
                    i === activeDesk ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent"
                  }`}
                >
                  {renaming === i ? (
                    <Input
                      autoFocus
                      defaultValue={d.name}
                      className="h-7 text-sm"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        touch();
                        setDesks((prev) =>
                          prev.map((x, xi) =>
                            xi === i ? { ...x, name: e.target.value || x.name } : x
                          )
                        );
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <div onDoubleClick={() => setRenaming(i)}>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.icons.length} 个图标</div>
                    </div>
                  )}
                  {desks.length > 1 && (
                    <button
                      className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDesk(i);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border p-2">
              <Button variant="outline" className="w-full" onClick={addDesk}>
                + 添加 Desk
              </Button>
            </div>

            {/* desk background */}
          <div className="border-t border-border p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              背景
            </div>
            <div className="mb-2 truncate text-xs text-muted-foreground" title={bgLabel(desk.background)}>
              {bgLabel(desk.background)}
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => pickBackground("image")}>
                图片
              </Button>
              <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => pickBackground("video")}>
                视频
              </Button>
              <Button variant="outline" size="sm" className="h-7" onClick={clearBackground} title="清除背景（回黑底）">
                ×
              </Button>
            </div>
          </div>

          {/* current desk icons */}
            <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                「{desk.name}」的图标
              </span>
              <div className="flex gap-1">
                {(["large", "medium", "small"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      touch();
                      setDesks((prev) =>
                        prev.map((d, i) => (i === activeDesk ? { ...d, iconSize: s } : d))
                      );
                    }}
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      (desk.iconSize ?? "medium") === s
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:bg-accent"
                    }`}
                    title="桌面图标尺寸"
                  >
                    {{ large: "大", medium: "中", small: "小" }[s]}
                  </button>
                ))}
              </div>
            </div>
              <div className="flex flex-wrap gap-1.5">
                {desk.icons.map((icon) => (
                  <button
                    key={icon.launch.target}
                    onClick={() => removeIcon(icon.launch.target)}
                    className="group relative rounded-md border border-border p-1.5 hover:border-destructive"
                    title={`移除 ${icon.label}`}
                  >
                    <img
                      src={`data:image/png;base64,${icon.icon_png}`}
                      alt=""
                      className="h-7 w-7"
                    />
                    <span className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white group-hover:flex">
                      ×
                    </span>
                  </button>
                ))}
                {desk.icons.length === 0 && (
                  <span className="text-xs text-muted-foreground">从右侧点选应用</span>
                )}
              </div>
            </div>
          </aside>

          {/* app library OR preview */}
          <section className="flex min-h-0 flex-1 flex-col p-4">
            {showPreview ? (
              <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
                <iframe
                  ref={previewRef}
                  src="http://dext.localhost/index.html"
                  onLoad={postRoom}
                  title="Room 预览"
                  className="aspect-video w-full max-w-4xl rounded-lg border border-border"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  实时预览 · 未保存的修改也会显示 · 双击图标不会真启动
                </p>
              </div>
            ) : (
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
