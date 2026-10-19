#!/usr/bin/env node
/** M2: same historical factual content, three real compositions. No live text-planning calls. */
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
  dest = path.join(
    root,
    "apps/web/public/presentation-examples/visual-directions",
  ),
  mod = path.join(root, "dist/local/server/skills");
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  mod + "/presentation/sources.js",
);
const { publicPresentationSources } = require(mod + "/presentation/assets.js");
const { planPresentationVisuals, visualPalettes } = require(
  mod + "/presentation/visuals.js",
);
const { presentationVisualStyles, presentationVisualEngineVersion } = require(
  path.join(root, "dist/local/shared/presentationDesign.js"),
);
const { buildStructuredPresentation } = require(mod + "/pptx-deck.js");
const { renderPresentation } = require(mod + "/pptx-render.js");
const { presentationFonts } = require(mod + "/presentation/fonts.js");
const { presentationQuality } = require(mod + "/presentation/quality.js");
const J = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const contentHash = (s) =>
  sha256(JSON.stringify(s.slides.map((p) => p.content)));
async function main() {
  process.chdir(root);
  fs.mkdirSync(dest, { recursive: true });
  const previous = JSON.parse(
      fs.readFileSync(path.join(base, "adaptive/presentation-spec.json")),
    ),
    oldReport = JSON.parse(fs.readFileSync(path.join(base, "report.json")));
  const frozen = Object.fromEntries(
    [
      "leader-decision.pptx",
      "leader-decision.pdf",
      "report.json",
      "adaptive/leader-decision.pptx",
      "adaptive/leader-decision.pdf",
      "report-v2.json",
    ].map((n) => [n, sha256(fs.readFileSync(path.join(base, n)))]),
  );
  const mark = createCanvas(440, 104),
    mc = mark.getContext("2d");
  mc.fillStyle = "#FFFFFF";
  mc.fillRect(0, 0, 440, 104);
  mc.fillStyle = "#244C42";
  mc.font = "bold 42px sans-serif";
  mc.fillText("DB / CONCEPT", 22, 68);
  const common = [
    {
      id: "asset-concept",
      name: "concept-hero.jpg",
      role: "illustration",
      usage: "decorative",
      alt: "AI生成概念雕塑 · 非产品、非业务证据",
      source: "本次会话通过Arena图像工具实际生成；不是应用自动生图",
      license: "本项目概念展示；AI生成不等于独立版权核验",
      permissionConfirmed: true,
      base64: fs
        .readFileSync(
          path.join(root, "assets/presentation-visuals/concept-hero.jpg"),
        )
        .toString("base64"),
    },
    {
      id: "asset-screenshot",
      name: "historical-v2-page04.jpg",
      role: "screenshot",
      usage: "evidence",
      alt: "历史V2第04页完整截图，仅示范原生稿与栅格的区别",
      source:
        "冻结的leader-decision/adaptive/slides/04.jpg；由历史PPTX真实渲染",
      license: "本项目内置历史案例；完整显示；不扩张为当前代码审计",
      permissionConfirmed: true,
      base64: fs
        .readFileSync(path.join(base, "adaptive/slides/04.jpg"))
        .toString("base64"),
    },
    {
      id: "asset-mark",
      name: "concept-mark.png",
      role: "logo",
      usage: "decorative",
      alt: "DB / CONCEPT · 脚本绘制的示例标识，非第三方Logo",
      source: "本脚本本地Canvas绘制；非外部品牌素材",
      license: "本项目示例演示；不宣称第三方品牌授权",
      permissionConfirmed: true,
      base64: mark.toBuffer("image/png").toString("base64"),
    },
  ];
  const all = [];
  for (const direction of presentationVisualStyles) {
    console.log("ART DIRECTION", direction.id);
    const request = JSON.parse(
      fs.readFileSync(path.join(base, "input-request.json")),
    );
    request.brief = {
      ...request.brief,
      layoutStyle: "adaptive",
      visualStyle: direction.id,
      logoAssetId: "asset-mark",
    };
    request.assets = common;
    const input = J(request),
      parsed = parsePresentationRequest(input),
      inputHash = sha256(input),
      sources = await readPresentationSources(parsed, inputHash),
      spec = structuredClone(previous.spec);
    spec.slides[1].design = {
      ...spec.slides[1].design,
      layout: "visual-story",
      visual: { assetId: "asset-concept", fit: "cover" },
    };
    spec.slides[10].design = {
      ...spec.slides[10].design,
      layout: "screenshot-evidence",
      visual: { assetId: "asset-screenshot", fit: "contain" },
    };
    spec.slides[10].sourceRefs.push("asset-screenshot");
    assert.equal(contentHash(spec), contentHash(previous.spec));
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(
        spec.slides[i].bindings,
        previous.spec.slides[i].bindings,
      );
      assert.deepEqual(
        spec.slides[i].sourceRefs.filter((r) => !r.startsWith("asset-")),
        previous.spec.slides[i].sourceRefs,
      );
    }
    const visualPlan = planPresentationVisuals(spec, parsed.brief, sources),
      built = await buildStructuredPresentation(
        J({
          title: spec.title,
          theme: {
            ...spec.theme,
            ...visualPalettes[direction.id],
            headingFont: "Noto Sans SC",
            bodyFont: "Noto Sans SC",
          },
          slides: spec.slides.map((s) => s.content),
        }),
        {
          strictLayout: true,
          contentOrigin: "ai-planned",
          adaptiveDesigns: visualPlan.designs,
          visual: {
            style: direction.id,
            assets: sources.assets,
            logoAssetId: "asset-mark",
          },
        },
      );
    const fonts = presentationFonts(),
      rendered = await renderPresentation(built.pptxBytes, 12, console.log, {
        fontDirectory: fonts.directory,
        pdf: true,
      }),
      quality = presentationQuality(
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
        inputHash,
        spec,
        visualEngine: presentationVisualEngineVersion,
      }),
    );
    const files = { "presentation.pptx": built.pptxBytes };
    for (const o of rendered.outputs)
      if (o.name !== "slide-01-preview.jpg")
        files[
          o.name === "draft-presentation.pdf" ? "presentation.pdf" : o.name
        ] = o.bytes;
    for (const [n, b] of Object.entries(
      unzipSync(files["rendered-slides.zip"]),
    ))
      if (/^slides\/\d{2}\.jpg$/.test(n)) files[n] = b;
    for (const a of sources.assets)
      files[`assets/${a.id}.png`] = Buffer.from(a.data, "base64");
    files["report.json"] = J({
      schemaVersion: 1,
      versionId,
      inputHash,
      style: direction.id,
      label: direction.label,
      composition: direction.composition,
      baselineVersionId: previous.versionId,
      semanticContentHash: contentHash(spec),
      sameBodyDataNotes: true,
      externalTextPlanningCalls: 0,
      automaticAppImageCalls: 0,
      assetOrigin:
        "Arena generated concept once; historical full-slide raster; locally drawn demonstration mark",
      sourceSnapshotNotice:
        "本案例沿用历史源码/测试材料；只比较视觉，不是本次代码审计、真实模型质量或商业验收。",
      qualitySummary: {
        releaseStatus: quality.releaseStatus,
        criticalIssues: 0,
        commercialApproval: false,
      },
      pages: oldReport.pages.map((p, i) => ({
        ...p,
        content: spec.slides[i].content,
        design: visualPlan.designs[i],
        preview: `slides/${String(i + 1).padStart(2, "0")}.jpg`,
      })),
      sourceCatalog: oldReport.sourceCatalog,
      missingInformation: oldReport.missingInformation,
    });
    files["visual-plan.json"] = J({
      schemaVersion: 1,
      versionId,
      ...visualPlan,
      imageUnderstanding: "not performed; no OCR; metadata only",
      rights: "user/project declaration, not independently verified",
    });
    files["presentation-spec.json"] = J({
      versionId,
      brief: parsed.brief,
      spec,
      planningOrigin:
        "original assistant-authored body, deterministic M2 visual rules; not live provider acceptance",
    });
    files["sources-and-notes.json"] = J({
      ...publicPresentationSources(sources),
      slides: spec.slides,
      sourceCatalog: oldReport.sourceCatalog,
    });
    files["quality-report.json"] = J({
      ...quality,
      versionId,
      pptxSHA256: sha256(built.pptxBytes),
    });
    files["resolved-layout.json"] = J({
      ...built.adaptiveLayout,
      objects: built.resolvedObjects,
      textElements: built.layout,
    });
    files["font-OFL.txt"] = fs.readFileSync(
      path.join(fonts.directory, "OFL.txt"),
    );
    files["README.md"] = Buffer.from(
      `# ${direction.label} · M2视觉对照\n\n12页，15分钟。原稿正文、数据、图表/表格绑定、讲稿与事实来源不变；第11页新增历史完整截图文件定位。新增图注、示例标识和素材归属属于视觉说明，不构成新业务事实。\n\n${direction.composition}。资产均真实可解析，不使用远程抓图或占位图。概念雕塑由本次会话工具生成，不是应用自动生图；历史V2第04页截图完整显示，没有OCR；示例Logo由脚本绘制。视觉策划为元数据驱动规则，不声称具备看图理解。\n\n文字、图表、表格、图注和讲稿为原生可编辑对象；图片是可替换PNG，不是可编辑矢量。PPTX未嵌入字体，接收端需安装Noto Sans SC。\n\n未进行真实后台模型验收或目标Office人工编辑验收；商业状态仍为待人工复核。原历史源码快照不可当作当前代码审计。\n\n请复核材料使用权限、截图清晰度、事实含义、模型留存、责任人与资源上限。\n`,
    );
    const cover = await loadImage(files["slides/01.jpg"]),
      cv = createCanvas(480, 270);
    cv.getContext("2d").drawImage(cover, 0, 0, 480, 270);
    files["cover.jpg"] = cv.toBuffer("image/jpeg", 85);
    files["manifest.json"] = J({
      versionId,
      pages: 12,
      style: direction.id,
      files: Object.entries(files).map(([name, b]) => ({
        name,
        bytes: b.length,
        sha256: sha256(b),
      })),
    });
    const dir = path.join(dest, direction.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const [n, b] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true });
      fs.writeFileSync(path.join(dir, n), b);
    }
    fs.writeFileSync(
      path.join(dir, "presentation-package.zip"),
      zipSync(
        Object.fromEntries(
          Object.entries(files).map(([n, b]) => [n, new Uint8Array(b)]),
        ),
        { level: 6 },
      ),
    );
    all.push({
      id: direction.id,
      label: direction.label,
      composition: direction.composition,
      versionId,
      cover: `${direction.id}/cover.jpg`,
      report: `${direction.id}/report.json`,
      criticalIssues: 0,
      pages: 12,
      semanticContentHash: contentHash(spec),
    });
  }
  for (const [n, h] of Object.entries(frozen))
    assert.equal(sha256(fs.readFileSync(path.join(base, n))), h, `frozen ${n}`);
  fs.writeFileSync(
    path.join(dest, "index.json"),
    J({
      schemaVersion: 1,
      baselineVersionId: previous.versionId,
      styles: all,
      bodyDataNotesUnchanged: true,
      commercialApproval: false,
      externalTextPlanningCalls: 0,
    }),
  );
  console.log("Visual gallery generated; V1/V2 frozen hashes unchanged.");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
