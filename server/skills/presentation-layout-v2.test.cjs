const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { unzipSync, strFromU8 } = require("fflate");
const { PDFDocument } = require("pdf-lib");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path");
const { presentationFixture } = require("./presentation-fixtures.cjs");
const B = "../../dist/local/server/skills/";
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  B + "presentation/sources.js",
);
const { compilePresentationSpec, planningInstructionsFor } = require(
  B + "presentation/spec.js",
);
const { resolveAdaptiveDeck, validateSlideDesign } = require(
  B + "presentation/layouts/index.js",
);
const {
  presentationLayoutCatalog,
} = require("../../dist/local/shared/presentationDesign.js");
const { buildStructuredPresentation } = require(B + "pptx-deck.js");
const {
  checkPresentationLayout,
  checkPresentationObjects,
  presentationQuality,
} = require(B + "presentation/quality.js");
const { presentationFonts } = require(B + "presentation/fonts.js");
const { renderPresentation } = require(B + "pptx-render.js");
const { createPresentation, validatePresentationCheckpoint } = require(
  B + "presentation/pipeline.js",
);
const { reviewPresentationPlan } = require(
  B + "presentation/planning-review.js",
);
const clone = (v) => JSON.parse(JSON.stringify(v)),
  encode = (v) => Buffer.from(JSON.stringify(v));
