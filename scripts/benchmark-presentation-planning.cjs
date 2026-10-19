#!/usr/bin/env node
/** Explicit opt-in private acceptance run. Never reads legacy embedded credentials; never publishes output. */
const fs = require("node:fs"),
  path = require("node:path");
const {
  parsePresentationRequest,
} = require("../dist/local/server/skills/presentation/sources.js");
function argumentsOf(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) throw Error("参数需要使用--名称");
    const k = args[i].slice(2);
    if (
      ![
        "preflight",
        "allow-external-ai",
        "request",
        "output",
        "owner",
      ].includes(k) ||
      Object.hasOwn(result, k)
    )
      throw Error("未知或重复参数");
    result[k] = ["preflight", "allow-external-ai"].includes(k)
      ? true
      : args[++i];
    if (result[k] === undefined) throw Error("参数缺少值");
  }
  return result;
}
async function main(args = process.argv.slice(2)) {
  const a = argumentsOf(args),
    dir = path.resolve(a.output || ".cache/presentation-planning-acceptance");
  for (const p of ["apps/web/public", "apps/web/dist"]) {
    const publicRoot = path.resolve(__dirname, "..", p);
    if (dir === publicRoot || dir.startsWith(publicRoot + path.sep))
      throw Error("真实材料验收不得写入应用静态公开目录");
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const write = (name, v) =>
    fs.writeFileSync(path.join(dir, name), JSON.stringify(v, null, 2) + "\n", {
      mode: 0o600,
    });
  const ready = !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
  const reasons = [];
  if (!ready)
    reasons.push("缺少服务端AI_API_KEY/OPENAI_API_KEY；不采用旧通道隐含回退");
  if (!a["allow-external-ai"])
    reasons.push("未通过--allow-external-ai明确授权向已配置服务商发送所选正文");
  if (!a.request) reasons.push("未指定--request材料请求");
  if (!a.owner || typeof a.owner !== "string" || a.owner.length > 80)
    reasons.push("未指定有效--owner验收归属");
  if (a.preflight || reasons.length) {
    const report = {
      schemaVersion: 1,
      status: "not-run",
      externalProviderCalls: 0,
      serverCredentialPresent: ready,
      reasons: a.preflight ? ["仅预检，不调用模型", ...reasons] : reasons,
      commercialApproval: false,
      nextAction:
        "核对模型通道/留存政策和实际材料后，以--request、--owner、--allow-external-ai显式启动；结果保存在私有输出目录，不放入public。",
    };
    write("acceptance-status.json", report);
    console.log(JSON.stringify(report, null, 2));
    return { exitCode: a.preflight ? 0 : 2, report };
  }
  // Read only the explicitly selected envelope, with the same bounded parser as the actual skill.
  const size = fs.statSync(a.request).size;
  if (size > 13_600_000) throw Error("请求超过演示材料限额");
  const bytes = fs.readFileSync(a.request);
  parsePresentationRequest(bytes);
  write("acceptance-status.json", {
    status: "running",
    commercialApproval: false,
    externalCallsMayHaveStarted: true,
  });
  try {
    const {
      createPresentation,
    } = require("../dist/local/server/skills/presentation/pipeline.js");
    const result = await createPresentation(
      {
        skillId: "slides.create",
        filename: "acceptance.json",
        bytes,
        owner: a.owner,
        parameters: { externalConsent: "yes" },
      },
      (msg) => console.log(msg),
    );
    if (
      result.outputs.length > 10 ||
      result.outputs.reduce((n, o) => n + o.bytes.length, 0) > 25_000_000
    )
      throw Error("验收产物超过技能成果预算");
    const meta = JSON.parse(
      Buffer.from(
        result.outputs.find((o) => o.name === "presentation-spec.json").bytes,
      ),
    );
    if (!meta.planner.callsThisExecution || meta.planner.resumedFromCheckpoint)
      throw Error("本验收必须包含真实新规划，不能以固定稿或检查点冒充");
    for (const o of result.outputs) {
      if (path.basename(o.name) !== o.name) throw Error("非法产物名称");
      fs.writeFileSync(path.join(dir, o.name), o.bytes, { mode: 0o600 });
    }
    const report = {
      schemaVersion: 1,
      status: "completed-needs-human-review",
      externalProviderCalls: meta.planner.callsThisExecution,
      model: meta.planner.model,
      versionId: meta.versionId,
      commercialApproval: false,
      usage: meta.planner.usage,
      quality: JSON.parse(
        Buffer.from(
          result.outputs.find((o) => o.name === "quality-report.json").bytes,
        ),
      ).releaseStatus,
    };
    write("acceptance-status.json", report);
    console.log(
      JSON.stringify(
        {
          status: report.status,
          externalProviderCalls: report.externalProviderCalls,
          quality: report.quality,
        },
        null,
        2,
      ),
    );
    return { exitCode: 0, report };
  } catch (e) {
    write("acceptance-status.json", {
      status: "failed",
      externalCallsMayHaveStarted: true,
      commercialApproval: false,
      reason: "调用、协议校验或导出未完成；不能自动重试或用固定稿替代。",
    });
    throw Error(
      "真实规划验收未完成；可能产生的服务商调用请核对用量，不自动重试。",
    );
  }
}
if (require.main === module)
  main()
    .then((r) => {
      process.exitCode = r.exitCode;
    })
    .catch(() => {
      console.error("验收失败。请核对参数、通道与私有输出目录；未发布结果。");
      process.exitCode = 1;
    });
module.exports = { main, argumentsOf };
