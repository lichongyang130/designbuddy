import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopDir, "../..");
const tscBin = path.join(repoRoot, "node_modules", ".bin", "tsc");

fs.rmSync(path.join(desktopDir, "dist"), { recursive: true, force: true });
execFileSync(tscBin, ["-p", path.join(desktopDir, "tsconfig.json")], {
  cwd: desktopDir,
  stdio: "inherit",
});
fs.copyFileSync(
  path.join(desktopDir, "src", "preload.cjs"),
  path.join(desktopDir, "dist", "preload.cjs"),
);
console.log("Built apps/desktop/dist/{main.js,preload.cjs}");
