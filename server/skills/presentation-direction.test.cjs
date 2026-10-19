const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http");
const { unzipSync, strFromU8 } = require("fflate"),
  { PDFDocument } = require("pdf-lib");
const { directedFixture } = require("./presentation-direction-fixtures.cjs");
const B = "../../dist/local/server/skills/";
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  B + "presentation/sources.js",
);
const { compileContentDirection, resolveContentDirection } = require(
  B + "presentation/direction.js",
);
const { compilePresentationSpec, planningInstructionsFor } = require(
  B + "presentation/spec.js",
);
const { buildStructuredPresentation } = require(B + "pptx-deck.js");
const { createPresentation, validatePresentationCheckpoint } = require(
  B + "presentation/pipeline.js",
);
const { checkPresentationLayout, checkPresentationObjects } = require(
  B + "presentation/quality.js",
);
const enc = (v) => Buffer.from(JSON.stringify(v)),
  clone = (v) => structuredClone(v);
async function context() {
  const f = directedFixture(),
    sources = await readPresentationSources(
      parsePresentationRequest(f.bytes),
      sha256(f.bytes),
    );
  return {
    ...f,
    sources,
    spec: compilePresentationSpec(f.proposal, f.request.brief, sources),
  };
}
test("director is explicit opt-in and cannot upgrade classic or accept unknown model/code fields", async () => {
  const c = await context();
  assert.equal(
    parsePresentationRequest(c.bytes).brief.narrativeMode,
    "directed",
  );
  for (const patch of [
    { layoutStyle: "classic" },
    { narrativeMode: "automatic" },
    { layoutStyle: undefined },
  ]) {
    const r = clone(c.request);
    Object.assign(r.brief, patch);
    assert.throws(() => parsePresentationRequest(enc(r)));
  }
  const plain = { ...c.request.brief };
  delete plain.narrativeMode;
  assert.throws(() => compilePresentationSpec(c.proposal, plain, c.sources));
  assert.throws(() => compileContentDirection(c.direction, plain, c.sources));
  for (const patch of [
    { html: "<script/>" },
    { schemaVersion: 2 },
    { pages: [] },
    { decision: "" },
    {
      pages: [
        ...c.direction.pages.slice(0, 7),
        { ...c.direction.pages[7], role: "evidence" },
      ],
    },
  ])
    assert.throws(() =>
      compileContentDirection(
        { ...c.direction, ...patch },
        c.request.brief,
        c.sources,
      ),
    );
  assert.match(planningInstructionsFor(c.request.brief), /lockedDirection/);
  assert.doesNotMatch(
    planningInstructionsFor({ ...c.request.brief, narrativeMode: undefined }),
    /This is a directed writing pass/,
  );
});
test("task metadata validates evidence, exact quotations, proposal boundaries, focus index and writer drift", async () => {
  const c = await context();
  for (const patch of [
    { evidenceRefs: ["asset-made-up"] },
    { evidenceRefs: ["unknown"] },
    { role: "__proto__" },
    { pace: "dramatic" },
    { expression: "causal" },
    { focusIndex: 2 },
    { sequence: { basis: "proposal" } },
    { x: 2 },
  ]) {
    const d = clone(c.direction);
    Object.assign(d.pages[1], patch);
    assert.throws(() => compileContentDirection(d, c.request.brief, c.sources));
  }
  for (const seq of [
    undefined,
    { basis: "causal" },
    { basis: "proposal", quote: "fake" },
    {
      basis: "source",
      sourceRef: c.direction.pages[6].evidenceRefs[0],
      quote: "不存在的关系",
    },
  ]) {
    const d = clone(c.direction);
    d.pages[6].sequence = seq;
    assert.throws(() => compileContentDirection(d, c.request.brief, c.sources));
  }
  const source = clone(c.direction),
    ref = source.pages[6].evidenceRefs[0];
  source.pages[6].sequence = {
    basis: "source",
    sourceRef: ref,
    quote: c.sources.blocks.find((b) => b.id === ref).text,
  };
  assert.ok(compileContentDirection(source, c.request.brief, c.sources));
  for (const mutate of [
    (p) => (p.slides[1].title = "任意更换的结论"),
    (p) => (p.slides[1].sourceRefs = [p.slides[1].sourceRefs[0]]),
    (p) => (p.slides[6].design.nature = "fact"),
    (p) => (p.slides[1].design.directed = { pace: "focus" }),
    (p) =>
      (p.slides[1].design.visual = { assetId: "asset-test", fit: "cover" }),
  ]) {
    const p = clone(c.proposal);
    mutate(p);
    assert.throws(() => compilePresentationSpec(p, c.request.brief, c.sources));
  }
  const empty = clone(c.proposal);
  empty.slides[4] = {
    ...clone(empty.slides[0]),
    title: empty.direction.pages[4].message,
    sourceRefs: empty.direction.pages[4].evidenceRefs,
  };
  empty.direction.pages[4].expression = "statement";
  assert.throws(
    () => compilePresentationSpec(empty, c.request.brief, c.sources),
    /封面凑页/,
  );
  const data = clone(c.proposal);
  data.direction.pages[2].expression = "sequence";
  data.direction.pages[2].sequence = { basis: "proposal" };
  assert.throws(
    () => compilePresentationSpec(data, c.request.brief, c.sources),
    /不兼容/,
  );
});
test("all five explanations author native, complete text/shapes with immutable original content and no hidden rows", async () => {
  const c = await context(),
    samples = [
      ["message-focus", undefined],
      ["native-structure", undefined],
      ["native-process", "proposal"],
      ["decision-criteria", undefined],
      ["connected-gates", "proposal"],
    ];
  for (const [layout, basis] of samples) {
    const source =
        layout === "connected-gates"
          ? c.spec.slides[6].content
          : c.spec.slides[1].content,
      slide = clone(source),
      before = enc(slide),
      built = await buildStructuredPresentation(
        enc({
          title: "原生解释组件验收",
          theme: {
            ...c.spec.theme,
            headingFont: "Noto Sans SC",
            bodyFont: "Noto Sans SC",
          },
          slides: [slide],
        }),
        {
          strictLayout: true,
          adaptiveDesigns: [
            {
              layout,
              nature: "recommendation",
              directed: {
                role: "explanation",
                pace: "explain",
                ...(basis ? { sequenceBasis: basis } : {}),
                ...(layout === "message-focus" ? { focusIndex: 1 } : {}),
              },
            },
          ],
        },
      );
    assert.deepEqual(enc(slide), before);
    assert.deepEqual(checkPresentationLayout(built.layout), []);
    assert.deepEqual(checkPresentationObjects(built.resolvedObjects), []);
    const z = unzipSync(built.pptxBytes),
      xml = strFromU8(z["ppt/slides/slide1.xml"]);
    assert.doesNotMatch(xml, /<p:pic>/);
    for (const text of slide.bullets ||
      slide.items.flatMap((x) => [x.label, x.body]))
      assert.ok(
        built.layout.some((e) => e.text === text),
        text,
      );
    if (basis) {
      assert.match(xml, /chevron/);
      assert.match(xml, /建议顺序/);
    }
    if (layout === "native-structure") {
      assert.match(xml, /ellipse/);
      assert.match(xml, /不表示顺序/);
    }
    if (layout === "decision-criteria") assert.match(xml, /空框不表示/);
  }
  const plan = resolveContentDirection(c.spec, c.sources),
    before = enc(c.spec);
  assert.equal(plan.designs[1].layout, "native-structure");
  assert.equal(plan.designs[6].layout, "connected-gates");
  assert.equal(plan.pages[6].relationshipSemanticsVerified, false);
  assert.equal(plan.commercialApproval, false);
  assert.deepEqual(enc(c.spec), before);
  assert.ok(plan.flags.some((f) => f.code === "DENSE_RUN"));
  const dense = {
    type: "bullets",
    title: "明确失败，不删原文",
    bullets: Array(4).fill("这是不能被删减或缩小的密集节点。".repeat(5)),
  };
  await assert.rejects(
    buildStructuredPresentation(
      enc({
        title: "密集示例",
        theme: {
          ...c.spec.theme,
          headingFont: "Noto Sans SC",
          bodyFont: "Noto Sans SC",
        },
        slides: [dense],
      }),
      {
        adaptiveDesigns: [
          {
            layout: "decision-criteria",
            nature: "pending",
            directed: { role: "conditions", pace: "verify" },
          },
        ],
      },
    ),
    /过密|拆页|过长/,
  );
});
test("checkpoint stages reject mixed state, bad input hashes and usage beyond per-stage call ceilings", async () => {
  const c = await context(),
    h = sha256(c.bytes),
    cp = {
      kind: "presentation",
      schemaVersion: 1,
      inputHash: h,
      stage: "directed",
      direction: c.direction,
    };
  assert.equal(validatePresentationCheckpoint(cp, h).stage, "directed");
  for (const patch of [
    { spec: c.proposal },
    { inputHash: "f".repeat(64) },
    { direction: { schemaVersion: 2, pages: [] } },
    { writerAttempts: 3 },
    { writerAttempts: -1 },
    { usage: [{}, {}, {}] },
  ])
    assert.throws(() => validatePresentationCheckpoint({ ...cp, ...patch }, h));
  assert.throws(() =>
    validatePresentationCheckpoint(
      { ...cp, stage: "planned", spec: c.proposal },
      h,
    ),
  );
});
let server,
  mode = "both-retry",
  counts = { director: 0, writer: 0 },
  saved = {},
  captured = [];
