import type { SkillOptions } from "../../shared/skillPlanning";
export class SkillRequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const normalizeFilename = (name: string) => name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120);
export const validRequestId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
export function validateSkillOptions(skillId: string, value: unknown): SkillOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SkillRequestError("技能选项格式错误。");
  const o = value as Record<string, unknown>;
  if (Object.keys(o).some(k => !["deduplicate", "parameters"].includes(k)) || typeof o.deduplicate !== "boolean") throw new SkillRequestError("技能选项不符合白名单。");
  if (skillId !== "table.analyze" && o.deduplicate) throw new SkillRequestError("该技能不支持表格去重。");
  if (skillId === "slides.create") {
    const p = o.parameters;
    if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length !== 1 || (p as Record<string, unknown>).externalConsent !== "yes") throw new SkillRequestError("演示规划会将需求与提取正文发送至服务端第三方AI模型；须单次明确授权，且不接受上传凭据/端点/模型参数。");
    return { deduplicate: false, parameters: { externalConsent: "yes" } };
  }
  if (skillId === "document.summarize") {
    const p=o.parameters;
    if (!p || typeof p!=="object" || Array.isArray(p) || Object.keys(p).length!==1 || (p as Record<string,unknown>).externalConsent!=="yes") throw new SkillRequestError("该摘要会把完整正文发送给服务端配置的第三方AI模型；请单次明确授权后再执行。");
    return {deduplicate:false,parameters:{externalConsent:"yes"}};
  }
  if (skillId === "audio.transcribe-en") {
    const p=o.parameters;
    if (!p || typeof p!=="object" || Array.isArray(p) || Object.keys(p).length!==1 || (p as Record<string,unknown>).englishConfirmed!=="yes") throw new SkillRequestError("请明确确认音频主要为英语；不自动检测语言，不支持中文或多语种。不得提供额外参数。");
    return {deduplicate:false,parameters:{englishConfirmed:"yes"}};
  }
  if (skillId === "table.join") {
    if (!o.parameters || typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("请填写关联工作表、字段和连接方式。");
    const p = o.parameters as Record<string, unknown>;
    const fields: Record<string, number> = { leftSheet: 31, rightSheet: 31, leftKey: 100, rightKey: 100, joinType: 5 };
    if (Object.keys(p).some(k => !Object.hasOwn(fields, k)) || Object.entries(fields).some(([k,n]) => typeof p[k] !== "string" || !(p[k] as string).trim() || (p[k] as string).length > n || /[\x00-\x1f\x7f]/.test(p[k] as string))) throw new SkillRequestError("关联参数不合法：工作表名称最多31字，字段最多100字，必须逐项填写，不支持额外参数。");
    if (!["left", "inner", "full"].includes(p.joinType as string)) throw new SkillRequestError("连接方式只支持left、inner、full。");
    if (p.leftSheet === p.rightSheet) throw new SkillRequestError("请指定两个不同的工作表。");
    return { deduplicate: false, parameters: { leftSheet: p.leftSheet as string, rightSheet: p.rightSheet as string, leftKey: p.leftKey as string, rightKey: p.rightKey as string, joinType: p.joinType as string } };
  }
  if (skillId === "finance.report") {
    const p = o.parameters;
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new SkillRequestError("请指定日期、分类、收支类型和金额字段。");
    const params = p as Record<string, unknown>;
    const required = ["dateField", "categoryField", "typeField", "amountField", "incomeValue", "expenseValue", "currency"];
    const allowed = [...required, "descriptionField", "startDate", "endDate", "title"];
    if (Object.keys(params).some(k => !allowed.includes(k)) || required.some(k => typeof params[k] !== "string" || !(params[k] as string).trim())) throw new SkillRequestError("财务报告参数缺少必填字段或包含未知字段。");
    const maxLength: Record<string, number> = { dateField: 100, categoryField: 100, typeField: 100, amountField: 100, incomeValue: 60, expenseValue: 60, currency: 12, descriptionField: 100, startDate: 10, endDate: 10, title: 100 };
    for (const [key, value] of Object.entries(params)) if (typeof value !== "string" || value.length > maxLength[key] || /[\x00-\x1f\x7f]/.test(value)) throw new SkillRequestError(`财务报告参数 ${key} 类型、长度或内容不合法。`);
    if (params.incomeValue === params.expenseValue) throw new SkillRequestError("收入与支出分类值必须不同。");
    const normalized = Object.fromEntries(allowed.map(key => [key, typeof params[key] === "string" ? params[key] : ""])) as Record<string, string>;
    normalized.title = normalized.title.trim() || "财务汇总报告";
    return { deduplicate: false, parameters: normalized };
  }
  if (skillId === "data.report") {
    const p = o.parameters;
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new SkillRequestError("请指定分组字段和聚合方式。");
    const params = p as Record<string, unknown>;
    const allowed = ["groupBy", "metric", "aggregation", "title"];
    if (Object.keys(params).some(k => !allowed.includes(k)) || typeof params.groupBy !== "string" || !params.groupBy.trim() || params.groupBy.length > 100 || typeof params.aggregation !== "string" || !["sum", "average", "count"].includes(params.aggregation)) throw new SkillRequestError("报告参数不合法：请提供字段名和sum/average/count聚合方式。");
    for (const key of ["metric", "title"]) if (params[key] !== undefined && (typeof params[key] !== "string" || (params[key] as string).length > 100 || /[\x00-\x1f\x7f]/.test(params[key] as string))) throw new SkillRequestError("指标字段或标题格式不合法。");
    if (params.aggregation !== "count" && (typeof params.metric !== "string" || !params.metric.trim())) throw new SkillRequestError("sum/average聚合必须指定数值指标字段。");
    return { deduplicate: false, parameters: { groupBy: params.groupBy, metric: typeof params.metric === "string" ? params.metric : "", aggregation: params.aggregation, title: typeof params.title === "string" && params.title.trim() ? params.title : "分组数据报告" } };
  }
  if (skillId === "web.verify" || skillId === "test.browser") {
    if (!o.parameters || typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("请填写要验证的站点地址。");
    const p = o.parameters as Record<string, unknown>;
    if (Object.keys(p).some(k => k !== "baseUrl")) throw new SkillRequestError("该技能只接受 baseUrl 参数。");
    if (typeof p.baseUrl !== "string" || !p.baseUrl.trim() || p.baseUrl.length > 200 || /[\x00-\x1f\x7f]/.test(p.baseUrl)) throw new SkillRequestError("站点地址不合法：只填 http/https 主机与端口，最长 200 字。");
    return { deduplicate: false, parameters: { baseUrl: p.baseUrl.trim() } };
  }
  if (skillId === "code.build") {
    if (o.parameters !== undefined) {
      if (typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("构建参数格式错误。");
      const p = o.parameters as Record<string, unknown>;
      if (Object.keys(p).some(k => k !== "buildCommand")) throw new SkillRequestError("该技能只接受 buildCommand 参数。");
      if (p.buildCommand !== undefined && (typeof p.buildCommand !== "string" || p.buildCommand.length > 60 || /[\x00-\x1f\x7f|;&$`><]/.test(p.buildCommand))) throw new SkillRequestError("构建命令不合法：最多 60 字且不得包含管道、重定向或链式命令。");
    }
    const command = (o.parameters as Record<string, string> | undefined)?.buildCommand;
    return { deduplicate: false, parameters: command ? { buildCommand: command.trim() } : {} };
  }
  if (skillId === "image.generate") {
    if (!o.parameters || typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("请确认第三方模型授权与出图参数。");
    const p = o.parameters as Record<string, unknown>;
    const allowed = ["externalConsent", "size", "count"];
    if (Object.keys(p).some(k => !allowed.includes(k))) throw new SkillRequestError("该技能只接受 externalConsent、size、count 参数。");
    if (p.externalConsent !== "yes") throw new SkillRequestError("生成图片会把提示词发送给第三方图像模型；请单次明确授权后再执行。");
    const sizes = ["256x256", "512x512", "1024x1024", "1024x1536", "1536x1024", "1792x1024", "1024x1792"];
    if (p.size !== undefined && (typeof p.size !== "string" || !sizes.includes(p.size))) throw new SkillRequestError(`图片尺寸只支持 ${sizes.join("、")}。`);
    if (p.count !== undefined && (typeof p.count !== "string" || !/^[1-4]$/.test(p.count))) throw new SkillRequestError("一次最多生成 4 张。");
    return { deduplicate: false, parameters: { externalConsent: "yes", size: typeof p.size === "string" ? p.size : "1024x1024", count: typeof p.count === "string" ? p.count : "1" } };
  }
  if (skillId === "collaboration.sync") {
    if (!o.parameters || typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("请确认本次外发并提供幂等键。");
    const p = o.parameters as Record<string, unknown>;
    const allowed = ["externalConsent", "confirmation", "idempotencyKey"];
    if (Object.keys(p).some(k => !allowed.includes(k))) throw new SkillRequestError("该技能只接受 externalConsent、confirmation、idempotencyKey 参数。");
    if (p.externalConsent !== "yes") throw new SkillRequestError("该操作会把内容发送到第三方服务；请单次明确授权后再执行。");
    if (p.confirmation !== "yes") throw new SkillRequestError("每次外发或写入都需要逐次确认。");
    if (typeof p.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(p.idempotencyKey)) throw new SkillRequestError("请提供 8–80 位幂等键（仅字母、数字、下划线、连字符）。");
    return { deduplicate: false, parameters: { externalConsent: "yes", confirmation: "yes", idempotencyKey: p.idempotencyKey } };
  }
  if (skillId !== "image.marketing") {
    if (o.parameters !== undefined) throw new SkillRequestError("该技能不支持这些参数。");
    return { deduplicate: o.deduplicate };
  }
  if (!o.parameters || typeof o.parameters !== "object" || Array.isArray(o.parameters)) throw new SkillRequestError("请填写海报标题等排版参数。");
  const limits: Record<string, number> = { title: 36, subtitle: 80, action: 16 };
  if (Object.entries(o.parameters).some(([key, val]) => !Object.hasOwn(limits,key) || typeof val !== "string" || val.length > limits[key] || /[\x00-\x1f\x7f]/.test(val))) throw new SkillRequestError("海报参数不合法：标题36字、副标题80字、行动文字16字。");
  const p = o.parameters as Record<string, string>;
  if (!p.title?.trim()) throw new SkillRequestError("请填写海报标题。");
  return { deduplicate: false, parameters: { title: p.title, subtitle: p.subtitle || "", action: p.action || "" } };
}

/** Owner-scoped conversation grouping, not a project membership or authorization token. */
export function skillTaskId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (!validRequestId(value)) throw new SkillRequestError("任务标识无效。");
  return value;
}
