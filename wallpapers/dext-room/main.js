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

const bgEl = document.getElementById("desk-background");
const iconLayer = document.getElementById("icon-layer");
const indicatorEl = document.getElementById("desk-indicator");
const transitionEl = document.getElementById("transition");
const transitionTextEl = document.getElementById("transition-text");
const toastEl = document.getElementById("toast");

let currentDesk = 0;
let switching = false;

function launchApp(launch) {
  // Phase B: wallpaper -> WebView2 host -> core IPC; falls back to toast outside Lively.
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
  bgEl.style.backgroundImage = `url("${desk.background}")`;
  indicatorEl.textContent = `${index + 1} / ${ROOM.desks.length} · ${desk.name}`;

  iconLayer.innerHTML = "";
  for (const item of desk.icons) {
    const el = document.createElement("div");
    el.className = "icon";
    const glyph = item.icon_png
      ? `<img class="icon-img" src="data:image/png;base64,${item.icon_png}">`
      : `<div class="icon-glyph" style="background:${item.color}">${item.glyph}</div>`;
    el.innerHTML = `
      ${glyph}
      <div class="icon-label">${item.label}</div>
    `;
    el.addEventListener("dblclick", () => {
      if (item.launch) {
        showToast(`正在启动 ${item.label} ...`);
        launchApp(item.launch);
      } else {
        showToast(item.action);
      }
    });
    iconLayer.appendChild(el);
  }
}

function switchDesk(delta) {
  if (switching) return;
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

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") switchDesk(1);
  if (e.key === "ArrowLeft") switchDesk(-1);
});

loadRoom();
