import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, posix, relative, resolve, sep } from "node:path";
import * as acorn from "acorn";
import postcss from "postcss";
// Node 22.12+/24 supports synchronous require() of pure ESM packages like parse5.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parse: parseHtml } = require("parse5") as {
  parse: (html: string, options?: { sourceCodeLocationInfo?: boolean }) => unknown;
};

export interface AnalyzableFile {
  path: string;
  content: string;
  language?: string;
}

export interface AnalyzedFileNode {
  path: string;
  extension: string;
  bytes: number;
  lines: number;
  role: "entry" | "style" | "script" | "config" | "asset" | "other";
  imports: string[];
  exports: string[];
  referencedAssets: string[];
  cssCustomProperties: string[];
}

export interface AnalysisDependencyEdge {
  from: string;
  to: string;
  kind: "script-import" | "html-script" | "html-style" | "html-image" | "css-import";
  resolved: boolean;
}

export interface AnalysisRiskFinding {
  id: string;
  severity: "high" | "medium" | "low";
  category: "syntax" | "broken-reference" | "security" | "accessibility" | "responsive" | "architecture";
  file: string;
  line?: number;
  title: string;
  evidence: string;
}

export interface ProjectAnalysisReport {
  analyzedAt: number;
  projectId: string;
  projectName: string;
  summary: {
    fileCount: number;
    totalBytes: number;
    totalLines: number;
    entryPoints: string[];
    dependencyCount: number;
    unresolvedReferences: number;
    riskCounts: { high: number; medium: number; low: number };
  };
  files: AnalyzedFileNode[];
  dependencies: AnalysisDependencyEdge[];
  cycles: string[][];
  unreferencedFiles: string[];
  risks: AnalysisRiskFinding[];
}

function normalizePosix(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveRelativeAsset(fromFile: string, specifier: string): string | null {
  const clean = specifier.trim().split(/[?#]/)[0];
  if (!clean || /^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(clean)) return null;
  if (clean.startsWith("/")) return clean.replace(/^\/+/, "");
  const dir = posix.dirname(normalizePosix(fromFile));
  return posix.normalize(dir === "." ? clean : posix.join(dir, clean));
}

function walkParse5(node: any, visit: (el: any) => void): void {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) walkParse5(child, visit);
  }
}

function getAttr(node: any, name: string): string | undefined {
  const found = Array.isArray(node.attrs) ? node.attrs.find((a: any) => a.name === name) : undefined;
  return found ? String(found.value) : undefined;
}

function findCycles(nodes: string[], edges: Array<{ from: string; to: string }>): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) {
    if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to);
  }
  const visited = new Set<string>();
  const stack = new Set<string>();
  const pathStack: string[] = [];
  const cycles: string[][] = [];
  const seenKeys = new Set<string>();

  function dfs(u: string) {
    visited.add(u);
    stack.add(u);
    pathStack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (!visited.has(v)) {
        dfs(v);
      } else if (stack.has(v)) {
        const idx = pathStack.indexOf(v);
        if (idx >= 0) {
          const cycle = [...pathStack.slice(idx), v];
          const key = cycle.join(" -> ");
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            cycles.push(cycle);
          }
        }
      }
    }
    pathStack.pop();
    stack.delete(u);
  }

  for (const n of nodes) {
    if (!visited.has(n)) dfs(n);
  }
  return cycles;
}

/**
 * Static, zero-execution analyzer for user DesignProject files.
 * Parses HTML with parse5, CSS with postcss, and JS with acorn to produce real
 * file graphs, asset dependencies, cycles and line-referenced risk findings.
 */
