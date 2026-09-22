const test = require("node:test");
const assert = require("node:assert/strict");
const { clampRectOutsideReserved, logicalIconGrid, resolveIconReorder, resolveWidgetIconAvoidance } = require("./layout.js");

const icon = (label, x, y) => ({
  label,
  icon_png: "",
  launch: { target: `${label}.exe`, args: "", workdir: "" },
  x,
  y,
});

test("logicalIconGrid maps the visible icon layer into the Room canvas", () => {
  assert.deepEqual(
    logicalIconGrid(960, 540, { cellW: 96, cellH: 120 }),
    { cellWidth: 192, cellHeight: 240, columns: 10, rows: 4 },
  );
});

test("resolveWidgetIconAvoidance moves only icons covered by the Widget", () => {
  const source = [icon("covered", 0, 0), icon("fixed", 1, 0)];
  const result = resolveWidgetIconAvoidance(
    source,
    [{ x: -40, y: -40, width: 180, height: 180 }],
    { cellWidth: 200, cellHeight: 200, columns: 4, rows: 2 },
  );

  assert.deepEqual(result, {
    committed: true,
    icons: [icon("covered", 0, 1), icon("fixed", 1, 0)],
    moved: [0],
    unresolved: [],
  });
  assert.deepEqual(source, [icon("covered", 0, 0), icon("fixed", 1, 0)]);
});

test("resolveWidgetIconAvoidance rolls back every icon when the final layout has no legal cell", () => {
  const source = [icon("covered", 0, 0), icon("fixed", 1, 0)];
  const result = resolveWidgetIconAvoidance(
    source,
    [{ x: -40, y: -40, width: 180, height: 180 }],
    { cellWidth: 200, cellHeight: 200, columns: 2, rows: 1 },
  );

  assert.deepEqual(result, {
    committed: false,
    icons: source,
    moved: [],
    unresolved: [0],
  });
});

test("resolveIconReorder inserts the lifted icon and shifts every icon along the path", () => {
  const source = [icon("alpha", 0, 0), icon("bravo", 1, 0), icon("charlie", 2, 0), icon("delta", 3, 0)];
  const result = resolveIconReorder(
    source,
    0,
    { x: 2, y: 0 },
    { cellWidth: 100, cellHeight: 100, columns: 5, rows: 2 },
  );

  assert.equal(result.committed, true);
  assert.deepEqual(result.icons, [
    icon("alpha", 2, 0),
    icon("bravo", 0, 0),
    icon("charlie", 1, 0),
    icon("delta", 3, 0),
  ]);
  assert.deepEqual(result.moved, [0, 1, 2]);
  assert.deepEqual(source, [icon("alpha", 0, 0), icon("bravo", 1, 0), icon("charlie", 2, 0), icon("delta", 3, 0)]);
});

test("resolveIconReorder preserves unaffected slots when moving backward or into an empty slot", () => {
  const source = [icon("alpha", 0, 0), icon("bravo", 1, 0), icon("charlie", 2, 0), icon("delta", 3, 0)];
  const grid = { cellWidth: 100, cellHeight: 100, columns: 5, rows: 2 };

  const backward = resolveIconReorder(source, 2, { x: 0, y: 0 }, grid);
  assert.deepEqual(backward.icons, [
    icon("alpha", 1, 0),
    icon("bravo", 2, 0),
    icon("charlie", 0, 0),
    icon("delta", 3, 0),
  ]);

  const empty = resolveIconReorder(source, 0, { x: 4, y: 0 }, grid);
  assert.deepEqual(empty.icons, [
    icon("alpha", 4, 0),
    icon("bravo", 1, 0),
    icon("charlie", 2, 0),
    icon("delta", 3, 0),
  ]);
});

test("resolveIconReorder rejects Widget obstacles and Dock reserved cells without changing icons", () => {
  const source = [icon("alpha", 0, 0), icon("bravo", 1, 0), icon("charlie", 2, 0)];
  const grid = { cellWidth: 100, cellHeight: 100, columns: 4, rows: 2 };
  const widget = resolveIconReorder(source, 0, { x: 2, y: 0 }, grid, [
    { x: 200, y: 0, width: 100, height: 100 },
  ]);
  const dock = resolveIconReorder(source, 0, { x: 0, y: 1 }, grid, [], [
    { x: 0, y: 100, width: 400, height: 100 },
  ]);

  assert.deepEqual(widget, { committed: false, icons: source, moved: [], reason: "blocked" });
  assert.deepEqual(dock, { committed: false, icons: source, moved: [], reason: "blocked" });
});

test("clampRectOutsideReserved keeps a Widget outside Dock reserves on every edge", () => {
  const bounds = { width: 1000, height: 600 };
  assert.deepEqual(
    clampRectOutsideReserved({ x: 400, y: 480, width: 200, height: 100 }, bounds, [{ x: 0, y: 500, width: 1000, height: 100 }], 2),
    { x: 400, y: 398, width: 200, height: 100 },
  );
  assert.deepEqual(
    clampRectOutsideReserved({ x: 400, y: 20, width: 200, height: 100 }, bounds, [{ x: 0, y: 0, width: 1000, height: 100 }], 2),
    { x: 400, y: 102, width: 200, height: 100 },
  );
  assert.deepEqual(
    clampRectOutsideReserved({ x: 50, y: 200, width: 200, height: 100 }, bounds, [{ x: 0, y: 0, width: 120, height: 600 }], 2),
    { x: 122, y: 200, width: 200, height: 100 },
  );
  assert.deepEqual(
    clampRectOutsideReserved({ x: 850, y: 200, width: 200, height: 100 }, bounds, [{ x: 880, y: 0, width: 120, height: 600 }], 2),
    { x: 678, y: 200, width: 200, height: 100 },
  );
  assert.equal(
    clampRectOutsideReserved({ x: 0, y: 0, width: 1000, height: 600 }, bounds, [{ x: 0, y: 0, width: 1000, height: 600 }], 2),
    null,
  );
});
