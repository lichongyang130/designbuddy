import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import chromium, { inflate } from "@sparticuz/chromium";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const chromiumBuild = dirname(require.resolve("@sparticuz/chromium"));
// This package bundles the Linux headless browser plus its small runtime libraries,
// avoiding the browser-CDN download which is blocked in this environment.
await inflate(join(chromiumBuild, "../bin/al2023.tar.br"));
const executablePath = await chromium.executablePath();
const env = {
  ...process.env,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: executablePath,
  LD_LIBRARY_PATH: [join(tmpdir(), "al2023/lib"), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
  DESIGNBUDDY_WEB_PORT: process.env.DESIGNBUDDY_WEB_PORT || "5174",
  DESIGNBUDDY_PORT: process.env.DESIGNBUDDY_PORT || "8788",
};
env.DESIGNBUDDY_API_TARGET = process.env.DESIGNBUDDY_API_TARGET || `http://127.0.0.1:${env.DESIGNBUDDY_PORT}`;
const cli = resolve(appRoot, "node_modules/@playwright/test/cli.js");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd: appRoot, env, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