export function analyzeDesignProject(input: {
  id: string;
  name?: string;
  files: AnalyzableFile[];
}): ProjectAnalysisReport {
  const fileSet = new Set(input.files.map((f) => normalizePosix(f.path)));
  const fileNodes: AnalyzedFileNode[] = [];
  const dependencies: AnalysisDependencyEdge[] = [];
  const risks: AnalysisRiskFinding[] = [];
  let riskSeq = 0;
  const pushRisk = (finding: Omit<AnalysisRiskFinding, "id">) => {
    riskSeq += 1;
    risks.push({ id: `risk-${riskSeq}`, ...finding });
  };

  for (const rawFile of input.files) {
    const filePath = normalizePosix(rawFile.path);
    const ext = extname(filePath).toLowerCase();
    const content = rawFile.content ?? "";
    const bytes = Buffer.byteLength(content, "utf8");
    const lines = content.length === 0 ? 0 : content.split(/\r?\n/).length;
    const imports: string[] = [];
    const exports: string[] = [];
    const referencedAssets: string[] = [];
    const cssCustomProperties: string[] = [];

    const role: AnalyzedFileNode["role"] =
      ext === ".html"
        ? "entry"
        : ext === ".css"
          ? "style"
          : [".js", ".mjs", ".cjs", ".ts", ".tsx"].includes(ext)
            ? "script"
            : ext === ".json"
              ? "config"
              : [".svg", ".png", ".jpg", ".webp"].includes(ext)
                ? "asset"
                : "other";

    if (ext === ".html") {
      const doc = parseHtml(content, { sourceCodeLocationInfo: true });
      let hasViewport = false;
      let hasTitle = false;
      let missingAltCount = 0;
      walkParse5(doc, (el) => {
        if (!el.tagName) return;
        const line = el.sourceCodeLocation?.startLine;
        if (el.tagName === "title") {
          const text = (el.childNodes ?? []).map((c: any) => c.value ?? "").join("").trim();
          if (text) hasTitle = true;
        }
        if (el.tagName === "meta" && getAttr(el, "name")?.toLowerCase() === "viewport") {
          hasViewport = true;
        }
        if (el.tagName === "script") {
          const src = getAttr(el, "src");
          if (src) {
            const target = resolveRelativeAsset(filePath, src);
            if (target) {
              const resolved = fileSet.has(target);
              referencedAssets.push(target);
              dependencies.push({ from: filePath, to: target, kind: "html-script", resolved });
              if (!resolved) {
                pushRisk({
                  severity: "high",
                  category: "broken-reference",
                  file: filePath,
                  line,
                  title: "HTML 引用了不存在的脚本文件",
                  evidence: `<script src="${src}"> 解析为 "${target}"，未在项目文件中找到。`,
                });
              }
            }
          }
        }
        if (el.tagName === "link") {
          const href = getAttr(el, "href");
          const rel = (getAttr(el, "rel") || "").toLowerCase();
          if (href && (!rel || rel.includes("stylesheet") || rel.includes("icon"))) {
            const target = resolveRelativeAsset(filePath, href);
            if (target) {
              const resolved = fileSet.has(target);
              referencedAssets.push(target);
              dependencies.push({ from: filePath, to: target, kind: "html-style", resolved });
              if (!resolved && rel.includes("stylesheet")) {
                pushRisk({
                  severity: "high",
                  category: "broken-reference",
                  file: filePath,
                  line,
                  title: "HTML 引用了不存在的样式表",
                  evidence: `<link href="${href}"> 解析为 "${target}"，未在项目文件中找到。`,
                });
              }
            }
          }
        }
        if (el.tagName === "img") {
          const src = getAttr(el, "src");
          const alt = getAttr(el, "alt");
          if (alt === undefined) missingAltCount += 1;
          if (src) {
            const target = resolveRelativeAsset(filePath, src);
            if (target) {
              const resolved = fileSet.has(target);
              referencedAssets.push(target);
              dependencies.push({ from: filePath, to: target, kind: "html-image", resolved });
              if (!resolved) {
                pushRisk({
                  severity: "medium",
                  category: "broken-reference",
                  file: filePath,
                  line,
                  title: "图片路径在项目中不存在",
                  evidence: `<img src="${src}"> 解析为 "${target}"。`,
                });
              }
            }
          }
        }
      });
      if (!hasViewport) {
        pushRisk({
          severity: "medium",
          category: "responsive",
          file: filePath,
          line: 1,
          title: "缺少响应式 viewport 声明",
          evidence: `${filePath} 未包含 <meta name="viewport" content="width=device-width, initial-scale=1.0">。`,
        });
      }
      if (!hasTitle) {
        pushRisk({
          severity: "low",
          category: "accessibility",
          file: filePath,
          line: 1,
          title: "页面缺少非空 <title>",
          evidence: `${filePath} 未定义有效页面标题。`,
        });
      }
      if (missingAltCount > 0) {
        pushRisk({
          severity: "low",
          category: "accessibility",
          file: filePath,
          title: "存在缺少 alt 属性的图片元素",
          evidence: `${filePath} 中有 ${missingAltCount} 个 <img> 未声明 alt 属性。`,
        });
      }
    } else if (ext === ".css") {
      try {
        const root = postcss.parse(content, { from: filePath });
        root.walkAtRules("import", (rule) => {
          const match = rule.params.match(/['"]([^'"]+)['"]/);
          if (match?.[1]) {
            const target = resolveRelativeAsset(filePath, match[1]);
            if (target) {
              const resolved = fileSet.has(target);
              imports.push(target);
              dependencies.push({ from: filePath, to: target, kind: "css-import", resolved });
              if (!resolved) {
                pushRisk({
                  severity: "high",
                  category: "broken-reference",
                  file: filePath,
                  line: rule.source?.start?.line,
                  title: "CSS @import 目标缺失",
                  evidence: `@import "${match[1]}" 解析为 "${target}"，文件不存在。`,
                });
              }
            }
          }
        });
        root.walkDecls((decl) => {
          if (decl.prop.startsWith("--") && !cssCustomProperties.includes(decl.prop)) {
            cssCustomProperties.push(decl.prop);
          }
          const pxMatch = decl.prop === "width" ? decl.value.match(/^(\d{4,})px$/) : null;
          if (pxMatch && Number(pxMatch[1]) > 960) {
            pushRisk({
              severity: "low",
              category: "responsive",
              file: filePath,
              line: decl.source?.start?.line,
              title: "固定大像素宽度可能导致移动端横向溢出",
              evidence: `${decl.prop}: ${decl.value}（建议使用 max-width + 百分比布局）。`,
            });
          }
        });
      } catch (err: any) {
        pushRisk({
          severity: "high",
          category: "syntax",
          file: filePath,
          line: err?.line,
          title: "CSS 语法错误",
          evidence: err instanceof Error ? err.message : String(err),
        });
      }
    } else if ([".js", ".mjs", ".cjs"].includes(ext)) {
      let ast: any;
      try {
        ast = acorn.parse(content, { ecmaVersion: "latest", sourceType: "module", locations: true });
      } catch {
        try {
          ast = acorn.parse(content, { ecmaVersion: "latest", sourceType: "script", locations: true });
        } catch (err: any) {
          pushRisk({
            severity: "high",
            category: "syntax",
            file: filePath,
            line: err?.loc?.line,
            title: "JavaScript 语法错误",
            evidence: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (ast && Array.isArray(ast.body)) {
        for (const stmt of ast.body) {
          if (stmt.type === "ImportDeclaration" && typeof stmt.source?.value === "string") {
            const rawSpec = stmt.source.value;
            const target = resolveRelativeAsset(filePath, rawSpec);
            const candidates = target ? [target, `${target}.js`, `${target}.mjs`] : [];
            const matched = candidates.find((c) => fileSet.has(c)) ?? target;
            if (matched) {
              const resolved = fileSet.has(matched);
              imports.push(matched);
              dependencies.push({ from: filePath, to: matched, kind: "script-import", resolved });
              if (!resolved) {
                pushRisk({
                  severity: "high",
                  category: "broken-reference",
                  file: filePath,
                  line: stmt.loc?.start?.line,
                  title: "JS 模块导入目标不存在",
                  evidence: `import "${rawSpec}" 未找到对应文件。`,
                });
              }
            }
          }
          if (
            stmt.type === "ExportNamedDeclaration" ||
            stmt.type === "ExportDefaultDeclaration" ||
            stmt.type === "ExportAllDeclaration"
          ) {
            exports.push(stmt.type === "ExportDefaultDeclaration" ? "default" : (stmt.declaration?.id?.name || "named"));
          }
        }
        // Scan AST recursively for eval / new Function
        const walkAst = (node: any) => {
          if (!node || typeof node !== "object") return;
          if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "eval") {
            pushRisk({
              severity: "high",
              category: "security",
              file: filePath,
              line: node.loc?.start?.line,
              title: "检测到高风险动态代码执行 eval()",
              evidence: `${filePath}:${node.loc?.start?.line ?? 1} 调用了 eval()。`,
            });
          }
          if (node.type === "NewExpression" && node.callee?.type === "Identifier" && node.callee.name === "Function") {
            pushRisk({
              severity: "high",
              category: "security",
              file: filePath,
              line: node.loc?.start?.line,
              title: "检测到 new Function() 动态代码构造",
              evidence: `${filePath}:${node.loc?.start?.line ?? 1} 使用了 new Function()。`,
            });
          }
          for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(walkAst);
            else if (value && typeof value === "object" && "type" in (value as Record<string, unknown>)) walkAst(value);
          }
        };
        walkAst(ast);
      }
    } else if (ext === ".json") {
      try {
        JSON.parse(content);
      } catch (err: any) {
        pushRisk({
          severity: "high",
          category: "syntax",
          file: filePath,
          title: "JSON 解析错误",
          evidence: err instanceof Error ? err.message : String(err),
        });
      }
    }

    fileNodes.push({
      path: filePath,
      extension: ext || "(none)",
      bytes,
      lines,
      role,
      imports,
      exports,
      referencedAssets,
      cssCustomProperties,
    });
  }

  const entryPoints = fileNodes.filter((f) => f.role === "entry").map((f) => f.path);
  const inboundCount = new Map<string, number>();
  for (const dep of dependencies) {
    if (dep.resolved) inboundCount.set(dep.to, (inboundCount.get(dep.to) || 0) + 1);
  }
  const unreferencedFiles = fileNodes
    .filter((f) => f.role !== "entry" && f.role !== "config" && !inboundCount.has(f.path))
    .map((f) => f.path);

  const cycles = findCycles(
    fileNodes.map((f) => f.path),
    dependencies.filter((d) => d.resolved),
  );
  for (const cycle of cycles) {
    pushRisk({
      severity: "medium",
      category: "architecture",
      file: cycle[0],
      title: "检测到模块循环引用",
      evidence: cycle.join(" -> "),
    });
  }

  return {
    analyzedAt: Date.now(),
    projectId: input.id,
    projectName: input.name || input.id,
    summary: {
      fileCount: fileNodes.length,
      totalBytes: fileNodes.reduce((acc, f) => acc + f.bytes, 0),
      totalLines: fileNodes.reduce((acc, f) => acc + f.lines, 0),
      entryPoints,
      dependencyCount: dependencies.length,
      unresolvedReferences: dependencies.filter((d) => !d.resolved).length,
      riskCounts: {
        high: risks.filter((r) => r.severity === "high").length,
        medium: risks.filter((r) => r.severity === "medium").length,
        low: risks.filter((r) => r.severity === "low").length,
      },
    },
    files: fileNodes,
    dependencies,
    cycles,
    unreferencedFiles,
    risks,
  };
}

export interface WorkspaceLayerNode {
  layer: string;
  classification: "canonical-active" | "active-coupled" | "bridged-core" | "skeleton-unreferenced";
  fileCount: number;
  inboundEdges: number;
  outboundEdges: number;
  note: string;
}

export interface WorkspaceArchitectureSnapshot {
  generatedAt: number;
  totalSourceFiles: number;
  layers: WorkspaceLayerNode[];
  crossLayerEdges: Array<{ from: string; to: string; count: number }>;
  bidirectionalCouplings: Array<{ pair: [string, string]; forward: number; backward: number }>;
}

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", ".cache", "build", "test-results"]);

function bucketForRepoFile(relPath: string): string {
  const parts = relPath.split("/");
  if (parts[0] === "apps" && parts[1] === "web") {
    if (parts[2] === "src") return "apps/web/src";
    if (parts[2] === "components") return "apps/web/components";
    if (parts[2] === "tests") return "apps/web/tests";
    return `apps/web/${parts[2] || "root"}`;
  }
  if (parts[0] === "apps") return `apps/${parts[1]}`;
  if (parts[0] === "packages") return `packages/${parts[1]}`;
  if (parts[0] === "server") return parts[1]?.endsWith(".ts") ? "server/local-daemon.ts" : `server/${parts[1]}`;
  if (parts[0] === "frontend") return `frontend/${parts[1]}`;
  return parts[0];
}

function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).workspaces) return dir;
      } catch {
        // ignore invalid json
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, "../..");
}

