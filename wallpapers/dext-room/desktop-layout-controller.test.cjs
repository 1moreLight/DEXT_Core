const test = require("node:test");
const assert = require("node:assert/strict");
const { DextDesktopLayoutController } = require("./desktop-layout-controller.js");

class FakeAnimation {
  constructor(options) {
    this.options = options;
    this.finished = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  cancel() { this.reject(new Error("canceled")); }
}

class FakeNode {
  constructor(container) {
    this.container = container;
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.textContent = "";
    this.animations = [];
  }
  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left || "0");
    const top = Number.parseFloat(this.style.top || "0");
    return { left, top, width: 72, height: 84, right: left + 72, bottom: top + 84 };
  }
  animate(_frames, options) {
    const animation = new FakeAnimation(options);
    this.animations.push(animation);
    return animation;
  }
  querySelector() { return null; }
  remove() {
    this.container.children = this.container.children.filter((node) => node !== this);
    this.parentNode = null;
  }
}

class FakeContainer {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.ownerDocument = { createElement: () => new FakeNode(this) };
  }
  appendChild(node) {
    if (!this.children.includes(node)) this.children.push(node);
    node.parentNode = this;
    return node;
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  dispatch(type, target, values = {}) {
    this.listeners.get(type)?.({
      type,
      target,
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
      preventDefault() {},
      ...values,
    });
  }
}

const icon = (label, x, y) => ({
  label,
  x,
  y,
  launch: { target: "C:\\Apps\\Editor.exe", args: "", workdir: "" },
});

test("render reuses a real icon node and updates it with the latest icon snapshot", () => {
  const layer = new FakeContainer();
  const controller = new DextDesktopLayoutController(layer, {
    createIconNode: () => new FakeNode(layer),
    updateIconNode: (node, item) => { node.textContent = item.data.label; },
    positionOf: ({ x, y }) => ({ left: x * 100, top: y * 120 }),
    reducedMotion: true,
  });

  controller.render([icon("Old label", 0, 0)], { mode: "initial" });
  const original = layer.children[0];
  controller.render([icon("New label", 2, 1)], { mode: "hot" });

  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0], original);
  assert.equal(original.textContent, "New label");
  assert.equal(original.style.left, "200px");
  assert.equal(original.style.top, "120px");
});

test("an authoritative render invalidates an external preview instead of restoring stale icons", () => {
  const layer = new FakeContainer();
  const placements = [];
  const controller = new DextDesktopLayoutController(layer, {
    createIconNode: () => new FakeNode(layer),
    positionOf: ({ x, y }) => ({ left: x * 100, top: y * 120 }),
    applyExternalPlacement: (placement) => placements.push({ ...placement }),
    reducedMotion: true,
  });
  const original = [icon("Old", 0, 0)];
  controller.render(original, { mode: "initial" });
  controller.beginExternalGesture({ kind: "draggingWidget", baseIcons: original, basePlacement: { x: 10, y: 10 } });
  controller.previewExternal({ icons: [icon("Old", 1, 0)], placement: { x: 30, y: 40 } });

  controller.render([icon("Authoritative", 3, 0)], { mode: "hot" });
  controller.cancelExternal();

  assert.equal(layer.children[0].style.left, "300px");
  assert.deepEqual(placements, [{ x: 30, y: 40 }]);
  assert.equal(controller.state, "idle");
});

test("an icon target must remain stable for the default 80ms before preview and commits only once", async () => {
  const layer = new FakeContainer();
  let placeholderCount = 0;
  let commits = 0;
  const controller = new DextDesktopLayoutController(layer, {
    createIconNode: () => new FakeNode(layer),
    positionOf: ({ x, y }) => ({ left: x * 100, top: y * 120 }),
    pointToCell: (event) => event.cell,
    solveIconReorder: (icons) => ({
      committed: true,
      icons: [
        { ...icons[0], x: 1, y: 0 },
        { ...icons[1], x: 0, y: 0 },
      ],
    }),
    showPlaceholder: () => { placeholderCount += 1; },
    onIconCommit: () => { commits += 1; },
    reducedMotion: true,
  });
  controller.render([icon("Alpha", 0, 0), icon("Bravo", 1, 0)], { mode: "initial" });
  controller.setEditing(true);
  const alpha = layer.children[0];

  layer.dispatch("pointerdown", alpha, { clientX: 36, clientY: 42 });
  layer.dispatch("pointermove", alpha, { clientX: 136, clientY: 42, cell: { x: 1, y: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(placeholderCount, 0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(placeholderCount, 1);

  layer.dispatch("pointerup", alpha, { clientX: 136, clientY: 42 });
  layer.dispatch("pointerup", alpha, { clientX: 136, clientY: 42 });
  assert.equal(commits, 1);
  assert.equal(layer.children[0].style.left, "100px");
  assert.equal(layer.children[1].style.left, "0px");
});

test("external Widget previews remain transactional and cancel restores both baselines", () => {
  const layer = new FakeContainer();
  const placements = [];
  let commits = 0;
  const controller = new DextDesktopLayoutController(layer, {
    createIconNode: () => new FakeNode(layer),
    positionOf: ({ x, y }) => ({ left: x * 100, top: y * 120 }),
    applyExternalPlacement: (placement) => placements.push({ ...placement }),
    onExternalCommit: () => { commits += 1; },
    reducedMotion: true,
  });
  const original = [icon("Alpha", 0, 0)];
  controller.render(original, { mode: "initial" });
  controller.beginExternalGesture({
    kind: "resizingWidget",
    baseIcons: original,
    basePlacement: { x: 10, y: 20, width: 200, height: 100 },
  });
  controller.previewExternal({
    icons: [icon("Alpha", 2, 0)],
    placement: { x: 10, y: 20, width: 360, height: 180 },
  });

  controller.cancelExternal();
  assert.equal(commits, 0);
  assert.equal(layer.children[0].style.left, "0px");
  assert.deepEqual(placements, [
    { x: 10, y: 20, width: 360, height: 180 },
    { x: 10, y: 20, width: 200, height: 100 },
  ]);
});

test("aborting a pending long press never clears the published icon snapshot", () => {
  const layer = new FakeContainer();
  const controller = new DextDesktopLayoutController(layer, {
    createIconNode: () => new FakeNode(layer),
    positionOf: ({ x, y }) => ({ left: x * 100, top: y * 120 }),
    reducedMotion: true,
  });
  controller.render([icon("Alpha", 0, 0)], { mode: "initial" });

  layer.dispatch("pointerdown", layer.children[0], { clientX: 36, clientY: 42 });
  assert.equal(controller.state, "pressing");
  controller.abort({ restore: true });

  assert.equal(controller.state, "idle");
  assert.equal(controller.publishedIcons.length, 1);
  assert.equal(controller.publishedIcons[0].label, "Alpha");
});
