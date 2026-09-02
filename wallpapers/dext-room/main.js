const DEFAULT_ROOM = {
  version: 2,
  startDesk: 0,
  switch: "slide",
  switches: {},
  desks: [
    {
      name: "主页",
      background: { name: "主页背景", type: "image", src: "background/desk1-bg.png" },
      iconSize: "medium",
      icons: [
        {
          glyph: "🌐",
          label: "浏览器",
          color: "#3b82f6",
          action: "启动 浏览器",
          launch: {
            target: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            args: "",
            workdir: "",
          },
          x: 0,
          y: 0,
        },
        { glyph: "🎮", label: "游戏", color: "#10b981", action: "启动 游戏", x: 1, y: 0 },
        { glyph: "🎵", label: "音乐", color: "#f59e0b", action: "启动 音乐", x: 2, y: 0 },
        {
          glyph: "📁",
          label: "文件",
          color: "#8b5cf6",
          action: "打开 文件夹",
          launch: { target: "explorer.exe", args: "shell:MyComputerFolder", workdir: "" },
          x: 3,
          y: 0,
        },
        {
          glyph: "⚙️",
          label: "设置",
          color: "#6b7280",
          action: "打开 设置",
          launch: { target: "ms-settings:", args: "", workdir: "" },
          x: 0,
          y: 1,
        },
      ],
      widgets: [],
    },
    {
      name: "工作台",
      background: { name: "工作台背景", type: "image", src: "background/desk2-bg.png" },
      iconSize: "medium",
      icons: [
        {
          glyph: "💻",
          label: "终端",
          color: "#111827",
          action: "启动 终端",
          launch: { target: "wt.exe", args: "", workdir: "" },
          x: 0,
          y: 0,
        },
        {
          glyph: "📝",
          label: "笔记",
          color: "#ef4444",
          action: "启动 笔记",
          launch: {
            target: "C:\\Users\\JAN\\Desktop\\Obsidian.lnk", args: "", workdir: "",
          },
          x: 1,
          y: 0,
        },
        { glyph: "📊", label: "监控", color: "#06b6d4", action: "打开 监控面板", x: 2, y: 0 },
      ],
      widgets: [],
    },
  ],
};

// room.json overrides the default when present (written by the Dext configurator).
let ROOM = DEFAULT_ROOM;

// dev preview: ?room=<prefix>/ points at any room dir (e.g. ../../rooms/cockpit-room/);
// production (Lively virtual host) has no param and uses package-relative paths.
const SEARCH = new URLSearchParams(location.search);
const PREVIEW_MODE = SEARCH.get("preview") === "1";
const SCREENSAVER_MODE = SEARCH.get("screensaver") === "1";
const PREVIEW_PARENT_ORIGINS = new Set([
  "http://tauri.localhost",
  "http://localhost:1420",
]);
let assetBase = SEARCH.get("room") ?? "";
const ROOM_CANVAS = { width: 1920, height: 1080 };
const WIDGET_PROTOCOL = 1;
const MAX_WIDGET_MESSAGE_BYTES = 64 * 1024;

function safeAssetPath(src) {
  return typeof src === "string" &&
    src.length > 0 &&
    !src.startsWith("/") &&
    !src.includes("\\") &&
    !src.split("/").some((part) => !part || part === "." || part === "..");
}

function assetUrl(src) {
  if (!safeAssetPath(src)) return null;
  try {
    return new URL(src, assetBase ? new URL(assetBase, location.href) : location.href).href;
  } catch {
    return null;
  }
}

// ---- official-host lifecycle hooks (not reachable from sandboxed Room content) ----
const dextListeners = { ready: [], deskchange: [], editchange: [] };
function dextEmit(kind, detail) {
  dextListeners[kind].forEach((fn) => {
    try { fn(detail); } catch (e) { console.error("[dext] listener error", e); }
  });
}
window.dext = {
  onReady: (fn) => dextListeners.ready.push(fn),
  onDeskChange: (fn) => dextListeners.deskchange.push(fn),
  onEditChange: (fn) => dextListeners.editchange.push(fn),
  getRoom: () => ROOM,
  getCurrentDesk: () => currentDesk,
};

