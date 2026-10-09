(() => {
  'use strict';
  const instanceId = crypto.randomUUID(), releases = [];
  document.documentElement.dataset.instanceId = instanceId;
  let connected = false, snapshot = null, transition = null, settled = 'overview';
  let frame = 0, flight = false, disposed = false, elapsed = 0, last = 0, completed = null, paused = false, dirty = false;
  const rect = desk => desk === 'detail' ? { x: 0, y: 0, width: 1920, height: 1080 } : { x: 0, y: 800, width: 1920, height: 280 };
  function schedule() { if (flight) { dirty = true; return; } if (!frame && !flight && !disposed && !paused && snapshot) frame = requestAnimationFrame(paint); }
  async function paint(time) {
    frame = 0; dirty = false;
    if (disposed || paused || !snapshot) return;
    const own = snapshot, ownTransition = transition;
    if (transition) { elapsed += Math.max(0, time - last); last = time; }
    const p = transition ? Math.min(1, elapsed / 700) : 1, ease = p * p * (3 - 2 * p);
    const from = rect(transition ? own.currentDeskId : settled), to = rect(own.targetDeskId || own.currentDeskId);
    const effective = Dext.session.placements['component.instrument'];
    const desired = Object.fromEntries(Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * ease]));
    const sx = effective ? desired.width / effective.width : 1, sy = effective ? desired.height / effective.height : 1;
    const matrix = effective ? [sx, 0, 0, sy, desired.x - effective.x * sx, desired.y - effective.y * sy] : [1, 0, 0, 1, 0, 0];
    const direction = own.targetDeskId === 'detail' ? 1 : -1;
    flight = true;
    try {
      await Dext.scene.publishGeometry({ groups: {
        source: { matrix: [1, 0, 0, 1, transition ? -direction * 1920 * ease : 0, 0], opacity: transition ? 1 - p : 1 },
        target: { matrix: [1, 0, 0, 1, transition ? direction * 1920 * (1 - ease) : 0, 0], opacity: transition ? p : 1 },
        shared: { matrix, opacity: effective ? 1 : 0 },
      } });
      if (!disposed && snapshot === own && ownTransition && transition === ownTransition && p === 1 && completed !== ownTransition) {
        completed = ownTransition;
        await Dext.scene.completeTransition(ownTransition);
      }
    } catch (_) {
      // A structural acknowledgement or Core revision may supersede this frame.
    } finally {
      flight = false;
      if (!disposed && (dirty || snapshot !== own || transition && completed !== transition)) schedule();
    }
  }
  function connect() {
    if (connected || !window.Dext?.session) return;
    connected = true;
    releases.push(Dext.desk.subscribe(next => {
      snapshot = next;
      if (next.transitionId !== transition) {
        transition = next.transitionId; completed = null; elapsed = 0; last = performance.now();
        if (!transition) settled = next.currentDeskId;
      }
      schedule();
    }));
    releases.push(Dext.lifecycle.subscribe(life => {
      const nextPaused = life.playbackPaused || life.locked || life.stage !== 'desktop';
      if (paused && !nextPaused) last = performance.now();
      paused = nextPaused;
      if (paused && frame) { cancelAnimationFrame(frame); frame = 0; } else schedule();
    }));
    releases.push(Dext.scene.subscribeGeometry(schedule));
  }
  addEventListener('dext:ready', connect, { once: true });
  addEventListener('pagehide', () => { disposed = true; if (frame) cancelAnimationFrame(frame); releases.forEach(release => release()); Dext.dispose(); });
  connect();
})();
