import { runtimeCatalog } from "./runtime-catalog";
import { startASRProcess } from "./asr-process";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { runtimeSkills, type SkillRun, type SkillArtifact } from "../../shared/skillRuntime";
import type { Output } from "./executors";
import type { PDFPageCheckpoint } from "./pdf-ocr";
import { SkillRequestError as RequestError, normalizeFilename, validateSkillOptions, validRequestId, skillTaskId } from "./contracts";
import { SkillPlanStore, type Planner } from "./plan-store";
import type { SkillPlan, SkillOptions } from "../../shared/skillPlanning";
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
type Row = { id: string; owner: string; record: string; input: Uint8Array };
/** One scheduler per database/process. Not a general-purpose code sandbox. */
export class SkillService {
  private db: DatabaseSync;
  private plans: SkillPlanStore;
  private active = new Map<string, { worker: Worker; timeout: ReturnType<typeof setTimeout>; external?: ReturnType<typeof startASRProcess> }>();
  private closed = false;
  constructor(file = process.env.DESIGNBUDDY_SKILL_DB || "./data/skill-runs.sqlite", private timeoutMs = 45000, planner?: Planner) {
    if (file !== ":memory:") mkdirSync(dirname(resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS skill_runs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,record TEXT NOT NULL,input BLOB NOT NULL);
      CREATE INDEX IF NOT EXISTS skill_runs_owner ON skill_runs(owner);
      CREATE TABLE IF NOT EXISTS skill_artifacts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES skill_runs(id) ON DELETE CASCADE,meta TEXT NOT NULL,bytes BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS skill_run_checkpoints(run_id TEXT NOT NULL REFERENCES skill_runs(id) ON DELETE CASCADE,file_index INTEGER NOT NULL,page INTEGER NOT NULL,source_hash TEXT NOT NULL,meta TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(run_id,file_index,page));
      CREATE TABLE IF NOT EXISTS skill_submissions(owner TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,run_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(owner,request_key));`);
    this.plans = new SkillPlanStore(this.db, planner);
    let recoverableWork = false;
    for (const row of this.db.prepare("SELECT id,record FROM skill_runs WHERE json_extract(record,'$.status') IN ('queued','running')").all() as Row[]) {
      const record = JSON.parse(row.record) as SkillRun;
      if (!["queued", "running"].includes(record.status)) continue;
      if (["pdf.ocr", "pdf.ocr-batch"].includes(record.skillId)) {
        // OCR is local and input-hash-bound. Until page checkpoints are available, recover by rerunning the complete input, never by claiming continuation.
        record.status = "queued"; delete record.error;
        this.event(record, "服务已恢复；本地PDF OCR将加载已持久化的逐页检查点，从首个未完成页继续；当前中断页可能需要重新OCR。");
        recoverableWork = true;
      } else {
        record.status = "failed"; record.error = "服务重启中断了任务；请检查后重新提交，未自动重试。";
        this.event(record, record.error);
      }
      this.save(record);
    }
    if (recoverableWork) setImmediate(() => this.pump());
  }
  private save(record: SkillRun) { record.updatedAt = new Date().toISOString(); this.db.prepare("UPDATE skill_runs SET record=? WHERE id=?").run(JSON.stringify(record), record.id); }
  private row(id: string, owner?: string) {
    return (owner === undefined ? this.db.prepare("SELECT * FROM skill_runs WHERE id=?").get(id) : this.db.prepare("SELECT * FROM skill_runs WHERE id=? AND owner=?").get(id, owner)) as Row | undefined;
  }
  private pageCheckpoints(id:string):PDFPageCheckpoint[]{
    const rows=this.db.prepare("SELECT meta,bytes FROM skill_run_checkpoints WHERE run_id=? ORDER BY file_index,page").all(id) as {meta:string;bytes:Uint8Array}[];
    return rows.map(row=>({...JSON.parse(Buffer.from(row.meta).toString("utf8")),png:new Uint8Array(row.bytes)} as PDFPageCheckpoint));
  }
  private event(record: SkillRun, message: string) { if (record.events.length < 30) record.events.push({ at: new Date().toISOString(), message: message.slice(0, 500) }); }
  private finish(id: string, error?: string, result?: { summary: string; outputs: Output[] }) {
    const row = this.row(id); if (!row || this.closed) return;
    const record = JSON.parse(row.record) as SkillRun;
    if (record.status !== "running") return;
    const active = this.active.get(id);
    if (active) { active.external?.abort(); clearTimeout(active.timeout); this.active.delete(id); void active.worker.terminate(); }
    if (error) {
      const checkpoints=Number(this.db.prepare("SELECT count(*) AS n FROM skill_run_checkpoints WHERE run_id=?").get(id)?.n||0);
      const retry=Number(record.recoveryAttempts||0);
      if(/^执行超过 \d+ 秒限制/.test(error)&&["pdf.ocr","pdf.ocr-batch"].includes(record.skillId)&&checkpoints>0&&retry<10){record.status="queued";record.recoveryAttempts=retry+1;delete record.error;this.event(record,`单次OCR时限到达；已持久保存${checkpoints}个页级检查点，将自动恢复未完成部分（恢复段${record.recoveryAttempts}/10）。`);this.save(record);this.pump();return;}
      record.status = "failed"; record.error = error; this.event(record, error); this.save(record);
    }
    else if (result) {
      try {
        const receipt = Buffer.from(JSON.stringify({ runId: id, skillId: record.skillId, version: record.version, inputHash: record.inputHash, options: record.options, ...(record.taskId ? { taskId: record.taskId } : {}), ...(record.plan ? { plan: record.plan } : {}), summary: result.summary, events: record.events, limitations: runtimeSkills.find(s => s.id === record.skillId)?.limits }, null, 2));
        const outputs = [...result.outputs, { name: "execution-receipt.json", mime: "application/json", bytes: receipt }];
        if (outputs.length > 10 || outputs.some(o => !(o.bytes instanceof Uint8Array) || !o.bytes.length) || outputs.reduce((n, o) => n + o.bytes.length, 0) > 10_000_000) throw Error("交付文件超限或无效。");
        const checkpointSize=Number(this.db.prepare("SELECT coalesce(sum(length(meta)+length(bytes)),0) AS n FROM skill_run_checkpoints WHERE run_id=?").get(id)?.n||0);
        const used = Number(this.db.prepare("SELECT coalesce(sum(length(a.bytes)),0) AS n FROM skill_artifacts a JOIN skill_runs r ON r.id=a.run_id WHERE r.owner=?").get(row.owner)?.n || 0) + Number(this.db.prepare("SELECT coalesce(sum(length(input)),0) AS n FROM skill_runs WHERE owner=?").get(row.owner)?.n || 0)+Number(this.db.prepare("SELECT coalesce(sum(length(c.meta)+length(c.bytes)),0) AS n FROM skill_run_checkpoints c JOIN skill_runs r ON c.run_id=r.id WHERE r.owner=?").get(row.owner)?.n||0);
        const globalUsed = Number(this.db.prepare("SELECT (SELECT coalesce(sum(length(input)),0) FROM skill_runs)+(SELECT coalesce(sum(length(bytes)),0) FROM skill_artifacts)+(SELECT coalesce(sum(length(meta)+length(bytes)),0) FROM skill_run_checkpoints) AS n").get()?.n || 0);
        if (globalUsed-checkpointSize + outputs.reduce((n, o) => n + o.bytes.length, 0) > 1_000_000_000) throw Error("后台全局存储配额已满。");
        if (used-checkpointSize + outputs.reduce((n, o) => n + o.bytes.length, 0) > 100_000_000) throw Error("成果存储超过 100 MB，请删除不需要的运行记录后重试。");
        this.db.exec("BEGIN");
        try {
          record.artifacts = outputs.map(output => {
            const meta: SkillArtifact = { id: randomUUID(), name: output.name, mime: output.mime, size: output.bytes.length, sha256: hash(output.bytes) };
            this.db.prepare("INSERT INTO skill_artifacts VALUES(?,?,?,?)").run(meta.id, id, JSON.stringify(meta), output.bytes); return meta;
          });
          record.summary = result.summary; record.status = "succeeded"; this.event(record, "成果已持久化，可以下载。"); this.save(record); this.db.prepare("DELETE FROM skill_run_checkpoints WHERE run_id=?").run(id); this.db.exec("COMMIT");
        } catch (error) { this.db.exec("ROLLBACK"); throw error; }
      } catch (error) { record.status = "failed"; record.artifacts = []; record.error = error instanceof Error ? error.message : "保存失败。"; this.event(record, record.error); this.save(record); }
    }
    this.pump();
  }
  private pump() {
    if (this.closed) return;
    const queued = this.db.prepare("SELECT * FROM skill_runs WHERE json_extract(record,'$.status')='queued' ORDER BY rowid LIMIT 2").all() as Row[];
    for (const row of queued) {
      if (this.active.size >= 2) return;
      const fresh = this.row(row.id); if (!fresh || JSON.parse(fresh.record).status !== "queued") continue;
      const record = JSON.parse(fresh.record) as SkillRun; record.status = "running"; this.event(record, record.skillId === "document.summarize" ? "后台开始处理用户已授权上传的材料；此技能会将正文发送至已配置的第三方AI服务。" : "后台执行器开始处理已上传材料（不访问外网、不执行用户代码）。"); this.save(record);
      try {
        const worker = new Worker(resolve(__dirname, "worker.js"), { workerData: { skillId: record.skillId, filename: record.filename, bytes: row.input, owner: row.owner, ...record.options, ...(["pdf.ocr","pdf.ocr-batch"].includes(record.skillId)?{resumePages:this.pageCheckpoints(row.id)}:{}) }, resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 } });
        const executionTimeout = ["pdf.ocr","pdf.ocr-batch"].includes(record.skillId) ? Math.max(this.timeoutMs, 120000) : this.timeoutMs;
        const timeout = setTimeout(() => this.finish(row.id, `执行超过 ${Math.ceil(executionTimeout / 1000)} 秒限制，已终止；没有把未完成成果标记为成功。`), executionTimeout);
        this.active.set(row.id, { worker, timeout });
        worker.on("message", msg => {
          if (this.closed || !this.active.has(row.id)) return;
          if (msg.type === "asr-request") {
            const active=this.active.get(row.id);
            if (!active || active.worker!==worker || active.external || record.skillId!=="audio.transcribe-en" || typeof msg.id!=="string" || msg.id.length>80 || !(msg.pcm instanceof Uint8Array)) { this.finish(row.id,"离线识别进程请求无效。"); return; }
            try {
              active.external=startASRProcess(msg.pcm);
              const latest=this.row(row.id);if(latest){const r=JSON.parse(latest.record);this.event(r,"已启动受控离线英语识别进程；不访问网络。");this.save(r);}
              active.external.promise.then(result=>{if(this.active.get(row.id)===active)worker.postMessage({type:"asr-result",id:msg.id,result});}).catch(()=>{if(this.active.get(row.id)===active)this.finish(row.id,"离线识别进程失败或超时，未交付部分成果；请核对模型安装及音频质量。");});
            } catch { this.finish(row.id,"离线识别未配置或无法启动，没有生成转写。"); }
            return;
          }
          if(msg.type==="checkpoint"){
            const reply=(type:string)=>worker.postMessage({type,id:msg.id});
            try{
              const cp=msg.checkpoint as PDFPageCheckpoint, latest=this.row(row.id),current=latest?JSON.parse(latest.record) as SkillRun:undefined;
              if(!latest||!current||current.status!=="running"||!(["pdf.ocr","pdf.ocr-batch"].includes(current.skillId))||typeof msg.id!=="string"||msg.id.length>80||!cp||!Number.isInteger(cp.fileIndex)||cp.fileIndex<0||cp.fileIndex>(current.skillId==="pdf.ocr-batch"?3:0)||!Number.isInteger(cp.page)||cp.page<1||cp.page>6||! /^[a-f0-9]{64}$/.test(cp.sourceSHA256)||!(cp.png instanceof Uint8Array)||cp.png.length<8||cp.png.length>8000000||!cp.record||cp.record.page!==cp.page||!Array.isArray(cp.record.lines)||cp.record.lines.length>6000||typeof cp.record.text!=="string"||cp.record.text.length>60000||hash(cp.png)!==cp.record.rasterSHA256||hash(cp.record.text)!==cp.record.textSHA256||Buffer.from(cp.png.subarray(0,8)).toString("hex")!=="89504e470d0a1a0a")throw Error("OCR页级检查点结构或哈希校验失败。");
              const meta=Buffer.from(JSON.stringify({fileIndex:cp.fileIndex,sourceSHA256:cp.sourceSHA256,page:cp.page,record:cp.record}));if(meta.length>2000000)throw Error("OCR页级检查点元数据超过2MB。");
              const old=Number(this.db.prepare("SELECT coalesce(length(meta)+length(bytes),0) AS n FROM skill_run_checkpoints WHERE run_id=? AND file_index=? AND page=?").get(row.id,cp.fileIndex,cp.page)?.n||0);
              const runUsed=Number(this.db.prepare("SELECT coalesce(sum(length(meta)+length(bytes)),0) AS n FROM skill_run_checkpoints WHERE run_id=?").get(row.id)?.n||0);
              const ownerUsed=Number(this.db.prepare("SELECT coalesce(sum(length(input)),0) AS n FROM skill_runs WHERE owner=?").get(row.owner)?.n||0)+Number(this.db.prepare("SELECT coalesce(sum(length(a.bytes)),0) AS n FROM skill_artifacts a JOIN skill_runs r ON a.run_id=r.id WHERE r.owner=?").get(row.owner)?.n||0)+Number(this.db.prepare("SELECT coalesce(sum(length(c.meta)+length(c.bytes)),0) AS n FROM skill_run_checkpoints c JOIN skill_runs r ON c.run_id=r.id WHERE r.owner=?").get(row.owner)?.n||0);
              const globalUsed=Number(this.db.prepare("SELECT (SELECT coalesce(sum(length(input)),0) FROM skill_runs)+(SELECT coalesce(sum(length(bytes)),0) FROM skill_artifacts)+(SELECT coalesce(sum(length(c.meta)+length(c.bytes)),0) FROM skill_run_checkpoints c) AS n").get()?.n||0);
              if(runUsed-old+meta.length+cp.png.length>18000000||ownerUsed-old+meta.length+cp.png.length>100000000||globalUsed-old+meta.length+cp.png.length>1000000000)throw Error("页级OCR检查点超过后台存储配额。");
              this.db.prepare("INSERT INTO skill_run_checkpoints(run_id,file_index,page,source_hash,meta,bytes) VALUES(?,?,?,?,?,?) ON CONFLICT(run_id,file_index,page) DO UPDATE SET source_hash=excluded.source_hash,meta=excluded.meta,bytes=excluded.bytes").run(row.id,cp.fileIndex,cp.page,cp.sourceSHA256,meta,new Uint8Array(cp.png));
              this.event(current,`PDF第${cp.page}页检查点已持久保存（文件序号${cp.fileIndex+1}）；仅在最终成果提交后清除。`);this.save(current);reply("checkpoint-saved");
            }catch{reply("checkpoint-error");}
            return;
          }
          if (msg.type === "event") { const latest = this.row(row.id); if (latest) { const r = JSON.parse(latest.record); this.event(r, String(msg.message)); this.save(r); } }
          if (msg.type === "failure") this.finish(row.id, String(msg.error).slice(0, 400));
          if (msg.type === "result") this.finish(row.id, undefined, msg.result);
        });
        worker.on("error", () => { if (!this.closed && this.active.has(row.id)) this.finish(row.id, "执行器异常或超出资源限制，任务未完成。"); });
        worker.on("exit", () => { if (!this.closed && this.active.has(row.id)) this.finish(row.id, "执行器退出，未交付有效结果。"); });
      } catch { this.finish(row.id, "无法启动后台执行器。"); }
    }
  }
  private async readBody(request: Request, limit: number) {
    const reader = request.body?.getReader(); if (!reader) throw new RequestError("缺少请求内容。");
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > limit) { await reader.cancel(); throw new RequestError("请求内容超过大小限制。", 413); } chunks.push(r.value); } } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  }
  private async createRun(request: Request, owner: string): Promise<Response> {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new RequestError("请上传 multipart 文件。");
    const raw = await this.readBody(request, 2_100_000);
    let form: FormData; try { form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: raw }).formData(); } catch { throw new RequestError("上传表单格式错误。"); }
    if (form.get("consent") !== "true") throw new RequestError("请确认将材料上传到应用后台并执行。", 403);
    if (form.get("permission") === "仅本地") throw new RequestError("仅本地任务不能上传执行，请先修改任务权限。", 403);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 2_000_000) throw new RequestError("请选择不超过 2 MB 的非空文件。", 413);
    const inputBytes = new Uint8Array(await file.arrayBuffer()); const inputHash = hash(inputBytes), filename = normalizeFilename(file.name);
    let skillId: string, expertId: string, options: SkillOptions, key: string, plan: SkillPlan | undefined, taskId: string | undefined;
    if (form.has("planId")) {
      if ([...form.keys()].some(k => !["planId", "approvalDigest", "file", "consent"].includes(k))) throw new RequestError("已确认方案不能在执行请求中改写技能或参数，请重新规划。", 409);
      const planId = form.get("planId"); if (typeof planId !== "string" || !/^[a-f0-9-]{36}$/.test(planId)) throw new RequestError("方案标识无效。");
      plan = this.plans.forApproval(owner, planId, form.get("approvalDigest"));
      if (plan.file.sha256 !== inputHash || plan.file.name !== filename || plan.file.size !== file.size) throw new RequestError("所选文件与方案不一致（文件名、大小或SHA-256不同），请重新规划。", 409);
      if (plan.decision?.kind !== "plan") throw new RequestError("方案没有有效工具。", 409);
      taskId = plan.taskId;
      skillId = plan.decision.skillId; expertId = plan.decision.expertId; options = plan.decision.options; key = `plan:${plan.id}`;
    } else {
      taskId = skillTaskId(form.get("taskId"));
      skillId = String(form.get("skillId")); expertId = String(form.get("expertId"));
      let parameters: unknown;
      if (form.has("parameters")) { const value = form.get("parameters"); if (typeof value !== "string" || value.length > 2000) throw new RequestError("技能参数格式错误或过长。"); try { parameters = JSON.parse(value); } catch { throw new RequestError("技能参数必须是JSON对象。"); } }
      options = validateSkillOptions(skillId, { deduplicate: skillId === "table.analyze" && form.get("deduplicate") === "true", ...(parameters !== undefined ? { parameters } : {}) });
      const requestId = form.get("requestId"); if (requestId !== null && !validRequestId(requestId)) throw new RequestError("执行请求标识无效。");
      key = `manual:${requestId || randomUUID()}`;
    }
    const skill = runtimeCatalog().find(s => s.id === skillId);
    if (!skill || !skill.expertIds.includes(expertId)) throw new RequestError("该专家没有这个可执行技能。", 409);
    const fingerprint = hash(JSON.stringify({ filename, inputHash, skillId, expertId, version: plan?.skillVersion || skill.version, options, planId: plan?.id || null, ...(taskId ? { taskId } : {}) }));
    const existing = this.db.prepare("SELECT fingerprint,run_id FROM skill_submissions WHERE owner=? AND request_key=?").get(owner, key) as { fingerprint: string; run_id: string } | undefined;
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new RequestError("相同执行请求标识不能用于不同文件或参数。", 409);
      const previous = this.row(existing.run_id, owner); if (!previous) throw new RequestError("此请求的运行记录已删除，不会重复执行。新任务请重新提交。", 410);
      return response(JSON.parse(previous.record));
    }
    if (plan) this.plans.checkCurrent(plan);
    if (skill.status !== "ready") throw new RequestError("该技能尚未接通。", 409);
    const extension = /\.[a-z0-9]+$/i.exec(filename)?.[0].toLowerCase();
    if (!extension || !skill.accepts.includes(extension)) throw new RequestError("文件格式不受该技能支持。");
    const ownerUsage = Number(this.db.prepare("SELECT coalesce(sum(length(input)),0) AS n FROM skill_runs WHERE owner=?").get(owner)?.n || 0)
      + Number(this.db.prepare("SELECT coalesce(sum(length(a.bytes)),0) AS n FROM skill_artifacts a JOIN skill_runs r ON a.run_id=r.id WHERE r.owner=?").get(owner)?.n || 0)
      + Number(this.db.prepare("SELECT coalesce(sum(length(c.meta)+length(c.bytes)),0) AS n FROM skill_run_checkpoints c JOIN skill_runs r ON c.run_id=r.id WHERE r.owner=?").get(owner)?.n||0);
    const globalUsage = Number(this.db.prepare("SELECT (SELECT coalesce(sum(length(input)),0) FROM skill_runs)+(SELECT coalesce(sum(length(bytes)),0) FROM skill_artifacts)+(SELECT coalesce(sum(length(meta)+length(bytes)),0) FROM skill_run_checkpoints) AS n").get()?.n || 0);
    if (ownerUsage + file.size > 100_000_000 || globalUsage + file.size > 1_000_000_000) throw new RequestError("存储配额不足，请删除不需要的运行与文件。", 429);
    const count = Number(this.db.prepare("SELECT count(*) AS n FROM skill_runs WHERE owner=?").get(owner)?.n || 0);
    if (count >= 100) throw new RequestError("最多保存 100 次运行，请先删除不需要的记录。", 429);
    const running = Number(this.db.prepare("SELECT count(*) AS n FROM skill_runs WHERE json_extract(record,'$.status') IN ('queued','running')").get()?.n || 0);
    if (running >= 20) throw new RequestError("执行队列繁忙，请稍后重试。", 429);
    const recent = Number(this.db.prepare("SELECT count(*) AS n FROM skill_submissions WHERE owner=? AND created_at>?").get(owner, Date.now()-86400000)?.n || 0);
    if (recent >= 500) throw new RequestError("24小时内执行次数达到限制，请稍后重试。", 429);
    const now = new Date().toISOString();
    const record: SkillRun = { id: randomUUID(), ...(taskId ? { taskId } : {}), expertId, skillId, version: skill.version, status: "queued", filename, inputHash, createdAt: now, updatedAt: now, options,
      ...(plan ? { plan: { id: plan.id, goal: plan.goal, reason: plan.decision!.kind === "plan" ? plan.decision!.reason : "", approvalDigest: plan.approvalDigest!, plannedAt: plan.createdAt, confirmedAt: now } } : {}),
      events: [{ at: now, message: plan ? "用户已确认冻结方案；文件SHA-256一致，材料已保存并排队，未重复调用模型。" : "材料已保存并记录 SHA-256，等待执行。" }], artifacts: [] };
    this.db.exec("BEGIN");
    try {
      this.db.prepare("INSERT INTO skill_runs VALUES(?,?,?,?)").run(record.id, owner, JSON.stringify(record), inputBytes);
      this.db.prepare("INSERT INTO skill_submissions VALUES(?,?,?,?,?)").run(owner, key, fingerprint, record.id, Date.now());
      if (plan) this.plans.markExecuted(plan, owner, record.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    setImmediate(() => this.pump()); return response(record, 202);
  }
  async handle(request: Request, owner: string): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    try {
      const taskId = skillTaskId(url.searchParams.get("taskId"));
      if (path === "/api/skill-plans" && request.method === "GET") return response({ plans: this.plans.list(owner, taskId), serverConfigured: !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY) });
      if (path === "/api/skill-plans" && request.method === "POST") {
        if (!request.headers.get("content-type")?.includes("application/json")) throw new RequestError("规划请求必须是JSON。");
        const raw = await this.readBody(request, 32000); let body: unknown;
        try { body = JSON.parse(raw.toString("utf8")); } catch { throw new RequestError("规划请求JSON格式错误。"); }
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("规划请求需要对象结构。");
        const plan = await this.plans.create(owner, body as Record<string,unknown>, request.signal);
        return response(plan, plan.status === "planning" ? 202 : 200);
      }
      const planPath = path.match(/^\/api\/skill-plans\/([a-f0-9-]{36})(?:\/(cancel))?$/);
      if (planPath) {
        if (request.method === "GET" && !planPath[2]) return response(this.plans.get(owner, planPath[1]));
        if (request.method === "POST" && planPath[2] === "cancel") return response(this.plans.cancel(owner, planPath[1]));
        if (request.method === "DELETE" && !planPath[2]) return response(this.plans.remove(owner, planPath[1]));
        return response({ error: "不支持此方案操作。" }, 405);
      }
      if (path === "/api/skill-runtime" && request.method === "GET") return response({ skills: runtimeCatalog(), policy: { maxInputBytes: 2000000, timeoutSeconds: 45, concurrency: 2, maxRunsPerUser: 100, retention: "保存在应用后台，用户可删除；不自动清理。无自动外部操作。" } });
      if (path === "/api/skill-runs" && request.method === "GET") {
        const rows = this.db.prepare("SELECT record FROM skill_runs WHERE owner=? AND (? IS NULL OR json_extract(record,'$.taskId')=?) ORDER BY rowid DESC LIMIT 100").all(owner, taskId || null, taskId || null) as { record: string }[];
        return response({ runs: rows.map(r => JSON.parse(r.record)) });
      }
      if (path === "/api/skill-runs" && request.method === "POST") return await this.createRun(request, owner);
      const match = path.match(/^\/api\/skill-runs\/([a-f0-9-]+)(?:\/(cancel|resume|artifacts)(?:\/([a-f0-9-]+))?)?$/);
      if (!match) return response({ error: "技能接口不存在。" }, 404);
      const row = this.row(match[1], owner); if (!row) return response({ error: "运行记录不存在。" }, 404);
      const record = JSON.parse(row.record) as SkillRun;
      if (request.method === "GET" && !match[2]) return response(record);
      if (request.method === "GET" && match[2] === "artifacts" && match[3]) {
        const artifact = this.db.prepare("SELECT * FROM skill_artifacts WHERE id=? AND run_id=?").get(match[3], record.id) as { meta: string; bytes: Uint8Array } | undefined;
        if (!artifact || record.status !== "succeeded") return response({ error: "成果不存在。" }, 404);
        const meta = JSON.parse(artifact.meta) as SkillArtifact;
        return new Response(new Uint8Array(artifact.bytes).buffer, { headers: { "Content-Type": meta.mime, "Content-Length": String(artifact.bytes.length), "Content-Disposition": `attachment; filename="${meta.name}"`, "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
      }
      if (request.method === "POST" && match[2] === "resume") {
        if (!["pdf.ocr", "pdf.ocr-batch"].includes(record.skillId)) return response({ error: "目前仅支持重新处理本地PDF OCR运行。" }, 409);
        if (!["failed", "cancelled"].includes(record.status)) return response({ error: "只有失败或已取消的PDF OCR运行可重新处理。" }, 409);
        record.status = "queued"; record.artifacts = []; record.recoveryAttempts = 0; delete record.error; delete record.summary;
        this.event(record, "用户请求继续PDF OCR；将校验并复用已持久化的逐页检查点，重新处理未完成页。"); this.save(record);
        setImmediate(() => this.pump()); return response(record, 202);
      }
      if ((request.method === "POST" && match[2] === "cancel") || (request.method === "DELETE" && !match[2])) {
        const active = this.active.get(record.id); if (active) { active.external?.abort(); clearTimeout(active.timeout); this.active.delete(record.id); await active.worker.terminate(); await active.external?.promise.catch(() => {}); }
        if (request.method === "DELETE") this.db.prepare("DELETE FROM skill_runs WHERE id=? AND owner=?").run(record.id, owner);
        else if (["queued", "running"].includes(record.status)) { record.status = "cancelled"; this.event(record, "用户已取消，执行器已停止。"); this.save(record); }
        this.pump(); return response(request.method === "DELETE" ? { deleted: true } : record);
      }
      return response({ error: "不支持此操作。" }, 405);
    } catch (error) {
      if (error instanceof RequestError) return response({ error: error.message }, error.status);
      return response({ error: "技能服务处理失败，未确认成功。请稍后重试。" }, 500);
    }
  }
  async close() { this.closed = true; this.plans.close(); for (const a of this.active.values()) { a.external?.abort(); clearTimeout(a.timeout); await a.worker.terminate(); await a.external?.promise.catch(() => {}); } this.active.clear(); this.db.close(); }
}