// ---- unified playable slot (native room.json v2) ----
// User HTML is always a sandboxed child. It can render its own scene, but it cannot
// reach the official Desk/Dock DOM or use the top-level WebView IPC channel.
let activeSlot = null;
function playSlot(slot, opts = {}) {
  const onDone = opts.onDone ?? (() => {});
  const persistent = opts.persistent === true;
  const src = slot && typeof slot === "object" ? assetUrl(slot.src) : null;
  if (!src || !["image", "video", "html"].includes(slot.type)) {
    onDone();
    return { cancel() {} };
  }
  activeSlot?.cancel();
  const wrap = document.createElement("div");
  wrap.className = "dext-scene-slot";
  wrap.dataset.kind = opts.kind ?? "";
  let finished = false;
  let timer = null;
  let onMsg = null;
  let media = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (onMsg) window.removeEventListener("message", onMsg);
    if (media instanceof HTMLMediaElement) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    } else if (media instanceof HTMLIFrameElement) {
      media.src = "about:blank";
    }
    wrap.remove();
    if (activeSlot?.cancel === cancel) activeSlot = null;
    onDone();
  };
  const cancel = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (onMsg) window.removeEventListener("message", onMsg);
    if (media instanceof HTMLMediaElement) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    } else if (media instanceof HTMLIFrameElement) {
      media.src = "about:blank";
    }
    wrap.remove();
    if (activeSlot?.cancel === cancel) activeSlot = null;
  };
  activeSlot = { cancel };

  if (slot.type === "image") {
    const image = document.createElement("img");
    media = image;
    image.src = src;
    image.alt = slot.name ?? "";
    image.addEventListener("error", finish, { once: true });
    wrap.appendChild(image);
    document.body.appendChild(wrap);
    if (!persistent) timer = setTimeout(finish, opts.durationMs ?? 500);
    return { cancel };
  }

  if (slot.type === "video") {
    const v = document.createElement("video");
    media = v;
    v.src = src;
    v.muted = true;
    v.autoplay = true;
    v.playsInline = true;
    v.loop = persistent;
    if (!persistent) v.addEventListener("ended", finish);
    v.addEventListener("error", finish);
    wrap.appendChild(v);
    document.body.appendChild(wrap);
    v.play().catch(finish);
    return { cancel };
  }

  if (slot.type === "html") {
    const f = document.createElement("iframe");
    media = f;
    const instanceId = globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sceneUrl = new URL(src);
    sceneUrl.searchParams.set("dextInstanceId", instanceId);
    sceneUrl.searchParams.set("dextKind", opts.kind ?? "");
    f.src = sceneUrl.href;
    f.sandbox = "allow-scripts";
    f.allow = "autoplay";
    f.referrerPolicy = "no-referrer";
    wrap.appendChild(f);
    document.body.appendChild(wrap);
    if (!persistent) {
      onMsg = (e) => {
        const data = e.data;
        if (e.source !== f.contentWindow ||
            data?.type !== "dext:scene" ||
            data.instanceId !== instanceId) return;
        if (data.event === "done") finish();
      };
      window.addEventListener("message", onMsg);
      timer = setTimeout(finish, (opts.timeoutSeconds ?? 60) * 1000);
    }
    return { cancel };
  }

  // unknown slot: don't hang the room on it
  finish();
  return { cancel };
}

// start: fullscreen cover on room load; reveal on slot end (video ended / html ack / timeout)
function playStart() {
  const slot = ROOM.start;
  if (!slot) return;
  playSlot(slot, { kind: "start" });
}

function renderIdle() {
  document.documentElement.dataset.mode = "screensaver";
  activeSlot?.cancel();
  playSlot(ROOM.idle, { kind: "idle", persistent: true });
}

async function loadRoom() {
  if (PREVIEW_MODE) {
    currentDesk = 0;
    if (SCREENSAVER_MODE) renderIdle();
    else renderDesk(currentDesk);
    for (const origin of PREVIEW_PARENT_ORIGINS) {
      window.parent.postMessage({ type: "dext:preview-ready" }, origin);
    }
    return;
  }
  try {
    const res = await fetch(assetUrl("room.json") ?? "room.json");
    if (res.ok) {
      const room = await res.json();
      // Widget code remains inert until the separate trusted WidgetHost work package.
      if (room?.version === 2 && room?.desks?.length) ROOM = room;
    }
  } catch (e) {
    // keep default (e.g. opened outside Lively via file://)
  }
  currentDesk = Number.isInteger(ROOM.startDesk) && ROOM.startDesk >= 0 && ROOM.startDesk < ROOM.desks.length
    ? ROOM.startDesk
    : 0;
  if (SCREENSAVER_MODE) {
    renderIdle();
    dextEmit("ready", { deskCount: ROOM.desks.length, screensaver: true });
    return;
  }
  renderDesk(currentDesk);
  playStart();
  dextEmit("ready", { deskCount: ROOM.desks.length });
}

// Runtime telemetry is deliberately kept outside ROOM so it can never be saved.
const runningAppTargets = new Set();
function launchTargetKey(target) {
  return typeof target === "string" && target.trim() ? target.trim().toLocaleLowerCase() : "";
}

function updateAppRuntimeStatus(target, running) {
  const key = launchTargetKey(target);
  if (!key) return;
  if (running) runningAppTargets.add(key);
  else runningAppTargets.delete(key);
  renderDockApps(dockCfg());
}

if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", (e) => {
    let data = e.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (data?.type === "dext:app-status") {
      updateAppRuntimeStatus(data.target, data.running);
    }
  });
}

// Windows-style icon size presets; desk.iconSize picks one (default medium)
const ICON_SIZES = {
  large: { icon: 72, cellW: 124, cellH: 152, label: 14 },
  medium: { icon: 56, cellW: 96, cellH: 120, label: 13 },
  small: { icon: 32, cellW: 64, cellH: 84, label: 11 },
};

