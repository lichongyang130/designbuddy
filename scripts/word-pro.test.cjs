const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { unzipSync, strFromU8 } = require("fflate");
const { PDFDocument } = require("pdf-lib");
const root = path.join(__dirname, "../apps/web/public/word-examples/word-pro"),
  sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = (type, name) => fs.readFileSync(path.join(root, type, name)),
  json = (type, name) => JSON.parse(read(type, name));
test("Word public cases have complete actual file/hash inventories, full pages and honest authored/approval labels", () => {
  for (const type of ["business-report", "project-plan"]) {
    const m = json(type, "manifest.json"),
      q = json(type, "word-quality-report.json");
    assert.equal(m.pageCount, q.renderer.pageCount);
    assert.equal(m.commercialApproval, false);
    assert.match(m.planningOrigin, /assistant-authored/);
    for (const f of m.files) {
      const b = read(type, f.file);
      assert.equal(b.length, f.bytes, f.file);
      assert.equal(sha(b), f.sha256, f.file);
    }
    assert.equal(q.finalDocxSHA256, sha(read(type, "document.docx")));
    assert.equal(q.finalPdfSHA256, sha(read(type, "document.pdf")));
    assert.equal(q.finalDocxSHA256, q.renderer.sourceSHA256);
    assert.equal(
      fs.readdirSync(path.join(root, type, "pages")).length,
      q.renderer.pageCount,
    );
    assert.equal(q.renderer.pages.length, q.renderer.pageCount);
  }
});
test("Word case native OOXML contains styles, internal navigation, PAGE fields, editable tables and separate illustration rather than flattened pages", () => {
  for (const type of ["business-report", "project-plan"]) {
    const z = unzipSync(read(type, "document.docx")),
      x = strFromU8(z["word/document.xml"]);
    assert.match(x, /<w:tbl>/);
    assert.match(x, /w:tblHeader/);
    assert.match(x, /w:anchor=/);
    assert.match(x, /word-pro-source-appendix/);
    assert.match(strFromU8(z["word/styles.xml"]), /Noto Sans SC/);
    assert.ok(Object.keys(z).some((k) => /^word\/header/.test(k)));
    assert.ok(Object.keys(z).some((k) => /^word\/footer/.test(k)));
    if (type === "business-report")
      assert.ok(Object.keys(z).some((k) => /^word\/media\/.+\.png$/.test(k)));
    assert.ok(!Object.keys(z).some((k) => k.includes("/embeddings/")));
  }
});
test("repair evidence retains actual pre/post files, stable content/source bindings, bounded rounds and no fake quality score", () => {
  const {
    parseWord,
    contentHash,
  } = require("../dist/local/server/skills/word-pro/schema.js");
  for (const type of ["business-report", "project-plan"]) {
    const q = json(type, "word-quality-report.json"),
      zip = unzipSync(read(type, "word-delivery.zip")),
      spec = json(type, "word-spec.json");
    assert.equal(q.commercialApproval, false);
    assert.equal(q.releaseStatus, "needs-human-review");
    assert.equal(q.score.weightedScore, null);
    assert.equal(q.repairPolicy.maxRepairRounds, 2);
    assert.equal(q.issues.filter((i) => i.severity === "critical").length, 0);
    assert.equal(q.checks.pdfTextCoverage.status, "passed");
    assert.equal(
      q.contentHash,
      contentHash(parseWord(read(type, "input.json"))),
    );
    assert.equal(contentHash(spec), q.contentHash);
    assert.ok(
      json(type, "content-manifest.json").sourceBindings.every(
        (b) => b.refs.length,
      ),
    );
    for (const r of q.repairRounds) {
      assert.equal(r.contentHash, q.contentHash);
      assert.equal(
        sha(zip[`iterations/${r.round}/document.docx`]),
        r.docxSHA256,
      );
      assert.equal(sha(zip[`iterations/${r.round}/document.pdf`]), r.pdfSHA256);
    }
    assert.equal(sha(zip["document.docx"]), q.finalDocxSHA256);
    assert.equal(sha(zip["document.pdf"]), q.finalPdfSHA256);
    if (type === "business-report") {
      assert.equal(q.repairRounds.length, 2);
      assert.equal(q.repairRounds[0].actions.length, 3);
    } else assert.equal(q.repairRounds.length, 1);
  }
});
test("actual Word PDFs reopen with matching physical page counts and extractable Chinese titles/body; figures are not claimed as native charts", async () => {
  const { extractPDF } = require("../dist/local/server/skills/pdf.js");
  for (const type of ["business-report", "project-plan"]) {
    const b = read(type, "document.pdf"),
      pdf = await PDFDocument.load(b),
      q = json(type, "word-quality-report.json");
    assert.equal(pdf.getPageCount(), q.renderer.pageCount);
    const pages = await extractPDF(b),
      text = pages
        .map((p) => p.text)
        .join("")
        .replace(/\s/g, "");
    assert.ok(text.includes(json(type, "input.json").title));
    assert.ok(text.includes("资料原文附录"));
    assert.ok(
      text.includes(type === "business-report" ? "建议与行动" : "验收条件"),
    );
    assert.equal(q.renderer.microsoftWordVerified, false);
    assert.equal(q.font.embeddedInDocx, false);
  }
});
