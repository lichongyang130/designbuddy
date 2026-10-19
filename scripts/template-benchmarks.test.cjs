const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { unzipSync, strFromU8 } = require("fflate");
const m = require("../dist/local/shared/commercialTemplates.js"),
  e = require("../dist/local/shared/commercialExports.js");
const dir = path.resolve(__dirname, "../apps/web/public/template-benchmarks");
test("inventory distinguishes 54 display entries from 130 catalog descriptions", () => {
  const a = require("../apps/web/public/template-benchmarks/readiness.json");
  assert.equal(a.registered.length, 54);
  assert.equal(new Set(a.registered.map((x) => x.id)).size, 54);
  assert.equal(a.catalog.length, 130);
  assert.equal(a.summary.uniquePageNameSequences, 1);
  assert.equal(new Set(m.benchmarkTemplates.map((t) => t.category)).size, 9);
  assert.equal(m.newBenchmarkIds.length, 8);
});
test("state restoration rejects malicious/invalid collections and scalar bounds", () => {
  for (const id of m.newBenchmarkIds) {
    const s = m.restoreBenchmark(id, {
      title: "x",
      accent: "red",
      page: 999,
      hours: [-1, NaN, Infinity],
      rates: [2],
      tax: -1,
      width: 999,
      edits: ["bad"],
      volume: 70,
    });
    assert.equal(s.title, "x");
    assert.equal(s.page, 0);
    assert.equal(s.accent, m.initialBenchmark(id).accent);
    assert.deepEqual(s.hours, [24, 48, 16]);
    assert.equal(s.tax, 6);
    assert.equal(s.width, 80);
    assert.equal(s.volume, 25);
    assert.equal(s.edits.length, m.pagesFor(id).length);
  }
});
test("cost model follows exact cent-based order and independent stress scenario", () => {
  const s = m.initialBenchmark("pro-cost"),
    c = m.costBreakdown(s);
  assert.equal(c.labor, 1840000);
  assert.equal(c.base, 2040000);
  assert.equal(c.reserve, 204000);
  assert.equal(c.tax, 134640);
  assert.equal(c.total, 2378640);
  assert.ok(m.costBreakdown(s, 1.2).total > c.total);
  const z = { ...s, hours: [0, 0, 0], rates: [0, 0, 0], external: 0 };
  assert.equal(m.costBreakdown(z).total, 0);
});
test("five cue WAVs contain distinct nonclipped PCM with truthful headers", () => {
  const hashes = new Set();
  for (let i = 0; i < 5; i++) {
    const b = e.cueWav(i, 60);
    assert.equal(Buffer.from(b.slice(0, 4)).toString(), "RIFF");
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    assert.equal(v.getUint32(24, true), 22050);
    assert.equal(v.getUint16(22, true), 1);
    assert.equal(v.getUint16(34, true), 16);
    assert.equal(v.getUint32(40, true), b.length - 44);
    const { pcm } = e.cuePCM(i, 60);
    assert.ok(pcm.some((x) => Math.abs(x) > 0.01));
    assert.ok(pcm.every((x) => Math.abs(x) < 0.95));
    hashes.add(crypto.createHash("sha256").update(b).digest("hex"));
  }
  assert.equal(hashes.size, 5);
});
test("HTML and SVG exports escape user input, source geometry is finite and indexed", () => {
  const s = {
    ...m.initialBenchmark("pro-launch"),
    title: "<script>alert(1)</script>",
    subtitle: "</script><img onerror=alert(1)>",
    edits: [
      "</script><img onerror=alert(1)>",
      ...m.initialBenchmark("pro-launch").edits.slice(1),
    ],
  };
  assert.ok(!e.campaignSvg(s).includes("<script>"));
  assert.ok(e.guideHtml(s).includes("\\u003c"));
  assert.ok(!e.guideHtml(s).includes("</script><img"));
  for (const [w, h] of [
    [40, 30],
    [80, 55],
    [140, 100],
  ]) {
    const g = e.configurationGeometry(w, h);
    assert.equal(g.positions.length, g.normals.length);
    assert.ok(g.positions.every(Number.isFinite));
    assert.equal(
      g.obj.split("\n").filter((x) => x.startsWith("v ")).length,
      40,
    );
    assert.equal(
      g.obj.split("\n").filter((x) => x.startsWith("f ")).length,
      30,
    );
  }
});
test("all committed generated asset hashes and lengths match", () => {
  const a = require("../apps/web/public/template-benchmarks/assets-manifest.json");
  for (const f of a.files) {
    const b = fs.readFileSync(path.join(dir, f.file));
    assert.equal(b.length, f.bytes, f.file);
    assert.equal(
      crypto.createHash("sha256").update(b).digest("hex"),
      f.sha256,
      f.file,
    );
  }
  assert.equal(a.externalCalls, false);
  assert.equal(a.commercialApproval, false);
});
test("native original PPTX has ten slides, notes and editable objects; PDF count matches", async () => {
  const { PDFDocument } = require("pdf-lib"),
    zip = unzipSync(
      fs.readFileSync(path.join(dir, "pro-review/original.pptx")),
    );
  const slides = Object.keys(zip).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n),
  );
  assert.equal(slides.length, 10);
  assert.equal(
    Object.keys(zip).filter((n) =>
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n),
    ).length,
    10,
  );
  assert.match(strFromU8(zip["ppt/slides/slide3.xml"]), /<a:tbl>/);
  const pdf = await PDFDocument.load(
    fs.readFileSync(path.join(dir, "pro-review/original.pdf")),
  );
  assert.equal(pdf.getPageCount(), 10);
  for (let i = 1; i <= 10; i++)
    assert.ok(
      fs.statSync(
        path.join(dir, `pro-review/pages/${String(i).padStart(2, "0")}.jpg`),
      ).size > 1000,
    );
});
test("Word DOCX and same-source PDF preserve all eight substantive sections", async () => {
  const { PDFDocument } = require("pdf-lib"),
    zip = unzipSync(
      fs.readFileSync(path.join(dir, "pro-project/original.docx")),
    ),
    xml = strFromU8(zip["word/document.xml"]);
  for (const p of m.projectPages) {
    assert.ok(xml.includes(p.title), p.title);
    for (const text of p.points) assert.ok(xml.includes(text), text);
  }
  assert.match(xml, /<w:tbl>/);
  const metadata = require("../apps/web/public/template-benchmarks/pro-project/original-metadata.json"),
    q = require("../apps/web/public/template-benchmarks/pro-project/word-quality-report.json");
  const pdf = await PDFDocument.load(
    fs.readFileSync(path.join(dir, "pro-project/original.pdf")),
  );
  assert.equal(pdf.getPageCount(), metadata.pageCount);
  assert.equal(q.contentPreserved, true);
  assert.equal(q.issues.filter((x) => x.severity === "critical").length, 0);
  assert.equal(q.commercialApproval, false);
});