function sizeOf(desk) {
  return ICON_SIZES[desk.iconSize] ?? ICON_SIZES.medium;
}

const deskMain = document.getElementById("desk-main");
const stageEl = document.getElementById("desk-staging");
const bgEl = deskMain.querySelector(".desk-bg");
const bgVideo = deskMain.querySelector(".desk-video");
const iconLayer = deskMain.querySelector(".icon-layer");
const widgetLayer = deskMain.querySelector(".widget-layer");
const indicatorEl = document.getElementById("desk-indicator");
const transitionEl = document.getElementById("transition");
const transitionTextEl = document.getElementById("transition-text");
const toastEl = document.getElementById("toast");
const doneBtn = document.getElementById("edit-done");
const dockEl = document.getElementById("dock");
const dockAppsEl = document.getElementById("dock-apps");

let currentDesk = 0;
let switching = false;
let editMode = false;

// ---- trusted WidgetHost ----------------------------------------------------
// Widget documents remain opaque sandbox origins. The official host owns their
// rectangle, lifecycle and message identity; author code never receives the
// top-level WebView object or direct access to Desk/Dock DOM.
const widgetInstancesBySource = new Map();
const widgetInstancesByLayer = new WeakMap();

function newInstanceId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validWidget(widget) {
  const p = widget?.placement;
  return widget && typeof widget === "object" &&
    typeof widget.id === "string" && widget.id.length > 0 &&
    typeof widget.name === "string" && widget.name.length > 0 &&
    assetUrl(widget.src) && p && typeof p === "object" &&
    [p.x, p.y, p.width, p.height, p.z].every(Number.isInteger);
}

function safePlacement(value) {
  const width = Math.min(Math.max(value.width, 64), ROOM_CANVAS.width);
  const height = Math.min(Math.max(value.height, 64), ROOM_CANVAS.height);
  return {
    x: Math.min(Math.max(value.x, 0), ROOM_CANVAS.width - width),
    y: Math.min(Math.max(value.y, 0), ROOM_CANVAS.height - height),
    width,
    height,
    z: Math.min(Math.max(value.z, 0), 255),
  };
}

function disposeWidgets(layer) {
  const instances = widgetInstancesByLayer.get(layer) ?? [];
  for (const instance of instances) {
    widgetInstancesBySource.delete(instance.frame.contentWindow);
    instance.disposed = true;
    instance.frame.src = "about:blank";
    instance.wrap.remove();
  }
  widgetInstancesByLayer.delete(layer);
  layer.replaceChildren();
}

function postWidgetInit(instance) {
  if (instance.disposed || !instance.frame.contentWindow) return;
  instance.frame.contentWindow.postMessage({
    type: "dext:widget:init",
    protocol: WIDGET_PROTOCOL,
    instanceId: instance.instanceId,
    token: instance.token,
    widgetId: instance.widget.id,
    deskIndex: instance.deskIndex,
    config: instance.widget.config && typeof instance.widget.config === "object"
      ? JSON.parse(JSON.stringify(instance.widget.config))
      : {},
    permissions: Array.isArray(instance.widget.permissions) ? [...instance.widget.permissions] : [],
    viewport: { ...ROOM_CANVAS },
  }, "*");
}

function mountWidgets(layer, desk, deskIndex) {
  disposeWidgets(layer);
  const widgets = Array.isArray(desk.widgets) ? desk.widgets.filter(validWidget) : [];
  const instances = [];
  for (const widget of widgets) {
    const src = assetUrl(widget.src);
    if (!src) continue;
    const placement = safePlacement(widget.placement);
    const wrap = document.createElement("div");
    wrap.className = "dext-widget";
    wrap.dataset.widgetId = widget.id;
    wrap.dataset.state = "loading";
    wrap.style.left = `${placement.x / ROOM_CANVAS.width * 100}%`;
    wrap.style.top = `${placement.y / ROOM_CANVAS.height * 100}%`;
    wrap.style.width = `${placement.width / ROOM_CANVAS.width * 100}%`;
    wrap.style.height = `${placement.height / ROOM_CANVAS.height * 100}%`;
    wrap.style.zIndex = String(placement.z);

    const frame = document.createElement("iframe");
    const instanceId = newInstanceId();
    const token = newInstanceId();
    const widgetUrl = new URL(src);
    widgetUrl.searchParams.set("dextInstanceId", instanceId);
    widgetUrl.searchParams.set("dextKind", "widget");
    frame.src = widgetUrl.href;
    frame.title = widget.name;
    frame.sandbox = "allow-scripts";
    frame.allow = "autoplay";
    frame.referrerPolicy = "no-referrer";
    wrap.appendChild(frame);
    layer.appendChild(wrap);

    const instance = { instanceId, token, widget, deskIndex, frame, wrap, disposed: false };
    instances.push(instance);
    widgetInstancesBySource.set(frame.contentWindow, instance);
    frame.addEventListener("load", () => postWidgetInit(instance));
    frame.addEventListener("error", () => { wrap.dataset.state = "error"; });
  }
  widgetInstancesByLayer.set(layer, instances);
}

