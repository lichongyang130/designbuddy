const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { unzipSync, strFromU8 } = require("fflate"),
  { PDFDocument } = require("pdf-lib"),
  sharp = require("sharp");
const base = path.join(
    __dirname,
    "../apps/web/public/presentation-examples/visual-directions",
  ),
  original = require("../apps/web/public/presentation-examples/leader-decision/adaptive/presentation-spec.json");
const read = (style, n) => fs.readFileSync(path.join(base, style, n)),
  json = (style, n) => JSON.parse(read(style, n)),
  sha = (b) => createHash("sha256").update(b).digest("hex");
for (const style of ["consulting", "technology-launch", "brand-editorial"])
  test(`actual M2 ${style}: 12-page same-content native/PDF, full evidence raster, complete artifact hashes`, async () => {
    const spec = json(style, "presentation-spec.json").spec,
      report = json(style, "report.json"),
      quality = json(style, "quality-report.json"),
      plan = json(style, "visual-plan.json");
    assert.deepEqual(
      spec.slides.map((s) => s.content),
      original.spec.slides.map((s) => s.content),
    );
    assert.deepEqual(
      spec.slides.map((s) => s.bindings),
      original.spec.slides.map((s) => s.bindings),
    );
    assert.equal(report.externalTextPlanningCalls, 0);
    assert.equal(report.automaticAppImageCalls, 0);
    assert.equal(report.qualitySummary.commercialApproval, false);
    assert.equal(quality.releaseStatus, "needs-human-review");
    assert.equal(
      quality.issues.filter((i) => i.severity === "critical").length,
      0,
    );
    assert.match(plan.imageUnderstanding, /no OCR/);
    assert.equal(
      (await PDFDocument.load(read(style, "presentation.pdf"))).getPageCount(),
      12,
    );
    for (const f of json(style, "manifest.json").files) {
      const bytes = read(style, f.name);
      assert.equal(bytes.length, f.bytes, f.name);
      assert.equal(sha(bytes), f.sha256, f.name);
    }
    const z = unzipSync(read(style, "presentation.pptx"));
    assert.equal(
      Object.keys(z).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .length,
      12,
    );
    assert.ok(
      Object.keys(z).some((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)),
    );
    assert.match(strFromU8(z["ppt/slides/slide6.xml"]), /<a:tbl>/);
    for (let i = 1; i <= 12; i++) {
      const xml = strFromU8(z[`ppt/slides/slide${i}.xml`]);
      assert.match(xml, /<a:t>/);
      assert.ok(
        read(style, `slides/${String(i).padStart(2, "0")}.jpg`).length > 1000,
      );
    }
    const slide11 = strFromU8(z["ppt/slides/slide11.xml"]);
    assert.doesNotMatch(slide11, /<a:srcRect/);
    const shot = (slide11.match(/<p:pic>.*?<\/p:pic>/g) || []).find((x) =>
      x.includes("历史V2第04页完整截图"),
    );
    assert.ok(shot);
    const ext = shot.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    assert.ok(ext);
    const a = plan.assets.find((a) => a.id === "asset-screenshot");
    assert.ok(
      Math.abs(Number(ext[1]) / Number(ext[2]) - a.width / a.height) < 0.00001,
    );
    assert.equal(sha(read(style, "assets/asset-screenshot.png")), a.sha256);
    const m = await sharp(
      read(style, "assets/asset-screenshot.png"),
    ).metadata();
    assert.equal(m.width, 960);
    assert.equal(m.height, 540);
    assert.equal(m.exif, undefined);
    const decoded = await sharp(
      fs.readFileSync(
        path.join(
          __dirname,
          "../apps/web/public/presentation-examples/leader-decision/adaptive/slides/04.jpg",
        ),
      ),
    )
      .raw()
      .toBuffer();
    assert.deepEqual(
      await sharp(read(style, "assets/asset-screenshot.png")).raw().toBuffer(),
      decoded,
    );
    for (const a of plan.assets) {
      assert.equal(a.permissionConfirmed, true);
      assert.equal(sha(read(style, `assets/${a.id}.png`)), a.sha256);
      assert.ok(!Object.hasOwn(a, "data"));
    }
    const zip = unzipSync(read(style, "presentation-package.zip"));
    assert.ok(zip["visual-plan.json"]);
    assert.ok(zip["presentation.pptx"]);
    assert.ok(zip["presentation.pdf"]);
  });
test("three real cover geometries, stable factual content hash and historical baseline untouched", () => {
  const index = JSON.parse(fs.readFileSync(path.join(base, "index.json"))),
    positions = [];
  assert.equal(index.styles.length, 3);
  assert.equal(new Set(index.styles.map((s) => s.semanticContentHash)).size, 1);
  assert.equal(index.baselineVersionId, original.versionId);
  for (const s of index.styles) {
    const layout = json(s.id, "resolved-layout.json"),
      hero = layout.slides[0].elements.find((e) => e.role === "hero");
    assert.ok(hero);
    positions.push([hero.x, hero.y, hero.w, hero.h]);
    assert.equal(layout.visualEngineVersion, "visual-1.0.0");
    assert.equal(layout.visualStyle, s.id);
  }
  assert.equal(new Set(positions.map((v) => JSON.stringify(v))).size, 3);
});
