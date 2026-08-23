const ROOM = {
  desks: [
    {
      name: "主页",
      background: "assets/desk1-bg.png",
      icons: [
        { glyph: "🌐", label: "浏览器", color: "#3b82f6", action: "启动 浏览器" },
        { glyph: "🎮", label: "游戏", color: "#10b981", action: "启动 游戏" },
        { glyph: "🎵", label: "音乐", color: "#f59e0b", action: "启动 音乐" },
        { glyph: "📁", label: "文件", color: "#8b5cf6", action: "打开 文件夹" },
        { glyph: "⚙️", label: "设置", color: "#6b7280", action: "打开 设置" }
      ]
    },
    {
      name: "工作台",
      background: "assets/desk2-bg.png",
      icons: [
        { glyph: "💻", label: "终端", color: "#111827", action: "启动 终端" },
        { glyph: "📝", label: "笔记", color: "#ef4444", action: "启动 笔记" },
        { glyph: "📊", label: "监控", color: "#06b6d4", action: "打开 监控面板" }
      ]
    }
  ],
  transitionText: (from, to) => `正在进入 ${to} ...`
};

const bgEl = document.getElementById("desk-background");
const iconLayer = document.getElementById("icon-layer");
const indicatorEl = document.getElementById("desk-indicator");
const transitionEl = document.getElementById("transition");
const transitionTextEl = document.getElementById("transition-text");
const toastEl = document.getElementById("toast");

let currentDesk = 0;
let switching = false;

function renderDesk(index) {
  const desk = ROOM.desks[index];
  bgEl.style.backgroundImage = `url("${desk.background}")`;
  indicatorEl.textContent = `${index + 1} / ${ROOM.desks.length} · ${desk.name}`;

  iconLayer.innerHTML = "";
  for (const item of desk.icons) {
    const el = document.createElement("div");
    el.className = "icon";
    el.innerHTML = `
      <div class="icon-glyph" style="background:${item.color}">${item.glyph}</div>
      <div class="icon-label">${item.label}</div>
    `;
    el.addEventListener("click", () => showToast(item.action));
    iconLayer.appendChild(el);
  }
}

function switchDesk(delta) {
  if (switching) return;
  switching = true;

  const next = (currentDesk + delta + ROOM.desks.length) % ROOM.desks.length;
  transitionTextEl.textContent = ROOM.transitionText(
    ROOM.desks[currentDesk].name,
    ROOM.desks[next].name
  );

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

renderDesk(currentDesk);
