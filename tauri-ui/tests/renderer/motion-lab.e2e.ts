import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    motionLab: {
      ready: boolean;
      waitForIdle(): Promise<void>;
      runScenario(name: string): Promise<void>;
    };
    __alphaNode?: Element;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/wallpapers/dext-motion-lab/");
  await expect.poll(() => page.evaluate(() => window.motionLab?.ready)).toBe(true);
});

async function enterAppleEditMode(page: import("@playwright/test").Page) {
  const face = page.locator('[data-icon-id="alpha"] .motion-icon-face');
  const box = await face.boundingBox();
  if (!box) throw new Error("icon face geometry unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(530);
  await page.mouse.up();
  await expect(page.locator("body")).toHaveClass(/editing/);
}

test("move animation reuses the icon node, exposes a transform, and finishes at the target grid cell", async ({ page }) => {
  await page.evaluate(() => {
    window.__alphaNode = document.querySelector('[data-icon-id="alpha"]') ?? undefined;
    void window.motionLab.runScenario("widget-single");
  });

  await expect.poll(() => page.locator('[data-icon-id="alpha"]').evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  const activeFrames = await page.locator('[data-icon-id="alpha"]').evaluate((node) =>
    node.getAnimations()[0]?.effect?.getKeyframes().map((frame) => frame.transform),
  );
  expect(activeFrames?.[0]).toContain("translate3d");

  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
  expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-icon-id="alpha"]'))).toBe(true);
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("top", "24px");
});

test("500ms long press keeps the Apple-style inner jiggle while the outer node performs FLIP", async ({ page }) => {
  await enterAppleEditMode(page);
  const alpha = page.locator('[data-icon-id="alpha"]');
  const face = alpha.locator(".motion-icon-face");
  await expect(face).toHaveCSS("animation-name", "motion-icon-jiggle");

  await page.evaluate(() => { void window.motionLab.runScenario("widget-single"); });
  await expect.poll(() => alpha.evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  expect(await alpha.evaluate((node) => node.getAnimations()[0]?.effect?.getTiming().duration)).toBe(280);
  await expect(face).toHaveCSS("animation-name", "motion-icon-jiggle");

  await page.getByRole("button", { name: "Done editing" }).click();
  await expect(page.locator("body")).not.toHaveClass(/editing/);
  await expect(face).toHaveCSS("animation-name", "none");
});

test("Widget shares the edit jiggle, pauses while dragged, and resumes on release", async ({ page }) => {
  await enterAppleEditMode(page);
  const widget = page.locator("#demo-widget");
  const face = widget.locator(".demo-widget-face");
  await expect(face).toHaveCSS("animation-name", "motion-widget-jiggle");

  const box = await widget.boundingBox();
  if (!box) throw new Error("Widget geometry unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(widget).toHaveClass(/is-dragging/);
  await expect(face).toHaveCSS("animation-name", "none");
  await page.mouse.up();

  await expect(widget).not.toHaveClass(/is-dragging/);
  await expect(face).toHaveCSS("animation-name", "motion-widget-jiggle");
  await page.getByRole("button", { name: "Done editing" }).click();
  await expect(face).toHaveCSS("animation-name", "none");
});

test("rapid revisions continue from the current visual state and never flash back to an old layout", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("zigzag"));
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "392px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
  await expect(page.locator(".motion-icon")).toHaveCount(8);
  expect(await page.locator(".motion-icon").evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations()).length)).toBe(0);
  await expect(page.locator("#motion-status")).toContainText("revision 4");
});

test("lifted icon moves a placeholder while path icons yield and the Widget stays fixed", async ({ page }) => {
  await enterAppleEditMode(page);
  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const charlie = await page.locator('[data-icon-id="charlie"]').boundingBox();
  if (!alpha || !charlie) throw new Error("icon geometry unavailable");
  const widgetPosition = await page.locator("#demo-widget").evaluate((node) => [
    (node as HTMLElement).style.left,
    (node as HTMLElement).style.top,
  ]);

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveClass(/is-dragging/);
  await expect(page.locator('[data-icon-id="alpha"] .motion-icon-face')).toHaveAttribute("style", /scale\(1\.06\)/);
  await page.mouse.move(charlie.x + charlie.width / 2, charlie.y + charlie.height / 2);

  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "true");
  await expect(page.locator("#reorder-placeholder")).toHaveCSS("left", "208px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "208px");
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="charlie"]')).toHaveCSS("left", "116px");

  await page.mouse.up();
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "208px");
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "false");
  expect(await page.locator("#demo-widget").evaluate((node) => [
    (node as HTMLElement).style.left,
    (node as HTMLElement).style.top,
  ])).toEqual(widgetPosition);
});

