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
  "http://localhost:1620",
  "http://localhost:1420",
]);
let assetBase = SEARCH.get("room") ?? "";
const ROOM_CANVAS = { width: 1920, height: 1080 };
const WIDGET_PROTOCOL = 1;
const MAX_WIDGET_MESSAGE_BYTES = 64 * 1024;
const capabilityApi = globalThis.DextCapabilityBridge;
if (!capabilityApi) throw new Error("Dext capability bridge is unavailable");

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
  let sceneInstance = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (onMsg) window.removeEventListener("message", onMsg);
    sceneInstance?.unregisterCapabilities?.();
    if (sceneInstance) {
      sceneInstance.disposed = true;
      capabilityInstances.delete(sceneInstance);
    }
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
    sceneInstance?.unregisterCapabilities?.();
    if (sceneInstance) {
      sceneInstance.disposed = true;
      capabilityInstances.delete(sceneInstance);
    }
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
    const token = globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sceneUrl = new URL(src);
    sceneUrl.searchParams.set("dextInstanceId", instanceId);
    sceneUrl.searchParams.set("dextKind", opts.kind ?? "");
    f.src = sceneUrl.href;
    f.sandbox = "allow-scripts";
    f.allow = "autoplay";
    f.referrerPolicy = "no-referrer";
    wrap.appendChild(f);
    const subject = opts.subject ?? `scene:${opts.kind ?? "content"}`;
    mountTrustedHotspots(wrap, { ...slot, subject }, ROOM_CANVAS);
    document.body.appendChild(wrap);
    sceneInstance = {
      instanceId,
      token,
      frame: f,
      permissions: slot.permissions,
      subject,
      disposed: false,
      unregisterCapabilities: null,
    };
    f.addEventListener("load", () => {
      if (sceneInstance.disposed || !f.contentWindow) return;
      f.contentWindow.postMessage({
        type: "dext:scene:init",
        protocol: WIDGET_PROTOCOL,
        instanceId,
        token,
        kind: opts.kind ?? "",
        permissions: capabilityApi.cleanPermissions(slot.permissions),
        viewport: { ...ROOM_CANVAS },
      }, "*");
      registerCapabilityFrame(sceneInstance);
    });
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
      // Room v2 content is mounted only through the trusted Scene/Widget hosts below.
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
    } else if (data?.type === "dext:room-layout") {
      applyRoomLayoutUpdate(data);
    } else if (data?.type === "dext:desktop-preferences") {
      receiveDesktopPreferences(data);
    } else if (data?.type === "dext:room-save-result") {
      receiveRoomSaveResult(data);
    } else if (data?.type === "dext:system-control-result" && data.success) {
      if (data.volume) capabilityHost.updateVolume(data.volume);
      if (data.permissions) updateRuntimeGrants(data.permissions);
    } else if (data?.type === "dext:system-control-result" && !data.success && data.userVisible) {
      showToast(data.error || "系统动作执行失败");
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
  return effectiveIconPreferences
    ? { ...globalThis.DextIconFeedback.resolveDesktopIconGeometry(effectiveIconPreferences), label: 12 }
    : ICON_SIZES[desk.iconSize] ?? ICON_SIZES.medium;
}

function validRoomLayoutUpdate(data) {
  return data?.room?.version === 2 &&
    Array.isArray(data.room.desks) &&
    Number.isInteger(data.deskIndex) &&
    data.deskIndex >= 0 && data.deskIndex < data.room.desks.length &&
    Array.isArray(data.room.desks[data.deskIndex]?.icons);
}

function cloneIcons(icons) {
  return JSON.parse(JSON.stringify(icons));
}

function applyRoomLayoutUpdate(data) {
  if (!validRoomLayoutUpdate(data) || !ROOM.desks[data.deskIndex]) return;
  activeIconDrag?.abort?.(false);
  activeWidgetGesture?.abort?.(false);
  if (pendingPreferenceSave) {
    clearTimeout(pendingPreferenceSave.timer);
    pendingPreferenceSave = null;
  }
  const target = data.deskIndex;
  ROOM.desks[target].icons = cloneIcons(data.room.desks[target].icons);
  const moveToTarget = data.enterEdit === true && target !== currentDesk;
  if (moveToTarget) {
    currentDesk = target;
    renderDesk(currentDesk);
  } else if (target === currentDesk) {
    renderIcons(iconLayer, ROOM.desks[currentDesk], sizeOf(ROOM.desks[currentDesk]));
  }
  if (data.enterEdit === true) enterEdit({ rerender: false });
  if (target === currentDesk && typeof data.highlightTarget === "string" && data.highlightTarget) {
    highlightIcon(data.highlightTarget);
  }
  drainPendingIconPreferences();
}

