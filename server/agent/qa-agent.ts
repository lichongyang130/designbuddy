import { analyzeDesignProject, type AnalyzableFile } from "./analyzer";

export interface QACheckResult {
  id: string;
  rule: string;
  category: "syntax" | "references" | "security" | "accessibility" | "responsive";
  status: "pass" | "warn" | "fail";
  file?: string;
  line?: number;
  detail: string;
}

export interface FileDiffEntry {
  path: string;
  changeType: "added" | "modified" | "removed" | "unchanged";
  addedLines: number;
  removedLines: number;
  bytesBefore: number;
  bytesAfter: number;
  unifiedPatch: string;
}

export interface QAReport {
  checkedAt: number;
  durationMs: number;
  passed: boolean;
  score: number;
  counts: { pass: number; warn: number; fail: number };
  checks: QACheckResult[];
  diff: FileDiffEntry[];
}

function buildCompactUnifiedDiff(path: string, before: string, after: string): {
  addedLines: number;
  removedLines: number;
  patch: string;
} {
  if (before === after) return { addedLines: 0, removedLines: 0, patch: "" };
  const a = before ? before.split(/\r?\n/) : [];
  const b = after ? after.split(/\r?\n/) : [];
  const lines: string[] = [`--- a/${path}`, `+++ b/${path}`];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (lines.length < 160) lines.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (j < b.length && (i >= a.length || a[i + 1] !== b[j])) {
      added += 1;
      if (lines.length < 160) lines.push(`+ ${b[j]}`);
      j += 1;
    } else if (i < a.length) {
      removed += 1;
      if (lines.length < 160) lines.push(`- ${a[i]}`);
      i += 1;
    }
  }
  if (lines.length >= 160) lines.push("... (diff truncated)");
  return { addedLines: added, removedLines: removed, patch: lines.join("\n") };
}

export function computeProjectDiff(beforeFiles: AnalyzableFile[], afterFiles: AnalyzableFile[]): FileDiffEntry[] {
  const beforeMap = new Map(beforeFiles.map((f) => [f.path, f.content]));
  const afterMap = new Map(afterFiles.map((f) => [f.path, f.content]));
  const allPaths = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
  return allPaths.map((path) => {
    const hasBefore = beforeMap.has(path);
    const hasAfter = afterMap.has(path);
    const before = beforeMap.get(path) ?? "";
    const after = afterMap.get(path) ?? "";
    const changeType: FileDiffEntry["changeType"] = !hasBefore
      ? "added"
      : !hasAfter
        ? "removed"
        : before === after
          ? "unchanged"
          : "modified";
    const computed = buildCompactUnifiedDiff(path, before, after);
    return {
      path,
      changeType,
      addedLines: computed.addedLines,
      removedLines: computed.removedLines,
      bytesBefore: Buffer.byteLength(before, "utf8"),
      bytesAfter: Buffer.byteLength(after, "utf8"),
      unifiedPatch: computed.patch,
    };
  });
}

/**
 * Deterministic QA Agent: validates AST syntax, local file references,
 * security hazards, viewport/accessibility hygiene and computes unified diffs.
 */
export function runProjectQA(input: {
  projectId: string;
  projectName?: string;
  files: AnalyzableFile[];
  baselineFiles?: AnalyzableFile[];
}): QAReport {
  const startedAt = Date.now();
  const analysis = analyzeDesignProject({
    id: input.projectId,
    name: input.projectName,
    files: input.files,
  });

  const checks: QACheckResult[] = [];
  const syntaxRisks = analysis.risks.filter((r) => r.category === "syntax");
  if (syntaxRisks.length === 0) {
    checks.push({
      id: "qa-syntax",
      rule: "AST Syntax Integrity (HTML / CSS / JS / JSON)",
      category: "syntax",
      status: "pass",
      detail: `全部 ${analysis.summary.fileCount} 个文件通过 parse5 / PostCSS / Acorn 语法校验。`,
    });
  } else {
    for (const r of syntaxRisks) {
      checks.push({
        id: `qa-${r.id}`,
        rule: r.title,
        category: "syntax",
        status: "fail",
        file: r.file,
        line: r.line,
        detail: r.evidence,
      });
    }
  }

  const brokenRefs = analysis.risks.filter((r) => r.category === "broken-reference");
  if (brokenRefs.length === 0) {
    checks.push({
      id: "qa-references",
      rule: "Local Asset & Module Resolution",
      category: "references",
      status: "pass",
      detail: `共校验 ${analysis.summary.dependencyCount} 条本地资源与模块引用，无缺失目标。`,
    });
  } else {
    for (const r of brokenRefs) {
      checks.push({
        id: `qa-${r.id}`,
        rule: r.title,
        category: "references",
        status: r.severity === "high" ? "fail" : "warn",
        file: r.file,
        line: r.line,
        detail: r.evidence,
      });
    }
  }

  const securityRisks = analysis.risks.filter((r) => r.category === "security");
  if (securityRisks.length === 0) {
    checks.push({
      id: "qa-security",
      rule: "Dynamic Execution Hazard Scan",
      category: "security",
      status: "pass",
      detail: "未检测到 eval() 或 new Function() 等动态代码执行风险。",
    });
  } else {
    for (const r of securityRisks) {
      checks.push({
        id: `qa-${r.id}`,
        rule: r.title,
        category: "security",
        status: "fail",
        file: r.file,
        line: r.line,
        detail: r.evidence,
      });
    }
  }

  const a11yRisks = analysis.risks.filter((r) => r.category === "accessibility");
  if (a11yRisks.length === 0) {
    checks.push({
      id: "qa-a11y",
      rule: "Document Title & Image Alt Semantics",
      category: "accessibility",
      status: "pass",
      detail: "入口 HTML 具备非空标题且所有图片均包含 alt 声明。",
    });
  } else {
    for (const r of a11yRisks) {
      checks.push({
        id: `qa-${r.id}`,
        rule: r.title,
        category: "accessibility",
        status: "warn",
        file: r.file,
        line: r.line,
        detail: r.evidence,
      });
    }
  }

  const responsiveRisks = analysis.risks.filter((r) => r.category === "responsive");
  if (responsiveRisks.length === 0) {
    checks.push({
      id: "qa-responsive",
      rule: "Responsive Viewport & Fluid Container Check",
      category: "responsive",
      status: "pass",
      detail: "页面已声明 viewport 元信息且未发现超宽硬编码容器。",
    });
  } else {
    for (const r of responsiveRisks) {
      checks.push({
        id: `qa-${r.id}`,
        rule: r.title,
        category: "responsive",
        status: "warn",
        file: r.file,
        line: r.line,
        detail: r.evidence,
      });
    }
  }

  const counts = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  const passed = counts.fail === 0;
  const rawScore = Math.max(0, 100 - counts.fail * 35 - counts.warn * 8);
  const diff = computeProjectDiff(input.baselineFiles ?? input.files, input.files);

  return {
    checkedAt: Date.now(),
    durationMs: Math.max(1, Date.now() - startedAt),
    passed,
    score: rawScore,
    counts,
    checks,
    diff,
  };
}