test("encoded video decodes without errors with the configured local FFmpeg", () => {
  const { spawnSync } = require("node:child_process");
  const config = path.resolve(__dirname, "../.cache/ffmpeg-path.txt");
  const ffmpeg =
    process.env.FFMPEG_PATH ||
    (fs.existsSync(config) ? fs.readFileSync(config, "utf8").trim() : "ffmpeg");
  const r = spawnSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      path.join(dir, "pro-film/original.mp4"),
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(r.status, 0, r.stderr || String(r.error));
});

test("offline HTML carries a local CJK font and its complete redistribution license", () => {
  for (const p of [
    "pro-tour/guide.html",
    "pro-cost/estimate.html",
    "pro-config/configurator.html",
  ]) {
    const html = fs.readFileSync(path.join(dir, p), "utf8");
    assert.match(html, /data:font\/woff2;base64,/);
    assert.match(html, /SIL OPEN FONT LICENSE Version 1.1/);
    assert.match(html, /Google Inc./);
    assert.match(html, /Copyright 2014-2021 Adobe/);
    assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  }
  const svg = e.offlineSvg(
    e.campaignSvg(m.initialBenchmark("pro-launch"), 0),
    "data:font/woff2;base64,AA==",
  );
  assert.match(svg, /<style>.*SIL OPEN FONT LICENSE/s);
  assert.match(svg, /Benchmark CJK/);
  assert.throws(() =>
    e.offlineHtml("<style></style>", "https://unapproved.invalid/font.woff2"),
  );
});