const deskMain = document.getElementById("desk-main");
const stageEl = document.getElementById("desk-staging");
const bgEl = deskMain.querySelector(".desk-bg");
const bgVideo = deskMain.querySelector(".desk-video");
const iconLayer = deskMain.querySelector(".icon-layer");
iconLayer.dataset.dextIconFeedbackRoot = "";
const widgetLayer = deskMain.querySelector(".widget-layer");
const indicatorEl = document.getElementById("desk-indicator");
const transitionEl = document.getElementById("transition");
const transitionTextEl = document.getElementById("transition-text");
const toastEl = document.getElementById("toast");
const doneBtn = document.getElementById("edit-done");
const dockEl = document.getElementById("dock");
const dockAppsEl = document.getElementById("dock-apps");

let effectiveIconPreferences = null;
let lastIconPreferenceRevision = -1;
let activeIconDrag = null;
let activeWidgetGesture = null;
let pendingIconPreferences = null;
let pendingPreferenceSave = null;
const iconFeedbackController = globalThis.DextIconFeedback.createDesktopIconFeedbackController(iconLayer);

// Temporary WorkerW/WebView2 gesture probe for DESK-PREFS-001 acceptance.
// Remove after the real pointer event sequence is captured.
const iconDragTrace = [];
let iconDragTraceElement = null;
function traceIconDrag(stage, event, element) {
  if (!iconDragTraceElement) {
    iconDragTraceElement = document.createElement('pre');
    iconDragTraceElement.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;max-width:680px;padding:10px;background:#101820ee;color:#bfffd7;font:12px/1.4 Consolas,monospace;pointer-events:none;white-space:pre-wrap;border:1px solid #69c49b;';
    document.body.appendChild(iconDragTraceElement);
  }
  const pointer = event && Number.isFinite(event.pointerId) ? ` id=${event.pointerId} buttons=${event.buttons}` : '';
  const captured = event && element?.hasPointerCapture ? ` captured=${element.hasPointerCapture(event.pointerId)}` : '';
  const target = event?.target?.className && typeof event.target.className === 'string' ? ` target=${event.target.className}` : '';
  iconDragTrace.push(`${Math.round(performance.now())} ${stage}${pointer}${captured}${target}`);
  iconDragTraceElement.textContent = `DESK-PREFS-001 pointer trace (screenshot after failed drag)\n${iconDragTrace.slice(-12).join('\n')}`;
}

function drainPendingIconPreferences() {
  if (activeIconDrag || activeWidgetGesture || pendingPreferenceSave || !pendingIconPreferences) return;
  const next = pendingIconPreferences;
  pendingIconPreferences = null;
  receiveDesktopPreferences(next);
}

function preferenceViews(geometry) {
  const layer = iconLayer.getBoundingClientRect();
  const widgets = widgetLayer.getBoundingClientRect();
  const width = layer.width || iconLayer.clientWidth || window.innerWidth - 80;
  const height = layer.height || iconLayer.clientHeight || window.innerHeight - 140;
  const widgetScaleX = (widgets.width || window.innerWidth) / ROOM_CANVAS.width;
  const widgetScaleY = (widgets.height || window.innerHeight) / ROOM_CANVAS.height;
  const dockRect = dockEl.getBoundingClientRect();
  return ROOM.desks.map((desk) => {
    const blocked = (desk.widgets || []).map((widget) => ({
      x: widget.placement.x * widgetScaleX + widgets.left - layer.left - 40,
      y: widget.placement.y * widgetScaleY + widgets.top - layer.top - 40,
      width: widget.placement.width * widgetScaleX + 80,
      height: widget.placement.height * widgetScaleY + 80,
    }));
    const deskDock = { ...ROOM.dock, ...desk.dock };
    const dockEnabled = deskDock.enabled !== false;
    const viewport = deskMain.getBoundingClientRect();
    const dockPosition = deskDock.position ?? 'bottom';
    const dockLeft = dockPosition === 'left' ? viewport.left + 24
      : dockPosition === 'right' ? viewport.right - 24 - dockRect.width
      : viewport.left + (viewport.width - dockRect.width) / 2;
    const dockTop = dockPosition === 'top' ? viewport.top + 24
      : dockPosition === 'bottom' ? viewport.bottom - 24 - dockRect.height
      : viewport.top + (viewport.height - dockRect.height) / 2;
    if (dockEnabled && dockRect.width && dockRect.height) blocked.push({
      x: dockLeft - layer.left - 24,
      y: dockTop - layer.top - 24,
      width: dockRect.width + 48,
      height: dockRect.height + 48,
    });
    return { width, height, blocked };
  });
}

function receiveRoomSaveResult(message) {
  const pending = pendingPreferenceSave;
  if (!pending || message.requestId !== pending.requestId) return;
  clearTimeout(pending.timer);
  pendingPreferenceSave = null;
  if (message.success !== true) {
    ROOM.desks.forEach((desk, index) => { desk.icons = pending.icons[index]; });
    if (pending.preferences) applyIconAppearance(pending.preferences);
    else {
      effectiveIconPreferences = null;
      iconLayer.removeAttribute('data-dext-icon-feedback-root');
      renderIcons(iconLayer, ROOM.desks[currentDesk], sizeOf(ROOM.desks[currentDesk]));
    }
    showToast('图标布局保存失败，已恢复原位置');
  }
  drainPendingIconPreferences();
}

