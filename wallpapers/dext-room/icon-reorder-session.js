(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('./layout.js') : root.DextLayout);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DextIconReorderSession = api;
})(globalThis, function (layout) {
  function copy(icons) {
    return icons.map(icon => ({
      ...icon,
      ...(icon.launch && typeof icon.launch === 'object' ? { launch: { ...icon.launch } } : {}),
    }));
  }
  function createIconReorderSession({ icons, draggedIndex, grid, obstacles = [], reserved = [] }) {
    const baseline = copy(icons);
    let current = { valid: true, icons: copy(baseline), moved: [] };
    let valid = false;
    let settled = false;

    return {
      preview(target) {
        if (settled) return null;
        const result = target && layout.resolveIconReorder(
          baseline, draggedIndex, target, grid, obstacles, reserved);
        if (result?.committed) {
          current = { valid: true, icons: result.icons, moved: result.moved };
          valid = true;
        } else {
          current = { ...current, valid: false };
          valid = false;
        }
        return { ...current, icons: copy(current.icons), moved: [...current.moved] };
      },
      finish({ commit }) {
        if (settled) return null;
        settled = true;
        return commit && valid
          ? { committed: true, icons: copy(current.icons), moved: [...current.moved] }
          : { committed: false, icons: copy(baseline), moved: [] };
      },
      abort() {
        if (settled) return null;
        settled = true;
        return { committed: false, icons: copy(baseline), moved: [] };
      },
    };
  }
  return { createIconReorderSession };
});
