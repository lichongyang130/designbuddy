import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";

/**
 * Browser verification executor shared by `web.verify` and `test.browser`.
 *
 * It drives the real Chromium shipped with the repository through the acceptance
 * harness (`scripts/acceptance/run-acceptance.mjs`). The harness is spawned as a
 * child process so a browser crash or a hung page cannot take the server down,
 * and so the evidence bundle stays byte-identical to the CLI output.
 *
 * Honest boundaries:
 * - The target origin always comes from the request parameter, never from the
 *   uploaded suite, so an uploaded file cannot silently redirect the browser.
 * - Only origins on the allowlist may be visited. Without configuration only
 *   loopback origins are allowed.
 * - A check that could not be executed is `not_verified`, never a pass.
 * - A failing check fails the whole skill run: the evidence bundle is not
 *   published as if it were a success.
 */
export type VerificationMode = "web" | "qa";

export type VerificationInput = {
  filename: string;
  bytes: Uint8Array;
  parameters?: Record<string, string>;
  mode: VerificationMode;
};

export type VerificationResult = {
  summary: string;
  outputs: { name: string; mime: string; bytes: Uint8Array }[];
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function allowedVerificationHosts(): Set<string> {
  const configured = (process.env.SKILL_WEB_VERIFY_ALLOWED_HOSTS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? new Set(configured) : LOOPBACK_HOSTS;
}

function repoRoot(): string {
  const marker = join("scripts", "acceptance", "run-acceptance.mjs");
  const configured = process.env.DESIGNBUDDY_REPO_ROOT;
  const seeds = [configured, process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const seed of seeds) {
    let current = resolve(seed);
    for (let depth = 0; depth < 6; depth += 1) {
      if (existsSync(join(current, marker))) return current;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error("找不到浏览器验收 harness（scripts/acceptance/run-acceptance.mjs）。");
}

function assertTarget(rawBaseUrl: string): { origin: string; host: string } {
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("请填写要验证的站点地址（http:// 或 https:// 开头，仅含主机与端口）。");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 http 或 https 地址。");
  if (url.pathname !== "/" && url.pathname !== "") throw new Error("站点地址不能包含路径，只填主机与端口。");
  if (url.username || url.password) throw new Error("站点地址不能包含账号密码。");
  const host = url.host.toLowerCase();
  const allowed = allowedVerificationHosts();
  const hostname = url.hostname.toLowerCase();
  const permitted =
    allowed.has(host) ||
    allowed.has(hostname) ||
    (LOOPBACK_HOSTS.has(hostname) && allowed.has("loopback"));
  if (!permitted) {
    throw new Error(
      `目标站点 ${host} 不在允许列表内。默认只允许本机地址；验证外部站点需要服务端设置 SKILL_WEB_VERIFY_ALLOWED_HOSTS。`,
    );
  }
  return { origin: url.origin, host };
}

type SuiteFile = {
  name: string;
  viewports: { name: string; width: number; height: number }[];
  checks: { id: string; type: string; path: string }[];
};

function readSuite(bytes: Uint8Array): SuiteFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("验收套件不是有效 JSON。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("验收套件必须是 JSON 对象。");
  const suite = parsed as Record<string, unknown>;
  if (typeof suite.name !== "string" || !suite.name.trim()) throw new Error("验收套件缺少 name。");
  if (!Array.isArray(suite.viewports) || !suite.viewports.length || suite.viewports.length > 12)
    throw new Error("验收套件需要 1 到 12 个视口。");
  if (!Array.isArray(suite.checks) || !suite.checks.length || suite.checks.length > 200)
    throw new Error("验收套件需要 1 到 200 个检查项。");
  return { name: suite.name, viewports: suite.viewports as SuiteFile["viewports"], checks: suite.checks as SuiteFile["checks"] };
}

function collectScreenshots(directory: string): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const walk = (current: string, prefix: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path, name);
      else if (entry.isFile() && entry.name.endsWith(".png"))
        files[name] = new Uint8Array(readFileSync(path));
    }
  };
  if (existsSync(directory)) walk(directory, "");
  return files;
}

export async function runVerification(input: VerificationInput, event: (message: string) => void): Promise<VerificationResult> {
  const baseUrl = input.parameters?.baseUrl?.trim();
  if (!baseUrl) throw new Error("请填写要验证的站点地址（baseUrl）。");
  const target = assertTarget(baseUrl);
  const suite = readSuite(input.bytes);
  const browserChecks = suite.checks.filter(check => check.type !== "http").length;
  if (input.mode === "qa" && browserChecks === 0)
    throw new Error("测试验收套件至少需要一个浏览器检查项（assertText/assertVisible/click/screenshot）。");
  if (input.mode === "web" && browserChecks === 0)
    throw new Error("网页验证套件至少需要一个浏览器检查项；纯接口检查请使用 test.browser。");

  const root = repoRoot();
  const workDir = join(root, "data", "verification-runs", `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const suitePath = join(workDir, "suite.json");
  const evidenceDir = join(workDir, "evidence");
  const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  mkdirSync(workDir, { recursive: true });
  try {
    // The declared target always wins over anything inside the uploaded file.
    const payload = { ...(JSON.parse(new TextDecoder().decode(input.bytes)) as object), baseUrl: target.origin };
    writeFileSync(suitePath, JSON.stringify(payload, null, 2));
    event(`已在真实浏览器中执行 ${suite.checks.length} 个检查项 × ${suite.viewports.length} 个视口，目标 ${target.origin}。`);

    const timeoutMs = Number(process.env.SKILL_WEB_VERIFY_TIMEOUT_MS || 240000);
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolveRun, rejectRun) => {
      const child = spawn(process.execPath, [join(root, "scripts/acceptance/run-acceptance.mjs"), "--suite", suitePath, "--out", evidenceDir], {
        cwd: root,
        env: { ...process.env, DESIGNBUDDY_API_TARGET: process.env.DESIGNBUDDY_API_TARGET || `http://127.0.0.1:${process.env.DESIGNBUDDY_PORT || "8787"}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        rejectRun(new Error(`浏览器验证超过 ${Math.round(timeoutMs / 1000)} 秒上限，已终止；没有产生通过结论。`));
      }, timeoutMs);
      child.stdout.on("data", chunk => (stdout += String(chunk)));
      child.stderr.on("data", chunk => (stderr += String(chunk)));
      child.on("error", error => {
        clearTimeout(timer);
        rejectRun(error);
      });
      child.on("close", code => {
        clearTimeout(timer);
        resolveRun({ code: code ?? -1, stdout, stderr });
      });
    });

    const manifestPath = join(evidenceDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(
        `浏览器验证没有产出清单（退出码 ${result.code}）。${(result.stderr || result.stdout).slice(-600)}`,
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      counts: { total: number; passed: number; failed: number; notVerified: number };
      results: { id: string; viewport: string; status: string; detail: string }[];
      baseUrl: string;
      ranAt: string;
    };
    if (manifest.baseUrl !== target.origin) throw new Error("验证结果的目标与请求的目标不一致，已拒绝交付。");
    const broken = manifest.results.filter(item => item.status !== "passed");
    if (manifest.counts.failed || manifest.counts.notVerified) {
      const detail = broken
        .slice(0, 12)
        .map(item => `[${item.viewport}] ${item.id}：${item.status} — ${item.detail}`)
        .join("；");
      throw new Error(
        `浏览器验证未通过：通过 ${manifest.counts.passed}/${manifest.counts.total}，失败 ${manifest.counts.failed}，未验证 ${manifest.counts.notVerified}。${detail}。未发布任何通过结论。`,
      );
    }

    const consoleLog = existsSync(join(evidenceDir, "console.log")) ? new Uint8Array(readFileSync(join(evidenceDir, "console.log"))) : new Uint8Array();
    const networkLog = existsSync(join(evidenceDir, "network.log")) ? new Uint8Array(readFileSync(join(evidenceDir, "network.log"))) : new Uint8Array();
    const screenshots = collectScreenshots(join(evidenceDir, "screenshots"));
    const report = {
      tool: input.mode === "qa" ? "test.browser" : "web.verify",
      suite: suite.name,
      target: target.origin,
      ranAt: manifest.ranAt,
      counts: manifest.counts,
      results: manifest.results,
      policy:
        "本报告证明所声明的检查项在所声明的视口下被真实浏览器执行并通过；它不是被测系统的业务验收结论。",
    };
    const outputs: VerificationResult["outputs"] = [
      { name: "verification-manifest.json", mime: "application/json", bytes: strToU8(JSON.stringify(report, null, 2)) },
      { name: "verification-console.log", mime: "text/plain", bytes: consoleLog },
      { name: "verification-network.log", mime: "text/plain", bytes: networkLog },
    ];
    if (Object.keys(screenshots).length) {
      const zipped = zipSync(screenshots, { level: 6 });
      outputs.push({ name: "verification-screenshots.zip", mime: "application/zip", bytes: new Uint8Array(zipped) });
    }
    return {
      summary: `真实浏览器验证通过：${manifest.counts.passed}/${manifest.counts.total} 项检查在 ${suite.viewports.length} 个视口下全部通过（目标 ${target.origin}）。证据含控制台、网络与截图记录；这不等于被测系统的业务验收。`,
      outputs,
    };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* Temporary verification workspace cleanup must not change the verdict. */
    }
  }
}