function clearStaging() {
  const layer = stageEl.querySelector(".widget-layer");
  if (layer) disposeWidgets(layer);
  stageEl.replaceChildren();
}

window.addEventListener("message", (event) => {
  const instance = widgetInstancesBySource.get(event.source);
  if (!instance || instance.disposed) return;
  let size = MAX_WIDGET_MESSAGE_BYTES + 1;
  try { size = new TextEncoder().encode(JSON.stringify(event.data)).byteLength; } catch { return; }
  if (size > MAX_WIDGET_MESSAGE_BYTES) return;
  const data = event.data;
  if (!data || typeof data !== "object" ||
      data.type !== "dext:widget" ||
      data.protocol !== WIDGET_PROTOCOL ||
      data.instanceId !== instance.instanceId ||
      data.token !== instance.token) return;
  if (data.event === "ready") instance.wrap.dataset.state = "ready";
  if (data.event === "error") instance.wrap.dataset.state = "error";
});

// ---- dock customization (room.json "dock" key; 宽容读取，全字段可选) ----
// enabled   关掉整条 dock
// position  bottom | top | left | right（缺省 bottom）
// magnify   false 或数字：mac 式鱼眼放大的最大倍率（缺省 1.55）
// indicator "text"(默认) | "dots"
// style     {bg, blur, radius, gap, pad, icon} 直接映射 CSS 变量
// icons     常驻启动项数组，结构同桌面图标（label/glyph/color/icon_png/launch/action）
const DEFAULT_DOCK = {
  enabled: true,
  position: "bottom",
  indicator: "text",
  autoHide: false,
  style: {},
  icons: [],
};
const DOCK_POSITIONS = new Set(["bottom", "top", "left", "right"]);

// global ROOM.dock is the baseline; desks[i].dock overrides any subset per desk
// (desk-level icons REPLACE the global list rather than appending)
function dockCfg() {
  const g = ROOM.dock && typeof ROOM.dock === "object" ? ROOM.dock : {};
  const desk = ROOM.desks[currentDesk] ?? {};
  const d = desk.dock && typeof desk.dock === "object" ? desk.dock : {};
  return {
    ...DEFAULT_DOCK,
    ...g,
    ...d,
    style: { ...DEFAULT_DOCK.style, ...(g.style ?? {}), ...(d.style ?? {}) },
    icons: Array.isArray(d.icons) ? d.icons : Array.isArray(g.icons) ? g.icons : [],
  };
}

function renderDock() {
  const cfg = dockCfg();
  dockEl.style.display = cfg.enabled ? "" : "none";
  const pos = DOCK_POSITIONS.has(cfg.position) ? cfg.position : "bottom";
  for (const p of DOCK_POSITIONS) dockEl.classList.toggle(`dock-${p}`, p === pos);
  dockEl.classList.toggle("dock-autohide", !!cfg.autoHide);

  // style overrides -> CSS vars; unset ones are cleared so per-desk switching
  // doesn't leak the previous desk's values (removeProperty resets to var() default)
  const st = cfg.style;
  const vars = [
    ["--dock-bg", st.bg],
    ["--dock-blur", st.blur != null ? `${st.blur}px` : undefined],
    ["--dock-radius", st.radius],
    ["--dock-gap", st.gap != null ? `${st.gap}px` : undefined],
    ["--dock-pad", st.pad],
    ["--dock-icon", st.icon != null ? `${st.icon}px` : undefined],
  ];
  for (const [name, val] of vars) {
    if (val === undefined || val === "") dockEl.style.removeProperty(name);
    else dockEl.style.setProperty(name, String(val));
  }

  renderDockApps(cfg);
}

// 鱼眼放大已移除（2026-08-27 用户拍板暂不做；git 历史可恢复）
function renderDockApps(cfg) {
  dockEl.classList.toggle("has-apps", cfg.icons.length > 0);
  dockAppsEl.replaceChildren();
  cfg.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "dock-icon";
    el.title = item.label ?? "";
    el.classList.toggle("is-running", runningAppTargets.has(launchTargetKey(item.launch?.target)));
    el.appendChild(iconVisual(item));
    const removeButton = document.createElement("button");
    removeButton.className = "icon-del dock-icon-del";
    removeButton.title = "删除";
    removeButton.textContent = "×";
    el.appendChild(removeButton);
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action ?? item.label ?? "");
      }
    });
    removeButton.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!editMode) return;
      cfg.icons.splice(i, 1);
      persistRoom();
      renderDock();
    });
    attachDockPress(el, item, cfg);
    dockAppsEl.appendChild(el);
  });
}

