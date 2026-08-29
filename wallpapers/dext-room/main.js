const DEFAULT_ROOM = {
  desks: [
    {
      name: "主页",
      background: "assets/desk1-bg.png",
      icons: [
        {
          glyph: "🌐",
          label: "浏览器",
          color: "#3b82f6",
          action: "启动 浏览器",
          launch: {
            target: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          },
        },
        { glyph: "🎮", label: "游戏", color: "#10b981", action: "启动 游戏" },
        { glyph: "🎵", label: "音乐", color: "#f59e0b", action: "启动 音乐" },
        {
          glyph: "📁",
          label: "文件",
          color: "#8b5cf6",
          action: "打开 文件夹",
          launch: { target: "explorer.exe", args: "shell:MyComputerFolder" },
        },
        {
          glyph: "⚙️",
          label: "设置",
          color: "#6b7280",
          action: "打开 设置",
          launch: { target: "ms-settings:" },
        },
      ],
    },
    {
      name: "工作台",
      background: "assets/desk2-bg.png",
      icons: [
        {
          glyph: "💻",
          label: "终端",
          color: "#111827",
          action: "启动 终端",
          launch: { target: "wt.exe" },
        },
        {
          glyph: "📝",
          label: "笔记",
          color: "#ef4444",
          action: "启动 笔记",
          launch: {
            target: "C:\\Users\\JAN\\Desktop\\Obsidian.lnk",
          },
        },
        { glyph: "📊", label: "监控", color: "#06b6d4", action: "打开 监控面板" },
      ],
    },
  ],
};

// room.json overrides the default when present (written by the Dext configurator).
let ROOM = DEFAULT_ROOM;

// dev preview: ?room=<prefix>/ points at any room dir (e.g. ../../rooms/cockpit-room/);
// production (Lively virtual host) has no param and uses package-relative paths.
const RP = new URLSearchParams(location.search).get("room") ?? "";

// ---- room-script hooks (window.dext contract, dev_docs/MODEL.md §6) ----
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

// optional room-owned assets; missing files resolve without blocking
function loadRoomAsset(path, tag, id) {
  return new Promise((resolve) => {
    const el = document.createElement(tag);
    if (id) el.id = id;
    if (id === "dext-room-css-link" && document.getElementById("dext-preview-room-css")) {
      el.disabled = true;
    }
    if (tag === "link") {
      el.rel = "stylesheet";
      el.href = path;
    } else {
      el.src = path;
    }
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.head.appendChild(el);
  });
}

// The configurator preview injects the source Room's current CSS over postMessage.
// Disable the package's room.css link so a previously applied Room cannot leak styles
// into a different Room that intentionally has no room.css.
function applyPreviewRoomCss(css) {
  const packaged = document.getElementById("dext-room-css-link");
  if (packaged) packaged.disabled = true;
  let injected = document.getElementById("dext-preview-room-css");
  if (!injected) {
    injected = document.createElement("style");
    injected.id = "dext-preview-room-css";
    document.head.appendChild(injected);
  }
  injected.textContent = typeof css === "string" ? css : "";
}

