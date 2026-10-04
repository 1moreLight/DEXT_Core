import { useEffect, useRef, useState, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  MonitorPlay,
  Moon,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DockLibrary } from "@/components/DockLibrary";
import { DockEditor } from "@/components/DockEditor";
import { AppPickerDialog } from "@/components/AppPickerDialog";
import { SettingsPage } from "@/components/SettingsPage";
import { DesktopCanvasEditor } from "@/components/DesktopCanvasEditor";
import { CreatorImportDialog } from "@/components/CreatorImportDialog";
import { SceneCapabilityEditor } from "@/components/SceneCapabilityEditor";
import { AppHeader, type AppMode as Mode, type AppTheme as Theme } from "@/app/AppHeader";
import { V3RoomEditor } from "@/features/room-editor/V3RoomEditor";
import { createRoomV3, readRoomV3, type RoomV3 } from "@/features/room-editor/v3-document";
import { RoomEditorHeader } from "@/features/room-editor/RoomEditorHeader";
import { EditorNavigation, type EditNav } from "@/features/room-editor/EditorNavigation";
import { UsePage, type RoomSort } from "@/pages/UsePage";
import { EditorRoomLibrary } from "@/pages/EditorRoomLibrary";
import { EditorAppLibrary } from "@/pages/EditorAppLibrary";
import { ContentInspector } from "@/features/room-library/previews";
import type { EditorView } from "@/features/room-editor/view";
import type { AppInfo, PermissionReview, RoomInfo } from "@/features/runtime/types";
import { useDextRuntime } from "@/features/runtime/useDextRuntime";
import { isCoreUnavailable, type CoreLifecycleBusy } from "@/features/runtime/core-status";
import {
  graphSwitchPosition,
  reconcileGraphEdges,
  routeGraphEdge,
  seedEdges,
  type GEdge,
} from "@/features/room-editor/graph";
import { useGraphGeometry } from "@/features/room-editor/useGraphGeometry";
import {
  cleanContent,
  cleanDesk,
  cleanTransition,
  serializeRoomV2,
} from "@/features/room-editor/room-draft";
import { deleteDeskGraph, moveDeskGraph, toggleDeskApplication } from "@/lib/desk";
import { desktopIconGridForPreferences } from "@/lib/widget-layout";
import { type DextSettingsView } from "@/lib/desktop-icon-preferences";
import {
  loadMinimizeAfterDeskAppAdd,
  saveMinimizeAfterDeskAppAdd,
} from "@/lib/config-preferences";
import {
  createDeskLayoutSyncQueue,
  deskAppSyncOutcome,
  mergeLiveLayoutFields,
  type DeskLayoutSyncRequest,
  type DeskLayoutSyncResult,
} from "@/lib/live-layout";
import {
  cloneEditorSnapshot,
  loadEditorHistory,
  normalizeRoomJson,
  saveEditorHistory,
  type RoomEditorSnapshot,
} from "@/lib/editor-history";
import {
  readOnlyRoomMessage,
  roomContractPolicy,
} from "@/lib/room-contract";
import {
  roomIntegrityBlockReason,
  roomOpenStatus,
  type RoomEditAudit,
  type RoomOrphanRecovery,
} from "@/lib/room-integrity";
import {
  type DockConfig,
  type DockPresetInfo,
  DEFAULT_DOCK,
  DOCK_PRESET_CATALOG,
  newLocalDockPresetId,
  parseDockPresetFile,
} from "@/lib/dock";
import {
  isRecord,
  type Content,
  type ContentType,
  type Desk,
  type Transition,
  type TransitionPreset,
  type WidgetDefinition,
} from "@/lib/room-v2";

type Snapshot = RoomEditorSnapshot;

const TRANSITION_OPTIONS: [TransitionPreset, string][] = [
  ["slide", "滑动"],
  ["fade", "淡入淡出"],
  ["zoom", "缩放"],
  ["none", "无"],
];

const mockNativeRooms = new Map<string, RoomV3>();

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
    version: 2,
    desks: 2,
    icons: 8,
    widgets: 3,
    covers: [
      { kind: "video", src: "background/bg.mp4" },
      { kind: "image", src: "background/bg.png" },
    ],
  },
  { name: "black-room", path: "C:\\mock\\black-room", version: 2, desks: 1, icons: 0, widgets: 0, covers: [] },
  {
    name: "game-room",
    path: "C:\\mock\\game-room",
    version: 2,
    desks: 3,
    icons: 15,
    widgets: 0,
    covers: [
      { kind: "image", src: "background/1.png" },
      { kind: "image", src: "background/2.png" },
      { kind: "image", src: "background/3.png" },
    ],
  },
  {
    name: "neon-city",
    path: "C:\\mock\\neon-city",
    version: 2,
    desks: 2,
    icons: 6,
    widgets: 0,
    covers: [
      { kind: "image", src: "background/a.png" },
      { kind: "image", src: "background/b.png" },
    ],
  },
  {
    name: "sunset",
    path: "C:\\mock\\sunset",
    version: 2,
    desks: 3,
    icons: 12,
    widgets: 0,
    covers: [
      { kind: "video", src: "background/sun.mp4" },
      { kind: "image", src: "background/1.png" },
      { kind: "image", src: "background/2.png" },
    ],
  },
  { name: "minimal", path: "C:\\mock\\minimal", version: 2, desks: 1, icons: 3, widgets: 0, covers: [] },
  {
    name: "retro",
    path: "C:\\mock\\retro",
    version: 2,
    desks: 2,
    icons: 9,
    widgets: 0,
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
    widgets: [
      {
        id: "system-meter",
        name: "系统仪表",
        src: "widgets/system-meter/index.html",
        resources: ["widgets/system-meter/index.html"],
        placement: { x: 1180, y: 96, width: 560, height: 260, z: 2 },
        config: { accent: "#67e8f9" },
        permissions: ["time.read", "hardware.cpu.read", "hardware.memory.read"],
        hotspots: [],
      },
      {
        id: "now-playing",
        name: "正在播放",
        src: "widgets/now-playing/index.html",
        resources: ["widgets/now-playing/index.html"],
        placement: { x: 720, y: 680, width: 640, height: 240, z: 1 },
        config: {},
        permissions: ["now-playing.read", "system.volume.read"],
        hotspots: [],
      },
      {
        id: "clock",
        name: "浮动时钟",
        src: "widgets/clock/index.html",
        resources: ["widgets/clock/index.html"],
        placement: { x: 96, y: 720, width: 360, height: 180, z: 3 },
        config: {},
        permissions: ["time.read"],
        hotspots: [],
      },
    ],
  },
  { name: "游戏", background: null, iconSize: "large", icons: [], widgets: [] },
];

function newDesk(index: number): Desk {
  return { name: `Desk ${index + 1}`, background: null, iconSize: "medium", icons: [], widgets: [] };
}

