import { test, expect } from "@playwright/test";

test("P2a scene keeps one document across desks and official icons stay interactive", async ({ page }) => {
  await page.goto("/wallpapers/dext-room/?room=../../rooms/v3-p2a-probe/");
  const scene = page.frameLocator(".continuous-scene-frame iframe");
  const documentId = await scene.locator("#document-id").textContent();
  expect(documentId).toBeTruthy();
  await scene.getByRole("button", { name: "Author button" }).click();
  await expect(scene.locator("#clicks")).toHaveText("1");
  await page.locator("#next-desk").click();
  await expect(page.locator(".icon[aria-label='Official B']")).toBeVisible();
  await expect(scene.locator("#desk")).toHaveText("1");
  await expect(scene.locator("#document-id")).toHaveText(documentId!);
  await expect(scene.locator("#clicks")).toHaveText("1");
  await page.locator(".icon[aria-label='Official B']").dblclick();
  await expect(page.locator("#toast")).toContainText("Official B");
  await page.locator("#prev-desk").click();
  await expect(scene.locator("#document-id")).toHaveText(documentId!);
});

test("P2a scene rectangle keeps icon drags out at a resized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/wallpapers/dext-room/?room=../../rooms/v3-p2a-probe/");
  const sceneBox = await page.locator(".continuous-scene-frame").boundingBox();
  expect(sceneBox).toBeTruthy();
  const icon = page.locator(".icon[aria-label='Official A']");
  const iconBox = await icon.boundingBox();
  expect(iconBox).toBeTruthy();
  expect(iconBox!.x + iconBox!.width).toBeLessThan(sceneBox!.x);
  await icon.dispatchEvent("pointerdown", { pointerId: 1, button: 0 });
  await page.waitForTimeout(550);
  await expect(page.locator("body")).toHaveClass(/editing/);
  const originalLeft = await icon.evaluate((el) => (el as HTMLElement).style.left);
  const originalTop = await icon.evaluate((el) => (el as HTMLElement).style.top);
  const refreshed = await icon.boundingBox();
  await page.mouse.move(refreshed!.x + refreshed!.width / 2, refreshed!.y + refreshed!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sceneBox!.x + sceneBox!.width / 2, sceneBox!.y + sceneBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(icon).toHaveCSS("left", originalLeft);
  await expect(icon).toHaveCSS("top", originalTop);
  await page.locator("#edit-done").click();
});
