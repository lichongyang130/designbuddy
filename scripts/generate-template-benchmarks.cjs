#!/usr/bin/env node
// Local, authored examples. No provider calls, no customer material, no fabricated acceptance.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const { unzipSync } = require("fflate"),
  sharp = require("sharp");
const model = require("../dist/local/shared/commercialTemplates.js");
const {
  campaignSvg,
  cueWav,
  guideHtml,
  costHtml,
  configHtml,
  offlineHtml,
} = require("../dist/local/shared/commercialExports.js");
const { reviewPptx } = require("../dist/local/shared/commercialOffice.js");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "apps/web/public/template-benchmarks");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
function write(name, b) {
  const file = path.join(out, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, b);
}
function json(name, data) {
  write(name, JSON.stringify(data, null, 2) + "\n");
}
async function office() {
  const {
    renderPresentation,
  } = require("../dist/local/server/skills/pptx-render.js");
  const {
    createWord,
  } = require("../dist/local/server/skills/word-pro/pipeline.js");
  const {
    presentationFonts,
  } = require("../dist/local/server/skills/presentation/fonts.js");
  const pptx = await reviewPptx();
  write("pro-review/original.pptx", pptx);
  const render = await renderPresentation(
    pptx,
    model.reviewPages.length,
    console.log,
    { fontDirectory: presentationFonts().directory, pdf: true },
  );
  const pdf = render.outputs.find((o) => o.name.endsWith(".pdf"));
  if (!pdf) throw Error("PPT PDF missing");
  write("pro-review/original.pdf", pdf.bytes);
  const previews = render.outputs.find((o) => o.name === "rendered-slides.zip");
  if (!previews) throw Error("slide preview zip missing");
  const images = unzipSync(previews.bytes);
  let slide = 0;
  for (const [name, b] of Object.entries(images).sort()) {
    if (name.endsWith(".jpg"))
      write(`pro-review/pages/${String(++slide).padStart(2, "0")}.jpg`, b);
  }
  if (slide !== 10) throw Error("PPT preview count mismatch: " + slide);
  json("pro-review/original-metadata.json", {
    pageCount: slide,
    pptxSHA256: sha(pptx),
    pdfSHA256: sha(pdf.bytes),
    render: render.report,
    commercialApproval: false,
  });
  json("pro-review/content.json", {
    pages: model.reviewPages,
    metrics: model.reviewMetrics,
    origin: "authored synthetic fixture; not actual business results",
  });
  const input = Buffer.from(JSON.stringify(model.projectSpec()));
  const word = await createWord(
    { skillId: "document.create", filename: "project.json", bytes: input },
    console.log,
  );
  const files = unzipSync(
    word.outputs.find((o) => o.name === "word-delivery.zip").bytes,
  );
  for (const [name, b] of Object.entries(files)) {
    if (name === "document.docx") write("pro-project/original.docx", b);
    if (name === "document.pdf") write("pro-project/original.pdf", b);
    if (
      name.startsWith("pages/") ||
      [
        "word-quality-report.json",
        "content-manifest.json",
        "render-manifest.json",
        "word-spec.json",
      ].includes(name)
    )
      write("pro-project/" + name, b);
  }
  const q = JSON.parse(
    Buffer.from(files["word-quality-report.json"]).toString(),
  );
  if (q.issues.some((x) => x.severity === "critical"))
    throw Error("Word critical issues: " + JSON.stringify(q.issues));
  json("pro-project/original-metadata.json", {
    pageCount: q.renderer.pageCount,
    docxSHA256: q.finalDocxSHA256,
    pdfSHA256: q.finalPdfSHA256,
    releaseStatus: q.releaseStatus,
    commercialApproval: false,
  });
  write(
    "OFL.txt",
    require("../dist/local/shared/commercialFontLicense.js")
      .benchmarkFontLicense,
  );
}
async function film() {
  const work = path.join(root, ".cache/template-film");
  fs.mkdirSync(work, { recursive: true });
  const headings = [
    "ROOM TO THINK",
    "FORM FOLLOWS USE",
    "A CLOSER LOOK",
    "A QUIETER MOMENT",
    "MAKE IT YOURS",
  ];
  for (let i = 0; i < 5; i++) {
    const b = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="${i % 2 ? "#203d38" : "#e5e5d8"}"/><g fill="${i % 2 ? "#b4c7b3" : "#527565"}"><ellipse cx="680" cy="220" rx="160" ry="48"/><path d="M550 225v175h18V230M800 225v175h18V225"/></g><circle cx="680" cy="260" r="180" fill="none" stroke="#8da38e" opacity=".4"/><g fill="${i % 2 ? "#edf0e1" : "#203d38"}" font-family="sans-serif"><text x="60" y="75" font-size="13" letter-spacing="4">OBJECT / FORM AND FUNCTION</text><text x="60" y="165" font-size="30" font-weight="bold">${headings[i]}</text><text x="60" y="460" font-size="15">0${i + 1} / 05  ·  ORIGINAL PROCEDURAL PRODUCT STUDY</text><text x="60" y="495" font-size="11">Fictional product / visual demonstration / no music</text></g></svg>`,
    );
    const png = await sharp(b).png().toBuffer();
    fs.writeFileSync(
      path.join(work, String(i + 1).padStart(2, "0") + ".png"),
      png,
    );
    if (i === 0)
      write(
        "pro-film/poster.jpg",
        await sharp(png).jpeg({ quality: 85 }).toBuffer(),
      );
  }
  const ffmpeg =
    process.env.FFMPEG_PATH ||
    (fs.existsSync(path.join(root, ".cache/ffmpeg-path.txt"))
      ? fs
          .readFileSync(path.join(root, ".cache/ffmpeg-path.txt"), "utf8")
          .trim()
      : "ffmpeg");
  const output = path.join(out, "pro-film/original.mp4");
  const r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-framerate",
      "1/4",
      "-i",
      path.join(work, "%02d.png"),
      "-vf",
      "zoompan=z='min(zoom+0.0004,1.04)':d=100:s=960x540:fps=25",
      "-t",
      "20",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      output,
    ],
    { encoding: "utf8", timeout: 90000 },
  );
  if (r.status !== 0)
    throw Error("Video encoding failed: " + r.stderr?.slice(-1500));
  write(
    "pro-film/captions.vtt",
    "WEBVTT\n\n" +
      model.filmPages
        .map(
          (p, i) =>
            `${i + 1}\n00:${String(Math.floor((i * 4) / 60)).padStart(2, "0")}:${String((i * 4) % 60).padStart(2, "0")}.000 --> 00:00:${String((i + 1) * 4).padStart(2, "0")}.000\n${p.points[1].replace("字幕：", "")}\n`,
        )
        .join("\n"),
  );
  json("pro-film/storyboard.json", {
    duration: 20,
    fps: 25,
    audio: false,
    source: "original procedural SVG scenes; not photography",
    scenes: model.filmPages,
  });
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  await office();
  await film();
  const fontDataUrl =
    "data:font/woff2;base64," +
    fs
      .readFileSync(
        path.join(
          root,
          "apps/web/src/assets/fonts/noto-sans-sc-chinese-simplified-400-normal.woff2",
        ),
      )
      .toString("base64");
  const s = model.initialBenchmark("pro-launch");
  for (let i = 0; i < 6; i++) {
    write(`pro-launch/orbit-${i + 1}.svg`, campaignSvg(s, i));
  }
  for (let i = 0; i < 5; i++) write(`pro-cues/signal-${i + 1}.wav`, cueWav(i));
  write(
    "pro-tour/guide.html",
    offlineHtml(guideHtml(model.initialBenchmark("pro-tour")), fontDataUrl),
  );
  write(
    "pro-cost/estimate.html",
    offlineHtml(costHtml(model.initialBenchmark("pro-cost")), fontDataUrl),
  );
  write(
    "pro-config/configurator.html",
    offlineHtml(configHtml(model.initialBenchmark("pro-config")), fontDataUrl),
  );
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!["assets-manifest.json", "readiness.json"].includes(e.name)) {
        const bytes = fs.readFileSync(p);
        files.push({
          file: path.relative(out, p).replaceAll("\\", "/"),
          bytes: bytes.length,
          sha256: sha(bytes),
        });
      }
    }
  }
  walk(out);
  json("assets-manifest.json", {
    version: model.benchmarkVersion,
    generatedAt: new Date().toISOString(),
    externalCalls: false,
    commercialApproval: false,
    files,
  });
  console.log(
    "Benchmarks generated:",
    files.length,
    "files",
    files.reduce((s, f) => s + f.bytes, 0),
    "bytes",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
