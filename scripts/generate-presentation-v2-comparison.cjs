#!/usr/bin/env node
/** Same historical case CONTENT, new deterministic layout. NOT a live-model benchmark. Leaves V1 untouched. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { zipSync, unzipSync } = require("fflate");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const root = path.resolve(__dirname, ".."),
  base = path.join(
    root,
    "apps/web/public/presentation-examples/leader-decision",
  ),
  dir = path.join(base, "adaptive");
const mod = path.join(root, "dist/local/server/skills");
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  mod + "/presentation/sources.js",
);
const { buildStructuredPresentation } = require(mod + "/pptx-deck.js");
const { renderPresentation } = require(mod + "/pptx-render.js");
const { presentationFonts } = require(mod + "/presentation/fonts.js");
const { presentationQuality } = require(mod + "/presentation/quality.js");
const { reviewPresentationPlan } = require(
  mod + "/presentation/planning-review.js",
);
const { presentationLayoutEngineVersion } = require(
  path.join(root, "dist/local/shared/presentationDesign.js"),
);
const J = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
async function main() {
  process.chdir(root);
  const oldReport = JSON.parse(fs.readFileSync(path.join(base, "report.json"))),
    oldMeta = JSON.parse(
      fs.readFileSync(path.join(base, "presentation-spec.json")),
    );
  const originals = Object.fromEntries(
    [
      "leader-decision.pptx",
      "leader-decision.pdf",
      "report.json",
      "manifest.json",
    ].map((n) => [n, sha256(fs.readFileSync(path.join(base, n)))]),
  );
  const request = JSON.parse(
    fs.readFileSync(path.join(base, "input-request.json")),
  );
  request.brief.layoutStyle = "adaptive";
  const input = Buffer.from(JSON.stringify(request));
  parsePresentationRequest(input);
  const inputHash = sha256(input),
    sources = await readPresentationSources(request, inputHash);
  const names = [
    "editorial-cover",
    "executive-summary",
    "kpi-insight",
    "capability-boundary",
    "chart-takeaway",
    "decision-matrix",
    "executive-summary",
    "adaptive-table",
    "risk-response",
    "stage-gates",
    "executive-summary",
    "action-agenda",
  ];
  const natures = { 事实: "fact", 分析: "analysis", 建议: "recommendation" };
  const spec = JSON.parse(JSON.stringify(oldMeta.spec));
  spec.schemaVersion = 2;
  spec.slides.forEach(
    (s, i) =>
      (s.design = {
        layout: names[i],
        nature: natures[oldReport.pages[i].classification],
        ...(i === 5 ? { emphasisRows: [1] } : {}),
      }),
  );
  const contentHash = (s) =>
    sha256(JSON.stringify(s.slides.map((p) => p.content)));
  assert.equal(contentHash(spec), contentHash(oldMeta.spec));
  const built = await buildStructuredPresentation(
    Buffer.from(
      JSON.stringify({
        title: spec.title,
        theme: {
          ...spec.theme,
          headingFont: "Noto Sans SC",
          bodyFont: "Noto Sans SC",
        },
        slides: spec.slides.map((s) => s.content),
      }),
    ),
    {
      strictLayout: true,
      contentOrigin: "ai-planned",
      adaptiveDesigns: spec.slides.map((s) => s.design),
    },
  );
  const fonts = presentationFonts(),
    rendered = await renderPresentation(built.pptxBytes, 12, console.log, {
      fontDirectory: fonts.directory,
      pdf: true,
    });
  const quality = presentationQuality(
    spec,
    sources,
    built.layout,
    { report: rendered.report },
    rendered.report.pdf,
    built.resolvedObjects,
  );
  if (quality.releaseStatus === "blocked")
    throw Error(
      JSON.stringify(
        quality.issues.filter((i) => i.severity === "critical"),
        null,
        2,
      ),
    );
  const versionId = sha256(
    JSON.stringify({
      spec,
      inputHash,
      engine: presentationLayoutEngineVersion,
    }),
  );
  const files = { "leader-decision.pptx": built.pptxBytes };
  for (const o of rendered.outputs)
    if (o.name !== "slide-01-preview.jpg")
      files[
        o.name === "draft-presentation.pdf" ? "leader-decision.pdf" : o.name
      ] = o.bytes;
  for (const [n, b] of Object.entries(unzipSync(files["rendered-slides.zip"])))
    if (/^slides\/\d{2}\.jpg$/.test(n)) files[n] = b;
  const report = {
    ...oldReport,
    versionId,
    inputHash,
    layoutVersion: "adaptive-v2",
    layoutEngine: presentationLayoutEngineVersion,
    sourceSnapshotNotice:
      "沿用原案例的源码/历史测试证据快照；本次只作同内容排版对照，不重新认证旧测试或声称当前代码未变化。",
    baselineVersionId: oldReport.versionId,
    semanticContentHash: contentHash(spec),
    externalProviderCalls: 0,
    planningOrigin:
      "original assistant-authored content; deterministic adaptive layout comparison, NOT live provider planning",
    qualitySummary: {
      releaseStatus: quality.releaseStatus,
      commercialApproval: false,
      criticalIssues: quality.issues.filter((i) => i.severity === "critical")
        .length,
    },
    pages: oldReport.pages.map((p, i) => ({
      ...p,
      content: spec.slides[i].content,
      design: spec.slides[i].design,
      preview: `adaptive/slides/${String(i + 1).padStart(2, "0")}.jpg`,
    })),
  };
  files["report.json"] = J(report);
  files["quality-report.json"] = J({
    ...quality,
    versionId,
    pptxSHA256: sha256(built.pptxBytes),
    externalProviderCalls: 0,
  });
  files["presentation-spec.json"] = J({
    versionId,
    inputHash,
    brief: request.brief,
    spec,
    planningOrigin: report.planningOrigin,
    planningReview: reviewPresentationPlan(spec, sources),
    externalProviderCalls: 0,
  });
  files["sources-and-notes.json"] = J({
    ...sources,
    slides: spec.slides,
    sourceCatalog: oldReport.sourceCatalog,
    snapshotNotice: report.sourceSnapshotNotice,
  });
  files["resolved-layout.json"] = J({
    ...built.adaptiveLayout,
    textElements: built.layout,
    objects: built.resolvedObjects,
  });
  files["input-request.json"] = input;
  files["comparison.json"] = J({
    schemaVersion: 1,
    baselineVersionId: oldReport.versionId,
    versionId,
    sameContent: true,
    sameSources: true,
    samePageCount: true,
    semanticContentHash: contentHash(spec),
    changes: [
      "字号层次、网格与留白",
      "图表与结论分栏",
      "原生表格列宽/行高自适应",
      "明确推荐行的视觉强调",
      "原生全对象外框检查",
    ],
    notChanged: [
      "原文稿正文与讲稿",
      "数值、来源和绑定",
      "页序与页数",
      "事实/分析/建议性质",
    ],
    externalProviderCalls: 0,
    realModelAcceptance:
      "not-run: deterministic layout comparison is not live-model acceptance; use the explicit benchmark runner",
    commercialApproval: false,
  });
  const image = await loadImage(files["slides/01.jpg"]),
    c = createCanvas(480, 270);
  c.getContext("2d").drawImage(image, 0, 0, 480, 270);
  files["cover.jpg"] = c.toBuffer("image/jpeg", 85);
  files["font-OFL.txt"] = fs.readFileSync(
    path.join(fonts.directory, "OFL.txt"),
  );
  files["README.md"] = Buffer.from(
    "# 同内容排版对照：自适应商务 V2\n\n12页，正文、讲稿、源数据与原案例保持一致。布局由项目确定性V2引擎生成；未调用外部规划模型。\n\n原案例是此前助手编排的历史源码证据汇报，不因重排而自动变成当前版本代码的审计结论。见comparison.json和sourceSnapshotNotice。\n\n包含原生PPTX、同文件PDF、全页图、文稿、绑定、来源/讲稿、对象外框、质量和哈希清单。文字、表格和图表原生可编辑；字体未嵌入。\n\n实际Office编辑、语义事实、图表内部标签与视觉效果仍需人工复核。commercialApproval=false。\n\n所有布局失败会提示明确调整或拆页；不自动增页、缩字、删事实或隐藏数据。\n\n真实模型验收使用scripts/benchmark-presentation-planning.cjs，须配置服务端通道并明确授权选定正文；默认不运行、不发布真实材料。\n",
  );
  files["manifest.json"] = J({
    versionId,
    baselineVersionId: oldReport.versionId,
    pages: 12,
    sameContent: true,
    externalProviderCalls: 0,
    commercialApproval: false,
    files: Object.entries(files).map(([name, b]) => ({
      name,
      bytes: b.length,
      sha256: sha256(b),
    })),
  });
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, b] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true });
    fs.writeFileSync(path.join(dir, n), b);
  }
  fs.writeFileSync(
    path.join(dir, "leader-decision-package.zip"),
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([n, b]) => [n, new Uint8Array(b)]),
      ),
      { level: 6 },
    ),
  );
  fs.writeFileSync(path.join(base, "report-v2.json"), J(report));
  for (const [n, hash] of Object.entries(originals))
    assert.equal(
      sha256(fs.readFileSync(path.join(base, n))),
      hash,
      `V1 must not change: ${n}`,
    );
  console.log(
    JSON.stringify(
      {
        versionId,
        pages: 12,
        sameContent: true,
        critical: 0,
        releaseStatus: quality.releaseStatus,
        externalProviderCalls: 0,
        baselineUnmodified: true,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