async function context() {
  const f = presentationFixture();
  f.request.brief.layoutStyle = "adaptive";
  f.proposal.schemaVersion = 2;
  f.proposal.slides.forEach(
    (s) => (s.design = { layout: "auto", nature: "pending" }),
  );
  f.bytes = encode(f.request);
  return {
    ...f,
    sources: await readPresentationSources(f.request, sha256(f.bytes)),
  };
}
function raw(slides, theme) {
  return encode({
    title: "V2布局验收（合成材料）",
    theme: { ...theme, headingFont: "Noto Sans SC", bodyFont: "Noto Sans SC" },
    slides,
  });
}
function allLayouts() {
  const samples = {
    cover: {
      type: "cover",
      title: "建议先核对证据，再批准下一步",
      subtitle: "合成材料 / 版式组件验收，不是业务事实",
    },
    bullets: {
      type: "bullets",
      title: "执行目标与限制分开呈现",
      bullets: [
        "先核对提供的材料与口径",
        "只按明确授权使用材料",
        "负责人和预算尚待确认",
      ],
    },
    metrics: {
      type: "metrics",
      title: "原始观测，不推断增长原因",
      items: [
        { label: "观测甲", value: "120", note: "合成示例" },
        { label: "观测乙", value: "150", note: "合成示例" },
      ],
    },
    chart: {
      type: "chart",
      title: "合成观测存在变化，原因仍待确认",
      chartType: "bar",
      categories: ["甲", "乙"],
      series: [{ name: "观测值", values: [120, 150] }],
    },
    table: {
      type: "table",
      title: "选项与风险需共同复核",
      headers: ["方案", "价值", "代价", "判断"],
      rows: [
        ["保持现状", "少新增投入", "缺真实反馈", "待评审"],
        ["受控试点", "获得真实证据", "需要复核", "有条件推荐"],
      ],
    },
    comparison: {
      type: "comparison",
      title: "已知证据与待确认项分开",
      columns: [
        {
          heading: "已有证据",
          bullets: ["可编辑的原生对象", "同文件PDF与页图"],
        },
        { heading: "仍待确认", bullets: ["目标Office编辑", "语义及商业验收"] },
      ],
    },
    timeline: {
      type: "timeline",
      title: "按关卡推进，不编造排期",
      items: [
        { label: "核对材料", body: "确认授权与口径" },
        { label: "真实试跑", body: "保留来源及检查结果" },
        { label: "人工复核", body: "依据证据决定下一步" },
      ],
    },
    quote: {
      type: "quote",
      title: "引用正文保持逐字，不冒充事实核验",
      quote: "这是合成材料，只用于版式验收。",
      attribution: "合成输入",
    },
  };
  return presentationLayoutCatalog.slice(0,12).map((l) => ({
    slide: clone({
      ...samples[l.type],
      speakerNotes: "合成组件验收，不是真实业务或模型质量验收。",
      sources: ["fixture"],
    }),
    design: {
      layout: l.id,
      nature: "pending",
      ...(l.id === "decision-matrix" ? { emphasisRows: [1] } : {}),
    },
  }));
}
test("adaptive opt-in and V1 protocol compatibility are explicit and fail closed", async () => {
  const c = await context();
  assert.equal(parsePresentationRequest(c.bytes).brief.layoutStyle, "adaptive");
  assert.equal(
    compilePresentationSpec(c.proposal, c.request.brief, c.sources)
      .schemaVersion,
    2,
  );
  const legacy = presentationFixture(),
    sources = await readPresentationSources(
      legacy.request,
      sha256(legacy.bytes),
    );
  assert.equal(
    compilePresentationSpec(legacy.proposal, legacy.request.brief, sources)
      .schemaVersion,
    1,
  );
  assert.throws(
    () => compilePresentationSpec(legacy.proposal, c.request.brief, c.sources),
    /不能静默回退/,
  );
  assert.throws(
    () => compilePresentationSpec(c.proposal, legacy.request.brief, c.sources),
    /显式选择/,
  );
  const bad = clone(c.request);
  bad.brief.layoutStyle = "arbitrary";
  assert.throws(() => parsePresentationRequest(encode(bad)), /排版/);
  assert.match(planningInstructionsFor(c.request.brief), /schemaVersion:2/);
  assert.doesNotMatch(
    planningInstructionsFor(legacy.request.brief),
    /emphasisRows/,
  );
});
test("design whitelist rejects arbitrary coordinates, incompatible types, row filters and forged source/data fields", async () => {
  const c = await context();
  for (const design of [
    { layout: "auto", nature: "fact", x: 12 },
    { layout: "chart-ledger", nature: "fact" },
    { layout: "auto", nature: "verified" },
    { layout: "auto", nature: "fact", takeaway: "x".repeat(161) },
    { layout: "auto", nature: "fact", takeaway: "bad\ntext" },
    { layout: "auto", nature: "fact", sourceRefs: ["fake"] },
    { layout: "auto", nature: "analysis", emphasisRows: [99] },
  ]) {
    const p = clone(c.proposal);
    p.slides[1].design = design;
    assert.throws(() => compilePresentationSpec(p, c.request.brief, c.sources));
  }
  const spec = compilePresentationSpec(c.proposal, c.request.brief, c.sources);
  assert.deepEqual(spec.slides[3].content.series[0].values, [120, 150, 180]);
  assert.deepEqual(spec.slides[4].bindings[0].rows, [2, 3, 4]);
});
test("all twelve declared layouts resolve natively with stable IDs, fixed font sizes and unchanged input content", async () => {
  const c = await context(),
    theme = compilePresentationSpec(
      c.proposal,
      c.request.brief,
      c.sources,
    ).theme,
    a = allLayouts(),
    before = encode(a);
  const r = resolveAdaptiveDeck(
    a.map((v) => v.slide),
    theme,
    a.map((v) => v.design),
  );
  assert.equal(r.length, 12);
  assert.equal(new Set(r.map((s) => s.layoutId)).size, 12);
  assert.deepEqual(encode(a), before);
  assert.deepEqual(
    r,
    resolveAdaptiveDeck(
      a.map((v) => v.slide),
      theme,
      a.map((v) => v.design),
    ),
  );
  const built = await buildStructuredPresentation(
    raw(
      a.map((v) => v.slide),
      theme,
    ),
    { strictLayout: true, adaptiveDesigns: a.map((v) => v.design) },
  );
  assert.equal(checkPresentationLayout(built.layout).length, 0);
  assert.equal(checkPresentationObjects(built.resolvedObjects).length, 0);
  const zip = unzipSync(built.pptxBytes);
  assert.equal(
    Object.keys(zip).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .length,
    12,
  );
  assert.equal(
    Object.keys(zip).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))
      .length,
    2,
  );
  for (let i = 1; i <= 12; i++) {
    assert.match(strFromU8(zip[`ppt/slides/slide${i}.xml`]), /<a:t>/);
    assert.doesNotMatch(strFromU8(zip[`ppt/slides/slide${i}.xml`]), /<p:pic>/);
    assert.doesNotMatch(
      strFromU8(zip[`ppt/slides/slide${i}.xml`]),
      /<a:normAutofit/,
    );
  }
});
test("adaptive tables preserve every cell and row while changing only widths, row heights and emphasis styling", async () => {
  const c = await context(),
    spec = compilePresentationSpec(c.proposal, c.request.brief, c.sources),
    s = spec.slides[4].content,
    original = clone(s),
    d = { layout: "decision-matrix", nature: "analysis", emphasisRows: [1] };
  const r = resolveAdaptiveDeck([s], spec.theme, [d]);
  const table = r[0].elements.find((e) => e.kind === "table");
  assert.deepEqual(table.data.values, [s.headers, ...s.rows]);
  assert.equal(
    table.data.widths.reduce((a, b) => a + b, 0).toFixed(2),
    "12.03",
  );
  assert.deepEqual(s, original);
  assert.throws(
    () => validateSlideDesign({ ...d, emphasisRows: [1, 1] }, s),
    /强调行/,
  );
  assert.throws(
    () => validateSlideDesign({ ...d, emphasisRows: [-1] }, s),
    /强调行/,
  );
});
test("dense layouts require an explicit edit or split, never auto-shrink, add pages, hide rows or truncate facts", async () => {
  const c = await context(),
    theme = compilePresentationSpec(
      c.proposal,
      c.request.brief,
      c.sources,
    ).theme;
  const dense = {
    type: "table",
    title: "完整保留长文本",
    headers: ["字段甲", "字段乙", "字段丙", "字段丁", "字段戊"],
    rows: Array.from({ length: 6 }, () =>
      Array(5).fill("需要完整保留的事实与说明".repeat(5)),
    ),
  }; // content within per-cell 80-char bound
  const before = clone(dense);
  assert.throws(
    () =>
      resolveAdaptiveDeck([dense], theme, [
        { layout: "auto", nature: "pending" },
      ]),
    /拆页/,
  );
  assert.deepEqual(dense, before);
  const chart = {
    type: "chart",
    title: "完整类别不能静默隐藏",
    chartType: "bar",
    categories: Array.from({ length: 12 }, (_, i) => `类别${i}`),
    series: [{ name: "原值", values: Array.from({ length: 12 }, (_, i) => i) }],
  };
  assert.throws(
    () =>
      resolveAdaptiveDeck([chart], theme, [
        { layout: "chart-ledger", nature: "pending" },
      ]),
    /拆页/,
  );
});
test("full-object quality catches chart/table text collisions, excluding only explicit decorations and table parents", () => {
  const a = {
      slideId: "slide-01",
      elementId: "chart",
      kind: "chart",
      role: "chart",
      x: 1,
      y: 1,
      w: 5,
      h: 3,
    },
    b = { ...a, elementId: "text", kind: "text", role: "text", x: 2, w: 2 };
  assert.equal(checkPresentationObjects([a, b])[0].code, "OBJECT_INTERSECTION");
  assert.equal(
    checkPresentationObjects([{ ...a, decorative: true }, b]).length,
    0,
  );
  assert.equal(
    checkPresentationObjects([
      { ...a, kind: "table" },
      { ...b, parentId: "chart" },
    ]).length,
    0,
  );
  assert.ok(
    checkPresentationObjects([{ ...a, x: 12 }]).some(
      (i) => i.code === "OBJECT_OUT_OF_BOUNDS",
    ),
  );
  assert.ok(
    checkPresentationObjects([a, a]).some(
      (i) => i.code === "DUPLICATE_ELEMENT_ID",
    ),
  );
});
test("design takeaway numbers are not exempt from source-number warnings; review never grants semantic approval", async () => {
  const c = await context(),
    spec = compilePresentationSpec(c.proposal, c.request.brief, c.sources);
  spec.slides[3].design.takeaway = "收益9999999已确认";
  const q = presentationQuality(
    spec,
    c.sources,
    [],
    { report: { pageCount: 8 } },
    { pageCount: 8 },
  );
  assert.ok(
    q.issues.some(
      (i) => i.code === "UNMATCHED_NUMBER" && i.slideId === "slide-04",
    ),
  );
  const review = reviewPresentationPlan(spec, c.sources);
  assert.equal(review.humanReviewRequired, true);
  assert.equal(review.commercialApproval, false);
  assert.equal(review.checks.semanticSourceSupport, "NOT verified");
  assert.ok(review.flags.some((f) => f.code === "THIN_NOTES"));
});
for (const theme of ["consulting", "corporate", "technology"])
  test(
    `native V2 render: all 12 layouts in ${theme} produce actual PDF/pages without claiming model quality`,
    { timeout: 300000 },
    async () => {
      const f = presentationFixture("business-report", theme),
        sources = await readPresentationSources(f.request, sha256(f.bytes)),
        colors = compilePresentationSpec(
          f.proposal,
          f.request.brief,
          sources,
        ).theme,
        a = allLayouts();
      const built = await buildStructuredPresentation(
        raw(
          a.map((v) => v.slide),
          colors,
        ),
        { strictLayout: true, adaptiveDesigns: a.map((v) => v.design) },
      );
      assert.deepEqual(checkPresentationLayout(built.layout), []);
      assert.deepEqual(checkPresentationObjects(built.resolvedObjects), []);
      const rendered = await renderPresentation(built.pptxBytes, 12, () => {}, {
        fontDirectory: presentationFonts().directory,
        pdf: true,
      });
      assert.equal(rendered.report.pageCount, 12);
      assert.deepEqual(rendered.report.missingFonts, []);
      const pdf = rendered.outputs.find(
        (o) => o.name === "draft-presentation.pdf",
      );
      assert.equal((await PDFDocument.load(pdf.bytes)).getPageCount(), 12);
    },
  );