function dockDropHit(x, y) {
  const cfg = dockCfg();
  if (!cfg.enabled) return false;
  const rect = dockEl.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function setDockDropFeedback(x, y) {
  const hit = dockDropHit(x, y);
  dockEl.classList.toggle("drop-target", hit);
  return hit;
}

function addDockIconFromDesk(item) {
  const launch = item?.launch;
  const target = typeof launch?.target === "string" ? launch.target.trim() : "";
  if (!target) {
    showToast("该图标没有可用的启动目标");
    return false;
  }
  const desk = ROOM.desks[currentDesk];
  const cfg = dockCfg();
  if (cfg.icons.some((icon) => icon?.launch?.target === target)) {
    showToast("Dock 中已存在该应用");
    return false;
  }
  if (!desk.dock || typeof desk.dock !== "object") desk.dock = {};
  if (!Array.isArray(desk.dock.icons)) desk.dock.icons = cfg.icons.map((icon) => ({ ...icon, launch: icon.launch ? { ...icon.launch } : undefined }));
  const label = typeof item.label === "string" && item.label ? item.label : target;
  desk.dock.icons.push({
    label,
    icon_png: typeof item.icon_png === "string" ? item.icon_png : "",
    glyph: item.glyph ?? "?",
    color: item.color ?? "#3b82f6",
    action: item.action ?? `启动 ${label}`,
    launch: {
      target,
      args: typeof launch.args === "string" ? launch.args : "",
      workdir: typeof launch.workdir === "string" ? launch.workdir : "",
    },
  });
  showToast(`已将 ${label} 添加到 Dock`);
  if (window.chrome?.webview?.postMessage) {
    window.chrome.webview.postMessage(JSON.stringify({
      type: "addDockIcon",
      scope: "desk",
      deskIndex: currentDesk,
      icon: desk.dock.icons[desk.dock.icons.length - 1],
    }));
  }
  return true;
}

function desktopDropHit(x, y) {
  const rect = iconLayer.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function moveDockIconToDesk(item, cfg, x, y) {
  const target = typeof item?.launch?.target === "string" ? item.launch.target.trim() : "";
  if (!target) {
    showToast("该 Dock 图标没有可用的启动目标");
    return false;
  }
  const desk = ROOM.desks[currentDesk];
  if (desk.icons.some((icon) => icon?.launch?.target === target)) {
    showToast("桌面中已存在该应用");
    return false;
  }
  const rect = iconLayer.getBoundingClientRect();
  const s = sizeOf(desk);
  const cols = Math.max(4, Math.floor(rect.width / s.cellW));
  const rows = Math.max(1, Math.floor(rect.height / s.cellH));
  const col = Math.max(0, Math.min(cols - 1, Math.floor((x - rect.left) / s.cellW)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor((y - rect.top) / s.cellH)));
  if (desk.icons.some((icon) => icon.x === col && icon.y === row)) {
    showToast("该桌面位置已有图标");
    return false;
  }
  const launch = item.launch ?? {};
  const label = typeof item.label === "string" && item.label ? item.label : target;
  desk.icons.push({
    label,
    x: col,
    y: row,
    icon_png: typeof item.icon_png === "string" ? item.icon_png : "",
    glyph: item.glyph ?? "?",
    color: item.color ?? "#3b82f6",
    action: item.action ?? `启动 ${label}`,
    launch: {
      target,
      args: typeof launch.args === "string" ? launch.args : "",
      workdir: typeof launch.workdir === "string" ? launch.workdir : "",
    },
  });
  // A desk override makes removing an inherited global icon local to this desk.
  if (!desk.dock || typeof desk.dock !== "object") desk.dock = {};
  if (Array.isArray(desk.dock.icons)) {
    desk.dock.icons = desk.dock.icons.filter((icon) => icon?.launch?.target !== target);
  } else {
    desk.dock.icons = cfg.icons
      .filter((icon) => icon?.launch?.target !== target)
      .map((icon) => ({ ...icon, launch: icon.launch ? { ...icon.launch } : undefined }));
  }
  persistRoom();
  showToast(`已将 ${label} 移到桌面`);
  return true;
}

function attachDockPress(el, item, cfg) {
  el.addEventListener("pointerdown", (e) => {
    if (!editMode || e.button !== 0 || e.target.closest(".dock-icon-del")) return;
    startDockDrag(e, el, item, cfg);
  });
}

function startDockDrag(e, el, item, cfg) {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");
  const sx = e.clientX;
  const sy = e.clientY;
  const onMove = (ev) => {
    el.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
    iconLayer.classList.toggle("drop-target", desktopDropHit(ev.clientX, ev.clientY));
  };
  const finish = (ev, canceled = false) => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
    el.classList.remove("dragging");
    el.style.transform = "";
    iconLayer.classList.remove("drop-target");
    if (!canceled && desktopDropHit(ev.clientX, ev.clientY)) {
      if (moveDockIconToDesk(item, cfg, ev.clientX, ev.clientY)) renderDesk(currentDesk);
      else renderDock();
    }
  };
  const onUp = (ev) => finish(ev);
  const onCancel = (ev) => finish(ev, true);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
}

function persistRoom() {
  if (PREVIEW_MODE || !window.chrome?.webview?.postMessage) return;
  const room = JSON.parse(JSON.stringify(ROOM));
  delete room.__source;
  window.chrome.webview.postMessage(JSON.stringify({ type: "saveRoom", room }));
}

// Malformed icons without coordinates get safe packed positions at runtime.
function normalizeCoords(desk, cols) {
  desk.icons.forEach((ic, i) => {
    ic.x = i % cols;
    ic.y = Math.floor(i / cols);
  });
}

function launchApp(launch) {
  if (window.chrome?.webview?.postMessage) {
    window.chrome.webview.postMessage(
      JSON.stringify({
        target: launch.target,
        args: launch.args ?? "",
        workdir: launch.workdir ?? "",
      })
    );
  } else {
    showToast("不在 Lively 环境内，无法启动");
  }
}

function iconVisual(item) {
  if (typeof item?.icon_png === "string" && item.icon_png) {
    const image = document.createElement("img");
    image.className = "icon-img";
    image.draggable = false;
    image.src = `data:image/png;base64,${item.icon_png}`;
    return image;
  }
  const glyph = document.createElement("div");
  glyph.className = "icon-glyph";
  glyph.textContent = typeof item?.glyph === "string" && item.glyph ? item.glyph : "?";
  const color = typeof item?.color === "string" && CSS.supports("color", item.color)
    ? item.color
    : "#3b82f6";
  glyph.style.backgroundColor = color;
  return glyph;
}

function clearBackground(bgTarget, videoTarget) {
  videoTarget.pause();
  videoTarget.removeAttribute("src");
  videoTarget.load();
  videoTarget.style.display = "none";
  bgTarget.style.backgroundImage = "none";
  bgTarget.replaceChildren();
}

// A v2 background is Content|null. HTML stays below the official icon and Dock layers.
function mountBackground(bgTarget, videoTarget, desk) {
  const bg = desk.background;
  clearBackground(bgTarget, videoTarget);
  const src = bg && typeof bg === "object" ? assetUrl(bg.src) : null;
  if (!src) return;
  if (bg.type === "video") {
    const vsrc = src;
    if (videoTarget.getAttribute("src") !== vsrc) videoTarget.src = vsrc;
    videoTarget.loop = true;
    videoTarget.muted = true;
    videoTarget.style.display = "block";
    videoTarget.play().catch(() => {});
  } else if (bg.type === "image") {
    bgTarget.style.backgroundImage = `url("${src.replaceAll('"', "%22")}")`;
  } else if (bg.type === "html") {
    const frame = document.createElement("iframe");
    const instanceId = globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sceneUrl = new URL(src);
    sceneUrl.searchParams.set("dextInstanceId", instanceId);
    sceneUrl.searchParams.set("dextKind", "background");
    frame.src = sceneUrl.href;
    frame.className = "dext-background-frame";
    frame.sandbox = "allow-scripts";
    frame.allow = "autoplay";
    frame.referrerPolicy = "no-referrer";
    bgTarget.appendChild(frame);
  }
}

function renderIcons(layer, desk, s) {
  const W = layer.clientWidth || window.innerWidth - 80;
  const H = layer.clientHeight || window.innerHeight - 140;
  const cols = Math.max(4, Math.floor(W / s.cellW));
  const rows = Math.max(1, Math.floor(H / s.cellH));
  layer.style.setProperty("--icon-size", `${s.icon}px`);
  layer.style.setProperty("--label-size", `${s.label}px`);

  if (!Array.isArray(desk.icons)) desk.icons = [];
  if (desk.icons.length && typeof desk.icons[0].x !== "number") normalizeCoords(desk, cols);

  layer.replaceChildren();
  desk.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "icon";
    el.style.width = `${s.cellW}px`;
    // clamp into view for the current size without rewriting stored coords
    el.style.left = `${Math.min(item.x ?? 0, cols - 1) * s.cellW}px`;
    el.style.top = `${Math.min(item.y ?? 0, rows - 1) * s.cellH}px`;
    el.appendChild(iconVisual(item));
    const label = document.createElement("div");
    label.className = "icon-label";
    label.textContent = item.label ?? "";
    el.appendChild(label);
    const removeButton = document.createElement("button");
    removeButton.className = "icon-del";
    removeButton.title = "删除";
    removeButton.textContent = "×";
    el.appendChild(removeButton);
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action);
      }
    });
    removeButton.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!editMode) return;
      desk.icons.splice(i, 1);
      renderDesk(currentDesk);
      persistRoom();
    });
    attachPress(el, i);
    layer.appendChild(el);
  });
}

