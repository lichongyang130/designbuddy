import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyRepositoryConsistency } from "./verify-status-registry.mjs";

test("live repository passes all manifest pinning, registry, runtime count, and honesty checks", () => {
  const result = verifyRepositoryConsistency();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.metrics.skillsTotal, 47);
  assert.equal(result.metrics.expertBusinessCasesVerified, 36);
  assert.equal(result.metrics.templatesTotal, 33);
});

test("verifier rejects floating latest versions and credential honesty violations", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "db-registry-check-"));
  fs.mkdirSync(path.join(tmp, "apps/web/src/inspiration/samples"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "apps/desktop"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "docs/plans"), { recursive: true });

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ dependencies: { vite: "latest" } }));
  fs.writeFileSync(path.join(tmp, "apps/web/package.json"), JSON.stringify({ dependencies: {} }));
  fs.writeFileSync(path.join(tmp, "apps/desktop/package.json"), JSON.stringify({ dependencies: {} }));
  fs.writeFileSync(
    path.join(tmp, "apps/web/src/inspiration/samples/shared.tsx"),
    'export const samples: unknown[] = [{ id: "a" }];',
  );
  fs.writeFileSync(
    path.join(tmp, "docs/plans/feature-status-registry.json"),
    JSON.stringify({
      metrics: { skillsTotal: 47, skillsReadyWithProvisionedAssets: 44, skillsExternalBlocked: 3, templatesTotal: 1 },
      features: [
        {
          id: "TEST-1",
          module: "m1",
          status: "verified_local",
          codeEntries: ["package.json"],
          testEvidence: ["missing-test.mjs"],
          externalDependency: "credentials:AI_API_KEY",
        },
        ...Array.from({ length: 7 }, (_, idx) => ({
          id: `PAD-${idx}`,
          module: "m",
          status: "verified_local",
          codeEntries: ["package.json"],
          testEvidence: ["package.json"],
          externalDependency: "none",
        })),
      ],
    }),
  );
  for (const name of ["feature-status-registry.md", "open-tasks.md", "remaining-work-ledger.md", "functional-gap-audit.md"]) {
    fs.writeFileSync(path.join(tmp, "docs/plans", name), "feature-status-registry.json\n技能目录 46 项\n");
  }

  const res = verifyRepositoryConsistency(tmp);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("Floating dependency prohibited")));
  assert.ok(res.errors.some((e) => e.includes("Honesty violation")));
  assert.ok(res.errors.some((e) => e.includes("missing-test.mjs")));
  assert.ok(res.errors.some((e) => e.includes("Stale contradictory count phrase")));
  fs.rmSync(tmp, { recursive: true, force: true });
});
