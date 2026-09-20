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

test("only the unified footprint is pointer-active while its surrounding gap stays blank", async ({ page }) => {
  await page.getByLabel("显示实际命中区").check();
  const icon = page.locator('[data-icon-id="hermes"]');
  const nextIcon = page.locator('[data-icon-id="creative-suite"]');
  const face = icon.locator(".icon-face");
  const cellBox = await icon.boundingBox();
  const nextCellBox = await nextIcon.boundingBox();
  const faceBox = await face.boundingBox();
  if (!cellBox || !nextCellBox || !faceBox) throw new Error("icon geometry unavailable");

  const blankPoint = {
    x: (cellBox.x + cellBox.width + nextCellBox.x) / 2,
    y: cellBox.y + cellBox.height / 2,
  };
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".lab-icon")), blankPoint)).toBe(false);
  await page.mouse.click(blankPoint.x, blankPoint.y);
  await expect(icon).not.toHaveAttribute("data-selected", "true");

  await page.mouse.click(faceBox.x + faceBox.width / 2, faceBox.y + faceBox.height / 2);
  await expect(icon).toHaveAttribute("data-selected", "true");
  await page.mouse.move(blankPoint.x, blankPoint.y);
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
  await expect(face).toHaveCSS("animation-duration", "0.15s");
  const jiggleAngles = await face.evaluate((node) => {
    const animation = node.getAnimations().find((item) => item instanceof CSSAnimation && item.animationName === "dext-icon-jiggle");
    const frames = animation?.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [];
    return frames.map((frame) => {
      const matrix = new DOMMatrixReadOnly(String(frame.transform));
      return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    });
  });
  expect(jiggleAngles[0]).toBeCloseTo(-5, 1);
  expect(jiggleAngles.at(-1)).toBeCloseTo(5, 1);
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

test("switches compact standard and spacious gaps between unified footprints", async ({ page }) => {
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
  await expect(page.locator("#gap-size")).toHaveText("20 × 28 gap");

  await page.getByRole("button", { name: "紧凑间距" }).click();
  await expect(root).toHaveAttribute("data-icon-spacing", "compact");
  expect(await horizontalPitch()).toBe(84);
  const firstFace = await icons.nth(0).locator(".icon-face").boundingBox();
  const secondFace = await icons.nth(1).locator(".icon-face").boundingBox();
  if (!firstFace || !secondFace) throw new Error("icon face geometry unavailable");
  expect(secondFace.x - (firstFace.x + firstFace.width)).toBe(4);
  await expect(page.locator("#gap-size")).toHaveText("4 × 12 gap");

  await page.getByRole("button", { name: "宽松间距" }).click();
  await expect(root).toHaveAttribute("data-icon-spacing", "spacious");
  expect(await horizontalPitch()).toBe(120);
  await expect(page.locator("#gap-size")).toHaveText("40 × 40 gap");
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
});

test("keeps every layout footprint coincident with its hit target across size presets", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const icons = page.locator(".lab-icon");
  const faces = page.locator(".icon-face");
  const visuals = page.locator(".icon-visual");
  await page.evaluate(() => {
    window.__iconLabNode = document.querySelector('[data-icon-id="hermes"]') ?? undefined;
  });

  const geometry = async () => Promise.all([0, 1, 2, 3].map(async (index) => {
    const footprint = await icons.nth(index).boundingBox();
    const face = await faces.nth(index).boundingBox();
    const visual = await visuals.nth(index).boundingBox();
    if (!footprint || !face || !visual) throw new Error("icon hit geometry unavailable");
    return {
      footprint: [footprint.x, footprint.y, footprint.width, footprint.height],
      face: [face.x, face.y, face.width, face.height],
      width: face.width,
      height: face.height,
      faceCenterX: face.x + face.width / 2,
      visualCenterX: visual.x + visual.width / 2,
    };
  }));

  await expect(root).toHaveAttribute("data-icon-hit-size", "standard");
  let boxes = await geometry();
  expect(boxes.map(({ width, height }) => [width, height])).toEqual([
    [80, 84], [80, 84], [80, 84], [80, 84],
  ]);
  boxes.forEach(({ footprint, face, faceCenterX, visualCenterX }) => {
    expect(face).toEqual(footprint);
    expect(faceCenterX).toBeCloseTo(visualCenterX, 1);
  });
  await expect(page.locator("#footprint-size")).toHaveText("80 × 84 unified footprint");

  await page.getByLabel("显示桌面图标名称").uncheck();
  expect((await geometry()).map(({ width, height }) => [width, height])).toEqual([
    [72, 72], [72, 72], [72, 72], [72, 72],
  ]);
  (await geometry()).forEach(({ footprint, face }) => expect(face).toEqual(footprint));
  await expect(page.locator("#footprint-size")).toHaveText("72 × 72 unified footprint");

  await page.getByRole("button", { name: "小图标框" }).click();
  await expect(root).toHaveAttribute("data-icon-hit-size", "small");
  expect((await geometry()).map(({ width, height }) => [width, height])).toEqual([
    [64, 64], [64, 64], [64, 64], [64, 64],
  ]);
  (await geometry()).forEach(({ footprint, face }) => expect(face).toEqual(footprint));
  await expect(page.locator("#footprint-size")).toHaveText("64 × 64 unified footprint");

  await page.getByLabel("显示桌面图标名称").check();
  expect((await geometry()).map(({ width, height }) => [width, height])).toEqual([
    [72, 80], [72, 80], [72, 80], [72, 80],
  ]);
  (await geometry()).forEach(({ footprint, face }) => expect(face).toEqual(footprint));
  await expect(page.locator("#footprint-size")).toHaveText("72 × 80 unified footprint");

  await page.getByRole("button", { name: "大图标框" }).click();
  await expect(root).toHaveAttribute("data-icon-hit-size", "large");
  expect((await geometry()).map(({ width, height }) => [width, height])).toEqual([
    [84, 88], [84, 88], [84, 88], [84, 88],
  ]);
  (await geometry()).forEach(({ footprint, face }) => expect(face).toEqual(footprint));
  await expect(page.locator("#footprint-size")).toHaveText("84 × 88 unified footprint");

  await page.getByRole("button", { name: "紧凑间距" }).click();
  const firstFace = await faces.nth(0).boundingBox();
  const secondFace = await faces.nth(1).boundingBox();
  if (!firstFace || !secondFace) throw new Error("compact hit geometry unavailable");
  expect(secondFace.x - (firstFace.x + firstFace.width)).toBe(4);
  expect(await page.evaluate(() => window.__iconLabNode === document.querySelector('[data-icon-id="hermes"]'))).toBe(true);
  expect(await icons.count()).toBe(4);
});