function renderDesk(index) {
  const desk = ROOM.desks[index];
  mountBackground(bgEl, bgVideo, desk);
  mountWidgets(widgetLayer, desk, index);
  renderDock();
  const n = ROOM.desks.length;
  if (dockCfg().indicator === "dots") {
    dockEl.classList.add("dots");
    indicatorEl.replaceChildren(...ROOM.desks.map((desk, i) => {
      const dot = document.createElement("i");
      dot.classList.toggle("on", i === index);
      dot.title = desk.name ?? "";
      return dot;
    }));
  } else {
    dockEl.classList.remove("dots");
    indicatorEl.textContent = `${index + 1} / ${n} · ${desk.name}`;
  }
  renderIcons(iconLayer, desk, sizeOf(desk));

  document.querySelectorAll("#size-group .size-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.size === (desk.iconSize ?? "medium"))
  );
}

// long-press enters edit mode; in edit mode pointerdown starts a drag
function attachPress(el, index) {
  let timer = null;
  let sx = 0, sy = 0;

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    sx = e.clientX;
    sy = e.clientY;
    if (editMode) {
      startDrag(e, el, index);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      enterEdit();
    }, 500);
  });
  el.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
      clearTimeout(timer);
      timer = null;
    }
  });
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
}

function startDrag(e, el, index) {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");
  el.style.transition = "none";
  const sx = e.clientX;
  const sy = e.clientY;
  const origLeft = parseFloat(el.style.left);
  const origTop = parseFloat(el.style.top);

  const onMove = (ev) => {
    el.style.left = `${origLeft + ev.clientX - sx}px`;
    el.style.top = `${origTop + ev.clientY - sy}px`;
    setDockDropFeedback(ev.clientX, ev.clientY);
  };
  const onUp = (ev) => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.classList.remove("dragging");
    el.style.transition = "";
    const overDock = setDockDropFeedback(ev.clientX, ev.clientY);
    dockEl.classList.remove("drop-target");
    const desk = ROOM.desks[currentDesk];
    const dragged = desk.icons[index];
    if (overDock) {
      addDockIconFromDesk(dragged);
      renderDesk(currentDesk);
      return;
    }
    // sparse grid: drop cell from pointer; occupied -> swap, empty -> place
    const rect = iconLayer.getBoundingClientRect();
    const s = sizeOf(ROOM.desks[currentDesk]);
    const cols = Math.max(4, Math.floor(rect.width / s.cellW));
    const rows = Math.max(1, Math.floor(rect.height / s.cellH));
    const col = Math.max(0, Math.min(cols - 1, Math.floor((ev.clientX - rect.left) / s.cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((ev.clientY - rect.top) / s.cellH)));
    if (dragged.x === col && dragged.y === row) {
      renderDesk(currentDesk);
      return;
    }
    const occupant = desk.icons.find((ic) => ic !== dragged && ic.x === col && ic.y === row);
    if (occupant) {
      [occupant.x, occupant.y, dragged.x, dragged.y] = [dragged.x, dragged.y, occupant.x, occupant.y];
    } else {
      dragged.x = col;
      dragged.y = row;
    }
    persistRoom();
    renderDesk(currentDesk);
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
}

function enterEdit() {
  if (editMode || switching) return;
  editMode = true;
  document.body.classList.add("editing");
  renderDesk(currentDesk);
  dextEmit("editchange", { editing: true });
  showToast("编辑模式：拖动排列，× 删除");
}

function exitEdit() {
  if (!editMode) return;
  editMode = false;
  document.body.classList.remove("editing");
  renderDesk(currentDesk);
  dextEmit("editchange", { editing: false });
  persistRoom();
}

// ---- transition registry (the extension point) ----
// add a new desk-switch effect = add one entry here:
//   { dur, run(stage, dir, done), cleanup() }
// dir = +1 (next desk) / -1 (previous desk); stage is the incoming desk layer
const TRANSITIONS = {
  slide: {
    dur: 450,
    run(stage, dir, done) {
      stage.style.display = "block";
      stage.style.transition = "none";
      stage.style.transform = `translateX(${dir * 100}%)`;
      deskMain.style.transition = "none";
      deskMain.style.transform = "translateX(0)";
      requestAnimationFrame(() => {
        const ease = `transform ${this.dur}ms cubic-bezier(.22,.61,.36,1)`;
        stage.style.transition = ease;
        deskMain.style.transition = ease;
        stage.style.transform = "translateX(0)";
        deskMain.style.transform = `translateX(${-dir * 25}%)`;
        setTimeout(done, this.dur + 40);
      });
    },
    cleanup() {
      stageEl.style.display = "none";
      stageEl.style.transition = "none";
      stageEl.style.transform = "";
      clearStaging();
      deskMain.style.transition = "none";
      deskMain.style.transform = "";
    },
  },
  fade: {
    dur: 320,
    run(stage, dir, done) {
      stage.style.display = "block";
      stage.style.transition = "none";
      stage.style.opacity = "0";
      requestAnimationFrame(() => {
        stage.style.transition = `opacity ${this.dur}ms ease`;
        stage.style.opacity = "1";
        setTimeout(done, this.dur + 40);
      });
    },
    cleanup() {
      stageEl.style.display = "none";
      stageEl.style.transition = "none";
      stageEl.style.opacity = "";
      clearStaging();
    },
  },
  zoom: {
    dur: 420,
    run(stage, dir, done) {
      stage.style.display = "block";
      stage.style.transition = "none";
      stage.style.opacity = "0";
      stage.style.transform = "scale(1.12)";
      requestAnimationFrame(() => {
        stage.style.transition = `opacity ${this.dur}ms ease, transform ${this.dur}ms cubic-bezier(.22,.61,.36,1)`;
        stage.style.opacity = "1";
        stage.style.transform = "scale(1)";
        setTimeout(done, this.dur + 40);
      });
    },
    cleanup() {
      stageEl.style.display = "none";
      stageEl.style.transition = "none";
      stageEl.style.opacity = "";
      stageEl.style.transform = "";
      clearStaging();
    },
  },
  none: {
    dur: 0,
    run(stage, dir, done) {
      done();
    },
    cleanup() {
      clearStaging();
    },
  },
};

function mountStaging(index) {
  const desk = ROOM.desks[index];
  stageEl.innerHTML = `
    <video class="desk-video" autoplay muted loop playsinline></video>
    <div class="desk-bg"></div>
    <div class="widget-layer"></div>
    <div class="icon-layer"></div>`;
  mountBackground(stageEl.querySelector(".desk-bg"), stageEl.querySelector(".desk-video"), desk);
  mountWidgets(stageEl.querySelector(".widget-layer"), desk, index);
  renderIcons(stageEl.querySelector(".icon-layer"), desk, sizeOf(desk));
}

const SWITCH_PRESETS = new Set(["slide", "fade", "zoom", "none"]);

// v2 switch resolution: directed edge first, then the Room-wide default.
function resolveTransition(from, to) {
  const value = ROOM.switches?.[`${from}>${to}`] ?? ROOM.switch ?? "slide";
  if (typeof value === "string" && SWITCH_PRESETS.has(value)) return value;
  if (value && typeof value === "object" &&
      ["image", "video", "html"].includes(value.type) &&
      assetUrl(value.src)) return value;
  return "slide";
}

// Kept as the existing transition entry point; v2 delegates every custom Content
// to playSlot and swaps Desk only after that scene completes.
function playVideoTransition(next, slot, from, delta) {
  return playSlot(slot, {
    kind: "switch",
    onDone: () => {
      if (!switching) return;
      const previous = currentDesk;
      if (previous !== from) {
        switching = false;
        return;
      }
      currentDesk = next;
      renderDesk(currentDesk);
      dextEmit("deskchange", { from, to: next, dir: delta, phase: "after" });
      switching = false;
    },
  });
}

function switchDesk(delta) {
  if (switching || editMode || ROOM.desks.length < 2) return;
  switching = true;

  const from = currentDesk;
  const next = (currentDesk + delta + ROOM.desks.length) % ROOM.desks.length;
  const spec = resolveTransition(from, next);
  const after = () => dextEmit("deskchange", { from, to: next, dir: delta, phase: "after" });

  dextEmit("deskchange", { from, to: next, dir: delta, phase: "before" });

  if (spec && typeof spec === "object") {
    playVideoTransition(next, spec, from, delta);
    return;
  }
  const t = TRANSITIONS[spec] ?? TRANSITIONS.slide;
  mountStaging(next);
  t.run(stageEl, delta, () => {
    currentDesk = next;
    renderDesk(currentDesk);
    after();
    t.cleanup();
    switching = false;
  });
}

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
}

