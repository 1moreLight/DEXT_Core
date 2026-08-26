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
function loadRoomAsset(path, tag) {
  return new Promise((resolve) => {
    const el = document.createElement(tag);
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
  await loadRoomAsset(`${RP}room.css`, "link");
  await loadRoomAsset(`${RP}room.js`, "script");
  renderDesk(currentDesk);
  playStart();
  dextEmit("ready", { deskCount: ROOM.desks.length });
}

// Core wraps up the wallpaper: Player forwards cmd_close as dext:end;
// play the end slot then ack, or ack immediately when none is configured.
if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", (e) => {
    if (e.data !== "dext:end") return;
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
const indicatorEl = document.getElementById("desk-indicator");
const transitionEl = document.getElementById("transition");
const transitionTextEl = document.getElementById("transition-text");
const toastEl = document.getElementById("toast");
const doneBtn = document.getElementById("edit-done");

let currentDesk = 0;
let switching = false;
let editMode = false;

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
  indicatorEl.textContent = `${index + 1} / ${ROOM.desks.length} · ${desk.name}`;
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
  };
  const onUp = (ev) => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.classList.remove("dragging");
    el.style.transition = "";
    // sparse grid: drop cell from pointer; occupied -> swap, empty -> place
    const rect = iconLayer.getBoundingClientRect();
    const s = sizeOf(ROOM.desks[currentDesk]);
    const cols = Math.max(4, Math.floor(rect.width / s.cellW));
    const rows = Math.max(1, Math.floor(rect.height / s.cellH));
    const col = Math.max(0, Math.min(cols - 1, Math.floor((ev.clientX - rect.left) / s.cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((ev.clientY - rect.top) / s.cellH)));
    const desk = ROOM.desks[currentDesk];
    const dragged = desk.icons[index];
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
    renderDesk(currentDesk);
    dextEmit("ready", { deskCount: ROOM.desks.length, injected: true });
  }
});

loadRoom();