function applyIconAppearance(preferences) {
  iconLayer.dataset.dextIconFeedbackRoot = '';
  effectiveIconPreferences = iconFeedbackController.setPreferences(preferences);
  const desk = ROOM.desks[currentDesk];
  if (!desk) return;
  const s = sizeOf(desk);
  const W = iconLayer.clientWidth || window.innerWidth - 80;
  const H = iconLayer.clientHeight || window.innerHeight - 140;
  const cols = Math.max(1, Math.floor(W / s.cellW));
  const rows = Math.max(1, Math.floor(H / s.cellH));
  iconLayer.querySelectorAll('.icon').forEach((el, index) => {
    const item = desk.icons?.[index];
    if (!item) return;
    el.style.width = `${s.footprintWidth}px`;
    el.style.height = `${s.footprintHeight}px`;
    el.style.left = `${Math.min(item.x ?? 0, cols - 1) * s.cellW + s.gapX / 2}px`;
    el.style.top = `${Math.min(item.y ?? 0, rows - 1) * s.cellH + s.gapY / 2}px`;
  });
}

function receiveDesktopPreferences(message) {
  const revision = Number.isSafeInteger(message.revision) ? message.revision : 0;
  if (revision < lastIconPreferenceRevision) return;
  const preferences = globalThis.DextIconFeedback.normalizeDesktopIconPreferences(message.preferences);
  if (revision === lastIconPreferenceRevision &&
      JSON.stringify(preferences) === JSON.stringify(effectiveIconPreferences)) return;
  if (activeIconDrag || activeWidgetGesture || pendingPreferenceSave) {
    if (!pendingIconPreferences || revision >= (pendingIconPreferences.revision ?? 0)) pendingIconPreferences = message;
    return;
  }
  const geometry = globalThis.DextIconFeedback.resolveDesktopIconGeometry(preferences);
  const plan = globalThis.DextIconPlacement.planRoomReflow(ROOM, geometry, preferenceViews(geometry));
  if (!plan.committed) {
    showToast('空间不足，当前 Room 未应用布局偏好');
    return;
  }
  const previousPreferences = effectiveIconPreferences;
  const oldIcons = ROOM.desks.map((desk) => cloneIcons(desk.icons || []));
  lastIconPreferenceRevision = revision;
  ROOM.desks.forEach((desk, index) => { desk.icons = plan.room.desks[index].icons; });
  applyIconAppearance(preferences);
  if (plan.moved.length) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    pendingPreferenceSave = {
      requestId, icons: oldIcons, preferences: previousPreferences,
      timer: setTimeout(() => showToast('图标布局保存结果未确认'), 10000),
    };
    const room = JSON.parse(JSON.stringify(ROOM));
    delete room.__source;
    window.chrome?.webview?.postMessage?.(JSON.stringify({ type: 'saveRoom', room, requestId }));
  }
}

let currentDesk = 0;
let switching = false;
let editMode = false;
let lastTrustedActionAt = 0;
const runtimeGrants = new Map();
const capabilityInstances = new Set();

const capabilityHost = capabilityApi.createHost({
  viewport: () => ({ width: ROOM_CANVAS.width, height: ROOM_CANVAS.height, scale: window.devicePixelRatio || 1 }),
  desk: () => ({ index: currentDesk, name: ROOM.desks[currentDesk]?.name ?? "" }),
});

// P1 能力按契约自动允许（WIDGETS_V2 §4：只读、宿主侧裁剪），无需授权 store 记录；
// P2（媒体/音量）与 P4（action.invoke）仍必须来自 permissions-v1.json 的显式授权。
const P1_AUTO_GRANTS = new Set([
  "time.read", "locale.read", "viewport.read", "desk.read", "playback.read",
  "audio.spectrum", "hardware.cpu.read", "hardware.gpu.read", "hardware.memory.read",
  "hardware.network.read",
]);

function grantedPermissions(subject, declared) {
  const granted = runtimeGrants.get(subject) ?? [];
  return capabilityApi.cleanPermissions(declared)
    .filter((permission) => P1_AUTO_GRANTS.has(permission) || granted.includes(permission));
}

function postSystemControl(action, subject) {
  const clean = capabilityApi.validateAction(action);
  const now = performance.now();
  if (!clean || !runtimeGrants.get(subject)?.includes("action.invoke") ||
      now - lastTrustedActionAt < 120 || !window.chrome?.webview?.postMessage) return false;
  lastTrustedActionAt = now;
  window.chrome.webview.postMessage(JSON.stringify({
    type: "dext:system-control",
    requestId: newInstanceId(),
    action: clean,
    subject,
  }));
  return true;
}