before(async () => {
  for (const k of ["AI_API_KEY", "OPENAI_API_KEY", "AI_BASE_URL", "AI_MODEL"])
    saved[k] = process.env[k];
  server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw),
      director = body.messages
        .find((m) => m.role === "system")
        .content.includes("CONTENT DIRECTOR"),
      stage = director ? "director" : "writer",
      user = body.messages.find((m) => m.role === "user").content;
    counts[stage]++;
    captured.push({ stage, user });
    const payload = JSON.parse(user.split("\nThe previous proposal")[0]);
    const f = directedFixture();
    let value = director
      ? f.direction
      : { ...f.proposal, direction: payload.lockedDirection };
    assert.ok(!user.includes("base64"));
    assert.ok(!user.includes("apiKey"));
    if (mode === "both-retry" && counts[stage] === 1) value = { bad: true };
    if (mode === "director-invalid" && director) value = { bad: true };
    if (mode === "writer-drift" && !director) {
      value = clone(value);
      value.direction.argument = "未经许可改写导演论证";
    }
    if (mode === "writer-retry" && !director && counts.writer === 1)
      value = { bad: true };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        model: "synthetic-director-fixture-NOT-live-quality",
        choices: [{ message: { content: JSON.stringify(value) } }],
        usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.AI_API_KEY = "fixture-only-never-production";
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  process.env.AI_MODEL = "synthetic-fixture";
});
after(async () => {
  await new Promise((r) => server.close(r));
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
const input = (c) => ({
    skillId: "slides.create",
    filename: "directed.json",
    bytes: c.bytes,
    owner: "director-fixture",
    parameters: { externalConsent: "yes" },
  }),
  get = (r, n) => {
    const o = r.outputs.find((o) => o.name === n);
    assert.ok(o, n);
    return o.bytes;
  },
  json = (r, n) => JSON.parse(Buffer.from(get(r, n)).toString());
test(
  "actual two-stage adapter, bounded retries, locked plan, four usage records, checkpoints and native PDF; resume planned makes zero model calls",
  { timeout: 240000 },
  async () => {
    const c = await context(),
      checkpoints = [],
      usage = [];
    counts = { director: 0, writer: 0 };
    mode = "both-retry";
    captured = [];
    const result = await createPresentation(
      {
        ...input(c),
        onAIUsage: (u) => usage.push(u),
        onPresentationCheckpoint: (cp) => checkpoints.push(clone(cp)),
      },
      () => {},
    );
    assert.deepEqual(counts, { director: 2, writer: 2 });
    assert.equal(usage.length, 4);
    assert.equal(checkpoints.at(-1).stage, "planned");
    assert.ok(checkpoints.slice(0, -1).every((cp) => cp.stage === "directed"));
    assert.ok(checkpoints.some((cp) => cp.writerAttempts === 1));
    assert.ok(checkpoints.some((cp) => cp.writerAttempts === 2));
    assert.equal(checkpoints[0].usage.length, 2);
    assert.equal(checkpoints.at(-1).usage.length, 4);
    assert.equal(
      json(result, "presentation-spec.json").planner.callsThisExecution,
      4,
    );
    assert.equal(json(result, "direction-plan.json").planner.directorCalls, 2);
    assert.equal(json(result, "direction-plan.json").planner.writerCalls, 2);
    assert.equal(
      json(result, "quality-report.json").repair.maxPlanningSchemaRetries,
      2,
    );
    assert.equal(
      json(result, "quality-report.json").repair
        .maxModelCallsAcrossStagesAndResume,
      4,
    );
    assert.equal(
      json(result, "quality-report.json").releaseStatus,
      "needs-human-review",
    );
    assert.equal(
      (
        await PDFDocument.load(get(result, "draft-presentation.pdf"))
      ).getPageCount(),
      8,
    );
    assert.equal(
      json(result, "direction-plan.json").automaticFactRewriting,
      false,
    );
    assert.deepEqual(
      json(result, "presentation-spec.json").spec.slides.map((s) => s.bindings),
      c.spec.slides.map((s) => s.bindings),
    );
    assert.deepEqual(JSON.parse(captured[2].user).lockedDirection, c.direction);
    const before = { ...counts },
      resumed = await createPresentation(
        { ...input(c), resumePresentation: checkpoints.at(-1) },
        () => {},
      );
    assert.deepEqual(counts, before);
    assert.equal(
      json(resumed, "presentation-spec.json").planner.callsThisExecution,
      0,
    );
    assert.equal(
      json(resumed, "direction-plan.json").bodyDataNotesHash,
      json(result, "direction-plan.json").bodyDataNotesHash,
    );
    counts = { director: 0, writer: 0 };
    mode = "writer-retry";
    const fromDirector = await createPresentation(
      { ...input(c), resumePresentation: checkpoints[0] },
      () => {},
    );
    assert.deepEqual(counts, { director: 0, writer: 2 });
    assert.equal(
      json(fromDirector, "presentation-spec.json").planner.usage.length,
      4,
    );
    assert.equal(
      json(fromDirector, "presentation-spec.json").planner.resumedStage,
      "directed",
    );
  },
);
test("invalid director stops before writer; locked-plan drift fails after one writer retry, leaving only the valid director checkpoint", async () => {
  const c = await context();
  counts = { director: 0, writer: 0 };
  mode = "director-invalid";
  await assert.rejects(
    createPresentation(input(c), () => {}),
    /内容导演两次/,
  );
  assert.deepEqual(counts, { director: 2, writer: 0 });
  counts = { director: 0, writer: 0 };
  mode = "writer-drift";
  const checkpoints = [];
  await assert.rejects(
    createPresentation(
      { ...input(c), onPresentationCheckpoint: (cp) => checkpoints.push(cp) },
      () => {},
    ),
    /不得改写/,
  );
  assert.deepEqual(counts, { director: 1, writer: 2 });
  assert.ok(checkpoints.every((cp) => cp.stage === "directed"));
  assert.equal(checkpoints.at(-1).writerAttempts, 2);
  assert.equal(checkpoints.at(-1).usage.length, 3);
  const before = { ...counts };
  await assert.rejects(
    createPresentation(
      { ...input(c), resumePresentation: checkpoints.at(-1) },
      () => {},
    ),
    /预算已用完/,
  );
  assert.deepEqual(counts, before);
  // Reservation is persisted before HTTP; an uncertain interruption cannot obtain a fresh two-call budget.
  counts = { director: 0, writer: 0 };
  mode = "normal";
  let reserved;
  await assert.rejects(
    createPresentation(
      {
        ...input(c),
        onPresentationCheckpoint: (cp) => {
          if (cp.stage === "directed" && cp.writerAttempts === 1) {
            reserved = clone(cp);
            throw Error("simulated interruption after budget reservation");
          }
        },
      },
      () => {},
    ),
    /simulated interruption/,
  );
  assert.deepEqual(counts, { director: 1, writer: 0 });
  assert.equal(reserved.writerAttempts, 1);
  counts = { director: 0, writer: 0 };
  mode = "writer-retry";
  await assert.rejects(
    createPresentation({ ...input(c), resumePresentation: reserved }, () => {}),
    /两次均未通过/,
  );
  assert.deepEqual(counts, { director: 0, writer: 1 });
});
