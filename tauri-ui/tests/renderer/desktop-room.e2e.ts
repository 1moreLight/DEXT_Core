import { expect, test } from "@playwright/test";

const baseRoom = {
  version: 2,
  startDesk: 0,
  switch: "none",
  switches: {},
  dock: {
    enabled: true,
    position: "bottom",
    indicator: "text",
    autoHide: false,
    icons: [
      { label: "Dock App", glyph: "D", color: "#567", launch: { target: "dock.exe", args: "--dock", workdir: "" } },
    ],
  },
  desks: [{
    name: "Motion desk",
    background: null,
    iconSize: "medium",
    icons: [
      { label: "Alpha", glyph: "A", color: "#345", x: 0, y: 0, launch: { target: "alpha.exe", args: "", workdir: "" } },
      { label: "Bravo", glyph: "B", color: "#456", x: 1, y: 0, launch: { target: "bravo.exe", args: "", workdir: "" } },
    ],
    widgets: [{
      id: "motion-widget",
      name: "Motion Widget",
      src: "widgets/motion-widget/index.html",
      permissions: [],
      placement: { x: 620, y: 260, width: 280, height: 180, z: 1 },
    }],
  }],
};

declare global {
  interface Window {
    __dextDispatch(message: unknown): void;
    __alphaNode?: Element;
    __widgetFrame?: Element;
    __dextPosts: unknown[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const listeners: Array<(event: { data: unknown }) => void> = [];
    window.__dextPosts = [];
    Object.defineProperty(window, "chrome", {
      value: {
        webview: {
          addEventListener(type: string, listener: (event: { data: unknown }) => void) {
            if (type === "message") listeners.push(listener);
          },
          postMessage(message: unknown) { window.__dextPosts.push(message); },
        },
      },
      configurable: true,
    });
    window.__dextDispatch = (message: unknown) => listeners.forEach((listener) => listener({ data: message }));
  });
  await page.route("**/wallpapers/dext-room/room.json", (route) => route.fulfill({ json: baseRoom }));
  await page.goto("/wallpapers/dext-room/");
  await expect(page.locator(".icon")).toHaveCount(2);
  await expect(page.locator('.dext-widget[data-widget-id="motion-widget"]')).toHaveCount(1);
});

async function longPressAlpha(page: import("@playwright/test").Page) {
  const alpha = page.locator('[data-launch-target="alpha.exe"]');
  const box = await alpha.boundingBox();
  if (!box) throw new Error("Alpha geometry unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(330);
  await page.mouse.up();
  await expect(page.locator("body")).toHaveClass(/editing/);
}

test("edit mode keeps the real icon node and Widget iframe while only inner faces jiggle", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });

  await longPressAlpha(page);

  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-visual')).toHaveCSS("animation-name", "dext-icon-jiggle");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-face')).toHaveCSS("animation-name", "none");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveCSS("animation-name", "none");
  await expect(page.locator('.dext-widget[data-widget-id="motion-widget"]')).toHaveCSS("animation-name", "dext-widget-jiggle");
});

test("desktop preferences update real hit geometry and visuals without replacing icons or Widget frames", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });

  await page.evaluate(() => window.__dextDispatch({
    type: "dext:desktop-preferences",
    preferences: {
      feedbackStyle: "bare",
      showLabels: false,
      hitTargetSize: "small",
      visualSize: "large",
      spacing: "compact",
    },
  }));

  const root = page.locator(".icon-layer");
  const alpha = page.locator('[data-launch-target="alpha.exe"]');
  const bravo = page.locator('[data-launch-target="bravo.exe"]');
  await expect(root).toHaveAttribute("data-icon-feedback", "bare");
  await expect(root).toHaveAttribute("data-icon-labels", "hidden");
  await expect(root).toHaveAttribute("data-icon-hit-size", "small");
  await expect(root).toHaveAttribute("data-icon-visual-size", "large");
  await expect(root).toHaveAttribute("data-icon-spacing", "compact");
  await expect(alpha.locator(".icon-glyph")).toHaveCSS("--icon-color", "#345");
  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);

  const alphaFace = await alpha.locator(".icon-face").boundingBox();
  const alphaVisual = await alpha.locator(".icon-visual").boundingBox();
  const bravoFace = await bravo.locator(".icon-face").boundingBox();
  if (!alphaFace || !alphaVisual || !bravoFace) throw new Error("desktop preference geometry unavailable");
  expect([alphaFace.width, alphaFace.height]).toEqual([64, 64]);
  expect([alphaVisual.width, alphaVisual.height]).toEqual([64, 64]);
  expect(bravoFace.x - (alphaFace.x + alphaFace.width)).toBe(4);
  await expect(alpha.locator(".icon-label")).toBeHidden();

  await alpha.locator(".icon-face").hover();
  await page.waitForTimeout(550);
  await expect(alpha.locator(".icon-label-tooltip")).toHaveAttribute("data-visible", "true");
});

