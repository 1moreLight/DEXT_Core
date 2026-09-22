const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MOTION_PROFILE,
  DextLayoutMotion,
  createMotionItems,
  diffMotionItems,
  iconIdentitySignature,
} = require("./layout-motion.js");

class FakeAnimation {
  constructor(keyframes, options) {
    this.keyframes = keyframes;
    this.options = options;
    this.finished = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  finish() { this.resolve(); }
  cancel() { this.reject(new Error("canceled")); }
}

class FakeNode {
  constructor(container) {
    this.container = container;
    this.style = {};
    this.dataset = {};
    this.parentNode = null;
    this.animations = [];
    this.textContent = "";
  }

  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left || "0");
    const top = Number.parseFloat(this.style.top || "0");
    return { left, top, right: left + 72, bottom: top + 84, width: 72, height: 84 };
  }

  animate(keyframes, options) {
    const animation = new FakeAnimation(keyframes, options);
    this.animations.push(animation);
    return animation;
  }

  remove() {
    this.container.children = this.container.children.filter((node) => node !== this);
    this.parentNode = null;
  }
}

class FakeContainer {
  constructor() {
    this.children = [];
    this.ownerDocument = { createElement: () => new FakeNode(this) };
  }

  appendChild(node) {
    if (!this.children.includes(node)) this.children.push(node);
    node.parentNode = this;
    return node;
  }
}

const app = (label, target, x, y, launch = {}) => ({
  label,
  icon_png: "",
  launch: { target, args: "", workdir: "", ...launch },
  x,
  y,
});

test("launch identity normalizes path casing and whitespace", () => {
  const first = iconIdentitySignature(app("Editor", " C:\\Apps\\Editor.EXE ", 0, 0, {
    args: " --profile Main ",
    workdir: " C:\\Apps ",
  }));
  const second = iconIdentitySignature(app("Renamed", "c:/apps/editor.exe", 5, 4, {
    args: "--profile Main",
    workdir: "c:/apps/",
  }));

  assert.equal(first, second);
  assert.equal(first, "launch:c:/apps/editor.exe|--profile Main|c:/apps");
});

test("legacy identity includes action label glyph and a stable occurrence suffix", () => {
  const icons = [
    { action: { type: "open", value: "settings" }, label: "Settings", glyph: "gear", x: 0, y: 0 },
    { action: { value: "settings", type: "open" }, label: "Settings", glyph: "gear", x: 1, y: 0 },
  ];

  const items = createMotionItems(icons, ({ x, y }) => ({ left: x * 100, top: y * 120 }));

  assert.equal(items[0].key, 'legacy:{"type":"open","value":"settings"}|settings|gear#1');
  assert.equal(items[1].key, 'legacy:{"type":"open","value":"settings"}|settings|gear#2');
  assert.deepEqual(items.map(({ left, top }) => ({ left, top })), [
    { left: 0, top: 0 },
    { left: 100, top: 0 },
  ]);
});

test("motion diff reports move enter and exit without treating unchanged items as affected", () => {
  const before = [
    { key: "a", left: 0, top: 0, data: {} },
    { key: "b", left: 100, top: 0, data: {} },
    { key: "gone", left: 200, top: 0, data: {} },
  ];
  const after = [
    { key: "a", left: 0, top: 0, data: {} },
    { key: "b", left: 100, top: 120, data: {} },
    { key: "new", left: 200, top: 120, data: {} },
  ];

  const diff = diffMotionItems(before, after);

  assert.deepEqual(diff.move.map((entry) => entry.key), ["b"]);
  assert.deepEqual(diff.enter.map((entry) => entry.key), ["new"]);
  assert.deepEqual(diff.exit.map((entry) => entry.key), ["gone"]);
  assert.deepEqual(diff.stay.map((entry) => entry.key), ["a"]);
});

test("excluded keys still receive final coordinates but are not animated as moves", () => {
  const before = [{ key: "dragged", left: 0, top: 0, data: {} }];
  const after = [{ key: "dragged", left: 300, top: 240, data: {} }];

  const diff = diffMotionItems(before, after, ["dragged"]);

  assert.deepEqual(diff.move, []);
  assert.deepEqual(diff.stay.map((entry) => ({ key: entry.key, left: entry.next.left, top: entry.next.top })), [
    { key: "dragged", left: 300, top: 240 },
  ]);
});

test("duplicate explicit keys fail instead of silently reusing one DOM node", () => {
  assert.throws(
    () => diffMotionItems(
      [],
      [
        { key: "same", left: 0, top: 0, data: {} },
        { key: "same", left: 100, top: 0, data: {} },
      ],
    ),
    /duplicate motion key: same/,
  );
});

test("reduced motion writes final coordinates without creating an animation", async () => {
  const container = new FakeContainer();
  const motion = new DextLayoutMotion(container, { reducedMotion: true });

  const result = motion.apply([{ key: "a", left: 240, top: 120, data: { label: "A" } }]);
  await result.finished;

  assert.equal(result.immediate, true);
  assert.equal(container.children[0].style.left, "240px");
  assert.equal(container.children[0].style.top, "120px");
  assert.equal(container.children[0].animations.length, 0);
});

test("cancel with restore rolls a preview back using the rollback duration", async () => {
  const container = new FakeContainer();
  const motion = new DextLayoutMotion(container, { reducedMotion: false });
  motion.apply([{ key: "a", left: 0, top: 0, data: { label: "A" } }], { mode: "initial" });

  motion.apply([{ key: "a", left: 200, top: 100, data: { label: "A" } }], { mode: "preview" });
  const rollback = motion.cancel({ restore: true });

  assert.equal(container.children[0].style.left, "0px");
  assert.equal(container.children[0].style.top, "0px");
  assert.equal(container.children[0].animations.at(-1).options.duration, 300);
  container.children[0].animations.at(-1).finish();
  await rollback.finished;
});

test("an exit callback from an older revision cannot delete a re-entered node", async () => {
  const container = new FakeContainer();
  const motion = new DextLayoutMotion(container, { reducedMotion: false });
  const a = { key: "a", left: 0, top: 0, data: { label: "A" } };
  const b = { key: "b", left: 100, top: 0, data: { label: "B" } };
  motion.apply([a, b], { mode: "initial" });
  const bNode = container.children.find((node) => node.dataset.motionKey === "b");

  motion.apply([a]);
  const staleExit = bNode.animations.at(-1);
  const current = motion.apply([a, b]);
  staleExit.finish();
  bNode.animations.at(-1).finish();
  await current.finished;

  assert.equal(container.children.includes(bNode), true);
  assert.equal(bNode.dataset.motionKey, "b");
});

test("the default motion profile drives the production move timing", () => {
  const container = new FakeContainer();
  const motion = new DextLayoutMotion(container, {
    durations: DEFAULT_MOTION_PROFILE.durations,
    easing: DEFAULT_MOTION_PROFILE.easing,
    reducedMotion: false,
  });
  motion.apply([{ key: "a", left: 0, top: 0, data: { label: "A" } }], { mode: "initial" });

  motion.apply([{ key: "a", left: 120, top: 0, data: { label: "A" } }]);

  assert.equal(container.children[0].animations.at(-1).options.duration, 280);
  assert.equal(container.children[0].animations.at(-1).options.easing, "cubic-bezier(.22,1,.36,1)");
  assert.equal(DEFAULT_MOTION_PROFILE.targetDwell, 80);
  assert.deepEqual(DEFAULT_MOTION_PROFILE.iconLift, { y: -8, scale: 1.06 });
});