function mountTrustedHotspots(container, owner, bounds) {
  const permissions = capabilityApi.cleanPermissions(owner?.permissions);
  if (!permissions.includes("action.invoke") || !Array.isArray(owner?.hotspots)) return;
  const ids = new Set();
  for (const hotspot of owner.hotspots.slice(0, 64)) {
    const p = hotspot?.placement;
    const action = capabilityApi.validateAction(hotspot?.action);
    if (!p || !action || typeof hotspot.id !== "string" || ids.has(hotspot.id) ||
        ![p.x, p.y, p.width, p.height, p.z].every(Number.isInteger) ||
        p.width < 16 || p.height < 16 || p.x < 0 || p.y < 0 ||
        p.x + p.width > bounds.width || p.y + p.height > bounds.height) continue;
    ids.add(hotspot.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dext-trusted-hotspot";
    button.dataset.hotspotId = hotspot.id;
    button.title = typeof hotspot.label === "string" ? hotspot.label.slice(0, 120) : hotspot.id;
    button.setAttribute("aria-label", button.title);
    button.style.left = `${p.x / bounds.width * 100}%`;
    button.style.top = `${p.y / bounds.height * 100}%`;
    button.style.width = `${p.width / bounds.width * 100}%`;
    button.style.height = `${p.height / bounds.height * 100}%`;
    button.style.zIndex = String(p.z);
    button.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      if (!postSystemControl(action, owner.subject)) showToast("该内容尚未获准执行系统动作");
    });
    container.appendChild(button);
  }
}

function registerCapabilityFrame(instance) {
  instance.unregisterCapabilities?.();
  capabilityInstances.add(instance);
  instance.unregisterCapabilities = capabilityHost.register({
    instanceId: instance.instanceId,
    token: instance.token,
    permissions: grantedPermissions(instance.subject, instance.permissions),
    post: (message) => {
      if (!instance.disposed && instance.frame.contentWindow) {
        instance.frame.contentWindow.postMessage(message, "*");
      }
    },
  });
}

function updateRuntimeGrants(value) {
  runtimeGrants.clear();
  if (value && typeof value === "object") {
    for (const [subject, permissions] of Object.entries(value)) {
      runtimeGrants.set(subject, capabilityApi.cleanPermissions(permissions));
    }
  }
  for (const instance of capabilityInstances) {
    if (!instance.disposed) registerCapabilityFrame(instance);
  }
}

// Lively Player 经 ExecuteScriptFunctionAsync 注入的负载都是 JSON 字符串（含 null），
// 能力桥只吃对象，这里统一在边界解析；解析失败按无数据处理。
const parseLivelyPayload = (value) => {
  if (typeof value !== "string" || value.length === 0) return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
window.livelySystemInformation = (value) => capabilityHost.updateHardware(parseLivelyPayload(value));
window.livelyCurrentTrack = (value) => capabilityHost.updateMedia(parseLivelyPayload(value));
window.livelyAudioListener = (value) => capabilityHost.updateSpectrum(parseLivelyPayload(value));
window.livelyWallpaperPlaybackChanged = (value) => capabilityHost.updatePlayback(parseLivelyPayload(value));
const capabilityTickTimer = setInterval(() => capabilityHost.tick(), 1000);
const volumePollTimer = setInterval(() => {
  if (!window.chrome?.webview?.postMessage) return;
  window.chrome.webview.postMessage(JSON.stringify({
    type: "dext:system-control",
    requestId: newInstanceId(),
    action: { id: "system.volume.read" },
  }));
}, 1500);
const permissionPollTimer = setInterval(() => {
  if (!window.chrome?.webview?.postMessage) return;
  window.chrome.webview.postMessage(JSON.stringify({
    type: "dext:system-control",
    requestId: newInstanceId(),
    action: { id: "system.permissions.read" },
  }));
}, 3000);

// ---- trusted WidgetHost ----------------------------------------------------
// Widget documents remain opaque sandbox origins. The official host owns their
// rectangle, lifecycle and message identity; author code never receives the
// top-level WebView object or direct access to Desk/Dock DOM.
const widgetInstancesBySource = new Map();
const widgetInstancesByLayer = new WeakMap();
const sceneInstancesByContainer = new WeakMap();

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
    instance.unregisterCapabilities?.();
    capabilityInstances.delete(instance);
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
  registerCapabilityFrame(instance);
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
    mountTrustedHotspots(wrap, { ...widget, subject: `widget:${widget.id}` }, { width: placement.width, height: placement.height });
    wrap.appendChild(widgetEditOverlay({ widget, wrap, subject: `widget:${widget.id}` }));
    layer.appendChild(wrap);

    const instance = {
      instanceId, token, widget, deskIndex, frame, wrap, disposed: false,
      permissions: widget.permissions,
      subject: `widget:${widget.id}`,
      unregisterCapabilities: null,
    };
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
  const background = stageEl.querySelector(".desk-bg");
  if (background) disposeSceneContainer(background);
  stageEl.replaceChildren();
}