test("interactive mode routes real hover press and selection through the visible hit target", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const firstIcon = page.locator('[data-icon-id="hermes"]');
  const firstFace = firstIcon.locator(".icon-face");
  const firstVisual = firstIcon.locator(".icon-visual");
  const secondIcon = page.locator('[data-icon-id="creative-suite"]');
  const secondFace = secondIcon.locator(".icon-face");
  const firstCellBox = await firstIcon.boundingBox();
  const secondCellBox = await secondIcon.boundingBox();
  if (!firstCellBox || !secondCellBox) throw new Error("icon cell geometry unavailable");

  await expect(page.getByRole("button", { name: "交互", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(root).not.toHaveAttribute("data-icon-preview-state");

  await page.mouse.click(
    (firstCellBox.x + firstCellBox.width + secondCellBox.x) / 2,
    firstCellBox.y + firstCellBox.height / 2,
  );
  await expect(firstIcon).not.toHaveAttribute("data-selected", "true");

  await firstFace.hover();
  await expect.poll(() => firstVisual.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await page.mouse.down();
  await expect(root).toHaveAttribute("data-icon-pressed", "true");
  expect(await firstVisual.evaluate((node) => getComputedStyle(node).transform)).toContain("matrix");
  await page.mouse.up();
  await expect(root).toHaveAttribute("data-icon-pressed", "false");

  await secondFace.click();
  await expect(secondIcon).toHaveAttribute("data-selected", "true");
  await expect(firstIcon).toHaveAttribute("data-selected", "false");
  await expect(page.locator("#lab-status")).toContainText("TARGET DEXT CREATIVE STUDIO EXTENDED EDITION");
});

test("interactive long press enters edit mode and drag returns before blank double click exits", async ({ page }) => {
  const root = page.locator("#icon-lab");
  const stage = page.locator("#icon-stage");
  const icon = page.locator('[data-icon-id="hermes"]');
  const face = icon.locator(".icon-face");
  const faceBox = await face.boundingBox();
  const stageBox = await stage.boundingBox();
  if (!faceBox || !stageBox) throw new Error("interactive geometry unavailable");
  const start = { x: faceBox.x + faceBox.width / 2, y: faceBox.y + faceBox.height / 2 };

  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.clock.runFor(299);
  expect(await root.getAttribute("data-icon-editing")).toBe("false");
  await page.clock.runFor(1);
  expect(await root.getAttribute("data-icon-editing")).toBe("true");
  await expect(face).toHaveCSS("animation-name", "dext-icon-jiggle");
  await expect(page.locator("footer")).toContainText("长按 300ms 编辑");
  await page.mouse.up();

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 34, start.y + 22, { steps: 3 });
  await expect(icon).toHaveClass(/is-dragging/);
  await expect(root).toHaveAttribute("data-icon-dragging", "true");
  expect(await face.getAttribute("style")).toContain("translate(");
  await page.mouse.up();

  await expect(icon).not.toHaveClass(/is-dragging/);
  await expect(root).toHaveAttribute("data-icon-dragging", "false");
  expect((await face.getAttribute("style")) ?? "").not.toContain("translate(");
  await expect(root).toHaveAttribute("data-icon-editing", "true");

  await page.mouse.dblclick(start.x, start.y);
  await expect(root).toHaveAttribute("data-icon-editing", "true");
  await page.mouse.dblclick(stageBox.x + stageBox.width - 24, stageBox.y + stageBox.height - 24);
  await expect(root).toHaveAttribute("data-icon-editing", "false");
});
