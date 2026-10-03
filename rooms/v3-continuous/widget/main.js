(() => {
  'use strict';
  const instanceId = crypto.randomUUID(), releases = [];
  document.documentElement.dataset.instanceId = instanceId;
  let connected = false, frame = 0, count = 0;
  const button = document.getElementById('navigate');
  button.addEventListener('click', () => Dext.actions.activate('navigate').catch(() => {}));
  function publishButtons() {
    if (frame || !Dext.session) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = button.getBoundingClientRect();
      Dext.scene.publishGeometry({ buttons: [{ buttonId: 'navigate', x: r.left, y: r.top, width: r.width, height: r.height }] }).catch(() => {});
    });
  }
  function connect() {
    if (connected || !window.Dext?.session) return;
    connected = true;
    releases.push(Dext.desk.subscribe(next => {
      document.body.dataset.desk = next.targetDeskId || next.currentDeskId;
      document.getElementById('status').textContent = next.currentDeskId + ' · revision ' + next.revision + ' · instance ' + instanceId.slice(0, 8);
      publishButtons();
    }));
    releases.push(Dext.scene.subscribeGeometry(publishButtons));
    releases.push(Dext.data.bindReadout('time.read', document.getElementById('clock'), value => {
      document.documentElement.dataset.readoutCount = String(++count);
      document.getElementById('clock').textContent = JSON.stringify(value);
    }));
  }
  addEventListener('dext:ready', connect, { once: true });
  addEventListener('resize', publishButtons);
  addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); releases.forEach(release => release()); Dext.dispose(); });
  connect();
})();
