"use strict";

const el = (id) => document.getElementById(id);
const state = {
  language: navigator.language || "zh-CN",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderClock(epochMs) {
  const d = new Date(epochMs);
  el("hh").textContent = pad(d.getHours());
  el("mm").textContent = pad(d.getMinutes());
  el("ss").textContent = pad(d.getSeconds());
  el("date").textContent = new Intl.DateTimeFormat(state.language, {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: state.timeZone,
  }).format(d);
}

function setBar(id, usage) {
  el(`bar-${id}`).style.width = `${Math.min(100, Math.max(0, usage))}%`;
}

function setPercent(id, usage) {
  el(`val-${id}`).textContent = `${Math.round(usage)}%`;
}

function formatSpeed(bps) {
  if (!Number.isFinite(bps) || bps <= 0) return "0 KB/s";
  if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

// P1 只读能力桥：宿主按限频推送快照，SDK 校验 token 后分发。
dext.subscribe("time.read", ({ epochMs }) => renderClock(epochMs));
dext.subscribe("locale.read", ({ language, timeZone }) => {
  state.language = language;
  state.timeZone = timeZone;
  renderClock(Date.now());
});
dext.subscribe("hardware.cpu.read", ({ usage }) => {
  setBar("cpu", usage);
  setPercent("cpu", usage);
});
dext.subscribe("hardware.gpu.read", ({ usage }) => {
  setBar("gpu", usage);
  setPercent("gpu", usage);
});
dext.subscribe("hardware.memory.read", ({ totalMb, availableMb, usedPercent }) => {
  setBar("ram", usedPercent);
  const usedGb = Math.max(0, (totalMb - availableMb) / 1024);
  const totalGb = totalMb / 1024;
  el("val-ram").textContent = totalGb > 0 ? `${usedGb.toFixed(1)} / ${totalGb.toFixed(0)} GB` : "--";
});
dext.subscribe("hardware.network.read", ({ downBytesPerSecond, upBytesPerSecond }) => {
  const peak = Math.max(downBytesPerSecond, upBytesPerSecond, 1);
  setBar("net", (downBytesPerSecond / peak) * 100);
  el("val-net").textContent = `↓ ${formatSpeed(downBytesPerSecond)} · ↑ ${formatSpeed(upBytesPerSecond)}`;
});

// 脱离宿主（浏览器直接打开）时的兜底：只有本地时钟，硬件保持占位。
if (!dext.session) {
  renderClock(Date.now());
  setInterval(() => renderClock(Date.now()), 1000);
}
