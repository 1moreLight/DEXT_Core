// Demo 工具：把 my-room 里的真实应用（真实图标+launch）注入 test-dock-hud 的 dock 图标，
// 模拟「配置器应用库 -> Dock」的数据流。跑完 node scripts/dock-demo-inject.mjs 后刷新预览。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + "\n");

const src = read("rooms/my-room/room.json");
const dst = read("rooms/test-dock-hud/room.json");

// 从 my-room 所有桌的图标里按名字取真实应用（保留 icon_png + launch，去掉桌面坐标）
const all = src.desks.flatMap((d) => d.icons);
const pick = (label) => {
  const it = all.find((i) => i.label === label);
  if (!it) throw new Error(`my-room 里没有「${label}」`);
  return { label: it.label, icon_png: it.icon_png, launch: it.launch };
};

const openCode = pick("OpenCode");
const steam = pick("Steam");

// 桌 1：真实应用 + emoji 兜底混搭；桌 2：另一个真实应用 + emoji
dst.desks[0].dock.icons = [
  { ...openCode, action: "启动 OpenCode" },
  { label: "浏览器", glyph: "🌐", color: "#3b82f6", action: "启动 浏览器" },
];
dst.desks[1].dock.icons = [
  { ...steam, action: "启动 Steam" },
  { label: "终端", glyph: "💻", color: "#111827", action: "启动 终端" },
];

write("rooms/test-dock-hud/room.json", dst);
console.log("injected: 主页 dock=[OpenCode, 浏览器] · 工作台 dock=[Steam, 终端]");