test("a room-layout hot update reuses the icon and Widget nodes while animating the real icon positioner", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });
  const updated = structuredClone(baseRoom);
  updated.desks[0].icons[0] = { ...updated.desks[0].icons[0], label: "Alpha updated", x: 2 };

  await page.evaluate((room) => window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 }), updated);

  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveText("Alpha updated");
  await expect.poll(() => page.locator('[data-launch-target="alpha.exe"]').evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
});

test("a live add/remove reuses survivors and the Widget iframe while animating the new real icon", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="bravo.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });
  const updated = structuredClone(baseRoom);
  updated.desks[0].icons = [
    updated.desks[0].icons[1],
    { label: "Charlie", glyph: "C", color: "#678", x: 2, y: 0, launch: { target: "charlie.exe", args: "", workdir: "" } },
  ];

  const enterDurations = await page.evaluate((room) => {
    window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 });
    const node = document.querySelector('[data-launch-target="charlie.exe"]');
    return node?.getAnimations().map((animation) => animation.effect?.getTiming().duration) ?? [];
  }, updated);

  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="bravo.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  expect(enterDurations).toContain(180);
});

test("crossing into an icon cell immediately leaves a placeholder and yields the path", async ({ page }) => {
  await longPressAlpha(page);
  const alpha = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  const bravo = await page.locator('[data-launch-target="bravo.exe"]').boundingBox();
  if (!alpha || !bravo) throw new Error("icon geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveClass(/dragging/);
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "100px");
  await expect(page.locator('[data-launch-target="bravo.exe"]')).toHaveCSS("left", "0px");
  const lifted = await page.locator('[data-launch-target="alpha.exe"] .icon-face').boundingBox();
  expect(lifted).not.toBeNull();
  expect(Math.abs(lifted!.x + lifted!.width / 2 - (bravo.x + bravo.width / 2))).toBeLessThan(15);

  await page.mouse.up();
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "false");
  await expect.poll(() => page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(1);
});

test("long press enters edit cleanly and the next press starts a sortable drag", async ({ page }) => {
  const alpha = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  const bravo = await page.locator('[data-launch-target="bravo.exe"]').boundingBox();
  if (!alpha || !bravo) throw new Error("icon geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(330);
  await expect(page.locator("body")).toHaveClass(/editing/);
  await expect(page.locator('[data-launch-target="alpha.exe"]')).not.toHaveClass(/dragging/);
  await page.mouse.up();

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveClass(/dragging/);
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-face')).toHaveCSS("transition-duration", "0s");
  const lifted = await page.locator('[data-launch-target="alpha.exe"] .icon-face').boundingBox();
  expect(lifted).not.toBeNull();
  expect(Math.abs(lifted!.x + lifted!.width / 2 - (bravo.x + bravo.width / 2))).toBeLessThan(15);
  await page.mouse.up();

  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "100px");
  await expect(page.locator('[data-launch-target="bravo.exe"]')).toHaveCSS("left", "0px");
  await expect.poll(() => page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(1);
});

test("repeated drags keep the lifted face stationary while its target preview changes", async ({ page }) => {
  await longPressAlpha(page);
  const face = page.locator('[data-launch-target="alpha.exe"] .icon-face');
  const otherFace = page.locator('[data-launch-target="bravo.exe"] .icon-face');
  for (let turn = 0; turn < 12; turn++) {
    const start = await face.boundingBox();
    const target = await otherFace.boundingBox();
    if (!start || !target) throw new Error("missing face");
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    const before = await face.boundingBox();
    await page.waitForTimeout(100);
    const after = await face.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "true");
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(12);
});

test("Dock and pointercancel restore an icon gesture without persisting", async ({ page }) => {
  await longPressAlpha(page);
  const alphaFace = page.locator('[data-launch-target="alpha.exe"] .icon-face');
  const alpha = await alphaFace.boundingBox();
  const dock = await page.locator("#dock").boundingBox();
  if (!alpha || !dock) throw new Error("drag geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveClass(/dragging/);
  await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2);
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "0px");
  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(0);

  const bravo = await page.locator('[data-launch-target="bravo.exe"]').boundingBox();
  if (!bravo) throw new Error("Bravo geometry unavailable");
  await alphaFace.hover();
  await page.mouse.down();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveClass(/dragging/);
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await page.waitForTimeout(100);
  await page.locator('[data-launch-target="alpha.exe"]').dispatchEvent("pointercancel", { pointerId: 1 });
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "0px");
  await expect(page.locator('[data-launch-target="bravo.exe"]')).toHaveCSS("left", "100px");
  await page.mouse.up();
  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(0);
});

