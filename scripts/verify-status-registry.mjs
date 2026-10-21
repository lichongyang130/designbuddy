import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export function verifyRepositoryConsistency(rootDir = repoRoot) {
  const errors = [];

  // 1. Verify zero floating "latest" or "*" versions in package manifests
  const manifests = [
    "package.json",
    "apps/web/package.json",
    "apps/desktop/package.json",
  ];
  for (const rel of manifests) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) {
      errors.push(`Missing manifest: ${rel}`);
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(abs, "utf8"));
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const deps = pkg[field] ?? {};
      for (const [dep, spec] of Object.entries(deps)) {
        if (spec === "latest" || spec === "*") {
          errors.push(`Floating dependency prohibited in ${rel} (${field}.${dep} = "${spec}")`);
        }
      }
    }
  }

  // 2. Verify removed monkeypatch scripts, fake UI components & unmounted skeleton packages stay deleted
  const scriptsDir = path.join(rootDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    for (const entry of fs.readdirSync(scriptsDir)) {
      if (/^(add|fix|patch|inject)_.*\.mjs$/.test(entry)) {
        errors.push(`Prohibited monkeypatch script found: scripts/${entry}`);
      }
    }
  }
  const bannedPaths = [
    "apps/api",
    "apps/web/components",
    "apps/web/src/components/CanvasEngine.tsx",
    "apps/web/src/components/DesignLibraryModal.tsx",
    "apps/web/src/components/PreviewToolbar.tsx",
    "apps/web/src/components/ProjectWorkspace.tsx",
    "apps/web/src/components/TaskMonitor.tsx",
    "apps/web/src/components/VersionHistory.tsx",
    "apps/web/src/utils/exportProject.ts",
    "apps/web/src/utils/ollamaClient.ts",
    "packages/agent-core",
    "packages/studio-core",
    "packages/canvas-engine",
    "packages/project-engine",
    "packages/skill-runtime",
    "packages/plugin-sdk",
  ];
  for (const rel of bannedPaths) {
    if (fs.existsSync(path.join(rootDir, rel))) {
      errors.push(`Prohibited unmounted skeleton or fake-UI path still present: ${rel}`);
    }
  }

  // Enforce modular App.tsx shell boundary (<= 250 lines)
  const appShellPath = path.join(rootDir, "apps/web/src/App.tsx");
  if (fs.existsSync(appShellPath)) {
    const appLines = fs.readFileSync(appShellPath, "utf8").split("\n").length;
    if (appLines > 250) {
      errors.push(`apps/web/src/App.tsx exceeded modular shell limit (${appLines} > 250 lines)`);
    }
  }

  // 3. Load authoritative feature status registry
  const registryPath = path.join(rootDir, "docs/plans/feature-status-registry.json");
  if (!fs.existsSync(registryPath)) {
    errors.push("Missing docs/plans/feature-status-registry.json");
    return { ok: false, errors };
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const allowedStatuses = new Set([
    "verified_local",
    "partial_subset",
    "external_blocked",
    "skeleton_unmounted",
  ]);

  assert.ok(Array.isArray(registry.features) && registry.features.length >= 8, "Registry features must be populated");

  for (const item of registry.features) {
    if (!allowedStatuses.has(item.status)) {
      errors.push(`Invalid status "${item.status}" on feature ${item.id}`);
    }
    if (!Array.isArray(item.codeEntries) || item.codeEntries.length === 0) {
      errors.push(`Feature ${item.id} has no codeEntries`);
    }
    if (!Array.isArray(item.testEvidence) || item.testEvidence.length === 0) {
      errors.push(`Feature ${item.id} has no testEvidence`);
    }
    for (const rel of [...(item.codeEntries ?? []), ...(item.testEvidence ?? [])]) {
      if (!fs.existsSync(path.join(rootDir, rel))) {
        errors.push(`Feature ${item.id} references missing path: ${rel}`);
      }
    }
    if (
      item.status === "verified_local" &&
      typeof item.externalDependency === "string" &&
      item.externalDependency.startsWith("credentials:")
    ) {
      errors.push(
        `Honesty violation on ${item.id}: external credential-gated feature cannot claim verified_local`,
      );
    }
  }

  // 4. Cross-check live runtime skill count & template catalog count against registry metrics
  const compiledCatalogPath = path.join(rootDir, "dist/local/server/skills/runtime-catalog.js");
  if (fs.existsSync(compiledCatalogPath)) {
    process.env.FFMPEG_PATH ||= path.join(rootDir, "node_modules/.cache/ffmpeg/ffmpeg");
    const { runtimeCatalog } = require(compiledCatalogPath);
    const catalog = runtimeCatalog();
    if (catalog.length !== registry.metrics.skillsTotal) {
      errors.push(
        `Skill total drift: runtimeCatalog() has ${catalog.length}, registry declares ${registry.metrics.skillsTotal}`,
      );
    }
    const readyCount = catalog.filter((s) => s.status === "ready").length;
    const blockedCount = catalog.filter((s) => s.status !== "ready").length;
    if (!process.env.AI_API_KEY && readyCount > registry.metrics.skillsReadyWithProvisionedAssets) {
      errors.push(`Unexpected ready skill count ${readyCount} without AI_API_KEY`);
    }
    if (!process.env.AI_API_KEY && blockedCount < registry.metrics.skillsExternalBlocked) {
      errors.push(
        `External skill honesty violation: expected at least ${registry.metrics.skillsExternalBlocked} blocked skills without credentials, got ${blockedCount}`,
      );
    }
  }

  const templateCatalogSrc = fs.readFileSync(
    path.join(rootDir, "apps/web/src/inspiration/samples/shared.tsx"),
    "utf8",
  );
  const samplesSection = templateCatalogSrc.slice(
    templateCatalogSrc.indexOf("export const samples:"),
  );
  const templateIds = [...samplesSection.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const uniqueTemplateIds = new Set(templateIds);
  if (uniqueTemplateIds.size !== registry.metrics.templatesTotal) {
    errors.push(
      `Template total drift: shared.tsx defines ${uniqueTemplateIds.size} unique templates, registry declares ${registry.metrics.templatesTotal}`,
    );
  }

  // 5. Verify markdown docs reference feature-status-registry.json and contain zero stale headline claims
  for (const docRel of [
    "docs/plans/feature-status-registry.md",
    "docs/plans/open-tasks.md",
    "docs/plans/remaining-work-ledger.md",
    "docs/plans/functional-gap-audit.md",
  ]) {
    const docAbs = path.join(rootDir, docRel);
    if (!fs.existsSync(docAbs)) {
      errors.push(`Missing governance doc: ${docRel}`);
      continue;
    }
    const text = fs.readFileSync(docAbs, "utf8");
    if (!text.includes("feature-status-registry.json")) {
      errors.push(`${docRel} must reference authoritative feature-status-registry.json`);
    }
    for (const stalePhrase of [
      "runtime目录共45项",
      "技能目录 46 项",
      "技能目录状态（46 项）",
      "最新模板进度为 **6 / 180**",
      "社区共 19 套作品",
      "新增 180 套模板的剩余 171 套",
      "社区可运行模板共 9 类 30 套",
    ]) {
      if (text.includes(stalePhrase)) {
        errors.push(`Stale contradictory count phrase "${stalePhrase}" still present in ${docRel}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, metrics: registry.metrics };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyRepositoryConsistency(repoRoot);
  if (!result.ok) {
    console.error("Repository consistency verification FAILED:");
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(
    `Repository consistency OK: ${result.metrics.skillsTotal} skills (${result.metrics.skillsReadyWithProvisionedAssets} ready / ${result.metrics.skillsExternalBlocked} external-blocked), ${result.metrics.expertBusinessCasesVerified} verified expert business cases, ${result.metrics.templatesTotal} templates across ${result.metrics.templateCategories} categories, 0 floating dependencies.`,
  );
}
