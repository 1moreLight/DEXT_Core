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

test("rapid revisions continue from the current visual state and never flash back to an old layout", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("zigzag"));
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "392px");
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("top", "240px");
  await expect(page.locator(".motion-icon")).toHaveCount(8);
  expect(await page.locator(".motion-icon").evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations()).length)).toBe(0);
  await expect(page.locator("#motion-status")).toContainText("revision 4");
});

test("icon swap waits for the 80ms stable-cell threshold", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("icon-swap"));
  await page.waitForTimeout(45);
  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");

  await expect.poll(() => page.locator('[data-icon-id="alpha"]').evaluate((node) => getComputedStyle(node).left)).toBe("116px");
  await page.evaluate(() => window.motionLab.waitForIdle());
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "24px");
});

test("leaving an occupied icon before 80ms cancels the pending pointer swap", async ({ page }) => {
  const alpha = await page.locator('[data-icon-id="alpha"]').boundingBox();
  const bravo = await page.locator('[data-icon-id="bravo"]').boundingBox();
  const stage = await page.locator("#motion-stage").boundingBox();
  if (!alpha || !bravo || !stage) throw new Error("motion lab geometry unavailable");

  await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.down();
  await page.mouse.move(bravo.x + bravo.width / 2, bravo.y + bravo.height / 2);
  await page.waitForTimeout(30);
  await page.mouse.move(stage.x + 600, stage.y + 300);
  await page.waitForTimeout(100);

  await expect(page.locator('[data-icon-id="alpha"]')).toHaveCSS("left", "24px");
  await expect(page.locator('[data-icon-id="bravo"]')).toHaveCSS("left", "116px");
  await page.mouse.up();
});

test("pointercancel restores published icon and Widget previews", async ({ page }) => {
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

test("100-icon pressure scenario keeps stable unique nodes and reaches the final revision", async ({ page }) => {
  await page.evaluate(() => window.motionLab.runScenario("stress"));
  await page.evaluate(() => window.motionLab.waitForIdle());

  await expect(page.locator(".motion-icon")).toHaveCount(100);
  const keys = await page.locator(".motion-icon").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-motion-key")));
  expect(new Set(keys).size).toBe(100);
  await expect(page.locator("#motion-status")).toContainText("100 nodes");
});
