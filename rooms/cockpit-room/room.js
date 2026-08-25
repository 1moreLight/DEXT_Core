// cockpit-room: Gundam-style HUD driven entirely by the window.dext contract.
// Room-author perspective: no renderer internals touched, only dext events + DOM.
(() => {
  if (!window.dext) return;

  const cv = document.createElement("canvas");
  cv.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80;";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");

  let W = 0, H = 0;
  const resize = () => {
    W = cv.width = innerWidth;
    H = cv.height = innerHeight;
  };
  addEventListener("resize", resize);
  resize();

  // seeded scatter so the layout is stable across reloads
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(0x6b21c0);
  const marks = [];
  for (let i = 0; i < 90; i++) {
    marks.push({
      x: rnd(), y: rnd(),
      kind: rnd() < 0.55 ? "tick" : rnd() < 0.6 ? "diamond" : "tri",
      len: 4 + rnd() * 14,
      rot: rnd() * Math.PI,
      side: rnd() < 0.5 ? -1 : 1,
    });
  }

  const MODES = {
    standby: { alpha: 0.32, sweep: 0.04, alert: 0, pulse: 0.15 },
    patrol:  { alpha: 0.62, sweep: 0.15, alert: 0, pulse: 0.3 },
    combat:  { alpha: 0.92, sweep: 0.45, alert: 1, pulse: 0.85 },
  };
  const ORDER = ["standby", "patrol", "combat"];
  let cur = { ...MODES.standby };
  let target = MODES.standby;
  let sweepX = 1; // 0..1, 1 = idle (off-screen)
  let t0 = performance.now();

  window.dext.onDeskChange(({ to, phase }) => {
    if (phase !== "before") return;
    target = MODES[ORDER[to]] ?? MODES.standby;
    sweepX = 0;
  });

  const lerp = (a, b, k) => a + (b - a) * k;
  const col = (rgb, a) => `rgba(${rgb},${a})`;
  const INK = "215,222,230";
  const HOT = "255,196,84";
  const RED = "255,72,72";

  function hex(x, y, r, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    const t = now / 1000;

    // ease visuals toward the target mode
    const k = 1 - Math.exp(-dt * 5);
    cur.alpha = lerp(cur.alpha, target.alpha, k);
    cur.sweep = lerp(cur.sweep, target.sweep, k);
    cur.alert = lerp(cur.alert, target.alert, k);
    cur.pulse = lerp(cur.pulse, target.pulse, k);
    if (sweepX < 1) sweepX = Math.min(1, sweepX + dt * 1.6);

    const a = cur.alpha;
    const ink = cur.alert > 0.5 ? HOT : INK;
    const cx = W / 2, cy = H / 2;
    const u = Math.min(W, H); // unit

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = col(ink, a);

    // center reticle
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 0.16); ctx.lineTo(cx, cy - u * 0.03);
    ctx.moveTo(cx, cy + u * 0.03); ctx.lineTo(cx, cy + u * 0.16);
    ctx.stroke();
    ctx.strokeRect(cx - u * 0.012, cy - u * 0.012, u * 0.024, u * 0.024);
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.05, cy); ctx.lineTo(cx - u * 0.02, cy);
    ctx.moveTo(cx + u * 0.02, cy); ctx.lineTo(cx + u * 0.05, cy);
    ctx.stroke();

    // left/right roll scales (arc tick bands around center)
    for (const side of [-1, 1]) {
      const R = u * 0.62;
      for (let i = 0; i <= 24; i++) {
        const ang = Math.PI / 2 + side * (0.12 + i * 0.028);
        const long = i % 6 === 0;
        const r1 = R, r2 = R + (long ? u * 0.035 : u * 0.018);
        ctx.beginPath();
        ctx.moveTo(cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang) - u * 0.06);
        ctx.lineTo(cx + r2 * Math.cos(ang), cy + r2 * Math.sin(ang) - u * 0.06);
        ctx.stroke();
      }
    }

    // big bottom arcs
    ctx.strokeStyle = col(ink, a * 0.8);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const R = u * 1.15;
      const c = { x: cx + side * u * 0.55, y: cy + u * 0.72 };
      ctx.arc(c.x, c.y, R, Math.PI * 1.15, Math.PI * 1.5, side < 0);
      ctx.stroke();
    }

    // lower hex cluster
    const hy = cy + u * 0.3;
    ctx.strokeStyle = col(ink, a);
    hex(cx - u * 0.085, hy, u * 0.028);
    hex(cx + u * 0.085, hy, u * 0.028);
    hex(cx, hy, u * 0.045);
    ctx.beginPath();
    ctx.moveTo(cx, hy - u * 0.075); ctx.lineTo(cx - u * 0.012, hy - u * 0.05);
    ctx.moveTo(cx, hy - u * 0.075); ctx.lineTo(cx + u * 0.012, hy - u * 0.05);
    ctx.stroke();
    // side brackets
    for (const side of [-1, 1]) {
      const bx = cx + side * u * 0.16;
      ctx.beginPath();
      ctx.moveTo(bx, hy - u * 0.045); ctx.lineTo(bx + side * u * 0.02, hy - u * 0.02);
      ctx.moveTo(bx, hy + u * 0.045); ctx.lineTo(bx + side * u * 0.02, hy + u * 0.02);
      ctx.stroke();
    }
    ctx.fillStyle = col(ink, a * 0.85);
    ctx.font = `${Math.max(8, u * 0.012)}px Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MID-DOW DOCK MANUFACTURER", cx, hy + u * 0.09);

    // top marker
    hex(cx, u * 0.14, u * 0.02, Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.012, u * 0.185); ctx.lineTo(cx, u * 0.21);
    ctx.lineTo(cx + u * 0.012, u * 0.185);
    ctx.stroke();

    // seeded scatter marks
    ctx.strokeStyle = col(ink, a * 0.55);
    for (const m of marks) {
      const x = m.x * W, y = m.y * H;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(m.rot);
      if (m.kind === "tick") {
        ctx.beginPath();
        ctx.moveTo(-m.len / 2, 0); ctx.lineTo(m.len / 2, 0);
        ctx.stroke();
      } else if (m.kind === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -m.len / 2); ctx.lineTo(m.len / 2, 0);
        ctx.lineTo(0, m.len / 2); ctx.lineTo(-m.len / 2, 0);
        ctx.closePath(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -m.len / 2); ctx.lineTo(m.len, m.len / 2);
        ctx.lineTo(-m.len, m.len / 2);
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }

    // patrol/combat rotating sweep ring
    const sr = u * 0.34;
    const ang = t * cur.sweep * Math.PI * 2;
    ctx.strokeStyle = col(ink, a * 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, sr, ang, ang + 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, sr, ang + Math.PI, ang + Math.PI + 0.5);
    ctx.stroke();

    // combat alert: red vignette pulse + corner triangles
    if (cur.alert > 0.02) {
      const p = (Math.sin(t * 3) + 1) / 2;
      const g = ctx.createRadialGradient(cx, cy, u * 0.4, cx, cy, u * 0.95);
      g.addColorStop(0, col(RED, 0));
      g.addColorStop(1, col(RED, 0.16 * cur.alert * (0.5 + p * 0.5)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = col(RED, a * cur.alert);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + sx * u * 0.42, y = cy + sy * u * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + sx * u * 0.02, y);
        ctx.lineTo(x, y + sy * u * 0.02);
        ctx.closePath(); ctx.fill();
      }
    }

    // desk-switch sweep line
    if (sweepX < 1) {
      const x = sweepX * W;
      ctx.fillStyle = col(HOT, 0.5 * (1 - sweepX));
      ctx.fillRect(x - 2, 0, 4, H);
      ctx.fillStyle = col(HOT, 0.08 * (1 - sweepX));
      ctx.fillRect(0, 0, x, H);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
