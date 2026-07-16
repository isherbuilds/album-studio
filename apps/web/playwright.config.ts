import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const serverRoot = resolve(workspaceRoot, "apps/server");
const webRoot = resolve(workspaceRoot, "apps/web");

export default defineConfig({
  testDir: "./__e2e__",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  globalSetup: "./__e2e__/global-setup.ts",
  projects: [
    {
      name: "desktop-chromium",
      use: devices["Desktop Chrome"]
    },
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "exec node --import tsx src/index.ts",
      cwd: serverRoot,
      url: "http://localhost:5000/server/health/live",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: "exec vp dev",
      cwd: webRoot,
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI
    }
  ]
});
