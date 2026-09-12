(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DextLayout = api;
})(globalThis, function () {
  function logicalIconGrid(layerWidth, layerHeight, size, canvas = { width: 1920, height: 1080 }) {
    const columns = Math.max(1, Math.floor(layerWidth / size.cellW));
    const rows = Math.max(1, Math.floor(layerHeight / size.cellH));
    return {
      cellWidth: canvas.width / Math.max(layerWidth, 1) * size.cellW,
      cellHeight: canvas.height / Math.max(layerHeight, 1) * size.cellH,
      columns,
      rows,
    };
  }

  function cellKey(x, y) {
    return `${x}:${y}`;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function iconRect(x, y, grid) {
    return { x: x * grid.cellWidth, y: y * grid.cellHeight, width: grid.cellWidth, height: grid.cellHeight };
  }

  function cloneIcons(icons) {
    return icons.map((icon) => ({ ...icon, launch: { ...icon.launch } }));
  }

  function candidates(originX, originY, grid) {
    const result = [];
    for (let y = 0; y < grid.rows; y += 1) {
      for (let x = 0; x < grid.columns; x += 1) {
        result.push({ x, y, distance: Math.abs(x - originX) + Math.abs(y - originY) });
      }
    }
    return result.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  }

  function resolveWidgetIconAvoidance(sourceIcons, obstacles, grid, reserved = []) {
    if (!grid || grid.cellWidth <= 0 || grid.cellHeight <= 0 || grid.columns <= 0 || grid.rows <= 0) {
      throw new Error("icon grid dimensions must be positive");
    }
    const originalIcons = cloneIcons(sourceIcons);
    const icons = cloneIcons(sourceIcons);
    const blocked = [...obstacles, ...reserved];
    const occupied = new Set();
    const conflicts = new Set();

    icons.forEach((icon, index) => {
      const x = Math.min(Math.max(Math.round(icon.x ?? index % grid.columns), 0), grid.columns - 1);
      const y = Math.min(Math.max(Math.round(icon.y ?? Math.floor(index / grid.columns)), 0), grid.rows - 1);
      icon.x = x;
      icon.y = y;
      const key = cellKey(x, y);
      if (occupied.has(key) || blocked.some((rect) => overlaps(iconRect(x, y, grid), rect))) {
        conflicts.add(index);
      } else {
        occupied.add(key);
      }
    });

    const pending = [...conflicts];
    const moved = [];
    while (pending.length) {
      const options = pending.map((index) => {
        const icon = icons[index];
        const originX = icon.x ?? 0;
        const originY = icon.y ?? 0;
        const targets = candidates(originX, originY, grid).filter(({ x, y }) =>
          !occupied.has(cellKey(x, y)) && !blocked.some((rect) => overlaps(iconRect(x, y, grid), rect))
        );
        return { index, originX, originY, targets };
      }).sort((a, b) => a.targets.length - b.targets.length || a.index - b.index);
      const next = options[0];
      if (!next.targets.length) {
        return { committed: false, icons: originalIcons, moved: [], unresolved: [...conflicts] };
      }
      const target = next.targets[0];
      const icon = icons[next.index];
      icon.x = target.x;
      icon.y = target.y;
      occupied.add(cellKey(target.x, target.y));
      if (target.x !== next.originX || target.y !== next.originY) moved.push(next.index);
      pending.splice(pending.indexOf(next.index), 1);
    }
    return { committed: true, icons, moved, unresolved: [] };
  }

  return { logicalIconGrid, resolveWidgetIconAvoidance };
});
