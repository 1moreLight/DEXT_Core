import { expect, test } from "@playwright/test";

const room = {
  version: 2,
  startDesk: 0,
  switch: "none",
  switches: {},
  dock: { enabled: true, position: "bottom", indicator: "text", autoHide: false, icons: [] },
  desks: [{
    name: "Production boundary",
    background: null,
    iconSize: "medium",
    icons: [{
      label: "Alpha",
      glyph: "A",
      color: "#345",
      x: 0,
      y: 0,
      launch: { target: "alpha.exe", args: "", workdir: "" },
    }],
    widgets: [],
  }],
};

test("production Room boots when WebView2 exposes only its mapped project folder", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:5174" && !url.pathname.startsWith("/wallpapers/dext-room/")) {
      await route.abort("blockedbyclient");
      return;
    }
    if (url.pathname === "/wallpapers/dext-room/room.json") {
      await route.fulfill({ json: room });
      return;
    }
    await route.continue();
  });

  await page.goto("/wallpapers/dext-room/");

  await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCount(1);
  await expect(page.locator("#desk-indicator")).toHaveText("1 / 1 · Production boundary");
});