/**
 * Live read-only static architecture scanner across the DesignBuddy repository.
 * Proves canonical entrypoints vs coupled modules vs zero-caller skeletons from
 * actual source imports on disk rather than hand-maintained prose.
 */
export function analyzeWorkspaceArchitecture(repoRoot = findRepoRoot()): WorkspaceArchitectureSnapshot {
  const root = resolve(repoRoot);
  const codeFiles: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
        codeFiles.push(relative(root, full).split(sep).join("/"));
      }
    }
  }
  walk(root);

  const fileCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();
  const importRegex = /(?:from|import|require)\s*\(?["'](\.[^"']+)["']\)?/g;

  for (const rel of codeFiles) {
    const fromBucket = bucketForRepoFile(rel);
    fileCounts.set(fromBucket, (fileCounts.get(fromBucket) || 0) + 1);
    if (rel.includes(".test.") || rel.includes(".spec.") || rel.startsWith("scripts/") || rel.startsWith("apps/web/tests")) {
      continue;
    }
    let content = "";
    try {
      if (statSync(join(root, rel)).size <= 1_000_000) {
        content = readFileSync(join(root, rel), "utf8");
      }
    } catch {
      continue;
    }
    importRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content))) {
      const resolvedTarget = normalize(join(rel, "..", match[1])).split(sep).join("/");
      const toBucket = bucketForRepoFile(resolvedTarget);
      if (fromBucket !== toBucket) {
        const key = `${fromBucket} -> ${toBucket}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
    }
  }

  const crossLayerEdges = Array.from(edgeCounts.entries())
    .map(([key, count]) => {
      const [from, to] = key.split(" -> ");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);

  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const e of crossLayerEdges) {
    outbound.set(e.from, (outbound.get(e.from) || 0) + e.count);
    inbound.set(e.to, (inbound.get(e.to) || 0) + e.count);
  }

  const trackedLayers: Array<{ layer: string; note: string }> = [
    { layer: "apps/web/src", note: "唯一正式 Web 前端入口（App.tsx 壳层、features/* 模块与按需懒加载路由）" },
    { layer: "frontend/workspace", note: "与 apps/web/src 双向耦合的工作区页面与 API 客户端（待按单向契约收敛）" },
    { layer: "server/local-daemon.ts", note: "唯一正式 HTTP / 静态服务守护进程入口" },
    { layer: "server/api", note: "唯一正式业务 API 层（会话、项目、版本、分享、工作流、模型、Agent Core）" },
    { layer: "server/skills", note: "确定性技能运行时与 Worker 线程池（47 项注册技能）" },
    { layer: "server/agent", note: "项目分析器、Planner、Memory、QA 与隔离项目运行器" },
    { layer: "packages/ai-core", note: "统一 AgentRuntime 状态机与 ModelRouter 抽象（已桥接至 server/agent）" },
    { layer: "shared", note: "前后端共享类型与确定性校验契约" },
    { layer: "apps/desktop", note: "Electron 桌面外壳（包装 Web 产物与本地守护进程）" },
  ];

  const layers: WorkspaceLayerNode[] = trackedLayers.map(({ layer, note }) => {
    const inCount = inbound.get(layer) || 0;
    const outCount = outbound.get(layer) || 0;
    const classification: WorkspaceLayerNode["classification"] =
      layer === "frontend/workspace"
        ? "active-coupled"
        : layer === "packages/ai-core"
          ? "bridged-core"
          : "canonical-active";
    return {
      layer,
      classification,
      fileCount: fileCounts.get(layer) || 0,
      inboundEdges: inCount,
      outboundEdges: outCount,
      note,
    };
  });

  const bidirectionalCouplings: WorkspaceArchitectureSnapshot["bidirectionalCouplings"] = [];
  const seenPairs = new Set<string>();
  for (const e of crossLayerEdges) {
    const reverse = edgeCounts.get(`${e.to} -> ${e.from}`);
    const pairKey = [e.from, e.to].sort().join("<->");
    if (reverse && !seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      bidirectionalCouplings.push({
        pair: [e.from, e.to],
        forward: e.count,
        backward: reverse,
      });
    }
  }

  return {
    generatedAt: Date.now(),
    totalSourceFiles: codeFiles.length,
    layers,
    crossLayerEdges,
    bidirectionalCouplings,
  };
}
