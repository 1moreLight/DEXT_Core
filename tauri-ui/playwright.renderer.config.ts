import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/renderer",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results/renderer",
  webServer: {
    command: "npm exec vite -- .. --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174/wallpapers/dext-motion-lab/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
