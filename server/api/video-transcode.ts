import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

let active = 0;
let probe: { binary: string; ok: boolean } | undefined;
export function ffmpegAvailable() {
  const binary = process.env.FFMPEG_PATH || "ffmpeg";
  if (probe?.binary !== binary)
    probe = {
      binary,
      ok:
        spawnSync(binary, ["-version"], { stdio: "ignore", timeout: 3000 })
          .status === 0,
    };
  return probe.ok;
}
export async function transcodeWebMToMp4(
  input: Uint8Array,
): Promise<Uint8Array> {
  if (active >= 2) throw Error("转码任务繁忙，请稍后重试。");
  active++;
  try {
    return await transcode(input);
  } finally {
    active--;
  }
}
async function transcode(input: Uint8Array): Promise<Uint8Array> {
  if (input.byteLength < 16 || input.byteLength > 100 * 1024 * 1024)
    throw new Error("Video must be between 16 bytes and 100 MB.");
  if (
    input[0] !== 0x1a ||
    input[1] !== 0x45 ||
    input[2] !== 0xdf ||
    input[3] !== 0xa3
  )
    throw new Error("A valid WebM/Matroska header is required.");
  const directory = await mkdtemp(join(tmpdir(), "designbuddy-video-"));
  const source = join(directory, "input.webm");
  const target = join(directory, "output.mp4");
  try {
    await writeFile(source, input);
    await new Promise<void>((resolve, reject) => {
      const binary = process.env.FFMPEG_PATH || "ffmpeg";
      const child = spawn(
        binary,
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-protocol_whitelist",
          "file,pipe",
          "-f",
          "matroska",
          "-threads",
          "2",
          "-i",
          source,
          "-an",
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          target,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let errorOutput = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Video transcode timed out after 90 seconds."));
      }, 90_000);
      child.stderr.on("data", (chunk: Buffer) => {
        errorOutput = (errorOutput + chunk.toString()).slice(-3000);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(
          new Error(
            "code" in error && error.code === "ENOENT"
              ? "FFmpeg is not installed or FFMPEG_PATH is invalid."
              : error.message,
          ),
        );
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `FFmpeg failed (${code}): ${errorOutput.trim().slice(-1200) || "unknown error"}`,
            ),
          );
      });
    });
    return new Uint8Array(await readFile(target));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
