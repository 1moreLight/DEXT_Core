(() => {
  'use strict';
  const instanceId = crypto.randomUUID(), releases = [];
  let connected = false, frame = 0, transitioning = null;
  document.documentElement.dataset.instanceId = instanceId;
  const button = document.getElementById('navigate');
  button.addEventListener('click', () => {
    if (!window.Dext) return;
    Dext.actions.activate('navigate').then(reply => { button.dataset.actionStatus = reply.status; })
      .catch(() => { button.dataset.actionStatus = 'rejected'; });
  });
  function publishButtons() {
    if (frame || !Dext.session) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = button.getBoundingClientRect();
      const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
      const right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
      const buttons = right > left && bottom > top ? [{ buttonId: 'navigate',
        x: left * 1920 / innerWidth, y: top * 1080 / innerHeight,
        width: (right - left) * 1920 / innerWidth, height: (bottom - top) * 1080 / innerHeight }] : [];
      Dext.scene.publishGeometry({ buttons }).catch(() => {});
    });
  }
  function connect() {
    if (connected || !window.Dext?.session) return;
    connected = true;
    releases.push(Dext.desk.subscribe(snapshot => {
      document.body.dataset.desk = snapshot.targetDeskId || snapshot.currentDeskId;
      document.getElementById('status').textContent = `${snapshot.currentDeskId} · revision ${snapshot.revision} · instance ${instanceId.slice(0, 8)}`;
      publishButtons();
      if (snapshot.transitionId === transitioning) return;
      transitioning = snapshot.transitionId;
      if (!transitioning) return;
      const expected = transitioning;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const animations = document.getElementById('instrument').getAnimations();
        Promise.all(animations.map(animation => animation.finished)).then(() => {
          if (Dext.session?.snapshot.transitionId !== expected) return;
          publishButtons();
          Dext.scene.completeTransition(expected).catch(() => {});
        }).catch(() => {});
      }));
    }));
    releases.push(Dext.scene.subscribeGeometry(publishButtons));
  }
  addEventListener('dext:ready', connect, { once: true });
  addEventListener('resize', publishButtons);
  addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); releases.forEach(release => release()); Dext.dispose(); });
  connect();
})();