// Player instances can be torn down without a full process exit (Room replace,
// WebView recreation, or watchdog recovery).  Make teardown explicit so no
// timer, capability registration, iframe or active transition can keep
// receiving callbacks after the document is gone.
let runtimeDisposed = false;
function disposeRuntime() {
  if (runtimeDisposed) return;
  runtimeDisposed = true;
  clearInterval(capabilityTickTimer);
  clearInterval(volumePollTimer);
  clearInterval(permissionPollTimer);
  activeSlot?.cancel();
  disposeWidgets(widgetLayer);
  disposeSceneContainer(bgEl);
  bgVideo.pause();
  bgVideo.removeAttribute("src");
  capabilityHost.dispose();
  clearStaging();
}
window.addEventListener("pagehide", disposeRuntime, { once: true });

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
  cfg.icons.forEach((item) => {
    const el = document.createElement("div");
    el.className = "dock-icon";
    el.title = item.label ?? "";
    el.classList.toggle("is-running", runningAppTargets.has(launchTargetKey(item.launch?.target)));
    el.appendChild(iconVisual(item));
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action ?? item.label ?? "");
      }
    });
    dockAppsEl.appendChild(el);
  });
}

// ---- Widget 编辑拖动（WIDGET-DRAG-001）-------------------------------------
// 编辑模式下每个 Widget 盖一层透明把手层：未编辑时长按进入编辑态；编辑态拖动移动、
// 右下角把手缩放。placement 直接写回 ROOM 并经 persistRoom 双写；不重挂载实例，
// 避免 iframe 重载丢状态。覆盖层同时解决 Widget iframe 吞掉指针事件的问题。

function widgetEditOverlay(instance) {
  const overlay = document.createElement("div");
  overlay.className = "widget-edit-layer";
  const name = document.createElement("span");
  name.className = "widget-edit-name";
  name.textContent = instance.widget.name;
  overlay.appendChild(name);
  const resize = document.createElement("span");
  resize.className = "widget-edit-resize";
  resize.title = "拖动缩放";
  overlay.appendChild(resize);

  let pressTimer = null;
  let pressX = 0, pressY = 0;

  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pressX = e.clientX;
    pressY = e.clientY;
    if (editMode) {
      startWidgetDrag(e, instance, resize.contains(e.target));
      return;
    }
    pressTimer = setTimeout(() => {
      pressTimer = null;
      enterEdit();
    }, 500);
  });
  overlay.addEventListener("pointermove", (e) => {
    if (pressTimer && Math.hypot(e.clientX - pressX, e.clientY - pressY) > 8) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  });
  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };
  overlay.addEventListener("pointerup", cancelPress);
  overlay.addEventListener("pointercancel", cancelPress);
  return overlay;
}

function applyWidgetPlacement(instance, placement) {
  instance.wrap.style.left = `${placement.x / ROOM_CANVAS.width * 100}%`;
  instance.wrap.style.top = `${placement.y / ROOM_CANVAS.height * 100}%`;
  instance.wrap.style.width = `${placement.width / ROOM_CANVAS.width * 100}%`;
  instance.wrap.style.height = `${placement.height / ROOM_CANVAS.height * 100}%`;
  instance.wrap.style.zIndex = String(placement.z);
}

function syncWidgetHotspots(instance) {
  instance.wrap.querySelectorAll(".dext-trusted-hotspot").forEach((el) => el.remove());
  mountTrustedHotspots(
    instance.wrap,
    { ...instance.widget, subject: instance.subject },
    { width: instance.widget.placement.width, height: instance.widget.placement.height }
  );
}

