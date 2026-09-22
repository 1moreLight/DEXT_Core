(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DextIconPlacement = api;
})(globalThis, function () {
  const clone = value => JSON.parse(JSON.stringify(value));
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

  function planDeskReflow(icons, geometry, viewport) {
    const source = clone(icons);
    const columns = Math.floor(viewport.width / geometry.cellW);
    const rows = Math.floor(viewport.height / geometry.cellH);
    const occupied = new Set();
    const blocked = viewport.blocked || [];
    const key = (x, y) => `${x}:${y}`;
    const rect = (x, y) => ({
      x: x * geometry.cellW + geometry.gapX / 2,
      y: y * geometry.cellH + geometry.gapY / 2,
      width: geometry.footprintWidth,
      height: geometry.footprintHeight,
    });
    const valid = (x, y) => Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && y >= 0 && x < columns && y < rows &&
      !occupied.has(key(x, y)) && !blocked.some(obstacle => overlaps(rect(x, y), obstacle));
    const pending = [];
    source.forEach((icon, index) => {
      if (valid(icon.x, icon.y)) occupied.add(key(icon.x, icon.y));
      else pending.push(index);
    });
    const moved = [];
    for (const index of pending) {
      const original = source[index];
      const choices = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          if (valid(x, y)) choices.push({ x, y, distance: Math.abs(x - original.x) + Math.abs(y - original.y) });
        }
      }
      choices.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      if (!choices.length) return { committed: false, icons: clone(icons), moved: [] };
      const next = choices[0];
      source[index] = { ...original, x: next.x, y: next.y };
      occupied.add(key(next.x, next.y));
      moved.push(index);
    }
    return { committed: true, icons: source, moved };
  }

  function planRoomReflow(room, geometry, views) {
    const result = clone(room);
    const moved = [];
    for (let deskIndex = 0; deskIndex < (room.desks || []).length; deskIndex++) {
      const original = room.desks[deskIndex];
      const plan = planDeskReflow(original.icons || [], geometry, views[deskIndex]);
      if (!plan.committed) return { committed: false, room: clone(room), moved: [] };
      result.desks[deskIndex].icons = plan.icons;
      for (const iconIndex of plan.moved) moved.push({ deskIndex, iconIndex });
    }
    return { committed: true, room: result, moved };
  }
  return { planDeskReflow, planRoomReflow };
});
