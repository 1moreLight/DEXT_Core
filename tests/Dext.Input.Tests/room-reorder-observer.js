// Copied only into the isolated Player fixture. Production index.html does not load it.
let probeCanceled = 0;
let probeMoves = 0;
let probeActive = false;
let probeDownX = null;
let probeMoveX = null;
document.addEventListener('pointerdown', event => {
  if (event.target.closest('.icon')) { probeActive = true; probeDownX = event.clientX; }
}, true);
document.addEventListener('pointermove', event => {
  if (probeActive && event.target.closest('.icon') && event.buttons === 1) {
    probeMoves++; probeMoveX = event.clientX;
  }
}, true);
document.addEventListener('pointerup', () => { probeActive = false; }, true);
for (const type of ['pointercancel', 'lostpointercapture']) {
  document.addEventListener(type, () => {
    if (probeActive) { probeCanceled++; probeActive = false; }
  }, true);
}
function probeReport(stage) {
  const icons = [...document.querySelectorAll('#desk-main .icon-layer .icon')].map(node => {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height,
      x: node.style.left, y: node.style.top, dragging: node.classList.contains('dragging') };
  });
  chrome.webview.postMessage(JSON.stringify({ type: 'saveRoom', room: {
    stage, icons, editing: document.body.classList.contains('editing'),
    canceled: probeCanceled, moves: probeMoves,
    downX: probeDownX, moveX: probeMoveX,
    dpr: window.devicePixelRatio,
    positions: window.dext?.getRoom()?.desks?.[0]?.icons?.map(icon => icon.x),
  } }));
}
window.livelyPropertyListener = (name, value) => {
  if (name === 'measure') probeReport(value);
};
window.dext.onReady(() => probeReport('ready'));
window.dext.onEditChange(() => probeReport('editing'));
