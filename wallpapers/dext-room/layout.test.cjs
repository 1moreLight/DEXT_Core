const test = require("node:test");
const assert = require("node:assert/strict");
const { logicalIconGrid, resolveWidgetIconAvoidance } = require("./layout.js");

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