test("an authoritative room update aborts a drag and stale pointerup cannot overwrite it", async ({ page }) => {
  await longPressAlpha(page);
  const alpha = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  const bravo = await page.locator('[data-launch-target="bravo.exe"]').boundingBox();
  if (!alpha || !bravo) throw new Error("icon geometry unavailable");
  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveClass(/dragging/);
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await page.waitForTimeout(100);

  const authoritative = structuredClone(baseRoom);
  authoritative.desks[0].icons[0] = { ...authoritative.desks[0].icons[0], label: "Server Alpha", x: 3 };
  await page.evaluate((room) => window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 }), authoritative);
  await page.mouse.up();

  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "300px");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveText("Server Alpha");
  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(0);
});

test("double-clicking true desktop blank exits edit while interactive children do not", async ({ page }) => {
  await longPressAlpha(page);
  await page.locator('[data-launch-target="alpha.exe"]').dblclick({ force: true });
  await expect(page.locator("body")).toHaveClass(/editing/);
  await page.evaluate(() => document.body.addEventListener("dblclick", (event) => event.stopPropagation()));
  await page.locator(".desk-bg").dblclick({ position: { x: 8, y: 8 }, force: true });
  await expect(page.locator("body")).not.toHaveClass(/editing/);
});

test("Widget drag keeps its iframe, animates conflicting icons, and commits both once", async ({ page }) => {
  await longPressAlpha(page);
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });
  const widget = page.locator('.dext-widget[data-widget-id="motion-widget"]');
  const before = await widget.boundingBox();
  const alpha = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  if (!before || !alpha) throw new Error("Widget drag geometry unavailable");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await expect(widget).toHaveClass(/widget-dragging/);
  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await expect.poll(() => page.locator('[data-launch-target="alpha.exe"]').evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  await page.mouse.up();

  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(1);
});

test("Widget resize keeps its iframe and commits the resized placement once", async ({ page }) => {
  await longPressAlpha(page);
  await page.evaluate(() => {
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });
  const widget = page.locator('.dext-widget[data-widget-id="motion-widget"]');
  const handle = widget.locator(".widget-edit-resize");
  const before = await widget.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!before || !handleBox) throw new Error("Widget resize geometry unavailable");

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 80, handleBox.y + handleBox.height / 2 + 50);
  await page.mouse.up();

  const after = await widget.boundingBox();
  expect(after?.width).toBeGreaterThan(before.width + 60);
  expect(after?.height).toBeGreaterThan(before.height + 35);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(1);
});

test("pressing a Widget without a valid movement does not create a no-op save", async ({ page }) => {
  await longPressAlpha(page);
  const widget = page.locator('.dext-widget[data-widget-id="motion-widget"]');
  const box = await widget.boundingBox();
  if (!box) throw new Error("Widget geometry unavailable");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(0);
});

