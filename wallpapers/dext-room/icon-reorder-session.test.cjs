const test = require('node:test');
const assert = require('node:assert/strict');
const { createIconReorderSession } = require('./icon-reorder-session.js');

const base = ['A', 'B', 'C', 'D'].map((label, x) => ({ label, x, y: 0 }));
const grid = { cellWidth: 100, cellHeight: 100, columns: 6, rows: 1 };

test('preview always derives from the baseline and invalid release rolls back', () => {
  const tx = createIconReorderSession({ icons: base, draggedIndex: 0, grid, obstacles: [], reserved: [] });
  assert.deepEqual(tx.preview({ x: 2, y: 0 }).icons.map(i => i.x), [2, 0, 1, 3]);
  assert.deepEqual(tx.preview({ x: 1, y: 0 }).icons.map(i => i.x), [1, 0, 2, 3]);
  assert.deepEqual(tx.preview({ x: 5, y: 0 }).icons.map(i => i.x), [5, 1, 2, 3]);
  assert.equal(tx.preview(null).valid, false);
  assert.equal(tx.finish({ commit: true }).committed, false);
  assert.equal(tx.finish({ commit: true }), null);
  assert.deepEqual(base.map(i => i.x), [0, 1, 2, 3]);
});

test('valid release commits once and empty slot leaves peers untouched', () => {
  const tx = createIconReorderSession({ icons: base, draggedIndex: 0, grid, obstacles: [], reserved: [] });
  assert.deepEqual(tx.preview({ x: 5, y: 0 }).moved, [0]);
  const result = tx.finish({ commit: true });
  assert.equal(result.committed, true);
  assert.equal(result.icons[0].x, 5);
  assert.equal(tx.finish({ commit: true }), null);
});

test('blocked target keeps last valid preview until cancel', () => {
  const tx = createIconReorderSession({ icons: base, draggedIndex: 0, grid,
    obstacles: [{ x: 400, y: 0, width: 100, height: 100 }], reserved: [] });
  tx.preview({ x: 2, y: 0 });
  const blocked = tx.preview({ x: 4, y: 0 });
  assert.equal(blocked.valid, false);
  assert.deepEqual(blocked.icons.map(i => i.x), [2, 0, 1, 3]);
  assert.equal(tx.finish({ commit: false }).committed, false);
  assert.deepEqual(base.map(i => i.x), [0, 1, 2, 3]);
});

test('legacy glyph icons retain their optional launch field shape after commit', () => {
  const icons = [{ label: 'A', glyph: 'A', x: 0, y: 0 }, { label: 'B', glyph: 'B', x: 1, y: 0 }];
  const tx = createIconReorderSession({ icons, draggedIndex: 0, grid, obstacles: [], reserved: [] });
  tx.preview({ x: 1, y: 0 });
  const committed = tx.finish({ commit: true });
  assert.equal(Object.hasOwn(committed.icons[0], 'launch'), false);
  assert.equal(Object.hasOwn(committed.icons[1], 'launch'), false);
});
