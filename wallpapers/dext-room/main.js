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
  transitionText: (from, to) => `正在进入 ${to} ...`
};

// room.json overrides the default when present (written by the Dext configurator).
let ROOM = DEFAULT_ROOM;

async function loadRoom() {
  try {
    const res = await fetch("room.json");
    if (res.ok) {
      const room = await res.json();
      if (room?.desks?.length) ROOM = room;
    }
  } catch (e) {
    // keep default (e.g. opened outside Lively via file://)
  }
  renderDesk(currentDesk);
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
    if (videoTarget.getAttribute("src") !== bg.src) videoTarget.src = bg.src;
    videoTarget.style.display = "block";
    videoTarget.play().catch(() => {});
  } else {
    videoTarget.pause();
    videoTarget.removeAttribute("src");
    videoTarget.style.display = "none";
    bgTarget.style.backgroundImage = bg ? `url("${bg}")` : "none";
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
  showToast("编辑模式：拖动排列，× 删除");
}

function exitEdit() {
  if (!editMode) return;
  editMode = false;
  document.body.classList.remove("editing");
  renderDesk(currentDesk);
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

// transition field: string = preset name; {type:"video",src} = stinger video
function transitionSpec() {
  const t = ROOM.transition;
  if (typeof t === "string") return { name: t, src: null };
  if (t && typeof t === "object" && t.type === "video" && t.src) {
    return { name: "video", src: t.src };
  }
  return { name: "slide", src: null };
}

// stinger: fullscreen video covers the screen, desks swap at midpoint, reveal on end
function playVideoTransition(next, src) {
  const tv = document.getElementById("transition-video");
  const wrap = document.getElementById("transition-video-wrap");
  let swapped = false;
  let done = false;

  const swap = () => {
    if (swapped) return;
    swapped = true;
    currentDesk = next;
    renderDesk(currentDesk);
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
    TRANSITIONS.slide.run(stageEl, 1, () => {
      currentDesk = next;
      renderDesk(currentDesk);
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

  const next = (currentDesk + delta + ROOM.desks.length) % ROOM.desks.length;
  const spec = transitionSpec();

  if (spec.name === "video") {
    playVideoTransition(next, spec.src);
    return;
  }

  if (spec.name === "text") {
    transitionTextEl.textContent = ROOM.transitionText
      ? ROOM.transitionText(ROOM.desks[currentDesk].name, ROOM.desks[next].name)
      : `正在进入 ${ROOM.desks[next].name} ...`;
    transitionEl.classList.add("active", "fade-in");
    setTimeout(() => {
      currentDesk = next;
      renderDesk(currentDesk);
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
  }
});

loadRoom();
