import { expect, test } from "@playwright/test";

const baseRoom = {
  version: 2,
  startDesk: 0,
  switch: "none",
  switches: {},
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
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const listeners: Array<(event: { data: unknown }) => void> = [];
    Object.defineProperty(window, "chrome", {
      value: {
        webview: {
          addEventListener(type: string, listener: (event: { data: unknown }) => void) {
            if (type === "message") listeners.push(listener);
          },
          postMessage() {},
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
  await page.waitForTimeout(530);
  await page.mouse.up();
  await expect(page.locator("body")).toHaveClass(/editing/);
}

test("edit mode remounts the pre-motion desktop and rebinds direct icon listeners", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });

  await longPressAlpha(page);

  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(false);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(false);
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS("animation-name", "none");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-visual')).toHaveCSS("animation-name", "dext-icon-jiggle");
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveCSS("animation-name", "none");
});

test("the pre-motion direct icon drag follows the pointer and swaps on release", async ({ page }) => {
  await longPressAlpha(page);
  const alpha = page.locator('[data-launch-target="alpha.exe"]');
  const bravo = page.locator('[data-launch-target="bravo.exe"]');
  const alphaStart = await alpha.boundingBox();
  const bravoStart = await bravo.boundingBox();
  if (!alphaStart || !bravoStart) throw new Error("Icon geometry unavailable");

  await page.mouse.move(alphaStart.x + alphaStart.width / 2, alphaStart.y + alphaStart.height / 2);
  await page.mouse.down();
  await page.mouse.move(bravoStart.x + bravoStart.width / 2, bravoStart.y + bravoStart.height / 2, { steps: 4 });
  const alphaDuringDrag = await alpha.boundingBox();
  expect(alphaDuringDrag?.x).toBeGreaterThan(alphaStart.x + 40);
  await page.mouse.up();

  await expect.poll(async () => (await alpha.boundingBox())?.x).toBeCloseTo(bravoStart.x, 0);
  await expect.poll(async () => (await bravo.boundingBox())?.x).toBeCloseTo(alphaStart.x, 0);
});

test("a room-layout hot update rebinds icons without replacing the Widget iframe", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe') ?? undefined;
  });
  const updated = structuredClone(baseRoom);
  updated.desks[0].icons[0] = { ...updated.desks[0].icons[0], label: "Alpha updated", x: 2 };

  await page.evaluate((room) => window.__dextDispatch({ type: "dext:room-layout", room, deskIndex: 0 }), updated);

  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(false);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget[data-widget-id="motion-widget"] iframe'))).toBe(true);
  await expect(page.locator('[data-launch-target="alpha.exe"] .icon-label')).toHaveText("Alpha updated");
});

test("desktop preference message changes the real icon footprint without replacing icons or Widget", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
    window.__widgetFrame = document.querySelector('.dext-widget iframe') ?? undefined;
    window.__dextDispatch({ type: "dext:desktop-preferences", revision: 1, preferences: {
      feedbackStyle: "bare", showLabels: false, hitTargetSize: "small", visualSize: "large", spacing: "compact",
    } });
  });
  await expect(page.locator('.icon-layer')).toHaveAttribute('data-icon-feedback', 'bare');
  await expect(page.locator('.icon-layer')).toHaveAttribute('data-icon-labels', 'hidden');
  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS('pointer-events', 'auto');
  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
  expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget iframe'))).toBe(true);
  const box = await page.locator('[data-launch-target="alpha.exe"]').boundingBox();
  expect(box?.width).toBe(64);
  const edgeTarget = await page.evaluate(() => {
    const icon = document.querySelector('[data-launch-target="alpha.exe"]')!;
    const bounds = icon.getBoundingClientRect();
    return document.elementFromPoint(bounds.right + 2, bounds.top + bounds.height / 2)?.closest('.icon') !== null;
  });
  expect(edgeTarget).toBe(false);
});
