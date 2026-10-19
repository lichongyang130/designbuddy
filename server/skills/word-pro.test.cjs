const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { unzipSync, strFromU8 } = require("fflate");
const sharp = require("sharp");
const B = "../../dist/local/";
const { wordExample } = require(B + "shared/wordDocument.js");
const { parseWord, contentHash, hash } = require(
  B + "server/skills/word-pro/schema.js",
);
const { generateWord, prepareImages } = require(
  B + "server/skills/word-pro/generate.js",
);
const { inspectWord, repairWord } = require(
  B + "server/skills/word-pro/inspect.js",
);
const { createWord } = require(B + "server/skills/word-pro/pipeline.js");
const enc = (d) => Buffer.from(JSON.stringify(d)),
  clone = (d) => structuredClone(d);
function fixture() {
  return wordExample();
}
function syntheticPages(d) {
  return [
    {
      page: 1,
      width: 595,
      height: 842,
      jpg: new Uint8Array(),
      sha256: "synthetic-only",
      items: [
        {
          text:
            require(B + "server/skills/word-pro/schema.js")
              .contentTexts(d)
              .map((x) => x.text)
              .join("") + "资料原文附录 / WORD PRO SOURCES",
          x: 60,
          y: 600,
          width: 450,
          height: 10,
        },
      ],
    },
  ];
}
test("word strict schema rejects unknown/code/remote fields, broken hierarchy, role omissions, unbound refs, duplicate IDs and oversized input", () => {
  const d = fixture();
  assert.equal(parseWord(enc(d)).documentType, "business-report");
  for (const mutate of [
    (x) => (x.code = "run()"),
    (x) => (x.documentType = "__proto__"),
    (x) => (x.blocks[0].refs = ["absent"]),
    (x) => (x.blocks[0].level = 2),
    (x) => (x.blocks[0].role = "unknown"),
    (x) => x.blocks.pop(),
    (x) => (x.blocks[1].id = x.blocks[0].id),
    (x) => (x.blocks[0].id = "word-pro-content"),
    (x) => (x.sources[0].url = "http://example.org"),
    (x) => (x.blocks[1].text = ""),
    (x) => (x.blocks[1].text = "a".repeat(4001)),
    (x) => (x.blocks[0].keepNext = "yes"),
  ]) {
    const x = clone(d);
    mutate(x);
    if (x.blocks.length === d.blocks.length - 1)
      x.blocks = x.blocks.filter((b) => b.role !== "recommendations");
    assert.throws(() => parseWord(enc(x)));
  }
  assert.throws(() => parseWord(new Uint8Array(2_000_001)));
  assert.throws(() =>
    parseWord(Buffer.from('{"schemaVersion":1,"__proto__":{}}')),
  );
});
test("two document types enforce different ordered required roles, real body after headings, and safe table/image contracts", () => {
  const p = wordExample("project-plan");
  assert.equal(parseWord(enc(p)).documentType, "project-plan");
  const x = clone(p);
  x.documentType = "business-report";
  assert.throws(() => parseWord(enc(x)));
  const d = fixture(),
    t = d.blocks.find((b) => b.type === "table");
  for (const change of [
    (v) => v.rows[0].pop(),
    (v) => (v.headers[1] = v.headers[0]),
    (v) => (v.widthsMm = [1, 90, 90]),
    (v) => (v.repeatHeader = "no"),
    (v) => (v.rows = Array(101).fill(["a", "b", "c"])),
  ]) {
    const a = clone(d);
    change(a.blocks.find((b) => b.type === "table"));
    assert.throws(() => parseWord(enc(a)));
  }
  const a = clone(d);
  a.blocks.splice(1, 0, {
    id: "empty-heading",
    type: "heading",
    level: 2,
    text: "只有标题",
    refs: ["source-1"],
  });
  assert.throws(() => parseWord(enc(a)));
});
test("native DOCX has real styles, headers, PAGE fields, internal links, native tables and inventory-checked escaped text", async () => {
  const d = fixture();
  d.blocks[1].text = "<script>not executed</script> & 原始12.50";
  const r = await generateWord(parseWord(enc(d)), {});
  const z = unzipSync(r.bytes),
    xml = strFromU8(z["word/document.xml"]);
  assert.match(xml, /&lt;script&gt;not executed/);
  assert.match(xml, /12\.50/);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /<w:tblHeader/);
  assert.match(xml, /w:anchor="summary"/);
  assert.match(xml, /w:keepNext/);
  assert.match(xml, /word-pro-source-appendix/);
  assert.match(strFromU8(z["word/styles.xml"]), /Noto Sans SC/);
  const foot = Object.keys(z)
    .filter((x) => /^word\/footer.*\.xml$/.test(x))
    .map((x) => strFromU8(z[x]))
    .join("");
  assert.match(foot, /NUMPAGES/);
  assert.match(foot, /PAGE/);
  assert.equal(r.nativeContentVerified, true);
  assert.equal(r.font.embeddedInDocx, false);
  assert.ok(!Object.keys(z).some((x) => x.includes("charts/")));
  assert.ok(
    !Object.keys(z).some(
      (x) =>
        x.endsWith(".rels") && /TargetMode="External"/.test(strFromU8(z[x])),
    ),
  );
});
test("repair only changes white-listed layout fields and keeps all content, strings, sources and image permissions hash-locked", () => {
  const d = fixture(),
    t = d.blocks.find((b) => b.type === "table");
  t.widthsMm = [90, 90, 90];
  t.repeatHeader = false;
  d.blocks[0].keepNext = false;
  t.rows[0][0] = "0012.50";
  const before = contentHash(d),
    q = inspectWord(d, syntheticPages(d), {}),
    r = repairWord(d, q.issues, {});
  assert.equal(r.actions.length, 3);
  assert.equal(contentHash(r.spec), before);
  assert.equal(d.blocks[0].keepNext, false);
  assert.equal(r.spec.blocks[0].keepNext, true);
  const table = r.spec.blocks.find((b) => b.type === "table");
  assert.ok(Math.abs(table.widthsMm.reduce((a, b) => a + b, 0) - 170) < 0.01);
  assert.ok(table.widthsMm.every((w) => w >= 12));
  assert.equal(table.rows[0][0], "0012.50");
  assert.equal(
    inspectWord(r.spec, syntheticPages(d), {}).issues.filter(
      (i) => i.autoRepair,
    ).length,
    0,
  );
});
test("PDF coverage does not count source appendix as body; unknown geometry/blank signals and scores never become visual or commercial approval", () => {
  const d = fixture(),
    pages = syntheticPages(d);
  let q = inspectWord(d, pages, {});
  assert.equal(q.checks.pdfTextCoverage.status, "passed");
  pages[0].items[0].text =
    "资料原文附录 / WORD PRO SOURCES" + d.sources[0].text;
  q = inspectWord(d, pages, {});
  assert.equal(q.checks.pdfTextCoverage.status, "unresolved");
  assert.ok(q.issues.some((i) => i.type === "pdf-text-unresolved"));
  assert.equal(q.commercialApproval, false);
  assert.equal(q.score.weightedScore, null);
  assert.equal(q.checks.renderedVisualReview.status, "required");
  assert.equal(q.checks.targetWordCompatibility.status, "not-evaluated");
  const empty = { ...pages[0], items: [] };
  q = inspectWord(d, [empty], {});
  assert.ok(
    q.issues.some((i) => i.type === "blank-page-candidate" && !i.autoRepair),
  );
  assert.equal(repairWord(d, q.issues, {}).actions.length, 0);
});
test("authorized images are normalized and embedded independently; oversized frames scale proportionally without cropping or content edits", async () => {
  const d = fixture(),
    png = await sharp({
      create: { width: 120, height: 240, channels: 3, background: "#29664c" },
    })
      .png()
      .toBuffer();
  const image = {
    id: "photo",
    type: "image",
    refs: ["source-1"],
    caption: "原创测试色块",
    alt: "不是业务证据",
    filename: "fixture.png",
    base64: png.toString("base64"),
    license: "原创测试素材，本次使用",
    permissionConfirmed: true,
    usage: "evidence",
    widthMm: 150,
  };
  d.blocks.push(image);
  parseWord(enc(d));
  const assets = await prepareImages(d),
    q = inspectWord(d, syntheticPages(d), assets),
    r = repairWord(d, q.issues, assets);
  assert.ok(
    r.actions.some((a) => a.action === "scale-complete-image-proportionally"),
  );
  assert.equal(r.spec.blocks.at(-1).widthMm, 105);
  assert.equal(contentHash(r.spec), contentHash(d));
  const g = await generateWord(r.spec, assets),
    z = unzipSync(g.bytes);
  assert.ok(Object.keys(z).some((x) => /^word\/media\/.*\.png$/.test(x)));
  assert.doesNotMatch(
    strFromU8(z["word/document.xml"]),
    /srcRect[^>]*\s[ltbr]="[1-9][0-9]*"/,
  );
  const bad = clone(d);
  bad.blocks.at(-1).permissionConfirmed = false;
  assert.throws(() => parseWord(enc(bad)));
  bad.blocks.at(-1).permissionConfirmed = true;
  bad.blocks.at(-1).base64 = Buffer.from("<svg/>").toString("base64");
  await assert.rejects(() => prepareImages(bad));
});
test("missing glyphs and corrupt image formats fail before delivery, never substituted with fake content", async () => {
  const d = fixture();
  d.blocks[1].text = "缺字测试：\u{10ffff}";
  await assert.rejects(() => generateWord(d, {}), /缺字/);
  const bad = fixture();
  bad.blocks.push({
    id: "bad",
    type: "image",
    refs: ["source-1"],
    caption: "坏图",
    alt: "坏图",
    filename: "a.png",
    base64: Buffer.from("not a png").toString("base64"),
    license: "自有",
    permissionConfirmed: true,
    usage: "decorative",
  });
  await assert.rejects(() => prepareImages(parseWord(enc(bad))));
});
test("actual local two-render repair produces hash-bound DOCX/PDF/all pages and pre/post evidence with no external AI calls", async () => {
  const d = fixture(),
    t = d.blocks.find((b) => b.type === "table");
  t.widthsMm = [90, 90, 90];
  t.repeatHeader = false;
  d.blocks[0].keepNext = false;
  const events = [],
    r = await createWord(
      { skillId: "document.create", filename: "word.json", bytes: enc(d) },
      (m) => events.push(m),
    ),
    get = (n) => r.outputs.find((o) => o.name === n).bytes;
  const q = JSON.parse(Buffer.from(get("word-quality-report.json"))),
    zip = unzipSync(get("word-delivery.zip"));
  assert.equal(q.repairRounds.length, 2);
  assert.equal(q.repairRounds[0].actions.length, 3);
  assert.equal(q.contentPreserved, true);
  assert.equal(q.finalDocxSHA256, hash(get("document.docx")));
  assert.equal(q.finalPdfSHA256, hash(get("document.pdf")));
  assert.equal(q.finalDocxSHA256, q.renderer.sourceSHA256);
  assert.equal(q.issues.filter((i) => i.severity === "critical").length, 0);
  assert.equal(q.checks.pdfTextCoverage.status, "passed");
  assert.equal(q.renderer.rasterEngine, "libreoffice");
  assert.equal(q.commercialApproval, false);
  assert.ok(q.renderer.pageCount >= 3);
  for (const p of q.renderer.pages) {
    assert.equal(hash(zip[p.file]), p.sha256);
    assert.equal((await sharp(zip[p.file]).metadata()).format, "jpeg");
  }
  for (const rr of q.repairRounds) {
    assert.equal(
      hash(zip[`iterations/${rr.round}/document.docx`]),
      rr.docxSHA256,
    );
    assert.equal(
      hash(zip[`iterations/${rr.round}/document.pdf`]),
      rr.pdfSHA256,
    );
    assert.equal(rr.contentHash, q.contentHash);
  }
  assert.ok(events.some((s) => s.includes("修复")));
  assert.equal(
    r.outputs.reduce((n, o) => n + o.bytes.length, 0) < 10_000_000,
    true,
  );
});
test("registered real Worker persists artifacts, requires upload consent, enforces owner isolation and rejects arbitrary parameters/resume", async (t) => {
  const { SkillService } = require(B + "server/skills/service.js"),
    { validateSkillOptions } = require(B + "server/skills/contracts.js"),
    { skillPermissions } = require(B + "server/skills/skill-permissions.js");
  const s = new SkillService(":memory:");
  t.after(() => s.close());
  assert.deepEqual(skillPermissions("document.create"), [
    "local.read",
    "local.write",
    "subprocess",
  ]);
  assert.throws(() =>
    validateSkillOptions("document.create", {
      deduplicate: false,
      parameters: { apiKey: "never-accepted" },
    }),
  );
  const upload = (consent) => {
    const f = new FormData();
    f.set("skillId", "document.create");
    f.set("expertId", "documents");
    f.set("consent", String(consent));
    f.set("deduplicate", "false");
    f.set("file", new File([enc(wordExample("project-plan"))], "word.json"));
    return new Request("http://local/api/skill-runs", {
      method: "POST",
      body: f,
    });
  };
  assert.equal((await s.handle(upload(false), "alice")).status, 403);
  const response = await s.handle(upload(true), "alice");
  assert.equal(response.status, 202);
  const first = await response.json();
  let run;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    run = await (
      await s.handle(
        new Request(`http://local/api/skill-runs/${first.id}`),
        "alice",
      )
    ).json();
    if (!["running", "queued"].includes(run.status)) break;
    await new Promise((r) => setTimeout(r, 30));
  }
  assert.equal(run.status, "succeeded", run.error);
  assert.ok(run.artifacts.some((a) => a.name === "document.pdf"));
  const a = run.artifacts.find((a) => a.name === "word-quality-report.json"),
    url = `http://local/api/skill-runs/${run.id}/artifacts/${a.id}`;
  assert.equal((await s.handle(new Request(url), "bob")).status, 404);
  const actual = await s.handle(new Request(url), "alice");
  assert.equal(actual.status, 200);
  const q = await actual.json();
  assert.equal(q.commercialApproval, false);
  assert.equal(q.contentPreserved, true);
  assert.equal(
    (
      await s.handle(
        new Request(`http://local/api/skill-runs/${run.id}`),
        "bob",
      )
    ).status,
    404,
  );
});
test("bounded orchestration unit mock stops at three renders/two repairs, never rewrites facts or grants a score", async () => {
  const renderer = require(B + "server/skills/word-pro/render.js"),
    inspector = require(B + "server/skills/word-pro/inspect.js");
  const oldRender = renderer.renderWord,
    oldInspect = inspector.inspectWord;
  const d = fixture();
  d.blocks[0].keepNext = false;
  const png = await sharp({
    create: { width: 80, height: 110, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  let calls = 0;
  try {
    renderer.renderWord = async (bytes) => {
      calls++;
      return {
        pdf: Buffer.from("%PDF-unit-control-mock"),
        pages: [{ ...syntheticPages(d)[0], jpg: png, sha256: hash(png) }],
        receipt: {
          sourceSHA256: hash(bytes),
          pdfSHA256: hash("%PDF-unit-control-mock"),
          missingFonts: [],
          pageCount: 1,
          pages: [],
          backend: "unit-mock",
        },
      };
    };
    inspector.inspectWord = (spec, pages, images) => {
      const q = oldInspect(spec, pages, images);
      q.issues = [
        {
          id: "forced-protection",
          type: "heading-protection-disabled",
          nodeId: spec.blocks[0].id,
          severity: "warning",
          page: null,
          method: "unit-control-mock",
          autoRepair: true,
          message: "Synthetic persistent issue",
        },
      ];
      return q;
    };
    const r = await createWord({
      skillId: "document.create",
      filename: "word.json",
      bytes: enc(d),
    });
    const q = JSON.parse(
      Buffer.from(
        r.outputs.find((o) => o.name === "word-quality-report.json").bytes,
      ),
    );
    assert.equal(calls, 3);
    assert.equal(q.repairRounds.length, 3);
    assert.equal(q.repairRounds[2].actions.length, 0);
    assert.equal(q.contentHash, contentHash(d));
    assert.equal(q.score.weightedScore, null);
    assert.equal(q.commercialApproval, false);
    assert.ok(q.issues.length);
  } finally {
    renderer.renderWord = oldRender;
    inspector.inspectWord = oldInspect;
  }
});
test("orchestration unit mock rolls back a repair that introduces a new critical issue, retaining prior version and full evidence", async () => {
  const renderer = require(B + "server/skills/word-pro/render.js"),
    inspector = require(B + "server/skills/word-pro/inspect.js");
  const oldRender = renderer.renderWord,
    oldInspect = inspector.inspectWord;
  const d = fixture();
  d.blocks[0].keepNext = false;
  const jpg = await sharp({
    create: { width: 80, height: 110, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  let calls = 0;
  try {
    renderer.renderWord = async (bytes) => {
      calls++;
      return {
        pdf: Buffer.from("%PDF-unit-" + calls),
        pages: [{ ...syntheticPages(d)[0], jpg, sha256: hash(jpg) }],
        receipt: {
          sourceSHA256: hash(bytes),
          pdfSHA256: hash("%PDF-unit-" + calls),
          missingFonts: [],
          pageCount: 1,
          pages: [],
          backend: "unit-mock",
        },
      };
    };
    inspector.inspectWord = (spec, pages, images) => {
      const q = oldInspect(spec, pages, images);
      if (calls === 2)
        q.issues.push({
          id: "new-critical",
          type: "mock-font-failure",
          nodeId: null,
          severity: "critical",
          page: 1,
          method: "unit-control-mock",
          autoRepair: false,
          message: "Synthetic regression",
        });
      return q;
    };
    const r = await createWord({
        skillId: "document.create",
        filename: "word.json",
        bytes: enc(d),
      }),
      q = JSON.parse(
        Buffer.from(
          r.outputs.find((o) => o.name === "word-quality-report.json").bytes,
        ),
      );
    assert.equal(calls, 2);
    assert.equal(q.repairRounds[1].rolledBack, true);
    assert.equal(q.finalDocxSHA256, q.repairRounds[0].docxSHA256);
    assert.equal(q.finalPdfSHA256, q.repairRounds[0].pdfSHA256);
    assert.ok(q.issues.some((i) => i.type === "heading-protection-disabled"));
    assert.equal(q.commercialApproval, false);
  } finally {
    renderer.renderWord = oldRender;
    inspector.inspectWord = oldInspect;
  }
});
