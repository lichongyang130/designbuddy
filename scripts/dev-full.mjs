import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const file of [".env", ".env.local"])
  if (existsSync(root + file)) loadEnvFile(root + file);
if (!process.env.FFMPEG_PATH && existsSync(root + ".cache/ffmpeg-path.txt"))
  process.env.FFMPEG_PATH = readFileSync(
    root + ".cache/ffmpeg-path.txt",
    "utf8",
  ).trim();
const compiled = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "server/tsconfig.local.json"],
  { cwd: root, stdio: "inherit" },
);
if (compiled.status !== 0) process.exit(compiled.status || 1);
const env = {
  ...process.env,
  DESIGNBUDDY_HOST: "0.0.0.0",
  DESIGNBUDDY_PORT: process.env.DESIGNBUDDY_PORT || "8787",
};
env.DESIGNBUDDY_API_TARGET =
  process.env.DESIGNBUDDY_API_TARGET ||
  `http://127.0.0.1:${env.DESIGNBUDDY_PORT}`;
const children = [
  spawn(process.execPath, ["dist/local/server/local-daemon.js"], {
    cwd: root,
    env,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      root + "apps/web/node_modules/vite/bin/vite.js",
      "--host",
      "0.0.0.0",
      "--port",
      process.env.DESIGNBUDDY_WEB_PORT || "5173",
      "--strictPort",
    ],
    { cwd: root + "apps/web", env, stdio: "inherit" },
  ),
];
// Vite's entry is resolved from the repository, while its working directory is apps/web.
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
    process.exit(code);
  }, 3500).unref();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