function startWidgetDrag(e, instance, resizing) {
  if (pendingPreferenceSave) {
    showToast('图标布局保存中，请稍候');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const wrap = instance.wrap;
  wrap.setPointerCapture(e.pointerId);
  wrap.classList.add("widget-dragging");
  const layerRect = widgetLayer.getBoundingClientRect();
  const scale = layerRect.width / ROOM_CANVAS.width || 1;
  const sx = e.clientX;
  const sy = e.clientY;
  const placement = instance.widget.placement;
  const origin = { ...placement };
  const desk = ROOM.desks[currentDesk];
  const originIcons = cloneIcons(desk.icons ?? []);
  let preview = null;

  const iconGrid = () => globalThis.DextLayout.logicalIconGrid(
    iconLayer.clientWidth || window.innerWidth,
    iconLayer.clientHeight || window.innerHeight,
    sizeOf(desk),
  );
  const widgetObstacles = () => desk.widgets.map((widget) => ({
    x: widget.placement.x - 40,
    y: widget.placement.y - 40,
    width: widget.placement.width + 80,
    height: widget.placement.height + 80,
  }));
  const dockReserve = () => {
    if (dockEl.style.display === "none") return [];
    const dockRect = dockEl.getBoundingClientRect();
    const layer = widgetLayer.getBoundingClientRect();
    if (dockRect.width <= 0 || dockRect.height <= 0 || layer.width <= 0 || layer.height <= 0) return [];
    return [{
      x: (dockRect.left - layer.left) / layer.width * ROOM_CANVAS.width - 40,
      y: (dockRect.top - layer.top) / layer.height * ROOM_CANVAS.height - 40,
      width: dockRect.width / layer.width * ROOM_CANVAS.width + 80,
      height: dockRect.height / layer.height * ROOM_CANVAS.height + 80,
    }];
  };
  const clearPreview = () => {
    iconLayer.querySelectorAll(".icon.widget-avoid-preview").forEach((icon) => {
      icon.classList.remove("widget-avoid-preview");
      icon.style.removeProperty("opacity");
    });
    wrap.classList.remove("widget-conflict");
  };
  const showPreview = (next) => {
    clearPreview();
    if (!next.committed) {
      wrap.classList.add("widget-conflict");
      return;
    }
    const size = sizeOf(desk);
    iconLayer.querySelectorAll(".icon").forEach((icon, index) => {
      if (!next.moved.includes(index)) return;
      const target = next.icons[index];
      icon.classList.add("widget-avoid-preview");
      icon.style.left = `${target.x * size.cellW + (size.gapX ?? 0) / 2}px`;
      icon.style.top = `${target.y * size.cellH + (size.gapY ?? 0) / 2}px`;
      icon.style.opacity = "0.55";
    });
  };
  const updatePlacement = () => {
    Object.assign(placement, safePlacement(placement));
    applyWidgetPlacement(instance, placement);
    preview = globalThis.DextLayout.resolveWidgetIconAvoidance(
      desk.icons ?? [], widgetObstacles(), iconGrid(), dockReserve(),
    );
    showPreview(preview);
  };
  const removeListeners = () => {
    wrap.removeEventListener("pointermove", onMove);
    wrap.removeEventListener("pointerup", finish);
    wrap.removeEventListener("pointercancel", cancel);
    wrap.classList.remove("widget-dragging");
  };
  const finish = () => {
    removeListeners();
    updatePlacement();
    if (!preview?.committed) {
      Object.assign(placement, origin);
      desk.icons = originIcons;
      applyWidgetPlacement(instance, origin);
      clearPreview();
      renderIcons(iconLayer, desk, sizeOf(desk));
      showToast("空间不足，Widget 已恢复原位");
      activeWidgetGesture = null;
      drainPendingIconPreferences();
      return;
    }
    desk.icons = preview.icons;
    clearPreview();
    renderIcons(iconLayer, desk, sizeOf(desk));
    if (resizing) syncWidgetHotspots(instance);
    persistRoom();
    activeWidgetGesture = null;
    drainPendingIconPreferences();
  };
  const cancel = () => {
    removeListeners();
    Object.assign(placement, origin);
    desk.icons = originIcons;
    applyWidgetPlacement(instance, origin);
    clearPreview();
    renderIcons(iconLayer, desk, sizeOf(desk));
    activeWidgetGesture = null;
    drainPendingIconPreferences();
  };
  const onMove = (ev) => {
    const dx = (ev.clientX - sx) / scale;
    const dy = (ev.clientY - sy) / scale;
    if (resizing) {
      placement.width = Math.round(origin.width + dx);
      placement.height = Math.round(origin.height + dy);
    } else {
      placement.x = Math.round(origin.x + dx);
      placement.y = Math.round(origin.y + dy);
    }
    updatePlacement();
  };
  activeWidgetGesture = { abort(restore) {
    removeListeners();
    Object.assign(placement, origin);
    applyWidgetPlacement(instance, origin);
    clearPreview();
    if (restore) renderIcons(iconLayer, desk, sizeOf(desk));
    activeWidgetGesture = null;
  } };
  wrap.addEventListener("pointermove", onMove);
  wrap.addEventListener("pointerup", finish);
  wrap.addEventListener("pointercancel", cancel);
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
  disposeSceneContainer(bgTarget);
  videoTarget.pause();
  videoTarget.removeAttribute("src");
  videoTarget.load();
  videoTarget.style.display = "none";
  bgTarget.style.backgroundImage = "none";
  bgTarget.replaceChildren();
}

function disposeSceneContainer(container) {
  const instance = sceneInstancesByContainer.get(container);
  if (!instance) return;
  instance.disposed = true;
  instance.unregisterCapabilities?.();
  capabilityInstances.delete(instance);
  if (instance.frame) instance.frame.src = "about:blank";
  sceneInstancesByContainer.delete(container);
}

// A v2 background is Content|null. HTML stays below the official icon and Dock layers.
function mountBackground(bgTarget, videoTarget, desk, deskIndex) {
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
    const token = globalThis.crypto?.randomUUID?.() ??
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
    const subject = `scene:desk:${deskIndex}`;
    mountTrustedHotspots(bgTarget, { ...bg, subject }, ROOM_CANVAS);
    const instance = {
      instanceId,
      token,
      frame,
      permissions: bg.permissions,
      subject,
      disposed: false,
      unregisterCapabilities: null,
    };
    sceneInstancesByContainer.set(bgTarget, instance);
    frame.addEventListener("load", () => {
      if (instance.disposed || !frame.contentWindow) return;
      frame.contentWindow.postMessage({
        type: "dext:scene:init",
        protocol: WIDGET_PROTOCOL,
        instanceId,
        token,
        kind: "background",
        permissions: capabilityApi.cleanPermissions(bg.permissions),
        viewport: { ...ROOM_CANVAS },
      }, "*");
      registerCapabilityFrame(instance);
    });
  }
}