// ---- unified playable slot (MODEL.md §6.5) ----
// {type:"video",src,loop?}  renderer-managed fullscreen <video> (local package path)
// {type:"html",src,timeout?} room-owned page; ends on postMessage "dext:slotDone"
// {type:"action",name}      event broadcast only
function playSlot(slot, opts = {}) {
  const onDone = opts.onDone ?? (() => {});
  if (!slot || typeof slot !== "object") {
    onDone();
    return { cancel() {} };
  }

  if (slot.type === "action" && slot.name) {
    window.dispatchEvent(
      new CustomEvent("dext:slot", { detail: { name: slot.name, kind: opts.kind ?? "" } })
    );
    onDone();
    return { cancel() {} };
  }

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;z-index:300;background:#000;";
  let finished = false;
  let timer = null;
  let onMsg = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (onMsg) window.removeEventListener("message", onMsg);
    wrap.remove();
    onDone();
  };
  const cancel = () => {
    finished = true;
    clearTimeout(timer);
    if (onMsg) window.removeEventListener("message", onMsg);
    wrap.remove();
  };
  const limit = slot.timeout ?? opts.timeout ?? (slot.type === "html" ? 20 : 60);
  if (limit > 0) timer = setTimeout(finish, limit * 1000);

  if (slot.type === "video" && slot.src) {
    const v = document.createElement("video");
    v.src = `${RP}${slot.src}`;
    v.muted = true;
    v.autoplay = true;
    v.playsInline = true;
    v.loop = slot.loop ?? opts.loop ?? false;
    v.style.cssText = "width:100%;height:100%;object-fit:cover;";
    v.addEventListener("ended", finish);
    v.addEventListener("error", finish);
    wrap.appendChild(v);
    document.body.appendChild(wrap);
    v.play().catch(finish);
    return { cancel };
  }

  if (slot.type === "html" && slot.src) {
    const f = document.createElement("iframe");
    f.src = `${RP}${slot.src}`;
    f.allow = "autoplay";
    f.style.cssText = "width:100%;height:100%;border:0;";
    wrap.appendChild(f);
    document.body.appendChild(wrap);
    onMsg = (e) => {
      if (e.data === "dext:slotDone") finish();
    };
    window.addEventListener("message", onMsg);
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

async function loadRoom() {
  try {
    const res = await fetch(`${RP}room.json`);
    if (res.ok) {
      const room = await res.json();
      if (room?.desks?.length) ROOM = room;
    }
  } catch (e) {
    // keep default (e.g. opened outside Lively via file://)
  }
  await loadRoomAsset(`${RP}room.css`, "link", "dext-room-css-link");
  await loadRoomAsset(`${RP}room.js`, "script");
  renderDesk(currentDesk);
  playStart();
  dextEmit("ready", { deskCount: ROOM.desks.length });
}

// Core wraps up the wallpaper: Player forwards cmd_close as dext:end;
// play the end slot then ack, or ack immediately when none is configured.
if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", (e) => {
    if (e.data === "dext:end") {
      const slot = ROOM.end;
      if (!slot) {
        window.chrome.webview.postMessage(JSON.stringify({ type: "dext:endDone" }));
        return;
      }
      playSlot(slot, {
        kind: "end",
        timeout: 4, // stay under the Player-side 5s close cap
        onDone: () =>
          window.chrome.webview.postMessage(JSON.stringify({ type: "dext:endDone" })),
      });
      return;
    }

    let data = e.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (data?.type === "dext:app-status") {
      updateAppRuntimeStatus(data.target, data.running);
    }
  });
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
  dockAppsEl.innerHTML = "";
  cfg.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "dock-icon";
    el.title = item.label ?? "";
    el.classList.toggle("is-running", runningAppTargets.has(launchTargetKey(item.launch?.target)));
    el.innerHTML = `
      ${item.icon_png
        ? `<img class="icon-img" draggable="false" src="data:image/png;base64,${item.icon_png}">`
        : `<div class="icon-glyph" style="background:${item.color ?? "#3b82f6"}">${item.glyph ?? "?"}</div>`}
      <button class="icon-del dock-icon-del" title="删除">×</button>
    `;
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action ?? item.label ?? "");
      }
    });
    el.querySelector(".dock-icon-del").addEventListener("click", (ev) => {
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
  if (!window.chrome?.webview?.postMessage) return;
  window.chrome.webview.postMessage(JSON.stringify({ type: "saveRoom", room: ROOM }));
}

// legacy rooms without coords get packed positions once; after that icons are sparse
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

// background is a string (image path, "" = black) or {type:"video",src}
// only the active desk's video stays mounted; desk switches swap the src behind the transition mask
function mountBackground(bgTarget, videoTarget, desk) {
  const bg = desk.background;
  const isVideo = bg && typeof bg === "object" && bg.type === "video";
  if (isVideo) {
    bgTarget.style.backgroundImage = "none";
    const vsrc = `${RP}${bg.src}`;
    if (videoTarget.getAttribute("src") !== vsrc) videoTarget.src = vsrc;
    videoTarget.style.display = "block";
    videoTarget.play().catch(() => {});
  } else {
    videoTarget.pause();
    videoTarget.removeAttribute("src");
    videoTarget.style.display = "none";
    bgTarget.style.backgroundImage = bg ? `url("${RP}${bg}")` : "none";
  }
}

function renderIcons(layer, desk, s) {
  const W = layer.clientWidth || window.innerWidth - 80;
  const H = layer.clientHeight || window.innerHeight - 140;
  const cols = Math.max(4, Math.floor(W / s.cellW));
  const rows = Math.max(1, Math.floor(H / s.cellH));
  layer.style.setProperty("--icon-size", `${s.icon}px`);
  layer.style.setProperty("--label-size", `${s.label}px`);

  if (!desk.icons.length || typeof desk.icons[0].x !== "number") normalizeCoords(desk, cols);

  layer.innerHTML = "";
  desk.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "icon";
    el.style.width = `${s.cellW}px`;
    // clamp into view for the current size without rewriting stored coords
    el.style.left = `${Math.min(item.x ?? 0, cols - 1) * s.cellW}px`;
    el.style.top = `${Math.min(item.y ?? 0, rows - 1) * s.cellH}px`;
    const glyph = item.icon_png
      ? `<img class="icon-img" draggable="false" src="data:image/png;base64,${item.icon_png}">`
      : `<div class="icon-glyph" style="background:${item.color}">${item.glyph}</div>`;
    el.innerHTML = `
      ${glyph}
      <div class="icon-label">${item.label}</div>
      <button class="icon-del" title="删除">×</button>
    `;
    el.addEventListener("dblclick", () => {
      if (editMode) return;
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action);
      }
    });
    el.querySelector(".icon-del").addEventListener("click", (ev) => {
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
  renderDock();
  const n = ROOM.desks.length;
  if (dockCfg().indicator === "dots") {
    dockEl.classList.add("dots");
    indicatorEl.innerHTML = ROOM.desks
      .map((d, i) => `<i${i === index ? ' class="on"' : ""} title="${d.name ?? ""}"></i>`)
      .join("");
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
      stageEl.innerHTML = "";
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
      stageEl.innerHTML = "";
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
      stageEl.innerHTML = "";
    },
  },
  none: {
    dur: 0,
    run(stage, dir, done) {
      done();
    },
    cleanup() {
      stageEl.innerHTML = "";
    },
  },
};

function mountStaging(index) {
  const desk = ROOM.desks[index];
  stageEl.innerHTML = `
    <video class="desk-video" autoplay muted loop playsinline></video>
    <div class="desk-bg"></div>
    <div class="icon-layer"></div>`;
  mountBackground(stageEl.querySelector(".desk-bg"), stageEl.querySelector(".desk-video"), desk);
  renderIcons(stageEl.querySelector(".icon-layer"), desk, sizeOf(desk));
}

// switch resolution: edge override "from>to" first, then room default.
// value: preset string | {type:"video",src} stinger | {type:"action",name} script event
// (legacy key "transition(s)" still read for old rooms)
function resolveTransition(from, to) {
  const t = ROOM.switches?.[`${from}>${to}`] ?? ROOM.switch ??
    ROOM.transitions?.[`${from}>${to}`] ?? ROOM.transition;
  if (typeof t === "string") return { name: t, src: null, action: null };
  if (t && typeof t === "object") {
    if (t.type === "video" && t.src) return { name: "video", src: t.src, action: null };
    if (t.type === "action" && t.name) return { name: "action", src: null, action: t.name };
  }
  return { name: "slide", src: null, action: null };
}

// stinger: fullscreen video covers the screen, desks swap at midpoint, reveal on end
function playVideoTransition(next, src, from, delta) {
  const tv = document.getElementById("transition-video");
  const wrap = document.getElementById("transition-video-wrap");
  let swapped = false;
  let done = false;

  const swap = () => {
    if (swapped) return;
    swapped = true;
    currentDesk = next;
    renderDesk(currentDesk);
    dextEmit("deskchange", { from, to: next, dir: delta, phase: "after" });
    stageEl.style.display = "none";
    stageEl.innerHTML = "";
  };
  const end = () => {
    if (done) return;
    done = true;
    swap();
    wrap.style.display = "none";
    tv.onended = null;
    tv.onerror = null;
    tv.removeAttribute("src");
    switching = false;
  };
  const fallback = () => {
    if (done) return;
    done = true;
    tv.onended = null;
    tv.onerror = null;
    wrap.style.display = "none";
    tv.removeAttribute("src");
    if (swapped) {
      switching = false;
      return;
    }
    mountStaging(next);
    TRANSITIONS.slide.run(stageEl, delta, () => {
      currentDesk = next;
      renderDesk(currentDesk);
      dextEmit("deskchange", { from, to: next, dir: delta, phase: "after" });
      TRANSITIONS.slide.cleanup();
      switching = false;
    });
  };

  tv.onended = end;
  tv.onerror = fallback;
  tv.src = src;
  wrap.style.display = "block";
  const p = tv.play();
  if (p && p.catch) p.catch(fallback);
  tv.addEventListener("timeupdate", function onTime() {
    if (done) {
      tv.removeEventListener("timeupdate", onTime);
      return;
    }
    if (tv.duration > 0 && tv.currentTime >= tv.duration / 2) {
      swap();
      tv.removeEventListener("timeupdate", onTime);
    }
  });
  setTimeout(() => {
    if (!done && tv.readyState === 0) fallback();
  }, 3000);
}

function switchDesk(delta) {
  if (switching || editMode || ROOM.desks.length < 2) return;
  switching = true;

  const from = currentDesk;
  const next = (currentDesk + delta + ROOM.desks.length) % ROOM.desks.length;
  const spec = resolveTransition(from, next);
  const after = () => dextEmit("deskchange", { from, to: next, dir: delta, phase: "after" });

  dextEmit("deskchange", { from, to: next, dir: delta, phase: "before" });

  if (spec.name === "action") {
    // no built-in visuals: broadcast to the room script, swap immediately
    window.dispatchEvent(
      new CustomEvent("dext:switch", {
        detail: { name: spec.action, from, to: next, dir: delta },
      })
    );
    currentDesk = next;
    renderDesk(currentDesk);
    after();
    switching = false;
    return;
  }

  if (spec.name === "video") {
    playVideoTransition(next, spec.src, from, delta);
    return;
  }

  if (spec.name === "text") {
    transitionTextEl.textContent = `正在进入 ${ROOM.desks[next].name} ...`;
    transitionEl.classList.add("active", "fade-in");
    setTimeout(() => {
      currentDesk = next;
      renderDesk(currentDesk);
      after();
      transitionEl.classList.remove("fade-in");
      transitionEl.classList.add("fade-out");
      setTimeout(() => {
        transitionEl.classList.remove("active", "fade-out");
        switching = false;
      }, 450);
    }, 350);
    return;
  }

  const t = TRANSITIONS[spec.name] ?? TRANSITIONS.slide;
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
  if (e.key === "ArrowRight") switchDesk(1);
  if (e.key === "ArrowLeft") switchDesk(-1);
  if (e.key === "Escape") exitEdit();
});

window.addEventListener("resize", () => renderDesk(currentDesk));

window.addEventListener("message", (e) => {
  const d = e.data;
  if (d?.type === "dext:room" && d.room?.desks?.length) {
    ROOM = d.room;
    currentDesk = Math.min(d.deskIndex ?? 0, ROOM.desks.length - 1);
    if (Object.prototype.hasOwnProperty.call(d, "roomCss")) applyPreviewRoomCss(d.roomCss);
    renderDesk(currentDesk);
    dextEmit("ready", { deskCount: ROOM.desks.length, injected: true });
  }
});

loadRoom();
