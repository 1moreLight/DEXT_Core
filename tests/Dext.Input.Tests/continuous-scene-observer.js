// Copied only into the isolated Player fixture.
let childState = null;
window.addEventListener("message", (event) => {
  if (event.source !== document.querySelector(".continuous-scene-frame iframe")?.contentWindow ||
      event.data?.type !== "p2a:scene-state") return;
  childState = event.data;
  report("child");
});
function report(stage) {
  const rect = document.querySelector(".continuous-scene-frame")?.getBoundingClientRect();
  chrome.webview.postMessage(JSON.stringify({ type: "saveRoom", room: {
    stage, childState, desk: window.dext.getCurrentDesk(),
    frames: document.querySelectorAll(".continuous-scene-frame iframe").length,
    icon: document.querySelector("#desk-main .icon-layer .icon")?.getAttribute("aria-label"),
    viewport: { width: innerWidth, height: innerHeight },
    scene: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  } }));
}
window.livelyPropertyListener = (name, value) => {
  if (name === "p2a-measure") report(value);
  if (name === "p2a-next") document.getElementById("next-desk").click();
};
window.dext.onReady(() => report("ready"));
window.dext.onDeskChange((event) => {
  if (event.phase === "after") report("after");
});