document.getElementById("next-desk").addEventListener("click", () => switchDesk(1));
document.getElementById("prev-desk").addEventListener("click", () => switchDesk(-1));
doneBtn.addEventListener("click", exitEdit);

document.querySelectorAll("#size-group .size-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (!editMode) return;
    const desk = ROOM.desks[currentDesk];
    if (desk.iconSize === btn.dataset.size) return;
    desk.iconSize = btn.dataset.size;
    renderDesk(currentDesk);
    persistRoom();
  })
);

iconLayer.addEventListener("pointerdown", (e) => {
  if (editMode && e.target === iconLayer) exitEdit();
});

window.addEventListener("keydown", (e) => {
  if (SCREENSAVER_MODE) return;
  if (e.key === "ArrowRight") switchDesk(1);
  if (e.key === "ArrowLeft") switchDesk(-1);
  if (e.key === "Escape") exitEdit();
});

window.addEventListener("resize", () => {
  if (!SCREENSAVER_MODE) renderDesk(currentDesk);
});

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!PREVIEW_MODE ||
      e.source !== window.parent ||
      !PREVIEW_PARENT_ORIGINS.has(e.origin) ||
      d?.type !== "dext:room" ||
      d.room?.version !== 2 ||
      !d.room?.desks?.length) return;
  try {
    const base = new URL(d.assetBase);
    if (base.origin !== "http://lib.localhost" || !base.pathname.endsWith("/")) return;
    assetBase = base.href;
    ROOM = d.room;
    currentDesk = Math.min(d.deskIndex ?? 0, ROOM.desks.length - 1);
    if (SCREENSAVER_MODE) renderIdle();
    else renderDesk(currentDesk);
    dextEmit("ready", {
      deskCount: ROOM.desks.length,
      injected: true,
      screensaver: SCREENSAVER_MODE,
    });
  } catch {
    // Ignore malformed preview messages without disturbing the last good draft.
  }
});

loadRoom();
