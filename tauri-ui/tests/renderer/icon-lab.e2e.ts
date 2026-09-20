import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    iconLab?: {
      ready: boolean;
    };
    __iconLabNode?: Element;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/wallpapers/dext-icon-lab/");
  await expect.poll(() => page.evaluate(() => window.iconLab?.ready)).toBe(true);
});

test("switches all feedback profiles without replacing icon nodes", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const icon = page.locator('[data-icon-id="hermes"]');
  const face = icon.locator(".icon-face");
  const visual = icon.locator(".icon-visual");
  await page.evaluate(() => {
    window.__iconLabNode = document.querySelector('[data-icon-id="hermes"]') ?? undefined;
  });

  await face.hover();
  await expect(root).toHaveAttribute("data-icon-feedback", "halo");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await expect(face).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "紧凑内容框" }).click();
  await face.hover();
  await expect(root).toHaveAttribute("data-icon-feedback", "compact");
  await expect.poll(() => face.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "纯净无边框" }).click();
  await face.hover();
  await expect(root).toHaveAttribute("data-icon-feedback", "bare");
  await expect.poll(() => face.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
});

test("only the visible face is pointer-active inside the 96 by 120 grid cell", async ({ page }) => {
  await page.getByLabel("显示实际命中区").check();
  const icon = page.locator('[data-icon-id="hermes"]');
  const face = icon.locator(".icon-face");
  const cellBox = await icon.boundingBox();
  const faceBox = await face.boundingBox();
  if (!cellBox || !faceBox) throw new Error("icon geometry unavailable");

  const blankPoint = { x: cellBox.x + cellBox.width - 2, y: cellBox.y + 2 };
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".lab-icon")), blankPoint)).toBe(false);
  await page.mouse.click(blankPoint.x, blankPoint.y);
  await expect(icon).not.toHaveAttribute("data-selected", "true");

  await page.mouse.click(faceBox.x + faceBox.width / 2, faceBox.y + faceBox.height / 2);
  await expect(icon).toHaveAttribute("data-selected", "true");
});

test("long labels ellipsize and hidden labels show a delayed tooltip", async ({ page }) => {
  const icon = page.locator('[data-icon-id="creative-suite"]');
  const label = icon.locator(".icon-label");
  const face = icon.locator(".icon-face");
  const tooltip = icon.locator(".icon-label-tooltip");

  await expect(label).toHaveCSS("white-space", "nowrap");
  await expect(label).toHaveCSS("text-overflow", "ellipsis");
  expect(await label.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);

  await page.getByLabel("显示桌面图标名称").uncheck();
  await expect(page.locator("#icon-lab")).toHaveAttribute("data-icon-labels", "hidden");
  await face.hover();
  await page.waitForTimeout(350);
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.waitForTimeout(220);
  await expect(tooltip).toHaveAttribute("data-visible", "true");
  await expect(tooltip).toContainText("Dext Creative Studio Extended Edition");

  await page.getByLabel("编辑模式").check();
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.getByLabel("编辑模式").uncheck();
  await face.hover();
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.mouse.up();
});

test("editing and dragging keep face motion separate from visual feedback", async ({ page }) => {
  await page.getByLabel("编辑模式").check();
  const icon = page.locator('[data-icon-id="hermes"]');
  const face = icon.locator(".icon-face");
  const visual = icon.locator(".icon-visual");
  await expect(face).toHaveCSS("animation-name", "dext-icon-jiggle");
  await visual.hover({ force: true });
  expect(await visual.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");

  await page.getByRole("button", { name: "模拟拖动" }).click();
  await expect(icon).toHaveClass(/is-dragging/);
  await expect(face).toHaveCSS("animation-name", "none");
  expect(await face.evaluate((node) => getComputedStyle(node).transform)).toContain("matrix");
  await page.getByRole("button", { name: "结束拖动" }).click();
  await expect(face).toHaveCSS("animation-name", "dext-icon-jiggle");
});

test("reduced motion removes transitions and jiggle while keeping feedback", async ({ page }) => {
  await page.getByLabel("编辑模式").check();
  await page.getByLabel("减少动态效果").check();
  const face = page.locator('[data-icon-id="hermes"] .icon-face');
  const visual = page.locator('[data-icon-id="hermes"] .icon-visual');
  await visual.hover();

  await expect(face).toHaveCSS("animation-name", "none");
  await expect(visual).toHaveCSS("transition-duration", "0s");
  expect(await visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
});
