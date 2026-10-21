import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./build.mjs";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopDir, "../..");
const webDist = path.join(repoRoot, "apps", "web", "dist");
const serverEntry = path.join(repoRoot, "dist", "local", "server", "local-daemon.js");

if (!fs.existsSync(path.join(webDist, "index.html"))) {
  throw new Error("Missing apps/web/dist/index.html. Run `pnpm --filter designbuddy-web build` before staging desktop.");
}
if (!fs.existsSync(serverEntry)) {
  throw new Error("Missing dist/local/server/local-daemon.js. Run `pnpm check:server` before staging desktop.");
}

const stagedRenderer = path.join(desktopDir, "dist", "renderer");
fs.cpSync(webDist, stagedRenderer, { recursive: true });

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const manifest = {
  stagedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  note: "Unpackaged Electron application bundle verified locally; signed macOS (.dmg/.notarized) and Windows (.exe) installers require OS signing runners and are intentionally not fabricated here.",
  entries: {
    main: { path: "dist/main.js", sha256: sha256File(path.join(desktopDir, "dist", "main.js")) },
    preload: { path: "dist/preload.cjs", sha256: sha256File(path.join(desktopDir, "dist", "preload.cjs")) },
    rendererIndex: { path: "dist/renderer/index.html", sha256: sha256File(path.join(stagedRenderer, "index.html")) },
    localDaemon: { path: "../../dist/local/server/local-daemon.js", sha256: sha256File(serverEntry) },
  },
};

fs.writeFileSync(path.join(desktopDir, "dist", "stage-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("Staged desktop bundle -> apps/desktop/dist/stage-manifest.json");
