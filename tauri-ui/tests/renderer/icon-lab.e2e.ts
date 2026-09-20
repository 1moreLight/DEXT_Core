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
  await expect(face).toHaveCSS("border-top-width", "0px");
  await page.evaluate(() => {
    window.__iconLabNode = document.querySelector('[data-icon-id="hermes"]') ?? undefined;
  });

  await page.getByRole("button", { name: "悬停", exact: true }).click();
  await expect(root).toHaveAttribute("data-icon-feedback", "halo");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await expect(face).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "紧凑内容框" }).click();
  await expect(root).toHaveAttribute("data-icon-feedback", "compact");
  await expect.poll(() => face.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "纯净无边框" }).click();
  await expect(root).toHaveAttribute("data-icon-feedback", "bare");
  await expect.poll(() => face.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
});

test("only the visible face is pointer-active inside the layout cell", async ({ page }) => {
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
  await page.waitForTimeout(200);
  await expect(icon.locator(".icon-visual")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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

  await page.getByRole("button", { name: "按下", exact: true }).click();
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await face.hover();
  await page.waitForTimeout(550);
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.getByRole("button", { name: "正常", exact: true }).click();
  await face.hover();
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect(tooltip).toHaveAttribute("data-visible", "false");
  await page.mouse.up();
});

test("editing and dragging keep face motion separate from visual feedback", async ({ page }) => {
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const icon = page.locator('[data-icon-id="hermes"]');
  const face = icon.locator(".icon-face");
  const visual = icon.locator(".icon-visual");
  await expect(face).toHaveCSS("animation-name", "dext-icon-jiggle");
  await page.getByRole("button", { name: "悬停", exact: true }).click();
  await expect(face).toHaveCSS("animation-name", "none");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "拖动", exact: true }).click();
  await expect(icon).toHaveClass(/is-dragging/);
  await expect(face).toHaveCSS("animation-name", "none");
  expect(await face.evaluate((node) => getComputedStyle(node).transform)).toContain("matrix");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(face).toHaveCSS("animation-name", "dext-icon-jiggle");
});

test("reduced motion removes transitions and jiggle while keeping feedback", async ({ page }) => {
  await page.getByRole("button", { name: "悬停", exact: true }).click();
  await page.getByLabel("减少动态效果").check();
  const face = page.locator('[data-icon-id="hermes"] .icon-face');
  const visual = page.locator('[data-icon-id="hermes"] .icon-visual');

  await expect(visual).toHaveCSS("transition-duration", "0s");
  await expect(visual).toHaveCSS("transform", "none");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(face).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "拖动", exact: true }).click();
  await expect(face).toHaveCSS("transform", "none");

  await page.getByLabel("减少动态效果").uncheck();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "悬停", exact: true }).click();
  await expect(visual).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "拖动", exact: true }).click();
  await expect(face).toHaveCSS("transform", "none");
});

test("releasing a pressed icon outside the viewport restores hover and delayed labels", async ({ page }) => {
  await page.getByLabel("显示桌面图标名称").uncheck();
  const root = page.locator("#icon-lab");
  const face = page.locator('[data-icon-id="creative-suite"] .icon-face');
  const tooltip = face.locator(".icon-label-tooltip");
  const box = await face.boundingBox();
  if (!box) throw new Error("icon geometry unavailable");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(root).toHaveAttribute("data-icon-pressed", "true");
  await page.mouse.move(-20, -20);
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await expect(root).toHaveAttribute("data-icon-pressed", "false");
  await page.waitForTimeout(550);
  await expect(tooltip).toHaveAttribute("data-visible", "true");
});

test("pins preview states without replacing nodes or moving the icon anchor", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const icon = page.locator('[data-icon-id="hermes"]');
  const visual = icon.locator(".icon-visual");
  const center = async () => {
    const box = await visual.boundingBox();
    if (!box) throw new Error("icon visual geometry unavailable");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const expectCenter = async (expected: { x: number; y: number }) => {
    const actual = await center();
    expect(actual.x).toBeCloseTo(expected.x, 1);
    expect(actual.y).toBeCloseTo(expected.y, 1);
  };

  await page.evaluate(() => {
    window.__iconLabNode = document.querySelector('[data-icon-id="hermes"]') ?? undefined;
  });
  const initialCenter = await center();
  await page.mouse.move(1, 1);

  await page.getByRole("button", { name: "悬停", exact: true }).click();
  await expect(root).toHaveAttribute("data-icon-preview-state", "hover");
  await expect.poll(() => visual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await expectCenter(initialCenter);

  await page.getByRole("button", { name: "紧凑内容框" }).click();
  await expectCenter(initialCenter);
  await page.getByRole("button", { name: "按下", exact: true }).click();
  await expect(root).toHaveAttribute("data-icon-preview-state", "pressed");
  await expectCenter(initialCenter);

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(icon.locator(".icon-face")).toHaveCSS("animation-name", "dext-icon-jiggle");
  await page.getByRole("button", { name: "拖动", exact: true }).click();
  await expect(icon).toHaveClass(/is-dragging/);
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
});

test("switches compact standard and spacious density without overlapping hit targets", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const icons = page.locator(".lab-icon");
  await page.evaluate(() => {
    window.__iconLabNode = document.querySelector('[data-icon-id="hermes"]') ?? undefined;
  });
  const horizontalPitch = async () => {
    const first = await icons.nth(0).boundingBox();
    const second = await icons.nth(1).boundingBox();
    if (!first || !second) throw new Error("icon cell geometry unavailable");
    return second.x - first.x;
  };

  await expect(root).toHaveAttribute("data-icon-spacing", "standard");
  expect(await horizontalPitch()).toBe(100);

  await page.getByRole("button", { name: "紧凑间距" }).click();
  await expect(root).toHaveAttribute("data-icon-spacing", "compact");
  expect(await horizontalPitch()).toBe(88);
  const firstFace = await icons.nth(0).locator(".icon-face").boundingBox();
  const secondFace = await icons.nth(1).locator(".icon-face").boundingBox();
  if (!firstFace || !secondFace) throw new Error("icon face geometry unavailable");
  expect(firstFace.x + firstFace.width).toBeLessThanOrEqual(secondFace.x);
  await expect(page.locator("#cell-size")).toHaveText("88 × 100 layout cell");

  await page.getByRole("button", { name: "宽松间距" }).click();
  await expect(root).toHaveAttribute("data-icon-spacing", "spacious");
  expect(await horizontalPitch()).toBe(120);
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
});
