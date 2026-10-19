const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
const { unzipSync, strFromU8 } = require("fflate");
const { PDFDocument } = require("pdf-lib");
const { presentationFixture } = require("./presentation-fixtures.cjs");
const B = "../../dist/local/server/skills/";
const { parsePresentationRequest, readPresentationSources, sha256 } = require(
  B + "presentation/sources.js",
);
const {
  normalizePresentationAssets,
  parsePresentationAssets,
  publicPresentationSources,
} = require(B + "presentation/assets.js");
const { planPresentationVisuals, visualPalettes } = require(
  B + "presentation/visuals.js",
);
const { compilePresentationSpec, planningInstructionsFor } = require(
  B + "presentation/spec.js",
);
const { validateSlideDesign } = require(B + "presentation/layouts/index.js");
const { buildStructuredPresentation } = require(B + "pptx-deck.js");
const { checkPresentationObjects, checkPresentationLayout } = require(
  B + "presentation/quality.js",
);
const { createPresentation } = require(B + "presentation/pipeline.js");
const enc = (v) => Buffer.from(JSON.stringify(v)),
  clone = (v) => structuredClone(v);
async function asset(patch = {}) {
  return {
    id: "asset-test",
    name: "test.png",
    role: "illustration",
    usage: "decorative",
    alt: "合成测试色块，非业务证据",
    source: "本地Sharp合成，仅作测试",
    license: "合成测试输入；不宣称真实照片授权",
    permissionConfirmed: true,
    base64: (
      await sharp({
        create: { width: 320, height: 180, channels: 3, background: "#89c4ab" },
      })
        .png()
        .toBuffer()
    ).toString("base64"),
    ...patch,
  };
}
async function context() {
  const f = presentationFixture();
  f.request.brief = {
    ...f.request.brief,
    layoutStyle: "adaptive",
    visualStyle: "consulting",
    logoAssetId: "asset-logo",
  };
  f.request.assets = [
    await asset(),
    await asset({
      id: "asset-shot",
      name: "shot.png",
      role: "screenshot",
      usage: "evidence",
    }),
    await asset({ id: "asset-logo", name: "logo.png", role: "logo" }),
  ];
  f.proposal.schemaVersion = 2;
  f.proposal.slides.forEach(
    (s) => (s.design = { layout: "auto", nature: "pending" }),
  );
  f.proposal.slides[1].design = {
    layout: "screenshot-evidence",
    nature: "pending",
    visual: { assetId: "asset-shot", fit: "contain" },
  };
  f.proposal.slides[1].sourceRefs = [
    ...f.proposal.slides[1].sourceRefs,
    "asset-shot",
  ];
  f.bytes = enc(f.request);
  const sources = await readPresentationSources(
      parsePresentationRequest(f.bytes),
      sha256(f.bytes),
    ),
    spec = compilePresentationSpec(f.proposal, f.request.brief, sources);
  return { ...f, sources, spec };
}
test("M2 opt-in, classic compatibility and explicit authorized, bounded raster request", async () => {
  const a = await asset(),
    f = presentationFixture();
  assert.equal(parsePresentationRequest(f.bytes).assets, undefined);
  for (const patch of [
    { permissionConfirmed: false },
    { role: "script" },
    { usage: "unverified" },
    { name: "../x.png" },
    { id: "source-1" },
    { base64: "data:image/png;base64,AAAA" },
    { url: "https://example.com/x.png" },
    { name: "x.svg" },
    { alt: "" },
    { license: "" },
    { source: "x\nremote" },
    { role: "screenshot", usage: "decorative" },
    { role: "logo", usage: "evidence" },
  ])
    assert.throws(() => parsePresentationAssets([{ ...a, ...patch }], 0));
  assert.throws(() => parsePresentationAssets([a, a], 0));
  assert.throws(() => parsePresentationAssets(Array(6).fill(a), 0));
  assert.throws(() => parsePresentationAssets([a], 10_000_000));
  f.request.assets = [a];
  assert.throws(() => parsePresentationRequest(enc(f.request)), /adaptive/);
  f.request.brief.layoutStyle = "adaptive";
  f.request.brief.visualStyle = "arbitrary";
  assert.throws(() => parsePresentationRequest(enc(f.request)), /风格/);
  f.request.brief.visualStyle = "consulting";
  f.request.brief.logoAssetId = a.id;
  assert.throws(() => parsePresentationRequest(enc(f.request)), /logo/);
});
test("real raster signature/decode/pixel/animation validation fails closed; no SVG or placeholder decoding", async () => {
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from([255, 216, 255, 0, 0]),
    Buffer.from("RIFF0000WEBP0000"),
  ])
    await assert.rejects(
      normalizePresentationAssets([
        await asset({ base64: bytes.toString("base64") }),
      ]),
    );
  const big = await sharp({
    create: { width: 3000, height: 3000, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    normalizePresentationAssets([
      await asset({ base64: big.toString("base64") }),
    ]),
    /预算/,
  );
  const png = Buffer.from((await asset()).base64, "base64"),
    chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8, 0);
  chunk.write("acTL", 4);
  const animated = Buffer.concat([
    png.subarray(0, 33),
    chunk,
    png.subarray(33),
  ]);
  await assert.rejects(
    normalizePresentationAssets([
      await asset({ base64: animated.toString("base64") }),
    ]),
    /动画/,
  );
  const animWebp = Buffer.alloc(30);
  animWebp.write("RIFF", 0);
  animWebp.write("WEBP", 8);
  animWebp.write("VP8X", 12);
  animWebp[20] = 2;
  await assert.rejects(
    normalizePresentationAssets([
      await asset({ base64: animWebp.toString("base64") }),
    ]),
    /动画/,
  );
});
test("orientation applied, EXIF stripped, evidence pixels retained, binary excluded from provenance", async () => {
  const bytes = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#498" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
    [a] = await normalizePresentationAssets([
      await asset({ base64: bytes.toString("base64"), name: "oriented.jpg" }),
    ]);
  assert.equal(a.width, 20);
  assert.equal(a.height, 40);
  assert.equal(a.originalSHA256, sha256(bytes));
  const m = await sharp(Buffer.from(a.data, "base64")).metadata();
  assert.equal(m.orientation, undefined);
  assert.equal(m.exif, undefined);
  assert.equal(m.format, "png");
  const large = await sharp({
      create: { width: 2600, height: 100, channels: 3, background: "#498" },
    })
      .png()
      .toBuffer(),
    [e] = await normalizePresentationAssets([
      await asset({ usage: "evidence", base64: large.toString("base64") }),
    ]);
  assert.equal(e.width, 2600);
  const c = await context(),
    pub = publicPresentationSources(c.sources),
    j = JSON.stringify(pub);
  assert.ok(
    pub.assets.every(
      (x) => !Object.hasOwn(x, "data") && !Object.hasOwn(x, "base64"),
    ),
  );
  assert.ok(!j.includes(c.sources.assets[0].data));
  assert.ok(
    pub.blocks.some(
      (x) => x.id === "asset-shot" && x.locator.includes("未OCR"),
    ),
  );
  assert.match(planningInstructionsFor(c.request.brief), /no OCR/i);
});
test("visual binding rejects missing assets, screenshot crop, missing citation and forged fields", async () => {
  const c = await context(),
    s = c.spec;
  for (const patch of [
    { assetId: "asset-missing", fit: "contain" },
    { assetId: "asset-shot", fit: "cover" },
    { assetId: "asset-logo", fit: "contain" },
  ]) {
    const v = clone(s);
    v.slides[1].design.visual = patch;
    assert.throws(() => planPresentationVisuals(v, c.request.brief, c.sources));
  }
  const imageOnly = clone(s);
  imageOnly.slides[1].sourceRefs = ["asset-shot"];
  assert.throws(
    () => planPresentationVisuals(imageOnly, c.request.brief, c.sources),
    /文字/,
  );
  const noRef = clone(s);
  noRef.slides[1].sourceRefs = noRef.slides[1].sourceRefs.filter(
    (x) => x !== "asset-shot",
  );
  assert.throws(
    () => planPresentationVisuals(noRef, c.request.brief, c.sources),
    /来源/,
  );
  for (const design of [
    { layout: "visual-story", nature: "fact" },
    {
      layout: "visual-story",
      nature: "fact",
      visual: { assetId: "asset-test", fit: "cover", x: 1 },
    },
    {
      layout: "executive-summary",
      nature: "fact",
      visual: { assetId: "asset-test", fit: "cover" },
    },
  ])
    assert.throws(() => validateSlideDesign(design, s.slides[1].content, 1, 8));
  const plain = clone(s);
  delete plain.slides[1].design.visual;
  plain.slides[1].design.layout = "auto";
  assert.equal(
    planPresentationVisuals(
      plain,
      { ...c.request.brief, visualStyle: undefined },
      { ...c.sources, assets: [] },
    ),
    undefined,
  );
});
test("three actual compositions, native text/charts/tables and full screenshot aspect, not slide flattening", async () => {
  const c = await context(),
    before = enc(c.spec),
    covers = [];
  for (const style of Object.keys(visualPalettes)) {
    const plan = planPresentationVisuals(
        c.spec,
        { ...c.request.brief, visualStyle: style },
        c.sources,
      ),
      built = await buildStructuredPresentation(
        enc({
          title: c.spec.title,
          theme: {
            ...c.spec.theme,
            ...visualPalettes[style],
            headingFont: "Noto Sans SC",
            bodyFont: "Noto Sans SC",
          },
          slides: c.spec.slides.map((s) => s.content),
        }),
        {
          strictLayout: true,
          adaptiveDesigns: plan.designs,
          visual: {
            style,
            assets: c.sources.assets,
            logoAssetId: "asset-logo",
          },
        },
      );
    assert.deepEqual(checkPresentationObjects(built.resolvedObjects), []);
    assert.deepEqual(checkPresentationLayout(built.layout), []);
    const objs = built.adaptiveLayout.slides.flatMap((p) => p.elements),
      cover = objs.find(
        (o) =>
          o.slideId === "slide-01" &&
          o.kind === "image" &&
          o.data.assetId === "asset-test",
      );
    assert.ok(cover);
    covers.push([cover.x, cover.y, cover.w, cover.h]);
    assert.equal(objs.filter((o) => o.role === "brand-logo").length, 8);
    assert.ok(
      objs.find(
        (o) => o.slideId === "slide-02" && o.kind === "image" && !o.decorative,
      ),
    );
    const z = unzipSync(built.pptxBytes),
      slide2 = strFromU8(z["ppt/slides/slide2.xml"]);
    assert.match(slide2, /<p:pic>/);
    assert.match(slide2, /面向小型团队/);
    assert.doesNotMatch(slide2, /<a:srcRect/);
    assert.ok(
      Object.keys(z).some((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)),
    );
    assert.match(strFromU8(z["ppt/slides/slide5.xml"]), /<a:tbl>/);
    assert.match(strFromU8(z["ppt/notesSlides/notesSlide2.xml"]), /SHA256/);
  }
  assert.equal(new Set(covers.map((v) => JSON.stringify(v))).size, 3);
  assert.deepEqual(enc(c.spec), before);
});
test("evidence-image intersections are not hidden behind decorative exclusions", () => {
  const a = {
      slideId: "s",
      elementId: "shot",
      kind: "image",
      x: 1,
      y: 1,
      w: 4,
      h: 3,
      decorative: false,
    },
    b = {
      ...a,
      elementId: "mask",
      kind: "shape",
      decorative: true,
      x: 2,
      w: 1,
    };
  assert.ok(
    checkPresentationObjects([a, b]).some(
      (i) => i.code === "OBJECT_INTERSECTION",
    ),
  );
  assert.deepEqual(
    checkPresentationObjects([{ ...a, decorative: true }, b]),
    [],
  );
});
test(
  "checkpoint-backed actual PPTX/PDF/quality/visual-plan outputs do not leak raster binary or claim live generation",
  { timeout: 180000 },
  async () => {
    const c = await context(),
      hash = sha256(c.bytes),
      cp = {
        kind: "presentation",
        schemaVersion: 1,
        inputHash: hash,
        stage: "planned",
        spec: c.proposal,
        plannerModel: "synthetic-checkpoint-not-live-model",
      };
    const result = await createPresentation(
        {
          skillId: "slides.create",
          filename: "visual.json",
          bytes: c.bytes,
          owner: "m2-fixture",
          parameters: { externalConsent: "yes" },
          resumePresentation: cp,
        },
        () => {},
      ),
      get = (n) => {
        const o = result.outputs.find((x) => x.name === n);
        assert.ok(o, n);
        return o.bytes;
      },
      json = (n) => JSON.parse(Buffer.from(get(n)).toString());
    assert.equal(json("visual-plan.json").automaticImageGeneration, false);
    assert.equal(json("visual-plan.json").style, "consulting");
    assert.equal(json("presentation-spec.json").planner.callsThisExecution, 0);
    assert.equal(
      (await PDFDocument.load(get("draft-presentation.pdf"))).getPageCount(),
      8,
    );
    const quality = json("quality-report.json");
    assert.equal(
      quality.releaseStatus,
      "needs-human-review",
      JSON.stringify(quality.issues),
    );
    assert.equal(quality.commercialApproval, false);
    for (const o of result.outputs.filter((o) => o.name.endsWith(".json")))
      for (const a of c.sources.assets) {
        assert.ok(
          !Buffer.from(o.bytes).toString().includes(a.data),
          `${o.name} binary leak`,
        );
        assert.ok(
          !Object.hasOwn(json("sources-and-notes.json").assets[0], "data"),
        );
      }
  },
);