function renderIcons(layer, desk, s) {
  if (activeIconDrag && layer === iconLayer) traceIconDrag('renderIcons during drag');
  const W = layer.clientWidth || window.innerWidth - 80;
  const H = layer.clientHeight || window.innerHeight - 140;
  const cols = Math.max(1, Math.floor(W / s.cellW));
  const rows = Math.max(1, Math.floor(H / s.cellH));
  layer.style.setProperty("--icon-size", `${s.icon}px`);
  layer.style.setProperty("--label-size", `${s.label}px`);

  if (!Array.isArray(desk.icons)) desk.icons = [];
  if (desk.icons.length && typeof desk.icons[0].x !== "number") normalizeCoords(desk, cols);

  layer.replaceChildren();
  desk.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "icon";
    el.dataset.dextIconFace = "";
    el.setAttribute('aria-label', item.label ?? '');
    el.dataset.launchTarget = item.launch?.target ?? "";
    el.style.width = `${s.footprintWidth ?? s.cellW}px`;
    if (s.footprintHeight) el.style.height = `${s.footprintHeight}px`;
    // clamp into view for the current size without rewriting stored coords
    el.style.left = `${Math.min(item.x ?? 0, cols - 1) * s.cellW + (s.gapX ?? 0) / 2}px`;
    el.style.top = `${Math.min(item.y ?? 0, rows - 1) * s.cellH + (s.gapY ?? 0) / 2}px`;
    const face = document.createElement('div');
    face.className = 'icon-face';
    const visual = document.createElement('div');
    visual.className = 'icon-visual';
    if (item.color) el.style.setProperty('--icon-color', item.color);
    visual.appendChild(iconVisual(item));
    face.appendChild(visual);
    const label = document.createElement("div");
    label.className = "icon-label";
    label.textContent = item.label ?? "";
    face.appendChild(label);
    const tooltip = document.createElement('div');
    tooltip.className = 'icon-label-tooltip';
    tooltip.textContent = item.label ?? '';
    tooltip.dataset.visible = 'false';
    face.appendChild(tooltip);
    el.appendChild(face);
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action);
      }
    });
    attachPress(el, i);
    layer.appendChild(el);
  });
}

function highlightIcon(target) {
  const icon = [...iconLayer.querySelectorAll(".icon")]
    .find((element) => element.dataset.launchTarget === target);
  if (!icon) return;
  icon.classList.add("live-layout-highlight");
  setTimeout(() => icon.classList.remove("live-layout-highlight"), 1800);
}