function transitionLabel(t: Transition): string {
  if (typeof t === "string") {
    return { slide: "滑动", fade: "淡入", zoom: "缩放", none: "无" }[t] ?? t;
  }
  return `${t.type === "image" ? "🖼" : t.type === "video" ? "🎬" : "代码"} ${t.name}`;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("use");
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [desks, setDesks] = useState<Desk[]>([newDesk(0)]);
  const [activeDesk, setActiveDesk] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading...");
  const [libDir, setLibDir] = useState(
    () => initialLibDir()
  );
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [rawRoomView, setRawRoomView] = useState<{name:string;json:string;message:string}|null>(null);
  const rawRoomDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog = rawRoomDialogRef.current;
    if (rawRoomView && dialog && !dialog.open) dialog.showModal();
    return ()=>{ if(dialog?.open) dialog.close(); };
  },[rawRoomView]);
  const [roomPath, setRoomPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { coreIdentity, coreIdentityError, v3Session, appliedRoom, setAppliedRoom, markCoreDisconnected, refreshCore } = useDextRuntime(IS_TAURI);
  const [coreBusy, setCoreBusy] = useState<CoreLifecycleBusy>(null);
  const coreActionRef = useRef(false);
  const [roomMultiMode, setRoomMultiMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [roomBusy, setRoomBusy] = useState<string | null>(null);
  const roomOperationRef = useRef(false);
  const [showPreview, setShowPreview] = useState(false);
  const [transition, setTransition] = useState<Transition>("slide");
  const [startContent, setStartContent] = useState<Content | null>(null);
  const [idleContent, setIdleContent] = useState<Content | null>(null);
  const [nativeRoom, setNativeRoom] = useState<RoomV3 | null>(null);
  const [roomVersion, setRoomVersion] = useState<number | null>(2);
  const [dock, setDock] = useState<DockConfig>(DEFAULT_DOCK);
  const [localDockPresets, setLocalDockPresets] = useState<DockPresetInfo[]>(loadLocalDockPresets);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [appPickerDesk, setAppPickerDesk] = useState<number | null>(null);
  const [minimizeAfterDeskAppAdd, setMinimizeAfterDeskAppAdd] = useState(
    () => loadMinimizeAfterDeskAppAdd(localStorage),
  );
  const [libSource, setLibSource] = useState<"auto" | "custom">("auto");
  const [heroPath, setHeroPath] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomSort, setRoomSort] = useState<RoomSort>("name-asc");
  const [roomPage, setRoomPage] = useState(1);
  const [editNav, setEditNav] = useState<EditNav>("room");
  const [navOpen, setNavOpen] = useState(true);
  const [roomEntered, setRoomEntered] = useState(false);
  const [editorView, setEditorView] = useState<EditorView>("canvas");
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showCreatorImport, setShowCreatorImport] = useState(false);
  const [permissionReviews, setPermissionReviews] = useState<PermissionReview[]>([]);
  const [roomOrphanResources, setRoomOrphanResources] = useState<string[]>([]);
  const [roomRecoveryDir, setRoomRecoveryDir] = useState<string | null>(null);
  const [roomRepairBusy, setRoomRepairBusy] = useState(false);
  const [roomPickPath, setRoomPickPath] = useState<string | null>(null);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [graphSel, setGraphSel] = useState<string | null>(null);
  const [startName, setStartName] = useState("启动画面");
  const [idleName, setIdleName] = useState("待机画面");
  const [hasStart, setHasStart] = useState(true);
  const [startDesk, setStartDesk] = useState(0);
  const [propsH, setPropsH] = useState(210);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const roomBaselineRef = useRef("");
  const libDirRef = useRef(libDir);
  libDirRef.current = libDir;
  const deskLayoutSyncQueueRef = useRef(createDeskLayoutSyncQueue(
    (request) => invoke<DeskLayoutSyncResult>("sync_active_desk_icons", {
      libraryDir: libDirRef.current,
      roomDir: request.roomDir,
      deskIndex: request.deskIndex,
      icons: request.icons,
      enterEdit: request.enterEdit,
      highlightTarget: request.highlightTarget,
    }),
    () => {},
  ));
  const historyReadyRef = useRef(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("dext.theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const previewRef = useRef<HTMLIFrameElement>(null);
  const fullscreenPreviewRef = useRef<HTMLIFrameElement>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const {
    canvasRef,
    startNodeRef,
    deskNodeRefs,
    geometry: geom,
    minHeight: graphMinHeight,
  } = useGraphGeometry(roomEntered && editorView === "flow", desks, edges.length);
  const dockPresets = [...DOCK_PRESET_CATALOG, ...localDockPresets];
  const coreUnavailable = isCoreUnavailable(coreIdentityError);
  const readyCoreIdentity = coreIdentity?.is_core_initialized ? coreIdentity : null;

  useEffect(() => {
    if (!IS_TAURI || !readyCoreIdentity) return;
    let cancelled = false;
    invoke<{cleaned:number;pending:number;messages:string[]}>("cleanup_v3_personal_deletions", {libraryDir:libDir})
      .then(reply => {
        if (cancelled) return;
        if (reply.pending) setStatus("Room私人数据清理待重试：" + reply.messages.join("；"));
        else if (reply.cleaned) setStatus("已处理 " + reply.cleaned + " 项Room私人数据恢复记录");
      }).catch(error => {if(!cancelled)setStatus("Room私人数据清理暂未完成：" + String(error));});
    return () => {cancelled = true;};
  }, [libDir,readyCoreIdentity?.process_id]);
  const activeRoomPolicy = roomContractPolicy(roomVersion);
  const activeRoomAudit: RoomEditAudit = {
    permissionReviews,
    orphanWidgetResources: roomOrphanResources,
  };
  const roomIntegrityReason = roomIntegrityBlockReason(activeRoomAudit);

  function buildRoomV2(sourceDesks: Desk[] = desks) {
    return serializeRoomV2({
      desks: sourceDesks,
      startDesk,
      transition,
      edges,
      startContent,
      startName,
      idleContent,
      idleName,
      dock,
    });
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dext.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LOCAL_DOCK_PRESETS_KEY, JSON.stringify(localDockPresets));
  }, [localDockPresets]);

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
      const native=mockNativeRooms.get(path);
      if(native){
        setNativeRoom(native);setRoomVersion(3);setRoomPath(path);setDirty(false);
        historyReadyRef.current=false;setShowPreview(false);setStatus("原生 v3 编辑器设计模式");return true;
      }
      setNativeRoom(null);
      historyReadyRef.current = false;
      setDesks(MOCK_DESKS);
      setActiveDesk(0);
      setRoomPath(path);
      setStartContent(null);
      setIdleContent(null);
      setIdleName("待机画面");
      setRoomVersion(2);
      setStartDesk(0);
      setEdges(seedEdges(MOCK_DESKS, true, 0));
      setDirty(false);
      setPermissionReviews([]);
      setRoomOrphanResources([]);
      setRoomRecoveryDir(null);
      setPast([]);
      setFuture([]);
      roomBaselineRef.current = "mock-v2";
      historyReadyRef.current = true;
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
      const room = JSON.parse(json);
      if (typeof room.version === "number" && room.version >= 3) {
        const report = await invoke<import("@/lib/room-contract").RoomCompatibility>("inspect_room_compatibility", {path: path + "\\room.json"});
        if (!report.supported) {
          setRawRoomView({name: path.split(/[\\/]/).pop() ?? "Room",json,message:report.message});
          setStatus(report.message);
          return false;
        }
        const native = readRoomV3(json);
        historyReadyRef.current = false;
        setNativeRoom(native); setRoomVersion(3); setRoomPath(path); setDirty(false);
        setRoomOrphanResources([]); setRoomRecoveryDir(null); setPermissionReviews([]);
        setShowPreview(false); setFullscreenPreview(false);
        localStorage.setItem("dext.roomPath", path);
        setStatus("已打开原生 Room v3 · " + native.name);
        return true;
      }
      setNativeRoom(null);
      const audit = await invoke<RoomEditAudit>("inspect_room_for_edit", { path });
      const baseline = normalizeRoomJson(json);
      const nextDesks = Array.isArray(room.desks) && room.desks.length
        ? room.desks.map(cleanDesk)
        : [newDesk(0)];
      const nextStartDesk = Number.isInteger(room.startDesk) && room.startDesk >= 0 && room.startDesk < nextDesks.length
        ? room.startDesk
        : 0;
      const nextStart = cleanContent(room.start, "start");
      const nextIdle = cleanContent(room.idle, "idle");
      const rawSwitches = isRecord(room.switches) ? room.switches : {};
      const nextSwitches = Object.fromEntries(
        Object.entries(rawSwitches).flatMap(([key, value]) => {
          const parsed = cleanTransition(value);
          return parsed ? [[key, parsed]] : [];
        })
      );
      const restored = await loadEditorHistory(path, baseline).catch(() => null);
      historyReadyRef.current = false;
      setDesks(nextDesks);
      setDock(room.dock ? { ...DEFAULT_DOCK, ...room.dock } : DEFAULT_DOCK);
      setTransition(cleanTransition(room.switch) ?? "slide");
      setStartContent(nextStart);
      setIdleContent(nextIdle);
      setStartName(nextStart?.name ?? "启动画面");
      setIdleName(nextIdle?.name ?? "待机画面");
      setHasStart(true);
      setStartDesk(nextStartDesk);
      setEdges(seedEdges(nextDesks, true, nextStartDesk, nextSwitches));
      setRoomVersion(typeof room.version === "number" ? room.version : null);
      if (room.version !== 2 || audit.orphanWidgetResources.length) setShowPreview(false);
      setActiveDesk(nextStartDesk);
      setRoomPath(path);
      setDirty(false);
      setPermissionReviews(audit.permissionReviews);
      setRoomOrphanResources(audit.orphanWidgetResources);
      setRoomRecoveryDir(null);
      roomBaselineRef.current = baseline;
      if (restored) {
        applySnapshot(restored.current);
        setPast(restored.past.map(cloneEditorSnapshot));
        setFuture(restored.future.map(cloneEditorSnapshot));
        setDirty(restored.dirty);
      } else {
        setPast([]);
        setFuture([]);
      }
      historyReadyRef.current = true;
      localStorage.setItem("dext.roomPath", path);
      setStatus(
        room.version === 2
          ? roomOpenStatus(path.split(/[\\/]/).filter(Boolean).pop() ?? "Room", audit, Boolean(restored?.dirty))
          : readOnlyRoomMessage(room.version, room.compatibility)
      );
      return true;
    } catch (e) {
      setStatus(`无法打开 Room：${String(e)}`);
      return false;
    }
  }

  function touch() {
    setDirty(true);
  }

  async function saveRoom(): Promise<boolean> {
    if (!roomPath) return false;
    if (roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return false;
    }
    if (!activeRoomPolicy.save) {
      setStatus(readOnlyRoomMessage(roomVersion));
      return false;
    }
    try {
      const roomJson = JSON.stringify(buildRoomV2(), null, 2);
      await invoke("write_room", {
        path: `${roomPath}\\room.json`,
        roomJson,
      });
      roomBaselineRef.current = normalizeRoomJson(roomJson);
      setDirty(false);
      setPermissionReviews(await invoke<PermissionReview[]>("get_permission_review", { path: roomPath }));
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function recoverRoomOrphans() {
    if (!IS_TAURI || !roomPath || roomRepairBusy || !roomOrphanResources.length) return;
    setRoomRepairBusy(true);
    try {
      const recovery = await invoke<RoomOrphanRecovery>("quarantine_room_orphan_resources", {
        path: roomPath,
      });
      const audit = await invoke<RoomEditAudit>("inspect_room_for_edit", { path: roomPath });
      setPermissionReviews(audit.permissionReviews);
      setRoomOrphanResources(audit.orphanWidgetResources);
      setRoomRecoveryDir(recovery.recoveryDir);
      setStatus(`已把 ${recovery.moved.length} 个未声明资源移至恢复目录；当前编辑内容已保留`);
    } catch (error) {
      setStatus(`Room 资源恢复失败：${String(error)}`);
    } finally {
      setRoomRepairBusy(false);
    }
  }

  async function applyRoomDir(dir: string) {
    if (roomOperationRef.current || roomBusy) return;
    if (dir === roomPath && roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return;
    }
    const target = rooms.find((room) => room.path === dir);
    if (target && !roomContractPolicy(target.version, target.compatibility).apply) {
      setStatus(readOnlyRoomMessage(target.version, target.compatibility));
      return;
    }
    if (!IS_TAURI) {
      setAppliedRoom(dir);
      setStatus(`已应用 ${dir.split("\\").pop()}（UI 设计模式）`);
      return;
    }
    if (IS_TAURI && !readyCoreIdentity) {
      setStatus(
        coreUnavailable
          ? "Dext Core 已退出；请点击顶部“启动 Core”后再应用 Room"
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
        markCoreDisconnected(message);
        setStatus("Dext Core 已断开；请重新运行 scripts/start.ps1 后再应用 Room");
      } else {
        setStatus(`error: ${message}`);
      }
    } finally {
      roomOperationRef.current = false;
      setRoomBusy(null);
    }
  }

  async function handleCoreAction(action: "start" | "exit") {
    if (!IS_TAURI || coreActionRef.current) return;
    coreActionRef.current = true;
    setCoreBusy(action === "start" ? "starting" : "exiting");
    try {
      if (action === "start") {
        await invoke("start_core");
        setStatus("Dext Core 已启动");
      } else {
        await invoke("exit_core");
        markCoreDisconnected("Dext Core not running");
        setStatus("Dext Core 已退出，配置器仍可使用");
      }
    } catch (error) {
      setStatus(`${action === "start" ? "启动" : "退出"} Dext Core 失败：${String(error)}`);
    } finally {
      await refreshCore();
      setCoreBusy(null);
      coreActionRef.current = false;
    }
  }

  async function applyCurrent() {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    if (!activeRoomPolicy.apply) {
      setStatus(readOnlyRoomMessage(roomVersion));
      return;
    }
    if (roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return;
    }
    setStatus("saving...");
    if (dirty && !(await saveRoom())) return;
    await applyRoomDir(roomPath);
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

  async function setSubjectPermission(subjectId: string, approved: boolean) {
    if (!roomPath || !IS_TAURI) return;
    if (roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return;
    }
    if (dirty && !(await saveRoom())) return;
    try {
      const reviews = await invoke<PermissionReview[]>("set_subject_permission", {
        path: roomPath,
        subjectId,
        approved,
      });
      setPermissionReviews(reviews);
      setStatus(approved ? "已在本机批准该内容当前版本的能力；内容变化后会自动失效" : "已撤销该内容的本机能力授权");
    } catch (error) {
      setStatus(`权限更新失败：${error}`);
    }
  }

  async function importWidgetForDesk() {
    if (!roomPath || !desks[activeDesk]) {
      setStatus("先打开一个 Room 并选择 Desk");
      return;
    }
    if (!IS_TAURI) {
      setStatus("Widget 文件夹导入请在桌面配置器中使用；设计模式已提供可编辑样例");
      return;
    }
    const sourceDir = await open({ multiple: false, directory: true });
    if (typeof sourceDir !== "string") return;
    const fallback = sourceDir.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "widget";
    const widgetId = prompt("Widget id（小写英文、数字和连字符）", /^[a-z]/.test(fallback) ? fallback : `widget-${fallback}`)?.trim();
    if (!widgetId) return;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(widgetId)) {
      setStatus("Widget id 必须是小写英文开头的 slug");
      return;
    }
    if (desks.some((desk) => desk.widgets.some((widget) => widget.id === widgetId))) {
      setStatus(`Widget id 已存在：${widgetId}`);
      return;
    }
    const widgetName = prompt("Widget 显示名称", widgetId)?.trim();
    if (!widgetName) return;
    try {
      const widget = await invoke<WidgetDefinition>("import_widget", {
        roomDir: roomPath,
        sourceDir,
        widgetId,
        widgetName,
        deskIndex: activeDesk,
        roomJson: JSON.stringify(buildRoomV2(), null, 2),
      });
      await openRoom(roomPath, false);
      setSelectedWidgetId(widget.id);
      setEditorView("canvas");
      setStatus(`已安全导入 Widget「${widget.name}」并保存 Room`);
    } catch (error) {
      setStatus(`Widget 导入失败：${error}`);
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
      const path = await invoke<string>("create_room_v3", { dir: libDir, name, roomJson: JSON.stringify(createRoomV3(name)) });
      await refreshRooms(libDir);
      await openRoom(path, false);
      return path;
    } catch (e) {
      setStatus(`error: ${e}`);
      return null;
    }
  }

  async function saveAs(nativeDraftJson?: string) {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    if (!activeRoomPolicy.saveAs) {
      setStatus(readOnlyRoomMessage(roomVersion));
      return;
    }
    if (roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return;
    }
    if (roomVersion === 3 && !readyCoreIdentity) {
      setStatus("先启动 Core，以复制本机绑定和皮肤；作品原文保持"); return;
    }
    const name = prompt("另存为（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("save_room_as", {
        roomDir: roomPath,
        dir: libDir,
        name,
        roomJson: roomVersion === 3 ? nativeDraftJson ?? JSON.stringify(nativeRoom) : JSON.stringify(buildRoomV2(), null, 2),
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
    if (!roomPath || !activeRoomPolicy.preview || roomIntegrityReason) return;
    const roomName = roomPath.split(/[\\/]/).filter(Boolean).pop();
    if (!roomName) return;
    for (const frame of [previewRef.current, fullscreenPreviewRef.current]) {
      frame?.contentWindow?.postMessage(
        {
          type: "dext:room",
          room: buildRoomV2(),
          deskIndex: activeDesk,
          assetBase: `http://lib.localhost/${encodeURIComponent(roomName)}/`,
        },
        "http://dext.localhost"
      );
    }
  }

  useEffect(() => {
    if (showPreview) postRoom();
  }, [desks, dock, activeDesk, showPreview, fullscreenPreview, transition, edges, startContent, idleContent, startDesk, startName, idleName, graphSel]);

  function exitFullscreenPreview() {
    setFullscreenPreview(false);
    if (IS_TAURI) void getCurrentWindow().setFullscreen(false).catch(() => {});
  }

  function enterFullscreenPreview() {
    setFullscreenPreview(true);
    if (IS_TAURI) void getCurrentWindow().setFullscreen(true).catch(() => {});
  }

  useEffect(() => {
    if (!fullscreenPreview) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") exitFullscreenPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenPreview]);

  const previewSrc = `http://dext.localhost/index.html?preview=1${graphSel === "idle" ? "&screensaver=1" : ""}`;

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
    slot: "background" | "start" | "switch" | "idle",
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
    const isIdle = nodeId === "idle";
    const deskIndex = isStart || isIdle ? -1 : Number(nodeId.slice(1));
    if (!isStart && !isIdle && (!Number.isInteger(deskIndex) || !desks[deskIndex])) return;
    const content = await pickRoomContent(isStart ? "start" : isIdle ? "idle" : "background", contentType);
    if (!content) return;
    pushHistory();
    touch();
    if (isStart) {
      setHasStart(true);
      setStartContent({ ...content, name: startName.trim() || content.name });
    } else if (isIdle) {
      setIdleContent({ ...content, name: idleName.trim() || content.name });
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

  function updateMinimizeAfterDeskAppAdd(value: boolean) {
    setMinimizeAfterDeskAppAdd(value);
    saveMinimizeAfterDeskAppAdd(localStorage, value);
  }

  async function syncDeskIcons(
    nextDesks: Desk[],
    deskIndex: number,
    action: "added" | "removed",
  ) {
    const isActiveRoom = roomPath !== null && roomPath === appliedRoom;
    const coreConnected = Boolean(readyCoreIdentity);
    const targetDesk = nextDesks[deskIndex];
    if (!targetDesk) return;
    if (!isActiveRoom || !coreConnected) {
      setStatus(deskAppSyncOutcome({
        action,
        preference: minimizeAfterDeskAppAdd,
        isActiveRoom,
        coreConnected,
      }).message);
      return;
    }
    const request: DeskLayoutSyncRequest = {
      roomDir: roomPath,
      deskIndex,
      icons: targetDesk.icons,
      enterEdit: action === "added" && minimizeAfterDeskAppAdd,
      highlightTarget: null,
    };
    try {
      const completion = await deskLayoutSyncQueueRef.current.submit(request);
      if (!completion.latest || !completion.result) return;
      const result = completion.result;
      if (result.roomJson) {
        const baseline = normalizeRoomJson(result.roomJson);
        roomBaselineRef.current = baseline;
        setDirty(normalizeRoomJson(JSON.stringify(buildRoomV2(nextDesks))) !== baseline);
      }
      const outcome = deskAppSyncOutcome({
        action,
        preference: minimizeAfterDeskAppAdd,
        isActiveRoom: result.active,
        coreConnected,
        result,
      });
      setStatus(outcome.message);
      if (outcome.closePicker) setAppPickerDesk(null);
      if (outcome.minimize && IS_TAURI) await getCurrentWindow().minimize().catch(() => {});
    } catch (error) {
      const message = String(error);
      if (message.includes("pipe connect failed")) markCoreDisconnected(message);
      setStatus(`桌面同步失败：${message}`);
    }
  }

  function syncHistoryDeskLayouts(before: Desk[], after: Desk[]) {
    after.forEach((desk, index) => {
      if (JSON.stringify(before[index]?.icons ?? []) !== JSON.stringify(desk.icons)) {
        void syncDeskIcons(after, index, "removed");
      }
    });
  }

  async function toggleDeskApp(app: AppInfo, deskIndex = activeDesk) {
    const targetDesk = desks[deskIndex];
    if (!targetDesk) return;
    let grid;
    let fallback = false;
    if (!targetDesk.icons.some((icon) => icon.launch.target === app.target) && IS_TAURI) {
      try {
        const saved = await invoke<DextSettingsView>("get_dext_settings");
        grid = desktopIconGridForPreferences({
          feedbackStyle: saved.desktopIconFeedbackStyle,
          showLabels: saved.showDesktopIconLabels,
          hitTargetSize: saved.desktopIconHitTargetSize,
          visualSize: saved.desktopIconVisualSize,
          spacing: saved.desktopIconSpacing,
        }, { width: window.screen.width - 80, height: window.screen.height - 140 });
      } catch {
        fallback = true;
      }
    }
    const result = toggleDeskApplication(targetDesk, app, grid, dock);
    if (result.action === "full") {
      setStatus(`${targetDesk.name} 没有可用的图标位置`);
      return;
    }
    pushHistory();
    touch();
    const nextDesks = desks.map((desk, index) => index === deskIndex ? result.desk : desk);
    setDesks(nextDesks);
    setStatus(
      result.action === "removed"
        ? `已从 ${targetDesk.name} 移除 ${app.name}`
        : fallback
          ? `无法读取当前图标设置，已按兼容网格将 ${app.name} 放入 ${targetDesk.name}`
          : `已将 ${app.name} 放入 ${targetDesk.name}；可在桌面长按图标拖动位置`
    );
    void syncDeskIcons(nextDesks, deskIndex, result.action);
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
  function moveDesk(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= desks.length) return;
    pushHistory();
    const next = moveDeskGraph<Desk, Transition>({
      desks,
      edges,
      fromIndex,
      toIndex,
      startDesk,
      activeDesk,
      graphSelection: graphSel,
      hasStart,
    });
    setDesks(next.desks);
    setEdges(next.edges);
    setStartDesk(next.startDesk);
    setActiveDesk(next.activeDesk);
    setGraphSel(next.graphSelection);
    touch();
    setStatus("Desk 顺序已调整；原 Desk 身份、startDesk 和仍相邻的有向 switch 已同步重映射");
  }

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
    const room: RoomInfo = { name, path: `C:\\mock\\${name}`, version: 3, desks: 2, icons: 0, widgets: 0, covers: [] };
    mockNativeRooms.set(room.path, createRoomV3(name));
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
    if (!roomContractPolicy(room.version, room.compatibility).edit) {
      try {
        const json = IS_TAURI ? await invoke<string>("read_room", {path: room.path + "\\room.json"}) : "{}";
        setRawRoomView({name:room.name,json,message:readOnlyRoomMessage(room.version,room.compatibility)});
      } catch (error) { setStatus("无法查看原始清单：" + String(error)); }
      return;
    }
    const opened = await openRoom(room.path);
    if (!opened) return;
    setRoomPickPath(room.path);
    setEditNav("room");
    setRoomEntered(roomContractPolicy(room.version, room.compatibility).edit);
    setMode("edit");
    if (!roomContractPolicy(room.version, room.compatibility).edit) setStatus(readOnlyRoomMessage(room.version, room.compatibility));
  }
  async function stopWallpaper() {
    if (roomOperationRef.current || roomBusy) return;
    if (!IS_TAURI) {
      setAppliedRoom(null);
      setStatus("壁纸已停止（UI 设计模式）");
      return;
    }
    if (!readyCoreIdentity) return;
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
    if (roomPath && paths.includes(roomPath) && roomIntegrityReason) {
      setStatus(roomIntegrityReason);
      return;
    }
    const items = paths.map((path) => rooms.find((room) => room.path === path)).filter(Boolean) as RoomInfo[];
    if (!items.length) return;
    const readOnly = items.find((room) => !roomContractPolicy(room.version, room.compatibility).zip);
    if (readOnly) {
      setStatus(`${readOnly.name}：${readOnlyRoomMessage(readOnly.version, readOnly.compatibility)}`);
      return;
    }
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
          const result = await invoke<{personalCleanupPending?:boolean;message?:string}>("delete_room", { libraryDir: libDir, roomDir: paths[index] });
          if (result?.personalCleanupPending) failures.push(result.message || "Room已回收，私人数据清理待Core重连");
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
    else if (id === "idle") {
      setIdleName(name);
      setIdleContent((current) => current ? { ...current, name } : current);
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
    return cloneEditorSnapshot({
      edges,
      desks,
      dock,
      transition,
      startName,
      startContent,
      idleName,
      idleContent,
      hasStart,
      startDesk,
    });
  }
  async function duplicateRoom(room: RoomInfo) {
    if (!roomContractPolicy(room.version, room.compatibility).saveAs) return setStatus(readOnlyRoomMessage(room.version, room.compatibility));
    const name = prompt("复制后的 Room 名称", `${room.name}-copy`)?.trim();
    if (!name) return;
    if (!IS_TAURI) {
      const next = { ...room, name, path: `C:\\mock\\${name}` };
      if (room.version === 3) {
        const copy = structuredClone(mockNativeRooms.get(room.path) ?? createRoomV3(room.name));
        copy.id = crypto.randomUUID(); copy.name = name; mockNativeRooms.set(next.path, copy);
      }
      setRooms((current) => [...current, next]);
      setHeroPath(next.path);
      setStatus(`已复制 ${room.name} → ${name}（UI 设计模式）`);
      return;
    }
    setRoomBusy(`正在复制 ${room.name}…`);
    try {
      const path = await invoke<string>("duplicate_room", { libraryDir: libDir, roomDir: room.path, name });
      await refreshRooms(libDir);
      setHeroPath(path);
      setRoomPickPath(path);
      setStatus(`已复制 ${room.name} → ${name}`);
    } catch (error) {
      setStatus(`Room 复制失败：${String(error)}`);
    } finally {
      setRoomBusy(null);
    }
  }
  async function renameRoom(room: RoomInfo) {
    if (!roomContractPolicy(room.version, room.compatibility).edit) return setStatus(readOnlyRoomMessage(room.version, room.compatibility));
    const name = prompt("新的 Room 名称", room.name)?.trim();
    if (!name || name === room.name) return;
    if (!IS_TAURI) {
      const path = `C:\\mock\\${name}`;
      setRooms((current) => current.map((item) => item.path === room.path ? { ...item, name, path } : item));
      setHeroPath(path);
      setRoomPickPath(path);
      setStatus(`已重命名 ${room.name} → ${name}（UI 设计模式）`);
      return;
    }
    setRoomBusy(`正在重命名 ${room.name}…`);
    try {
      const path = await invoke<string>("rename_room", { libraryDir: libDir, roomDir: room.path, name });
      if (appliedRoom === room.path) {
        await invoke("apply_room", { roomDir: path });
        setAppliedRoom(path);
      }
      if (roomPath === room.path) setRoomPath(path);
      await refreshRooms(libDir);
      setHeroPath(path);
      setRoomPickPath(path);
      setStatus(`已重命名 ${room.name} → ${name}`);
    } catch (error) {
      setStatus(`Room 重命名失败：${String(error)}`);
    } finally {
      setRoomBusy(null);
    }
  }
  function applySnapshot(s: Snapshot) {
    const next = cloneEditorSnapshot(s);
    setEdges(next.edges);
    setDesks(next.desks);
    setDock(next.dock);
    setTransition(next.transition);
    setStartName(s.startName);
    setStartContent(s.startContent);
    setIdleName(s.idleName);
    setIdleContent(s.idleContent);
    setHasStart(s.hasStart);
    setStartDesk(s.startDesk);
    setActiveDesk((current) => Math.min(current, Math.max(0, s.desks.length - 1)));
    setGraphSel((current) => {
      if (!current || !/^d\d+$/.test(current)) return current;
      return parseInt(current.slice(1), 10) < s.desks.length ? current : null;
    });
  }
  function pushHistory() {
    setPast((p) => [...p.slice(-49), cloneEditorSnapshot(snapshot())]);
    setFuture([]);
  }
  function undo() {
    if (past.length === 0) return;
    const s = past[past.length - 1];
    const before = snapshot();
    setPast(past.slice(0, -1));
    setFuture([before, ...future]);
    applySnapshot(s);
    setDirty(true);
    syncHistoryDeskLayouts(before.desks, s.desks);
  }
  function redo() {
    if (future.length === 0) return;
    const s = future[0];
    const before = snapshot();
    setFuture(future.slice(1));
    setPast([...past, before]);
    applySnapshot(s);
    setDirty(true);
    syncHistoryDeskLayouts(before.desks, s.desks);
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
      setGraphSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomEntered, roomPath]);

  useEffect(() => {
    if (!IS_TAURI || !roomEntered || !roomPath || !historyReadyRef.current || !roomBaselineRef.current) return;
    const timer = window.setTimeout(() => {
      void saveEditorHistory({
        version: 1,
        roomPath,
        baseRoomJson: roomBaselineRef.current,
        current: cloneEditorSnapshot(snapshot()),
        past: past.slice(-50).map(cloneEditorSnapshot),
        future: future.slice(0, 50).map(cloneEditorSnapshot),
        dirty,
        updatedAt: Date.now(),
      }).catch((error) => setStatus(`草稿历史持久化失败：${error}`));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [roomEntered, roomPath, dirty, edges, desks, dock, transition, startName, startContent, idleName, idleContent, hasStart, startDesk, past, future]);

  useEffect(() => {
    if (!IS_TAURI || roomVersion === 3 || !roomEntered || !roomPath || roomPath !== appliedRoom) return;
    let disposed = false;
    let revision = 0;
    const mergeDesktopLayout = async () => {
      const targetPath = roomPath;
      const currentRevision = ++revision;
      try {
        const json = await invoke<string>("read_room", { path: `${targetPath}\\room.json` });
        const room = JSON.parse(json);
        if (disposed || currentRevision !== revision || targetPath !== roomPath || appliedRoom !== targetPath) return;
        const persistedDesks = Array.isArray(room.desks) ? room.desks.map(cleanDesk) : null;
        if (!persistedDesks?.length) return;
        const merged = mergeLiveLayoutFields(snapshot(), persistedDesks);
        const baseline = normalizeRoomJson(json);
        roomBaselineRef.current = baseline;
        setDesks(merged.desks);
        setDirty(normalizeRoomJson(JSON.stringify(buildRoomV2(merged.desks))) !== baseline);
      } catch (error) {
        if (!disposed) setStatus(`桌面布局回读失败：${String(error)}`);
      }
    };
    window.addEventListener("focus", mergeDesktopLayout);
    return () => {
      disposed = true;
      window.removeEventListener("focus", mergeDesktopLayout);
    };
  }, [roomEntered, roomPath, appliedRoom, desks, edges, dock, transition, startName, startContent, idleName, idleContent, hasStart, startDesk]);

  const sortedRooms = [...rooms].sort((left, right) => roomSort === "name-desc"
    ? right.name.localeCompare(left.name)
    : roomSort === "desks-desc"
      ? right.desks - left.desks || left.name.localeCompare(right.name)
      : left.name.localeCompare(right.name));
  const filteredRooms = sortedRooms.filter((r) => r.name.toLowerCase().includes(roomQuery.toLowerCase()));
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
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        mode={mode}
        onMode={setMode}
        theme={theme}
        onTheme={setTheme}
        isTauri={IS_TAURI}
        coreIdentity={coreIdentity}
        v3Session={v3Session}
        coreIdentityError={coreIdentityError}
        coreBusy={coreBusy}
        onCoreAction={(action) => void handleCoreAction(action)}
        status={status}
        showPreview={showPreview}
        canPreview={activeRoomPolicy.preview && !roomIntegrityReason}
        previewDisabledReason={roomIntegrityReason ?? (!activeRoomPolicy.preview ? readOnlyRoomMessage(roomVersion) : undefined)}
        onTogglePreview={() => {
          setShowPreview((value) => !value);
          if (!showPreview) setEditNav("room");
        }}
      />

      {mode === "use" ? (
        <UsePage
          rooms={rooms}
          visibleRooms={pagedRooms}
          filteredCount={filteredRooms.length}
          heroRoom={heroRoom}
          appliedRoom={appliedRoom}
          query={roomQuery}
          sort={roomSort}
          page={roomPageCur}
          pageCount={roomPageCount}
          multiMode={roomMultiMode}
          selectedRooms={selectedRooms}
          selectedCount={roomActionPaths.length}
          busy={roomBusy}
          coreIdentity={readyCoreIdentity}
          isTauri={IS_TAURI}
          onQuery={(value) => { setRoomQuery(value); setRoomPage(1); }}
          onSort={(value) => { setRoomSort(value); setRoomPage(1); }}
          onPage={setRoomPage}
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
          onSelectRoom={selectRoom}
          onApplyRoom={(room) => void applyRoomFromCard(room)}
          onDuplicateRoom={(room) => void duplicateRoom(room)}
          onRenameRoom={(room) => void renameRoom(room)}
          onEditRoom={(room) => void enterRoomEditor(room)}
          onStopRoom={() => void stopWallpaper()}
        />
      ) : mode === "edit" ? (
        /* ===== edit mode ===== */
        <div className="flex min-h-0 flex-1">
          <EditorNavigation
            navOpen={navOpen}
            editNav={editNav}
            onToggle={() => setNavOpen((value) => !value)}
            onNavigate={(value) => {
              setEditNav(value);
              if (value === "room") setRoomEntered(false);
            }}
          />
          {/* content: library / room(preview) */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {showPreview && activeRoomPolicy.preview && !roomIntegrityReason ? (
              <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
                <iframe
                  ref={previewRef}
                  src={previewSrc}
                  onLoad={postRoom}
                  title="Room 预览"
                  className="aspect-video w-full max-w-4xl rounded-lg border border-border"
                />
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>实时预览 · 只使用内存中的原生 room.json v2 草稿，不写源文件或运行包</span>
                  <Button variant="outline" size="sm" onClick={enterFullscreenPreview}>
                    全屏预览
                  </Button>
                </div>
              </div>
            ) : editNav === "library" ? (
              <EditorAppLibrary
                apps={apps}
                filteredApps={filtered}
                query={query}
                selected={selected}
                source={libSource}
                onQuery={setQuery}
                onAdd={() => void manualAdd()}
                onDelete={() => void deleteFromLibrary()}
                onScan={() => void scanMerge()}
                onToggleSelect={toggleSelect}
              />
            ) : editNav === "dock" ? (
              <DockLibrary
                presets={dockPresets}
                onImport={importDockPreset}
                onSave={saveDockPreset}
              />
            ) : editNav === "room" && !roomEntered ? (
              <EditorRoomLibrary
                rooms={sortedRooms}
                selectedRoom={pickedRoom}
                appliedRoom={appliedRoom}
                busy={roomBusy}
                coreIdentity={readyCoreIdentity}
                isTauri={IS_TAURI}
                onSelect={(room) => setRoomPickPath(room.path)}
                onNew={() => void addRoomFromList()}
                onEdit={(room) => void enterRoomEditor(room)}
                onApply={(room) => void applyRoomDir(room.path)}
                onDuplicate={(room) => void duplicateRoom(room)}
                onRename={(room) => void renameRoom(room)}
              />
            ) : roomVersion === 3 && nativeRoom && roomPath ? (
              <V3RoomEditor key={roomPath} room={nativeRoom} path={roomPath} apps={apps} isTauri={IS_TAURI}
                canApply={Boolean(readyCoreIdentity)}
                onSaveAs={json => saveAs(json)}
                onShare={() => exportRooms([roomPath])}
                onDirty={setDirty}
                onBack={() => {setRoomEntered(false); setDirty(false);}}
                onSaved={() => {void refreshRooms(libDir);}}
                onApply={() => invoke("apply_room", {roomDir:roomPath})}
                onApplied={() => {setAppliedRoom(roomPath); setStatus("已应用原生 Room v3");}}
              />
            ) : (
              /* entered a room: desk editing */
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <RoomEditorHeader
                  roomName={roomPath?.split("\\").pop() ?? "（未选房间）"}
                  dirty={dirty}
                  editorView={editorView}
                  canUndo={past.length > 0}
                  canRedo={future.length > 0}
                  canSave={!roomIntegrityReason}
                  saveDisabledReason={roomIntegrityReason ?? undefined}
                  canApply={(!IS_TAURI || Boolean(readyCoreIdentity)) && !roomIntegrityReason}
                  applyDisabledReason={roomIntegrityReason ?? (IS_TAURI && !readyCoreIdentity ? "Dext Core 未连接" : undefined)}
                  canDeleteDesk={desks.length > 1 && Boolean(desks[activeDesk])}
                  onBack={() => setRoomEntered(false)}
                  onView={setEditorView}
                  onCreatorImport={() => setShowCreatorImport(true)}
                  onImportWidget={() => void importWidgetForDesk()}
                  onAddDesk={addDesk}
                  onUndo={undo}
                  onRedo={redo}
                  onSave={() => void (async () => {
                    if (IS_TAURI) await saveRoom();
                    else {
                      setDirty(false);
                      setStatus("已保存（mock，未写盘）");
                    }
                  })()}
                  onSaveAs={() => {
                    if (IS_TAURI) void saveAs();
                    else setStatus("另存为请在桌面配置器中使用");
                  }}
                  onApply={() => void applyCurrent()}
                  onDeleteDesk={() => {
                    const current = desks[activeDesk];
                    if (current && confirm(`删除「${current.name}」？此操作可用撤销恢复。`)) removeDesk(activeDesk);
                  }}
                />
                {roomOrphanResources.length > 0 && (
                  <div role="alert" className="rounded-lg border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">Room 中有未声明的 Widget 资源</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          你可以继续查看和编辑；保存、预览、应用和导出会被阻止，直到这些文件移至恢复目录。
                        </p>
                        <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto font-mono text-xs">
                          {roomOrphanResources.map((resource) => <li key={resource}>{resource}</li>)}
                        </ul>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={roomRepairBusy}
                        onClick={() => void recoverRoomOrphans()}
                      >
                        {roomRepairBusy ? "正在移至恢复目录…" : "移至恢复目录并继续"}
                      </Button>
                    </div>
                  </div>
                )}
                {!roomOrphanResources.length && roomRecoveryDir && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    未声明资源已安全移出；恢复副本：<span className="font-mono">{roomRecoveryDir}</span>
                  </div>
                )}
                <div className="flex min-h-0 flex-1 gap-3">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {editorView === "dock" ? (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background p-3">
                    <DockEditor
                      dock={dock}
                      setDock={setDock}
                      apps={apps}
                      desks={desks}
                      setDesks={setDesks}
                      activeDesk={activeDesk}
                      onBeginChange={pushHistory}
                      touch={touch}
                      setStatus={setStatus}
                    />
                  </div>
                ) : editorView === "canvas" ? (
                  <DesktopCanvasEditor
                    desks={desks}
                    activeDesk={activeDesk}
                    roomDock={dock}
                    roomPath={roomPath}
                    selectedWidgetId={selectedWidgetId}
                    permissionReview={permissionReviews.find((item) => item.id === (selectedWidgetId ? `widget:${selectedWidgetId}` : `scene:desk:${activeDesk}`)) ?? null}
                    onPermissionChange={(approved) => setSubjectPermission(selectedWidgetId ? `widget:${selectedWidgetId}` : `scene:desk:${activeDesk}`, approved)}
                    onActiveDesk={(index) => {
                      setActiveDesk(index);
                      setGraphSel(`d${index}`);
                    }}
                    onSelectWidget={setSelectedWidgetId}
                    onBeginChange={pushHistory}
                    onDeskChange={(nextDesk, message) => {
                      setDesks((current) => current.map((item, index) => index === activeDesk ? nextDesk : item));
                      touch();
                      if (message) setStatus(message);
                    }}
                  />
                ) : (
                  <>
                    {/* 上：Room 结构思维导图（Desk 对拆为两条方向线，各带箭头与 switch chip） */}
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
	                          {edges.map((edge) => {
	                            const fromNode = geom.nodes[edge.from];
	                            const toNode = geom.nodes[edge.to];
	                            const pair = edge.from !== "start" && edge.to !== "start";
	                            const laneOffset = pair && fromNode && toNode ? (toNode.cy >= fromNode.cy ? -20 : 20) : 0;
	                            const segments = routeGraphEdge(edge, geom.nodes, laneOffset);
	                            return (
	                              <g key={edge.id} data-graph-edge={edge.id} className={pair && graphSel === edge.id ? "text-primary" : "text-foreground/60"}>
	                                {segments.map((segment, index) => (
	                                  <line
	                                    key={index}
	                                    {...segment}
	                                    fill="none"
	                                    stroke="currentColor"
	                                    strokeWidth={2.2}
	                                    strokeLinecap="round"
	                                    vectorEffect="non-scaling-stroke"
	                                    markerEnd={index === segments.length - 1 ? "url(#garrow)" : undefined}
	                                  />
	                                ))}
	                              </g>
	                            );
	                          })}
	                        </svg>
	                        {/* switch 标记（每条方向线一个，骑线显示，点选即编辑该方向） */}
	                        {edges
	                          .filter((edge) => edge.from !== "start" && edge.to !== "start")
	                          .map((e) => {
	                          const fromNode = geom.nodes[e.from];
	                          const toNode = geom.nodes[e.to];
	                          if (!fromNode || !toNode) return null;
	                          const base = graphSwitchPosition(e, geom.nodes);
	                          if (!base) return null;
	                          const downward = toNode.cy >= fromNode.cy;
	                          const nameOf = (id: string) => desks[parseInt(id.slice(1), 10)]?.name ?? id;
	                          return (
	                            <button
	                              key={e.id}
	                              data-graph-switch={e.id}
	                              title={`切换：${nameOf(e.from)} → ${nameOf(e.to)}`}
	                              onClick={() => setGraphSel(e.id)}
	                              style={{ left: base.left + (downward ? -20 : 20), top: base.top }}
                              className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border bg-background px-1 py-0.5 text-[10px] transition-colors ${
                                graphSel === e.id
                                  ? "border-primary bg-primary/10 font-medium text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              <ArrowRightLeft className="h-3 w-3" />
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
                        {/* 待机是 Lively 屏保入口，不属于 Desk 导航拓扑。 */}
                        <button
                          data-graph-node="idle"
                          title={idleName}
                          onClick={() => setGraphSel("idle")}
                          className={`absolute right-[3%] top-1/2 z-10 flex w-[11%] min-w-24 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border-2 py-3 transition-colors ${
                            graphSel === "idle"
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          <Moon className="h-5 w-5 text-primary" />
                          <span className="w-full truncate px-1 text-xs font-medium">{idleName}</span>
                          <span className="text-[10px] text-muted-foreground">Lively 待机</span>
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
                      ) : graphSel === "start" || graphSel === "idle" || /^d\d+$/.test(graphSel) ? (
                        (() => {
                          const isStart = graphSel === "start";
                          const isIdle = graphSel === "idle";
                          const deskIndex = isStart || isIdle ? -1 : parseInt(graphSel.slice(1), 10);
                          const name = isStart
                            ? startName
                            : isIdle
                              ? idleName
                              : (desks[deskIndex]?.name ?? "");
                          const content = isStart
                            ? startContent
                            : isIdle
                              ? idleContent
                              : desks[deskIndex]?.background ?? null;
                          const subjectId = isStart ? "scene:start" : isIdle ? "scene:idle" : `scene:desk:${deskIndex}`;
                          return (
                            <>
                              <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                {isStart ? (
                                  <MonitorPlay className="h-3.5 w-3.5 text-primary" />
                                ) : isIdle ? (
                                  <Moon className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                                )}
                                {isStart ? "启动画面" : isIdle ? "待机画面" : "Desk"}
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
                              {!isStart && !isIdle && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-7 w-7"
                                    title="上移 Desk"
                                    disabled={deskIndex === 0}
                                    onClick={() => moveDesk(deskIndex, deskIndex - 1)}
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-7 w-7"
                                    title="下移 Desk"
                                    disabled={deskIndex === desks.length - 1}
                                    onClick={() => moveDesk(deskIndex, deskIndex + 1)}
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
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
	                              {!isStart && !isIdle && (
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
                              <ContentInspector
                                content={content}
                                roomPath={roomPath}
                                emptyLabel={isStart ? "尚未选择启动画面" : isIdle ? "尚未设置待机画面" : "尚未设置背景"}
                              />
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {isStart ? "画面素材：" : isIdle ? "待机素材：" : "壁纸素材："}
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
                              {content?.type === "html" && (
                                <div className="w-[52rem] shrink-0 border-l border-border pl-4">
                                  <SceneCapabilityEditor
                                    compact
                                    scene={content}
                                    permissionReview={permissionReviews.find((item) => item.id === subjectId) ?? null}
                                    onPermissionChange={(approved) => setSubjectPermission(subjectId, approved)}
                                    onBeginChange={pushHistory}
                                    onSceneChange={(next, message) => {
                                      if (isStart) setStartContent(next);
                                      else if (isIdle) setIdleContent(next);
                                      else setDesks((current) => current.map((desk, index) => index === deskIndex ? { ...desk, background: next } : desk));
                                      touch();
                                      setStatus(message);
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        edges
                          .filter((e) => e.id === graphSel)
                          .map((e) => {
                            const nameOf = (id: string) =>
                              id === "start"
                                ? startName
                                : (desks[parseInt(id.slice(1), 10)]?.name ?? id);
                            const content = typeof e.trans === "object" ? e.trans : null;
                            const route = `${Number(e.from.slice(1))}>${Number(e.to.slice(1))}`;
                            const subjectId = `scene:switch:${route}`;
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
                                {content?.type === "html" && (
                                  <div className="w-[52rem] shrink-0 border-l border-border pl-4">
                                    <SceneCapabilityEditor
                                      compact
                                      scene={content}
                                      permissionReview={permissionReviews.find((item) => item.id === subjectId) ?? null}
                                      onPermissionChange={(approved) => setSubjectPermission(subjectId, approved)}
                                      onBeginChange={pushHistory}
                                      onSceneChange={(next, message) => {
                                        setEdges((current) => current.map((edge) => edge.id === e.id ? { ...edge, trans: next } : edge));
                                        touch();
                                        setStatus(message);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </>
                )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <SettingsPage
          theme={theme}
          setTheme={setTheme}
          libDir={libDir}
          onChangeLib={(path) => void changeLib(path)}
          coreIdentity={readyCoreIdentity}
          setStatus={setStatus}
          minimizeAfterDeskAppAdd={minimizeAfterDeskAppAdd}
          onMinimizeAfterDeskAppAddChange={updateMinimizeAfterDeskAppAdd}
        />
      )}
      {pickerDesk && appPickerDesk !== null && (
        <AppPickerDialog
          title={`放入应用 · ${pickerDesk.name}`}
          description="点击应用即可加入或移出；加入后可在桌面长按图标拖动位置。"
          apps={apps}
          isSelected={(app) => pickerDesk.icons.some((icon) => icon.launch.target === app.target)}
          onToggle={(app) => toggleDeskApp(app, appPickerDesk)}
          onClose={() => setAppPickerDesk(null)}
        />
      )}
      {showCreatorImport && roomPath && (
        <CreatorImportDialog
          roomPath={roomPath}
          roomJson={buildRoomV2()}
          activeDesk={activeDesk}
          deskCount={desks.length}
          onImported={async () => {
            await openRoom(roomPath, false);
            setEditorView("canvas");
            setStatus("AI 创作内容已安全写入 Room；系统能力仍需本机单独授权");
          }}
          onClose={() => setShowCreatorImport(false)}
        />
      )}
      {rawRoomView && <dialog ref={rawRoomDialogRef} onCancel={()=>setRawRoomView(null)} aria-label="原始 Room 清单（只读）" className="fixed inset-0 z-50 m-auto flex max-h-[85vh] w-[min(900px,90vw)] flex-col rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">{rawRoomView.name} · 原始清单（只读）</h2><Button autoFocus variant="outline" onClick={()=>setRawRoomView(null)}>关闭</Button></div>
        <p className="my-3 text-sm text-amber-600 dark:text-amber-300">{rawRoomView.message}</p>
        <pre tabIndex={0} className="min-h-0 flex-1 overflow-auto rounded-md bg-muted p-4 text-xs">{rawRoomView.json}</pre>
      </dialog>}      {fullscreenPreview && (
        <div className="fixed inset-0 z-50 bg-black">
          <iframe
            ref={fullscreenPreviewRef}
            src={previewSrc}
            onLoad={postRoom}
            title="Room 全屏预览"
            className="h-full w-full border-0 bg-black"
          />
          <div className="absolute right-4 top-4 z-10 flex items-center gap-3 rounded-md border border-white/15 bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className="text-[11px] text-white/70">全屏预览 · 只读 · Esc 退出</span>
            <Button variant="outline" size="sm" onClick={exitFullscreenPreview}>
              退出全屏
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
