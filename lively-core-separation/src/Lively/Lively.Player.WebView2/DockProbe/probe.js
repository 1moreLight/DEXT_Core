"use strict";
const counts = {pointerdown:0,pointerup:0,click:0,dblclick:0,wheel:0,keydown:0,keyup:0};
const bridge = window.chrome?.webview;
const send = value => bridge?.postMessage(value);
const byId = id => document.getElementById(id);
const modes = Array.from(document.querySelectorAll("[data-mode]"));
const rect = value => value ? `${value.x},${value.y} · ${value.width}×${value.height}` : "—";
const refreshCounts = () => {
  byId("click-count").textContent = String(counts.click);
  byId("input-counts").textContent = `按下 ${counts.pointerdown} / 松开 ${counts.pointerup} / 双击 ${counts.dblclick} / 滚轮 ${counts.wheel} / 键 ${counts.keydown}:${counts.keyup}`;
};
function record(event) {
  if (!event.isTrusted || !(event.type in counts)) return;
  if (event.type === "click" || event.type === "dblclick") {
    if (!event.target.closest("#counter")) return;
  }
  counts[event.type]++;
  refreshCounts();
  send({command:"input",eventType:event.type,id:event.target.id || event.target.closest("button")?.id || "",count:counts[event.type],trusted:event.isTrusted});
}
for (const name of ["pointerdown","pointerup","click","dblclick","wheel","keydown","keyup"])
  document.addEventListener(name, record, {passive:true,capture:true});
const onClick = (element, action) => element.addEventListener("click", event => {
  if (event.isTrusted) action();
});
for (const button of modes) onClick(button, () => send({command:"mode",value:button.dataset.mode}));
onClick(byId("keyboard"), () => send({command:"keyboard"}));
onClick(byId("mouse"), () => send({command:"mouse"}));
onClick(byId("transparent"), () => {
  document.body.classList.toggle("transparent-test");
  byId("transparent").setAttribute("aria-pressed", String(document.body.classList.contains("transparent-test")));
  send({command:"input",eventType:"transparent-toggle",id:"transparent",trusted:true});
});
onClick(byId("close"), () => send({command:"close"}));
byId("height").addEventListener("input", event => {
  byId("height-value").textContent = `${event.target.value} DIP`;
});
byId("height").addEventListener("change", event => {
  if (event.isTrusted) send({command:"height",value:Number(event.target.value)});
});
document.addEventListener("keydown", event => {
  if (event.isTrusted && event.key === "Escape") {
    event.preventDefault();
    send({command:"mouse"});
  }
});
bridge?.addEventListener("message", event => {
  if (event.data?.kind === "error") {
    byId("notice").textContent = event.data.message;
    return;
  }
  if (event.data?.kind !== "state") return;
  const state = event.data.state;
  byId("notice").textContent = "原生透明框 HRESULT " + event.data.nativeFrameResult + "；实际透出须看底下软件。超时自动退出。";
  for (const button of modes) button.setAttribute("aria-pressed",String(button.dataset.mode === state.mode));
  byId("height").value = String(state.heightDip);
  byId("height-value").textContent = `${state.heightDip} DIP`;
  byId("status").textContent = `${state.mode} · DPI ${state.dpi} · ${state.keyboard ? "键盘模式" : "鼠标不激活"} · ${state.fullscreen ? "全屏抑制" : state.visible ? "显示" : "收起"}`;
  byId("rectangles").textContent = `窗口 ${rect(state.window)}\n工作区 ${rect(state.workArea)}\n原工作区 ${rect(state.originalWorkArea)}\n前台 ${state.foreground} / Dock ${state.hwnd} · AppBar ${state.appBarRegistered}`;
});
if (!bridge) byId("notice").textContent = "此页面需要原生 Dock 原型宿主。浏览器显示不能验证 AppBar 或焦点。";
else send({command:"ping"});