test("Dock rejects icon drops and restores the original order", async ({ page }) => {
  await enterAppleEditMode(page);
  const dock = page.locator("#demo-dock");
  await expect(dock).toBeVisible();
  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const charlie = await page.locator('[data-icon-id="charlie"]').boundingBox();
  const dockBox = await dock.boundingBox();
  if (!alpha || !charlie || !dockBox) throw new Error("drag geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.mouse.move(charlie.x + charlie.width / 2, charlie.y + charlie.height / 2);
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "24px");
  await page.mouse.move(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await expect(page.locator("#motion-stage")).toHaveAttribute("data-drop-zone", "blocked");
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "116px");
  await page.mouse.up();
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
});

test("Widget remains draggable but is clamped above the Dock", async ({ page }) => {
  await enterAppleEditMode(page);
  const widget = page.locator("#demo-widget");
  const dock = page.locator("#demo-dock");
  await expect(dock).toBeVisible();
  const before = await widget.boundingBox();
  const dockBox = await dock.boundingBox();
  if (!before || !dockBox) throw new Error("Widget geometry unavailable");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await page.mouse.up();
  await page.evaluate(() => window.motionLab.waitForIdle());

  const after = await widget.boundingBox();
  if (!after) throw new Error("Widget geometry unavailable after drag");
  expect(after.y).not.toBe(before.y);
  expect(after.y + after.height).toBeLessThanOrEqual(dockBox.y - 8);
});

test("pointercancel restores published icon and Widget previews", async ({ page }) => {
  await enterAppleEditMode(page);
  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const bravo = await page.locator('[data-icon-id="bravo"]').boundingBox();
  if (!alpha || !bravo) throw new Error("icon geometry unavailable");
  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await expect.poll(() => page.locator('[data-icon-id="alpha"]').evaluate((node) => getComputedStyle(node).left)).toBe("116px");
  await page.locator('[data-icon-id="alpha"]').dispatchEvent("pointercancel", { pointerId: 1 });
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "116px");
  await page.mouse.up();

  const widget = await page.locator("#demo-widget").boundingBox();
  const stage = await page.locator("#motion-stage").boundingBox();
  if (!widget || !stage) throw new Error("Widget geometry unavailable");
  await page.mouse.move(widget.x + widget.width / 2, widget.y + widget.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + 80, stage.y + 80);
  await expect.poll(() => page.locator('[data-icon-id="alpha"]').evaluate((node) => getComputedStyle(node).top)).not.toBe("24px");
  await page.locator("#demo-widget").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
  await page.mouse.up();
});

test("a gesture cancel restores the layout visible when that gesture started", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("widget-single"));
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");

  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const bravo = await page.locator('[data-icon-id="bravo"]').boundingBox();
  if (!alpha || !bravo) throw new Error("icon geometry unavailable");
  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await page.locator('[data-icon-id="alpha"]').dispatchEvent("pointercancel", { pointerId: 1 });
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
  await page.mouse.up();
});

test("a Widget cancel also restores its own current gesture baseline", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("widget-single"));
  await page.evaluate(() => window.motionLab.waitForIdle());
  const widget = await page.locator("#demo-widget").boundingBox();
  const stage = await page.locator("#motion-stage").boundingBox();
  if (!widget || !stage) throw new Error("Widget geometry unavailable");

  await page.mouse.move(widget.x + widget.width / 2, widget.y + widget.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + 520, stage.y + 220);
  await page.locator("#demo-widget").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator("#demo-widget")).toHaveCSS("left", "18px");
  await expect(page.locator("#demo-widget")).toHaveCSS("top", "16px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
  await page.mouse.up();
});

test("reset aborts an active Widget drag before later pointer events arrive", async ({ page }) => {
  await enterAppleEditMode(page);
  const widget = await page.locator("#demo-widget").boundingBox();
  const stage = await page.locator("#motion-stage").boundingBox();
  if (!widget || !stage) throw new Error("Widget geometry unavailable");

  await page.mouse.move(widget.x + widget.width / 2, widget.y + widget.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + 80, stage.y + 80);
  await page.evaluate(() => window.motionLab.runScenario("reset"));
  await page.mouse.move(stage.x + 320, stage.y + 260);
  await page.mouse.up();
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator("#demo-widget")).toHaveCSS("left", "744px");
  await expect(page.locator("#demo-widget")).toHaveCSS("top", "368px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
  await expect(page.locator("#motion-status")).toContainText("reset");
});

test("reset clears a pending long press before its timer can reopen edit mode", async ({ page }) => {
  const face = page.locator('[data-icon-id="alpha"] .motion-icon-face');
  const alpha = await face.boundingBox();
  if (!alpha) throw new Error("icon geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.evaluate(() => window.motionLab.runScenario("reset"));
  await page.waitForTimeout(530);
  await page.mouse.up();

  await expect(page.locator("body")).not.toHaveClass(/editing/);
});

test("reset invalidates delayed scenario callbacks", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("zigzag"));
  await page.waitForTimeout(24);
  await page.evaluate(() => window.motionLab.runScenario("reset"));
  await page.waitForTimeout(420);
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
  await expect(page.locator("#motion-status")).toContainText("reset");
});