test("Widget cannot enter Dock and lost pointer capture restores the complete gesture baseline", async ({ page }) => {
  await longPressAlpha(page);
  const widget = page.locator('.dext-widget[data-widget-id="motion-widget"]');
  const before = await widget.boundingBox();
  const dock = await page.locator("#dock").boundingBox();
  if (!before || !dock) throw new Error("Widget/Dock geometry unavailable");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2);
  await page.mouse.up();
  const clamped = await widget.boundingBox();
  if (!clamped) throw new Error("Widget geometry unavailable after Dock clamp");
  expect(clamped.y + clamped.height).toBeLessThanOrEqual(dock.y - 2);

  const start = await widget.boundingBox();
  if (!start) throw new Error("Widget restart geometry unavailable");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x - 180, start.y - 120);
  await widget.dispatchEvent("lostpointercapture", { pointerId: 1 });
  const restored = await widget.boundingBox();
  expect(restored?.x).toBeCloseTo(start.x, 0);
  expect(restored?.y).toBeCloseTo(start.y, 0);
  await page.mouse.up();
});

test("authoritative layout during Widget drag wins over its stale release", async ({ page }) => {
  await longPressAlpha(page);
  const widget = page.locator('.dext-widget[data-widget-id="motion-widget"]');
  const before = await widget.boundingBox();
  const alpha = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  if (!before || !alpha) throw new Error("Widget drag geometry unavailable");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);

  const authoritative = structuredClone(baseRoom);
  authoritative.desks[0].icons[0] = { ...authoritative.desks[0].icons[0], label: "Server Alpha", x: 3 };
  await page.evaluate((room) => window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 }), authoritative);
  await page.mouse.up();

  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "300px");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveText("Server Alpha");
  expect(await page.evaluate(() => window.__dextPosts.filter((item) => String(item).includes('"type":"saveRoom"')).length)).toBe(0);
});

test("desktop and Dock launch interactions still dispatch their current launch payloads", async ({ page }) => {
  await page.locator('[data-launch-target="alpha.exe"]').dblclick({ force: true });
  await page.locator(".dock-icon").dblclick({ force: true });

  await expect.poll(() => page.evaluate(() => window.__dextPosts.filter((item) => {
    try { return Boolean(JSON.parse(String(item)).target); } catch { return false; }
  }).length)).toBe(2);
  const targets = await page.evaluate(() => window.__dextPosts.flatMap((item) => {
    try { return [JSON.parse(String(item)).target]; } catch { return []; }
  }));
  expect(targets).toEqual(["alpha.exe", "dock.exe"]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps editing semantics but disables WAAPI and both jiggles", async ({ page }) => {
    await longPressAlpha(page);
    await expect(page.locator('[data-launch-target="alpha.exe"] .icon-visual')).toHaveCSS("animation-name", "none");
    await expect(page.locator('.dext-widget[data-widget-id="motion-widget"]')).toHaveCSS("animation-name", "none");
    await expect(page.locator('[data-launch-target="alpha.exe"] .icon-face')).toHaveCSS("transition-duration", "0s");
    await expect(page.locator("#reorder-placeholder")).toHaveCSS("transition-duration", "0s");

    const alphaFace = page.locator('[data-launch-target="alpha.exe"] .icon-face');
    const alphaBox = await alphaFace.boundingBox();
    if (!alphaBox) throw new Error("reduced-motion drag geometry unavailable");
    await page.mouse.move(alphaBox.x + alphaBox.width / 2, alphaBox.y + alphaBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(alphaBox.x + alphaBox.width / 2 + 24, alphaBox.y + alphaBox.height / 2 + 12);
    expect(await alphaFace.evaluate((node) => (node as HTMLElement).style.transform)).toContain("scale(1)");
    expect(await alphaFace.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
    await page.mouse.up();

    const updated = structuredClone(baseRoom);
    updated.desks[0].icons[0] = { ...updated.desks[0].icons[0], x: 2 };
    await page.evaluate((room) => window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 }), updated);
    await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("left", "200px");
    expect(await page.locator('[data-launch-target="alpha.exe"]').evaluate((node) => node.getAnimations().length)).toBe(0);
  });
});
