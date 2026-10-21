import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import chromiumPkg from "@sparticuz/chromium";

const webPort = Number(process.env.DESIGNBUDDY_WEB_PORT || 5173);

async function resolveChromiumExecutable(): Promise<string | undefined> {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (process.platform === "linux") {
    for (const candidate of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
      if (existsSync(candidate)) return candidate;
    }
    try {
      // Ensure @sparticuz/chromium unpacks bundled NSS/NSPR shared libs + SwiftShader WebGL
      if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
        process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x";
      }
      return await chromiumPkg.executablePath();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const resolvedExecPath = await resolveChromiumExecutable();

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
    launchOptions: resolvedExecPath
      ? {
          env: {
            ...process.env,
            LANG: process.env.LANG || "C.UTF-8",
            LC_ALL: process.env.LC_ALL || "C.UTF-8",
            LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, "/tmp/al2023/lib"].filter(Boolean).join(":"),
          },
          executablePath: resolvedExecPath,
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
