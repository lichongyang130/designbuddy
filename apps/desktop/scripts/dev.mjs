import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(desktopDir, "../..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rendererUrl = "http://127.0.0.1:5173";

const web = spawn(pnpm, ["--filter", "designbuddy-web", "exec", "vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
  cwd: repoDir,
  stdio: "inherit",
});

let desktop;
let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;
  web.kill("SIGTERM");
  desktop?.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (web.exitCode !== null) throw new Error("Vite exited before it became ready.");
    try {
      const response = await fetch(rendererUrl);
      if (response.ok) { ready = true; break; }
    } catch { /* Vite is still starting. */ }
    await delay(300);
  }
  if (!ready) throw new Error("Timed out waiting for the Vite development server.");

  desktop = spawn(pnpm, ["exec", "electron", "."], {
    cwd: desktopDir,
    stdio: "inherit",
    env: { ...process.env, DESIGNBUDDY_DEV_SERVER_URL: rendererUrl },
  });

  const exitCode = await new Promise((resolve, reject) => {
    desktop.once("error", reject);
    desktop.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  stop();
}
