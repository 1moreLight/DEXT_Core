const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeskReflow, planRoomReflow } = require('./icon-preferences-layout.js');
const { resolveDesktopIconGeometry } = require('./icon-feedback.js');

const G = { footprintWidth: 80, footprintHeight: 84, gapX: 20, gapY: 28, cellW: 100, cellH: 112 };

test('keeps existing valid slots and moves only duplicate occupants', () => {
  const src = [{ label: 'A', x: 0, y: 0 }, { label: 'B', x: 1, y: 0 }, { label: 'C', x: 1, y: 0 }];
  const result = planDeskReflow(src, G, { width: 300, height: 224, blocked: [] });
  assert.equal(result.committed, true);
  assert.deepEqual(result.icons.map(v => [v.x, v.y]), [[0, 0], [1, 0], [2, 0]]);
  assert.deepEqual(result.moved, [2]);
  assert.deepEqual(src[2], { label: 'C', x: 1, y: 0 });
});

test('uses footprint, not the whole cell, for obstacles and returns failure if full', () => {
  const compact = resolveDesktopIconGeometry({ showLabels: false, spacing: 'compact' });
  assert.equal(planDeskReflow([{ x: 0, y: 0 }], compact, {
    width: compact.cellW, height: compact.cellH,
    blocked: [{ x: compact.footprintWidth + 1, y: 0, width: 1, height: 1 }],
  }).committed, true);
  assert.equal(planDeskReflow([{ x: 8, y: 0 }], G, {
    width: 100, height: 112, blocked: [{ x: 0, y: 0, width: 100, height: 112 }],
  }).committed, false);
});

test('selects nearest available slot by distance, then row and column', () => {
  const result = planDeskReflow([{ x: 1, y: 0 }, { x: 1, y: 0 }], G, {
    width: 300, height: 224, blocked: [],
  });
  assert.deepEqual(result.icons.map(v => [v.x, v.y]), [[1, 0], [0, 0]]);
});

test('room failure rolls back all desks without mutating source', () => {
  const room = { desks: [{ icons: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }, { icons: [{ x: 9, y: 9 }] }] };
  const result = planRoomReflow(room, G, [
    { width: 200, height: 112, blocked: [] },
    { width: 100, height: 112, blocked: [{ x: 0, y: 0, width: 100, height: 112 }] },
  ]);
  assert.equal(result.committed, false);
  assert.deepEqual(result.room, room);
  assert.notEqual(result.room, room);
  assert.equal(room.desks[0].icons[1].x, 0);
});
