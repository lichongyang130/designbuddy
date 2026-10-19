/** Authored layout fixture. Executes the actual compiler/renderer; no external model or user data. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { unzipSync } = require("fflate");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const {
  wordExample,
  wordEngineVersion,
} = require("../dist/local/shared/wordDocument.js");
const {
  createWord,
} = require("../dist/local/server/skills/word-pro/pipeline.js");
const root = path.resolve(
  __dirname,
  "../apps/web/public/word-examples/word-pro",
);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
function diagram() {
  GlobalFonts.registerFromPath(
    path.resolve(__dirname, "../assets/presentation-fonts/NotoSansSC.ttf"),
    "Noto Sans SC",
  );
  const canvas = createCanvas(1000, 280),
    c = canvas.getContext("2d");
  c.fillStyle = "#F1F4F0";
  c.fillRect(0, 0, 1000, 280);
  const labels = ["原生 DOCX", "同源 PDF / 全页图", "质量与修复记录"];
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 330;
    c.fillStyle = "#294C3B";
    c.fillRect(x, 65, 280, 145);
    c.fillStyle = "#FFFFFF";
    c.font = '26px "Noto Sans SC"';
    c.textAlign = "center";
    c.fillText(labels[i], x + 140, 146);
    if (i < 2) {
      c.strokeStyle = "#81968B";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x + 282, 138);
      c.lineTo(x + 325, 138);
      c.stroke();
    }
  }
  return canvas.toBuffer("image/png");
}
(async () => {
  fs.mkdirSync(root, { recursive: true });
  const manifests = [];
  for (const type of ["business-report", "project-plan"]) {
    const d = wordExample(type);
    if (type === "business-report") {
      const table = d.blocks.find((b) => b.type === "table");
      table.widthsMm = [90, 90, 90];
      table.repeatHeader = false;
      d.blocks[0].keepNext = false;
      const data = diagram();
      d.sources.push({
        id: "source-image",
        name: "本地脚本绘制的流程示意图",
        locator: "scripts/generate-word-pro.cjs diagram()",
        text: "图形表示本例的交付关系，不是项目进度、真实产品截图或业务证据。图中文字为图像像素，不是可逐节点编辑的流程图。",
      });
      d.blocks.splice(
        d.blocks.findIndex((b) => b.id === "recommendations"),
        0,
        {
          id: "delivery-image",
          type: "image",
          caption: "交付关系示意（图片对象，不是可逐节点编辑图形）",
          alt: "原生DOCX、同源PDF与全页图、质量与修复记录",
          base64: data.toString("base64"),
          filename: "delivery-diagram.png",
          license: "项目原创示意图，允许用于此公开案例",
          permissionConfirmed: true,
          usage: "decorative",
          refs: ["source-image"],
          widthMm: 150,
        },
      );
    }
    const dir = path.join(root, type);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ["pages", "iterations"])
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    const input = Buffer.from(JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(dir, "input.json"), input);
    const result = await createWord(
      { skillId: "document.create", filename: "word.json", bytes: input },
      console.log,
    );
    for (const o of result.outputs)
      fs.writeFileSync(path.join(dir, o.name), o.bytes);
    const zip = unzipSync(
      result.outputs.find((o) => o.name === "word-delivery.zip").bytes,
    );
    for (const [name, bytes] of Object.entries(zip)) {
      const p = path.join(dir, name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, bytes);
    }
    const q = JSON.parse(
      fs.readFileSync(path.join(dir, "word-quality-report.json")),
    );
    const files = [];
    function walk(p) {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(p, e.name));
        else if (e.name !== "manifest.json") {
          const b = fs.readFileSync(path.join(p, e.name));
          files.push({
            file: path
              .relative(dir, path.join(p, e.name))
              .replaceAll("\\", "/"),
            bytes: b.length,
            sha256: sha(b),
          });
        }
      }
    }
    walk(dir);
    const manifest = {
      schemaVersion: 1,
      type,
      title: d.title,
      engineVersion: wordEngineVersion,
      inputSHA256: sha(input),
      pageCount: q.renderer.pageCount,
      repairRounds: q.repairRounds.length - 1,
      criticalIssues: q.issues.filter((i) => i.severity === "critical").length,
      releaseStatus: q.releaseStatus,
      commercialApproval: false,
      planningOrigin:
        "assistant-authored original methodology fixture; not AI quality acceptance or real business evidence",
      files,
    };
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    manifests.push(manifest);
  }
  fs.writeFileSync(
    path.join(root, "index.json"),
    JSON.stringify(
      manifests.map(({ files, ...m }) => m),
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(root, "README.md"),
    "# Word Pro actual exports\n\nOriginal assistant-authored methodology examples; not business data or autonomous AI quality acceptance. Business report input contains deliberately oversized columns and disabled protection/header settings to exercise bounded repair. Project plan uses different required sections.\n\nEach folder contains actual native DOCX, PDF rendered from that same DOCX, all page JPEGs, source/content inventory, quality and per-round records. The ZIP includes pre/post DOCX/PDF and renderer hashes in iterations/. Two repair rounds maximum, no body/data deletion. Chapter navigation has no TOC page numbers. Word/WPS compatibility and visual/semantic review remain required. No external provider calls. Font: Noto Sans SC; OFL included. DOCX does not embed fonts.\n",
  );
  console.log(
    "Word Pro actual cases complete:",
    manifests.map((m) => ({
      type: m.type,
      pages: m.pageCount,
      repairs: m.repairRounds,
      critical: m.criticalIssues,
    })),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