test("reset clears a scripted reorder lift without allowing stale cleanup to overwrite it", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("icon-reorder"));
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveClass(/is-dragging/);
  await page.evaluate(() => window.motionLab.runScenario("reset"));
  await page.waitForTimeout(520);

  await expect(page.locator('[data-icon-id="alpha"]')).not.toHaveClass(/is-dragging/);
  await expect(page.locator('[data-icon-id="alpha"] .motion-icon-face')).not.toHaveAttribute("style", /transform/);
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "false");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
});

test("switching scenarios clears a scripted reorder lift before the next scenario runs", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("icon-reorder"));
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveClass(/is-dragging/);
  await page.evaluate(() => window.motionLab.runScenario("add"));
  await page.waitForTimeout(520);

  await expect(page.locator('[data-icon-id="alpha"]')).not.toHaveClass(/is-dragging/);
  await expect(page.locator("#reorder-placeholder")).toHaveAttribute("data-active", "false");
  await expect(page.locator('[data-icon-id="india"]')).toHaveCount(1);
});

test("switching scenarios aborts a real drag so its later pointerup cannot overwrite the new result", async ({ page }) => {
  await enterAppleEditMode(page);
  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const charlie = await page.locator('[data-icon-id="charlie"]').boundingBox();
  if (!alpha || !charlie) throw new Error("icon geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.mouse.move(charlie.x + charlie.width / 2, charlie.y + charlie.height / 2);
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "24px");
  await page.evaluate(() => window.motionLab.runScenario("add"));
  await page.mouse.up();
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="india"]')).toHaveCount(1);
  await expect(page.locator(".motion-icon")).toHaveCount(9);
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator("#motion-status")).toContainText("add icon");
});

test("enter and exit animate while stale exit completion cannot remove a re-entered node", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("add"));
  const added = page.locator('[data-icon-id="india"]');
  await expect(added).toHaveCount(1);
  await expect.poll(() => added.evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  expect(await added.evaluate((node) => node.getAnimations()[0]?.effect?.getKeyframes()[0].transform)).toContain("scale(0.92)");
  await page.evaluate(() => window.motionLab.waitForIdle());

  await page.evaluate(() => window.motionLab.runScenario("remove-reenter"));
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(added).toHaveCount(1);
  await expect(page.locator(".motion-icon")).toHaveCount(9);
});

test("cancel restore and no-space rollback return the complete layout", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("cancel"));
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");

  await page.evaluate(() => window.motionLab.runScenario("no-space"));
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator("#motion-stage")).toHaveAttribute("data-conflict", "true");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
});

test("reduced motion applies final coordinates immediately without WAAPI animations", async ({ page }) => {
  await page.getByLabel("Reduce motion").check();
  await page.evaluate(() => window.motionLab.runScenario("add"));

  await expect(page.locator('[data-icon-id="india"]')).toHaveCSS("left", "392px");
  expect(await page.locator(".motion-icon").evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations()).length)).toBe(0);
  await expect(page.locator('[data-icon-id="india"]')).toHaveAttribute("data-new-highlight", "true");
});

test("enabling reduced motion mid-FLIP immediately settles the outer positioner", async ({ page }) => {
  await page.evaluate(() => { void window.motionLab.runScenario("widget-single"); });
  await expect.poll(() => page.locator(".motion-icon").evaluateAll(
    (nodes) => nodes.flatMap((node) => node.getAnimations()).length,
  )).toBeGreaterThan(0);

  await page.getByLabel("Reduce motion").check();

  expect(await page.locator(".motion-icon").evaluateAll(
    (nodes) => nodes.flatMap((node) => node.getAnimations()).length,
  )).toBe(0);
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
});

test("enabling reduced motion during a preview preserves its cancel baseline", async ({ page }) => {
  await page.evaluate(() => {
    void window.motionLab.runScenario("cancel");
    const checkbox = document.querySelector<HTMLInputElement>("#reduce-motion");
    if (!checkbox) throw new Error("reduced-motion checkbox unavailable");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "24px");
});

test("system reduced-motion preference disables both FLIP and edit-mode jiggle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterAppleEditMode(page);
  const face = page.locator('[data-icon-id="alpha"] .motion-icon-face');
  await expect(face).toHaveCSS("animation-name", "none");
  await expect(page.locator("#demo-widget .demo-widget-face")).toHaveCSS("animation-name", "none");

  await page.evaluate(() => window.motionLab.runScenario("widget-single"));
  expect(await page.locator(".motion-icon").evaluateAll(
    (nodes) => nodes.flatMap((node) => node.getAnimations()).length,
  )).toBe(0);
});

test("100-icon pressure scenario keeps stable unique nodes and reaches the final revision", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("stress"));
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator(".motion-icon")).toHaveCount(100);
  const keys = await page.locator(".motion-icon").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-motion-key")));
  expect(new Set(keys).size).toBe(100);
  await expect(page.locator("#motion-status")).toContainText("100 nodes");
});
