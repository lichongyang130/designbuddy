import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.PYTHON || "python3";
const destination = root + ".cache/ffmpeg";
const installed = spawnSync(
  python,
  ["-m", "pip", "install", "--target", destination, "imageio-ffmpeg==0.6.0"],
  { cwd: root, stdio: "inherit", timeout: 180000 },
);
if (installed.status !== 0) process.exit(installed.status || 1);
const resolved = spawnSync(
  python,
  [
    "-c",
    `import sys; sys.path.insert(0, ${JSON.stringify(destination)}); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())`,
  ],
  { encoding: "utf8", timeout: 10000 },
);
if (resolved.status !== 0) {
  console.error(resolved.stderr || resolved.error);
  process.exit(1);
}
writeFileSync(root + ".cache/ffmpeg-path.txt", resolved.stdout.trim() + "\n");
console.log(
  "FFmpeg installed outside Git. Restart pnpm dev:full to enable MP4 encoding. An explicit FFMPEG_PATH takes precedence.",
);