test(
  "real pipeline accepts source-hash-bound V2 checkpoint, records review and never calls a provider on resume",
  { timeout: 300000 },
  async () => {
    const c = await context(),
      hash = sha256(c.bytes),
      cp = {
        kind: "presentation",
        schemaVersion: 1,
        inputHash: hash,
        stage: "planned",
        spec: c.proposal,
      };
    validatePresentationCheckpoint(cp, hash);
    const r = await createPresentation(
      {
        skillId: "slides.create",
        filename: "input.json",
        bytes: c.bytes,
        owner: "v2-fixture",
        parameters: { externalConsent: "yes" },
        resumePresentation: cp,
      },
      () => {},
    );
    const meta = JSON.parse(
      Buffer.from(
        r.outputs.find((o) => o.name === "presentation-spec.json").bytes,
      ),
    );
    assert.equal(meta.planner.callsThisExecution, 0);
    assert.equal(meta.spec.schemaVersion, 2);
    assert.equal(meta.planningReview.commercialApproval, false);
    const geometry = JSON.parse(
      Buffer.from(
        r.outputs.find((o) => o.name === "resolved-layout.json").bytes,
      ),
    );
    assert.ok(geometry.objects.some((o) => o.kind === "chart"));
    assert.equal(geometry.adaptiveLayout.engineVersion, "adaptive-2.0.0");
    const q = JSON.parse(
      Buffer.from(
        r.outputs.find((o) => o.name === "quality-report.json").bytes,
      ),
    );
    assert.equal(q.releaseStatus, "needs-human-review");
    assert.equal(q.commercialApproval, false);
  },
);
test("M0 preflight records NOT RUN without external credentials/consent, and refuses public output directories", () => {
  const script = path.resolve(
      __dirname,
      "../../scripts/benchmark-presentation-planning.cjs",
    ),
    dir = path.resolve(".cache/v2-preflight-test");
  const env = { ...process.env, AI_API_KEY: "", OPENAI_API_KEY: "" };
  const r = spawnSync(
    process.execPath,
    [script, "--preflight", "--output", dir],
    { env, encoding: "utf8" },
  );
  assert.equal(r.status, 0);
  const status = JSON.parse(
    fs.readFileSync(path.join(dir, "acceptance-status.json")),
  );
  assert.equal(status.status, "not-run");
  assert.equal(status.externalProviderCalls, 0);
  assert.equal(status.serverCredentialPresent, false);
  const denied = spawnSync(
    process.execPath,
    [
      script,
      "--preflight",
      "--output",
      path.resolve("apps/web/public/private-data"),
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(denied.status, 1);
  assert.equal(fs.existsSync("apps/web/public/private-data"), false);
});

test(
  "fresh adaptive planning uses the V2 contract and one bounded schema retry; mocked provider is NOT live acceptance",
  { timeout: 300000 },
  async () => {
    const c = await context(),
      ai = require("../../dist/local/server/api/ai.js"),
      original = ai.requestAI,
      old = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "offline-v2-fixture-not-a-real-key";
    let calls = 0;
    try {
      ai.requestAI = async (input) => {
        calls++;
        assert.equal(input.serverConfigurationOnly, true);
        assert.match(input.systemPrompt, /"schemaVersion":2/);
        assert.match(input.systemPrompt, /emphasisRows/);
        const prompt = JSON.parse(
          input.prompt.split("\nThe previous proposal")[0],
        );
        assert.equal(prompt.brief.layoutStyle, "adaptive");
        assert.ok(prompt.blocks.length > 0);
        input.onUsage({
          model: "offline-fixture",
          provider: "test",
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          reported: true,
          latencyMs: 1,
          status: "succeeded",
          error: "",
          createdAt: Date.now(),
        });
        const proposal = clone(c.proposal);
        if (calls === 1)
          proposal.slides[1].design.layout = "unregistered-layout";
        return { model: "offline-fixture", content: JSON.stringify(proposal) };
      };
      const r = await createPresentation(
        {
          skillId: "slides.create",
          filename: "input.json",
          bytes: c.bytes,
          owner: "offline-v2-fixture",
          parameters: { externalConsent: "yes" },
        },
        () => {},
      );
      const meta = JSON.parse(
        Buffer.from(
          r.outputs.find((o) => o.name === "presentation-spec.json").bytes,
        ),
      );
      assert.equal(calls, 2);
      assert.equal(meta.planner.callsThisExecution, 2);
      assert.equal(meta.planner.usage.length, 2);
      assert.equal(meta.spec.schemaVersion, 2);
      assert.equal(meta.planner.resumedFromCheckpoint, false);
      assert.equal(meta.planningReview.commercialApproval, false);
      assert.deepEqual(
        meta.spec.slides[3].content.series[0].values,
        [120, 150, 180],
      );
    } finally {
      ai.requestAI = original;
      if (old === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = old;
    }
  },
);
test(
  "adaptive 25-page upper bound exports every physical page without expanding resource limits",
  { timeout: 300000 },
  async () => {
    const c = await context(),
      hash = sha256(c.bytes),
      spec = compilePresentationSpec(c.proposal, c.request.brief, c.sources),
      slide = spec.slides[1].content,
      slides = [
        spec.slides[0].content,
        ...Array.from({ length: 24 }, () => clone(slide)),
      ],
      designs = slides.map(() => ({ layout: "auto", nature: "pending" }));
    const built = await buildStructuredPresentation(raw(slides, spec.theme), {
      strictLayout: true,
      adaptiveDesigns: designs,
    });
    assert.deepEqual(checkPresentationLayout(built.layout), []);
    assert.deepEqual(checkPresentationObjects(built.resolvedObjects), []);
    const rendered = await renderPresentation(built.pptxBytes, 25, () => {}, {
      fontDirectory: presentationFonts().directory,
      pdf: true,
    });
    assert.equal(rendered.report.pageCount, 25);
    assert.equal(
      (
        await PDFDocument.load(
          rendered.outputs.find((o) => o.name === "draft-presentation.pdf")
            .bytes,
        )
      ).getPageCount(),
      25,
    );
    assert.ok(
      rendered.outputs.reduce((n, o) => n + o.bytes.length, 0) +
        built.pptxBytes.length <
        25_000_000,
    );
  },
);
