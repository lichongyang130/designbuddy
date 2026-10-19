#!/usr/bin/env node
/** Same historical material, content-first explanation. The fixture director is authored, NOT a live-model benchmark. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { zipSync, unzipSync } = require("fflate"),
  { createCanvas, loadImage } = require("@napi-rs/canvas");
const root = path.resolve(__dirname, ".."),
  publicBase = path.join(root, "apps/web/public/presentation-examples"),
  legacy = path.join(publicBase, "leader-decision"),
  dest = path.join(publicBase, "content-director"),
  mod = path.join(root, "dist/local/server/skills");
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  mod + "/presentation/sources.js",
);
const { compileContentDirection, resolveContentDirection } = require(
  mod + "/presentation/direction.js",
);
const { planPresentationVisuals, visualPalettes } = require(
  mod + "/presentation/visuals.js",
);
const { publicPresentationSources } = require(mod + "/presentation/assets.js");
const { buildStructuredPresentation } = require(mod + "/pptx-deck.js");
const { renderPresentation } = require(mod + "/pptx-render.js");
const { presentationQuality } = require(mod + "/presentation/quality.js");
const { presentationFonts } = require(mod + "/presentation/fonts.js");
const J = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
async function main() {
  process.chdir(root);
  const frozenPaths = [
      "leader-decision/manifest.json",
      "leader-decision/leader-decision.pptx",
      "leader-decision/adaptive/leader-decision.pptx",
      "leader-decision/adaptive/leader-decision.pdf",
      "visual-directions/consulting/manifest.json",
      "visual-directions/consulting/presentation.pptx",
      "visual-directions/consulting/presentation.pdf",
    ],
    frozen = Object.fromEntries(
      frozenPaths.map((p) => [
        p,
        sha256(fs.readFileSync(path.join(publicBase, p))),
      ]),
    );
  const old = JSON.parse(
      fs.readFileSync(path.join(legacy, "adaptive/presentation-spec.json")),
    ),
    history = JSON.parse(fs.readFileSync(path.join(legacy, "report.json"))),
    baseline = JSON.parse(
      fs.readFileSync(
        path.join(publicBase, "visual-directions/consulting/report.json"),
      ),
    ),
    request = JSON.parse(
      fs.readFileSync(path.join(legacy, "input-request.json")),
    );
  request.brief = {
    ...request.brief,
    layoutStyle: "adaptive",
    visualStyle: "consulting",
    narrativeMode: "directed",
  };
  request.assets = [
    {
      id: "asset-concept",
      name: "concept-hero.jpg",
      role: "illustration",
      usage: "decorative",
      alt: "AI生成概念装饰；不是业务事实或真实产品",
      source: "此前本会话Arena工具真实生成；沿用M2素材，不是应用自动生图",
      license: "本项目概念展示，非独立版权认证",
      permissionConfirmed: true,
      base64: fs
        .readFileSync(
          path.join(root, "assets/presentation-visuals/concept-hero.jpg"),
        )
        .toString("base64"),
    },
  ];
  const input = J(request),
    parsed = parsePresentationRequest(input),
    inputHash = sha256(input),
    sources = await readPresentationSources(parsed, inputHash),
    spec = structuredClone(old.spec);
  const jobs = [
    [
      "opening",
      "focus",
      "statement",
      "先给建议和批准边界，不把试点建议排成批准事实。",
      "小范围试点建议，不代表已批准或商业就绪。",
    ],
    [
      "decision",
      "focus",
      "statement",
      "把本次请求置于主视觉，保留其余三项支撑与停止条件。",
      "责任、资源、范围均待确认，不能承诺启动。",
    ],
    [
      "evidence",
      "verify",
      "data",
      "使用原生指标呈现历史工程证据，不推导商业质量。",
      "沿用历史测试范围和计数，不是当前版本重新审计。",
    ],
    [
      "evidence",
      "explain",
      "contrast",
      "将可交付内容与不能承诺的效果并列对照。",
      "功能存在不等于商业成稿、图内理解或目标Office验收。",
    ],
    [
      "evidence",
      "verify",
      "data",
      "保留原生图表与完整绑定，明确仍有失败。",
      "历史不同范围结果，不作全仓通过、失败原因或试点收益推断。",
    ],
    [
      "options",
      "explain",
      "contrast",
      "用原生方案矩阵呈现选择，不新增评分或财务测算。",
      "推荐为定性建议，不是批准决定或量化回报。",
    ],
    [
      "explanation",
      "explain",
      "parallel",
      "四项试点价值是并列论据，用原生分支结构而非无依据的因果箭头。",
      "并列归纳，不表示先后、从属关系或节省承诺。",
    ],
    [
      "conditions",
      "verify",
      "data",
      "保留完整成本字段、记录口径和责任人待确认项。",
      "未测算预算、人员或资源上限，不写估算值。",
    ],
    [
      "conditions",
      "verify",
      "criteria",
      "使用风险、触发条件、处置动作的完整原生表格。",
      "风险建议不是已发生损失或概率预测。",
    ],
    [
      "explanation",
      "explain",
      "sequence",
      "原稿明确提出按关卡推进，用原生节点与连接箭头表达建议顺序。",
      "流程尚待授权和评估，不代表完成、批准、实际排期或因果。",
    ],
    [
      "conditions",
      "verify",
      "criteria",
      "把原有四项扩围条件做成待核对条件卡，空框不表示达标。",
      "条件未被认证满足；导出成功不是唯一门槛。",
    ],
    [
      "decision",
      "focus",
      "criteria",
      "以原有四项决策问题收束，保留待指定和待确认状态。",
      "批准范围、负责人、资料政策与资源上限仍需用户确认。",
    ],
  ];
  const direction = compileContentDirection(
    {
      schemaVersion: 1,
      decision:
        "请项目决策领导判断是否有条件批准小范围试点，并确认范围、责任、资源与退出条件。",
      argument:
        "建议结论 → 可核对的历史证据与边界 → 方案选择 → 并列价值 → 成本风险 → 建议关卡 → 扩围条件与决策请求。",
      pages: jobs.map(([role, pace, expression, reason, boundary], i) => ({
        role,
        pace,
        expression,
        reason,
        boundary,
        message: spec.slides[i].content.title,
        evidenceRefs: spec.slides[i].sourceRefs,
        ...(i === 1 ? { focusIndex: 0 } : {}),
        ...(i === 9 ? { sequence: { basis: "proposal" } } : {}),
      })),
    },
    parsed.brief,
    sources,
  );
  spec.direction = direction;
  const plan = resolveContentDirection(spec, sources),
    visualSpec = {
      ...spec,
      slides: spec.slides.map((s, i) => ({ ...s, design: plan.designs[i] })),
    },
    visual = planPresentationVisuals(visualSpec, parsed.brief, sources);
  const lockedHash = sha256(
    JSON.stringify(
      old.spec.slides.map((s) => ({
        content: s.content,
        bindings: s.bindings,
        sourceRefs: s.sourceRefs,
      })),
    ),
  );
  assert.equal(plan.bodyDataNotesHash, lockedHash);
  const built = await buildStructuredPresentation(
    J({
      title: spec.title,
      theme: {
        ...spec.theme,
        ...visualPalettes.consulting,
        headingFont: "Noto Sans SC",
        bodyFont: "Noto Sans SC",
      },
      slides: spec.slides.map((s) => s.content),
    }),
    {
      strictLayout: true,
      contentOrigin: "ai-planned",
      adaptiveDesigns: visual.designs,
      visual: { style: "consulting", assets: sources.assets },
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
  assert.equal(
    sha256(
      JSON.stringify(
        spec.slides.map((s) => ({
          content: s.content,
          bindings: s.bindings,
          sourceRefs: s.sourceRefs,
        })),
      ),
    ),
    lockedHash,
  );
  const versionId = sha256(
      JSON.stringify({ inputHash, spec, directionEngine: plan.engineVersion }),
    ),
    files = { "presentation.pptx": built.pptxBytes };
  for (const o of rendered.outputs)
    if (o.name !== "slide-01-preview.jpg")
      files[o.name === "draft-presentation.pdf" ? "presentation.pdf" : o.name] =
        o.bytes;
  for (const [n, b] of Object.entries(unzipSync(files["rendered-slides.zip"])))
    if (/^slides\/\d{2}\.jpg$/.test(n)) files[n] = b;
  files["report.json"] = J({
    schemaVersion: 1,
    versionId,
    baselineVersionId: baseline.versionId,
    title: "内容导演 · 让表达由证据决定",
    sourceSnapshotNotice:
      "沿用历史领导决策报告，仅比较内容表达；不是本次源码/历史测试的重新审计。导演任务单由助手明确编排，不冒称真实模型自主规划。",
    sourceBlocks: sources.blocks,
    sourceCatalog: history.sourceCatalog,
    missingInformation: history.missingInformation,
    qualitySummary: {
      releaseStatus: quality.releaseStatus,
      criticalIssues: 0,
      commercialApproval: false,
    },
    pages: history.pages.map((p, i) => ({
      ...p,
      sourceRefs: spec.slides[i].sourceRefs,
      historyEvidenceRefs: p.sourceRefs,
      content: spec.slides[i].content,
      design: visual.designs[i],
      preview: `slides/${String(i + 1).padStart(2, "0")}.jpg`,
    })),
  });
  files["direction-plan.json"] = J({
    schemaVersion: 1,
    versionId,
    ...plan,
    origin:
      "assistant-authored director fixture over unchanged historical content; NOT live-provider planning acceptance",
    externalProviderCalls: 0,
  });
  files["visual-plan.json"] = J({
    schemaVersion: 1,
    versionId,
    ...visual,
    automaticImageGeneration: false,
  });
  files["presentation-spec.json"] = J({
    versionId,
    brief: parsed.brief,
    spec,
    planner: { origin: "assistant-authored fixture", externalProviderCalls: 0 },
    commercialApproval: false,
  });
  files["sources-and-notes.json"] = J({
    ...publicPresentationSources(sources),
    slides: spec.slides,
  });
  files["resolved-layout.json"] = J({
    ...built.adaptiveLayout,
    objects: built.resolvedObjects,
    textElements: built.layout,
  });
  files["quality-report.json"] = J({
    ...quality,
    versionId,
    pptxSHA256: sha256(built.pptxBytes),
  });
  files["comparison.json"] = J({
    versionId,
    baselineVersionId: baseline.versionId,
    sameOriginalContent: true,
    sameBindings: true,
    sameSourceRefs: true,
    sameOriginalNotes: true,
    samePageCount: true,
    lockedHash,
    externalProviderCalls: 0,
    changes: plan.pages.map((p) => ({
      slideId: p.slideId,
      role: p.role,
      pace: p.pace,
      expression: p.expression,
      layout: p.resolvedLayout,
      reason: p.reason,
    })),
  });
  files["README.md"] = Buffer.from(
    "# 内容导演首批示例\n\n12页/15分钟。原正文、原有讲稿、数据、绑定、来源和页序不变；新增的任务、图示标识与素材附注不构成新业务事实。\n\n第02页重点与支撑；第07页并列分支，不暗示因果；第10页原生建议流程；第11/12页待核对条件。图示由原有文字编译为原生形状和文字，没有整页拍平。\n\n导演任务由助手编排，不是实际后台模型质量验收。生产功能在明确选择后先调用导演、再写稿，每阶段最多一次校验重试，总计最多4次；已规划恢复0次调用，只有导演检查点时仅使用剩余写稿预算；预算耗尽阻止恢复，中断后保守计入已预约调用。\n\n沿用历史源码/测试材料，不重新认证旧计数。待人工核对语义、顺序依据、来源权限与目标Office编辑。字体未嵌入。商业审批=false。\n",
  );
  files["font-OFL.txt"] = fs.readFileSync(
    path.join(fonts.directory, "OFL.txt"),
  );
  for (const a of sources.assets)
    files[`assets/${a.id}.png`] = Buffer.from(a.data, "base64");
  const cover = await loadImage(files["slides/01.jpg"]),
    canvas = createCanvas(480, 270);
  canvas.getContext("2d").drawImage(cover, 0, 0, 480, 270);
  files["cover.jpg"] = canvas.toBuffer("image/jpeg", 85);
  files["manifest.json"] = J({
    versionId,
    pages: 12,
    files: Object.entries(files).map(([name, b]) => ({
      name,
      bytes: b.length,
      sha256: sha256(b),
    })),
  });
  fs.mkdirSync(dest, { recursive: true });
  for (const [n, b] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dest, n)), { recursive: true });
    fs.writeFileSync(path.join(dest, n), b);
  }
  fs.writeFileSync(
    path.join(dest, "presentation-package.zip"),
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([n, b]) => [n, new Uint8Array(b)]),
      ),
      { level: 6 },
    ),
  );
  for (const [n, h] of Object.entries(frozen))
    assert.equal(sha256(fs.readFileSync(path.join(publicBase, n))), h, n);
  console.log(
    "Content director example generated; originals and M2 untouched.",
    versionId,
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
