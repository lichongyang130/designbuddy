const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { unzipSync, strFromU8 } = require("fflate"),
  { PDFDocument } = require("pdf-lib");
const base = path.join(
    __dirname,
    "../apps/web/public/presentation-examples/content-director",
  ),
  read = (n) => fs.readFileSync(path.join(base, n)),
  json = (n) => JSON.parse(read(n)),
  sha = (b) => createHash("sha256").update(b).digest("hex"),
  original = require("../apps/web/public/presentation-examples/leader-decision/adaptive/presentation-spec.json");
test("same historical content, notes, exact bindings, sources, titles and page sequence are locked under the director", () => {
  const s = json("presentation-spec.json").spec,
    plan = json("direction-plan.json"),
    cmp = json("comparison.json");
  assert.deepEqual(s.slides, original.spec.slides);
  assert.equal(plan.pages.length, 12);
  assert.equal(plan.bodyDataNotesHash, cmp.lockedHash);
  assert.equal(
    plan.bodyDataNotesHash,
    sha(
      JSON.stringify(
        original.spec.slides.map((s) => ({
          content: s.content,
          bindings: s.bindings,
          sourceRefs: s.sourceRefs,
        })),
      ),
    ),
  );
  assert.equal(plan.externalProviderCalls, 0);
  assert.match(plan.origin, /NOT live/);
  for (let i = 0; i < 12; i++) {
    assert.equal(plan.pages[i].message, s.slides[i].content.title);
    assert.ok(
      plan.pages[i].evidenceRefs.every((r) =>
        s.slides[i].sourceRefs.includes(r),
      ),
    );
    assert.equal(plan.pages[i].relationshipSemanticsVerified, false);
  }
  assert.equal(cmp.samePageCount, true);
});
test("native explanations retain every original point and do not flatten slides or invent causal/order claims", () => {
  const layout = json("resolved-layout.json"),
    z = unzipSync(read("presentation.pptx")),
    plan = json("direction-plan.json"),
    s = json("presentation-spec.json").spec;
  for (const [i, id] of [
    [1, "message-focus"],
    [6, "native-structure"],
    [9, "connected-gates"],
    [10, "decision-criteria"],
    [11, "decision-criteria"],
  ])
    assert.equal(layout.slides[i].layoutId, id);
  for (const i of [1, 6, 10, 11]) {
    const text = layout.textElements
      .filter((x) => x.slideId === `slide-${String(i + 1).padStart(2, "0")}`)
      .map((x) => x.text);
    for (const b of s.slides[i].content.bullets) assert.ok(text.includes(b), b);
    assert.doesNotMatch(
      strFromU8(z[`ppt/slides/slide${i + 1}.xml`]),
      /<p:pic>/,
    );
  }
  assert.match(strFromU8(z["ppt/slides/slide7.xml"]), /ellipse/);
  assert.doesNotMatch(strFromU8(z["ppt/slides/slide7.xml"]), /chevron/);
  assert.match(strFromU8(z["ppt/slides/slide10.xml"]), /chevron/);
  assert.equal(plan.pages[9].sequence.basis, "proposal");
  assert.match(
    strFromU8(z["ppt/slides/slide11.xml"]),
    /空框不表示条件已经满足/,
  );
  assert.ok(Object.keys(z).some((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)));
  assert.match(strFromU8(z["ppt/slides/slide8.xml"]), /<a:tbl>/);
  assert.equal(layout.directionEngineVersion, "director-1.0.0");
});
test("actual 12-page PDF and all-page rasters preserve text, with no critical quality issue or commercial approval", async () => {
  assert.equal(
    (await PDFDocument.load(read("presentation.pdf"))).getPageCount(),
    12,
  );
  const q = json("quality-report.json");
  assert.equal(q.releaseStatus, "needs-human-review");
  assert.equal(q.issues.filter((x) => x.severity === "critical").length, 0);
  assert.equal(q.commercialApproval, false);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"),
    loading = pdfjs.getDocument({
      data: new Uint8Array(read("presentation.pdf")),
      isEvalSupported: false,
      useSystemFonts: false,
    }),
    doc = await loading.promise;
  try {
    for (let i = 0; i < 12; i++) {
      assert.ok(
        read(`slides/${String(i + 1).padStart(2, "0")}.jpg`).length > 1000,
      );
      const p = await doc.getPage(i + 1),
        txt = (await p.getTextContent()).items
          .map((x) => x.str || "")
          .join("")
          .replace(/\s/g, ""),
        s = original.spec.slides[i].content;
      assert.ok(txt.includes(s.title.replace(/\s/g, "")), s.title);
      for (const b of s.bullets || [])
        assert.ok(txt.includes(b.replace(/\s/g, "")), b);
    }
  } finally {
    await loading.destroy();
  }
});
test("complete hashed evidence package includes task sheets, rhythm, source snapshots and native outputs", () => {
  for (const f of json("manifest.json").files) {
    assert.equal(read(f.name).length, f.bytes);
    assert.equal(sha(read(f.name)), f.sha256, f.name);
  }
  const zip = unzipSync(read("presentation-package.zip"));
  for (const n of [
    "direction-plan.json",
    "visual-plan.json",
    "presentation.pptx",
    "presentation.pdf",
    "sources-and-notes.json",
    "comparison.json",
  ])
    assert.ok(zip[n], n);
  const plan = json("direction-plan.json");
  assert.equal(plan.rhythm.length, 12);
  assert.ok(
    plan.pages.every((p) => p.reason && p.boundary && p.evidenceRefs.length),
  );
  assert.ok(new Set(plan.rhythm.map((p) => p.pace)).size === 3);
  assert.ok(json("report.json").sourceBlocks.length > 0);
});
