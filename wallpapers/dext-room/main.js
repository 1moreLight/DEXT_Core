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

const GRID_COLS = 8;
const CELL_H = 120;
const ICON_W = 96;

const bgEl = document.getElementById("desk-background");
const iconLayer = document.getElementById("icon-layer");
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

function normalizeCoords(desk) {
  desk.icons.forEach((ic, i) => {
    ic.x = i % GRID_COLS;
    ic.y = Math.floor(i / GRID_COLS);
  });
}

// legacy rooms without coords get packed positions once; after that icons are sparse
function normalizeCoords(desk) {
  desk.icons.forEach((ic, i) => {
    ic.x = i % GRID_COLS;
    ic.y = Math.floor(i / GRID_COLS);
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

function renderDesk(index) {
  const desk = ROOM.desks[index];
  bgEl.style.backgroundImage = desk.background ? `url("${desk.background}")` : "none";
  indicatorEl.textContent = `${index + 1} / ${ROOM.desks.length} · ${desk.name}`;

  if (!desk.icons.length || typeof desk.icons[0].x !== "number") normalizeCoords(desk);

  const W = iconLayer.clientWidth || window.innerWidth - 80;
  const cellW = W / GRID_COLS;

  iconLayer.innerHTML = "";
  desk.icons.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "icon";
    el.style.left = `${item.x * cellW + (cellW - ICON_W) / 2}px`;
    el.style.top = `${item.y * CELL_H + 8}px`;
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
    iconLayer.appendChild(el);
  });
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
    const cellW = rect.width / GRID_COLS;
    const rows = Math.max(1, Math.floor(rect.height / CELL_H));
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((ev.clientX - rect.left) / cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((ev.clientY - rect.top) / CELL_H)));
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

function switchDesk(delta) {
  if (switching || editMode) return;
  switching = true;

  const next = (currentDesk + delta + ROOM.desks.length) % ROOM.desks.length;
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
