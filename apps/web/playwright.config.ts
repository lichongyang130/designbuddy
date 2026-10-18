import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.DESIGNBUDDY_WEB_PORT || 5173);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./playwright.global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    storageState: "./playwright/.auth.json",
    viewport: { width: 1024, height: 797 },
    reducedMotion: "reduce",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          env: {
            ...process.env,
            LANG: process.env.LANG || "C.UTF-8",
            LC_ALL: process.env.LC_ALL || "C.UTF-8",
          },
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {},
  },
  webServer: {
    command: "node ../../scripts/dev-full.mjs",
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: !process.env.CI,
  },
});
