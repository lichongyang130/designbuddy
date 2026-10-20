const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  skillProducts,
  productForSkill,
  migrateSkillFavorites,
  productSearch,
  maintenanceSkillIds,
} = require("../../dist/local/shared/skillProducts.js");
const { runtimeSkills } = require("../../dist/local/shared/skillRuntime.js");
const {
  builtinWorkflows,
  evaluateWorkflowQuality,
} = require("../../dist/local/server/api/workflows.js");
test("8 outcomes own all 49 executor IDs exactly once, without creating executors", () => {
  assert.equal(skillProducts.length, 8);
  assert.equal(new Set(skillProducts.map((p) => p.id)).size, 8);
  const mapped = skillProducts.flatMap((p) => p.skillIds);
  assert.equal(mapped.length, 49);
  assert.equal(new Set(mapped).size, 49);
  assert.deepEqual([...mapped].sort(), runtimeSkills.map((s) => s.id).sort());
  assert.deepEqual(maintenanceSkillIds, ["code.build"]);
  for (const product of skillProducts) {
    assert.ok(product.boundary.length > 30);
    const workflowId = product.primary.startsWith("workflow:")
      ? product.primary.slice(9)
      : undefined;
    assert.ok(
      workflowId
        ? product.workflows.some((w) => w.id === workflowId)
        : product.skillIds.includes(product.primary),
    );
    for (const entry of product.workflows)
      assert.ok(builtinWorkflows().some((w) => w.id === entry.id));
  }
});
test("old favorites map without duplicates; malformed input cannot grant a product", () => {
  assert.deepEqual(
    migrateSkillFavorites([
      "table.analyze",
      "table.join",
      "social.carousel",
      "slides.create",
      "bad",
      null,
    ]),
    ["data", "visual", "presentations"],
  );
  assert.deepEqual(migrateSkillFavorites({}), []);
  assert.equal(productForSkill("pdf.ocr").id, "documents");
  assert.equal(productForSkill("never.registered"), undefined);
  assert.equal(
    productSearch(
      skillProducts.find((p) => p.id === "visual"),
      runtimeSkills,
      "social.carousel",
    ),
    true,
  );
});
test("new chains retain old recipe versions and wire declared artifacts to registered scopes", () => {
  const recipes = builtinWorkflows();
  for (const oldId of [
    "landing-page",
    "doc-brief",
    "doc-structure",
    "social-card",
    "business-infographic",
    "faq-page",
    "table-insights",
  ])
    assert.equal(recipes.find((w) => w.id === oldId).version, "1.0.0");
  for (const id of [
    "web-delivery",
    "brand-delivery",
    "marketing-delivery",
    "project-delivery",
  ]) {
    const recipe = recipes.find((w) => w.id === id);
    assert.ok(recipe);
    const seen = new Set();
    for (const step of recipe.steps) {
      const skill = runtimeSkills.find((s) => s.id === step.skill);
      assert.ok(skill);
      assert.ok(skill.expertIds.includes(step.expertId));
      if (step.source.kind === "artifact") {
        assert.ok(seen.has(step.source.stepId));
        assert.ok(step.source.artifactName);
      }
      seen.add(step.id);
    }
  }
});
test("static gates fail closed; execution success, missing reports or syntax errors cannot pass", () => {
  for (const gate of ["html", "css", "javascript"]) {
    for (const invalid of [
      null,
      {},
      { findings: [], truncated: true },
      { findings: [null] },
      { findings: [{ code: "PROBLEM", severity: "error" }], syntaxValid: true },
    ])
      assert.equal(evaluateWorkflowQuality(gate, invalid).passed, false);
    assert.equal(
      evaluateWorkflowQuality(gate, { findings: [], syntaxValid: true }).passed,
      true,
    );
  }
  assert.equal(
    evaluateWorkflowQuality("css", { findings: [], syntaxValid: false }).passed,
    false,
  );
  assert.equal(
    evaluateWorkflowQuality("javascript", { findings: [], syntaxValid: false })
      .passed,
    false,
  );
  assert.equal(
    evaluateWorkflowQuality("css", {
      findings: [{ severity: "warning" }],
      syntaxValid: true,
    }).passed,
    true,
  );
  assert.match(
    evaluateWorkflowQuality("html", { findings: [] }).message,
    /未做浏览器或商业验收/,
  );
});

test("project gate requires actual complete coverage, not a generic execution success", () => {
  for (const value of [
    null,
    {},
    {
      uncoveredRequirements: ["R2"],
      requirementCount: 2,
      acceptanceCount: 1,
      warnings: [],
    },
    {
      uncoveredRequirements: [],
      requirementCount: 0,
      acceptanceCount: 0,
      warnings: [],
    },
  ])
    assert.equal(evaluateWorkflowQuality("project", value).passed, false);
  assert.equal(
    evaluateWorkflowQuality("project", {
      uncoveredRequirements: [],
      requirementCount: 1,
      acceptanceCount: 1,
      warnings: ["风险待补充"],
    }).passed,
    true,
  );
});

test("all 244 method references have exactly one outcome owner but grant no executor or commercial approval", () => {
  const index = require("../../docs/plans/skill-method-consolidation-2026-10-20.json");
  assert.equal(index.entries.length, 244);
  assert.equal(new Set(index.entries.map((r) => r.slug)).size, 244);
  for (const row of index.entries) {
    assert.ok(skillProducts.some((p) => p.id === row.product_id));
    assert.equal(row.upstream_installed, false);
    assert.equal(row.executor_granted, false);
    assert.equal(row.commercial_acceptance, "not-accepted");
    assert.ok(row.license_gate);
  }
  assert.equal(
    index.entries.find((r) => r.slug === "anything2explainer").license_gate,
    "catalog-reports-noncommercial-block",
  );
  const gsap = index.entries.filter(
    (r) =>
      r.slug.startsWith("gsap-") && r.slug !== "gsap-framer-scroll-animation",
  );
  assert.equal(gsap.length, 8);
  assert.ok(
    gsap.every(
      (r) => r.product_id === "visual" && r.module === "motion-advanced",
    ),
  );
  const three = index.entries.filter((r) => r.slug.startsWith("threejs-"));
  assert.equal(three.length, 8);
  assert.ok(
    three.every(
      (r) => r.module === "spatial-advanced" && r.executor_granted === false,
    ),
  );
});

test("HTML audit handles actual embedded binary separately without silently truncating document structure", async () => {
  const { htmlAudit } = require("../../dist/local/server/skills/web-checks.js");
  const html =
    '<!doctype html><html lang="zh"><head><title>测试</title><meta name="viewport" content="width=device-width"><style>@font-face{font-family:test;src:url(data:font/woff2;base64,' +
    "A".repeat(180000) +
    ')}</style></head><body><img src="data:image/png;base64,AAAA"></body></html>';
  const result = await htmlAudit(
    { filename: "binary.html", bytes: Buffer.from(html) },
    () => {},
  );
  const report = JSON.parse(Buffer.from(result.outputs[0].bytes));
  assert.equal(report.embeddedBinary.payloads, 2);
  assert.equal(report.embeddedBinary.inspected, false);
  assert.ok(report.findings.some((f) => f.code === "MISSING_ALT"));
  await assert.rejects(
    () =>
      htmlAudit(
        {
          filename: "long.html",
          bytes: Buffer.from("<p>" + "文".repeat(150001) + "</p>"),
        },
        () => {},
      ),
    /未截断检查/,
  );
});