function renderDesk(index) {
  const desk = ROOM.desks[index];
  mountBackground(bgEl, bgVideo, desk, index);
  mountWidgets(widgetLayer, desk, index);
  // The active desk is part of the read-only capability snapshot.  Rendering
  // a new desk must notify already-registered Scene/Widget instances as well
  // as the public lifecycle event, otherwise a surviving instance can keep
  // displaying the previous desk identity until its next reload.
  capabilityHost.deskChanged();
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
  capabilityHost.deskChanged();

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
      traceIconDrag('edit pointerdown', e, el);
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
  if (pendingPreferenceSave) {
    traceIconDrag('blocked: preference save pending', e, el);
    showToast('图标布局保存中，请稍候');
    return;
  }
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  traceIconDrag('capture requested', e, el);
  el.classList.add("dragging");
  iconFeedbackController.setDragging(true);
  el.style.transition = "none";
  const sx = e.clientX;
  const sy = e.clientY;
  const origLeft = parseFloat(el.style.left);
  const origTop = parseFloat(el.style.top);
  let moveCount = 0;
  let windowMoveCount = 0;
  const onWindowMove = (ev) => {
    if (ev.pointerId !== e.pointerId || ++windowMoveCount > 3) return;
    traceIconDrag('window move', ev, el);
  };
  const onWindowUp = (ev) => {
    if (ev.pointerId === e.pointerId) traceIconDrag('window pointerup', ev, el);
  };

  const onMove = (ev) => {
    if (++moveCount <= 3) traceIconDrag('icon move', ev, el);
    el.style.left = `${origLeft + ev.clientX - sx}px`;
    el.style.top = `${origTop + ev.clientY - sy}px`;
  };
  let settled = false;
  const clearDrag = () => {
    if (settled) return false;
    settled = true;
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
    el.removeEventListener("lostpointercapture", onCancel);
    window.removeEventListener("pointermove", onWindowMove, true);
    window.removeEventListener("pointerup", onWindowUp, true);
    el.classList.remove("dragging");
    el.style.transition = "";
    iconFeedbackController.setDragging(false);
    activeIconDrag = null;
    return true;
  };
  const onCancel = (ev) => {
    traceIconDrag(ev.type, ev, el);
    if (!clearDrag()) return;
    renderIcons(iconLayer, ROOM.desks[currentDesk], sizeOf(ROOM.desks[currentDesk]));
    drainPendingIconPreferences();
  };
  const onUp = (ev) => {
    traceIconDrag('icon pointerup', ev, el);
    if (!clearDrag()) return;
    const desk = ROOM.desks[currentDesk];
    const dragged = desk.icons[index];
    // sparse grid: drop cell from pointer; occupied -> swap, empty -> place
    const rect = iconLayer.getBoundingClientRect();
    const s = sizeOf(ROOM.desks[currentDesk]);
    const cols = Math.max(1, Math.floor(rect.width / s.cellW));
    const rows = Math.max(1, Math.floor(rect.height / s.cellH));
    const blockedAt = (box) => ev.clientX >= box.left && ev.clientX < box.right &&
      ev.clientY >= box.top && ev.clientY < box.bottom;
    const outside = !blockedAt(rect);
    const onDock = dockEl.style.display !== 'none' && blockedAt(dockEl.getBoundingClientRect());
    const onWidget = [...widgetLayer.querySelectorAll('.dext-widget')].some((widget) => blockedAt(widget.getBoundingClientRect()));
    if (outside || onDock || onWidget) {
      renderIcons(iconLayer, desk, s);
      drainPendingIconPreferences();
      return;
    }
    const col = Math.max(0, Math.min(cols - 1, Math.floor((ev.clientX - rect.left) / s.cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((ev.clientY - rect.top) / s.cellH)));
    if (dragged.x === col && dragged.y === row) {
      renderDesk(currentDesk);
      drainPendingIconPreferences();
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
    drainPendingIconPreferences();
  };
  activeIconDrag = { abort(restore) {
    traceIconDrag(`authoritative abort restore=${restore}`);
    if (!clearDrag()) return;
    if (restore) renderIcons(iconLayer, ROOM.desks[currentDesk], sizeOf(ROOM.desks[currentDesk]));
  } };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
  el.addEventListener("lostpointercapture", onCancel);
  el.addEventListener("gotpointercapture", (ev) => traceIconDrag('got capture', ev, el), { once: true });
  window.addEventListener("pointermove", onWindowMove, true);
  window.addEventListener("pointerup", onWindowUp, true);
}

function enterEdit({ rerender = true } = {}) {
  if (editMode || switching) return;
  editMode = true;
  document.body.classList.add("editing");
  iconFeedbackController.setEditing(true);
  if (rerender) renderDesk(currentDesk);
  dextEmit("editchange", { editing: true });
  showToast("编辑模式：拖动图标 / Widget 排列，Esc 或「完成」退出");
}

function exitEdit() {
  if (!editMode) return;
  activeIconDrag?.abort?.(true);
  activeWidgetGesture?.abort?.(true);
  editMode = false;
  document.body.classList.remove("editing");
  iconFeedbackController.setEditing(false);
  renderDesk(currentDesk);
  dextEmit("editchange", { editing: false });
  if (!pendingPreferenceSave) persistRoom();
  drainPendingIconPreferences();
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
  const stagingIcons = stageEl.querySelector('.icon-layer');
  stagingIcons.dataset.dextIconFeedbackRoot = '';
  if (effectiveIconPreferences) globalThis.DextIconFeedback.applyDesktopIconPreferences(stagingIcons, effectiveIconPreferences);
  mountBackground(stageEl.querySelector(".desk-bg"), stageEl.querySelector(".desk-video"), desk, index);
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
    subject: `scene:switch:${from}>${next}`,
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

let deskPressTimer = null;
let deskPressX = 0, deskPressY = 0;
iconLayer.addEventListener("pointerdown", (e) => {
  if (editMode) return;
  if (e.button !== 0 || e.target !== iconLayer) return;
  deskPressX = e.clientX;
  deskPressY = e.clientY;
  deskPressTimer = setTimeout(() => {
    deskPressTimer = null;
    enterEdit();
  }, 500);
});
["pointermove", "pointerup", "pointercancel"].forEach((type) =>
  iconLayer.addEventListener(type, (e) => {
    if (deskPressTimer && (type !== "pointermove" || Math.hypot(e.clientX - deskPressX, e.clientY - deskPressY) > 8)) {
      clearTimeout(deskPressTimer);
      deskPressTimer = null;
    }
  })
);

window.addEventListener("keydown", (e) => {
  if (SCREENSAVER_MODE) return;
  if (e.key === "ArrowRight") switchDesk(1);
  if (e.key === "ArrowLeft") switchDesk(-1);
  if (e.key === "Escape") exitEdit();
});

window.addEventListener("resize", () => {
  if (activeIconDrag) traceIconDrag('window resize');
  activeIconDrag?.abort?.(false);
  activeWidgetGesture?.abort?.(false);
  if (!SCREENSAVER_MODE) renderDesk(currentDesk);
  drainPendingIconPreferences();
});
deskMain.addEventListener('dblclick', (event) => {
  if (!editMode || !(event.target instanceof Element)) return;
  if (event.target.closest('.icon, .dext-widget, .dext-trusted-hotspot')) return;
  exitEdit();
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
