import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { SkillPlan, SkillPlanningRequest } from "../../shared/skillPlanning";
import { runtimeSkills } from "../../shared/skillRuntime";
import { routingExperts } from "../../shared/expertRouting";
import { normalizeFilename, SkillRequestError, validRequestId, skillTaskId } from "./contracts";
import { planSkill, validateDecision, validateModelSettings, planningCandidates } from "./planner";
export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export function approvalDigest(plan: SkillPlan) { return digest(JSON.stringify({ id: plan.id, goal: plan.goal, file: plan.file, expertScope: plan.expertScope, ...(plan.skillScope ? { skillScope: plan.skillScope } : {}), decision: plan.decision, skillVersion: plan.skillVersion, createdAt: plan.createdAt, expiresAt: plan.expiresAt, ...(plan.taskId ? { taskId: plan.taskId } : {}) })); }
export type Planner = typeof planSkill;
export class SkillPlanStore {
  private active = new Map<string, AbortController>(); private closed = false;
  constructor(private db: DatabaseSync, private planner: Planner = planSkill) {
    db.exec(`CREATE TABLE IF NOT EXISTS skill_plans(id TEXT PRIMARY KEY,owner TEXT NOT NULL,record TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS skill_plans_owner ON skill_plans(owner);
      CREATE TABLE IF NOT EXISTS skill_plan_requests(owner TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,plan_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(owner,request_key));`);
    const unfinished = db.prepare("SELECT id,record FROM skill_plans WHERE json_extract(record,'$.status')='planning'").all() as { id: string; record: string }[];
    for (const r of unfinished) { const p = JSON.parse(r.record) as SkillPlan; p.status = "failed"; p.error = "服务重启中断规划；未自动重试模型，也未执行任务。"; this.save(p); }
  }
  get(owner: string, id: string): SkillPlan {
    const row = this.db.prepare("SELECT record FROM skill_plans WHERE id=? AND owner=?").get(id, owner) as { record: string } | undefined;
    if (!row) throw new SkillRequestError("技能方案不存在。", 404);
    return JSON.parse(row.record);
  }
  list(owner: string, taskId?: string) { return (this.db.prepare("SELECT record FROM skill_plans WHERE owner=? AND (? IS NULL OR json_extract(record,'$.taskId')=?) ORDER BY rowid DESC LIMIT 50").all(owner, taskId || null, taskId || null) as { record: string }[]).map(r => JSON.parse(r.record) as SkillPlan); }
  private save(plan: SkillPlan) { this.db.prepare("UPDATE skill_plans SET record=? WHERE id=?").run(JSON.stringify(plan), plan.id); }
  async create(owner: string, raw: Record<string, unknown>, signal: AbortSignal): Promise<SkillPlan> {
    if (raw.consent !== true || raw.permission === "仅本地") throw new SkillRequestError("需要单独允许将任务描述和文件元数据发送模型，不能在仅本地模式下规划。", 403);
    if (Object.keys(raw).some(k => !["requestId", "goal", "file", "expertScope", "skillScope", "consent", "permission", "model", "provider", "apiKey", "taskId"].includes(k))) throw new SkillRequestError("规划请求包含不支持的字段。");
    if (!validRequestId(raw.requestId) || typeof raw.goal !== "string" || !raw.goal.trim() || raw.goal.length > 4000) throw new SkillRequestError("请提供请求标识和1–4000字任务描述。");
    const file = raw.file as Record<string, unknown>;
    if (!file || typeof file !== "object" || Array.isArray(file) || Object.keys(file).some(k => !["name", "size", "sha256"].includes(k)) || typeof file.name !== "string" || !file.name || normalizeFilename(file.name) !== file.name || !Number.isInteger(file.size) || Number(file.size) < 1 || Number(file.size) > 2000000 || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new SkillRequestError("文件元数据不合法，请重新选择不超过2MB的文件。");
    if (raw.expertScope !== undefined && (typeof raw.expertScope !== "string" || !routingExperts.some(e => e.id === raw.expertScope))) throw new SkillRequestError("专家范围无效。");
    if (raw.skillScope !== undefined && (!Array.isArray(raw.skillScope) || raw.skillScope.length > 50 || !raw.skillScope.every(id => typeof id === "string" && runtimeSkills.some(skill => skill.id === id && (!raw.expertScope || skill.expertIds.includes(raw.expertScope as string)))) || new Set(raw.skillScope).size !== raw.skillScope.length)) throw new SkillRequestError("技能类别范围无效或超出所选专家的真实绑定。");
    const taskId = skillTaskId(raw.taskId);
    validateModelSettings(raw);
    const request = { ...raw, goal: raw.goal.trim() } as unknown as SkillPlanningRequest;
    const fingerprint = digest(JSON.stringify({ goal: request.goal, file: { name: file.name, size: file.size, sha256: file.sha256 }, expertScope: request.expertScope || null, skillScope: request.skillScope || null, model: request.model || null, provider: request.provider || null, ...(taskId ? { taskId } : {}) }));
    const existing = this.db.prepare("SELECT fingerprint,plan_id FROM skill_plan_requests WHERE owner=? AND request_key=?").get(owner, request.requestId) as { fingerprint: string; plan_id: string } | undefined;
    if (existing) { if (existing.fingerprint !== fingerprint) throw new SkillRequestError("同一请求标识不能用于不同任务，请重新生成方案。", 409); try { return this.get(owner, existing.plan_id); } catch { throw new SkillRequestError("此请求对应的方案已删除，不会重复调用模型；新任务请使用新的请求标识。", 410); } }
    if (this.list(owner).length >= 50) throw new SkillRequestError("最多保留50份方案，请先删除不需要的方案。", 429);
    const day = Date.now() - 24 * 60 * 60 * 1000;
    const own = Number(this.db.prepare("SELECT count(*) AS n FROM skill_plan_requests WHERE owner=? AND created_at>?").get(owner, day)?.n || 0);
    const total = Number(this.db.prepare("SELECT count(*) AS n FROM skill_plan_requests WHERE created_at>?").get(day)?.n || 0);
    const pending = Number(this.db.prepare("SELECT count(*) AS n FROM skill_plans WHERE json_extract(record,'$.status')='planning'").get()?.n || 0);
    const ownPending = this.list(owner).filter(p => p.status === "planning").length;
    if (own >= 20 || total >= 200 || pending >= 4 || ownPending >= 1) throw new SkillRequestError("规划次数或并发达到限制（每用户24小时20次、全局200次）；可使用不调用模型的手动执行。", 429);
    const plan: SkillPlan = { id: randomUUID(), ...(taskId ? { taskId } : {}), requestId: request.requestId, goal: request.goal, file: { name: file.name, size: Number(file.size), sha256: file.sha256 }, ...(request.expertScope ? { expertScope: request.expertScope } : {}), ...(request.skillScope ? { skillScope: request.skillScope } : {}), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: "planning" };
    this.db.exec("BEGIN");
    try { this.db.prepare("INSERT INTO skill_plans VALUES(?,?,?)").run(plan.id, owner, JSON.stringify(plan)); this.db.prepare("INSERT INTO skill_plan_requests VALUES(?,?,?,?,?)").run(owner, plan.requestId, fingerprint, plan.id, Date.now()); this.db.exec("COMMIT"); } catch (e) { this.db.exec("ROLLBACK"); throw e; }
    const controller = new AbortController(); this.active.set(plan.id, controller);
    try {
      const proposal = await this.planner(request, AbortSignal.any([signal, controller.signal, AbortSignal.timeout(22000)]));
      if (this.closed) return { ...plan, status: "failed", error: "服务已关闭，未执行任务。" };
      const current = this.get(owner, plan.id); if (current.status !== "planning") return current;
      // Revalidate even injected/test adapters; model output never becomes authority.
      const decision = validateDecision(proposal, planningCandidates(request), request.expertScope, request.goal);
      plan.decision = decision; plan.status = decision.kind === "plan" ? "review" : decision.kind;
      if (decision.kind === "plan") { plan.skillVersion = runtimeSkills.find(s => s.id === decision.skillId)!.version; plan.approvalDigest = approvalDigest(plan); }
      this.save(plan); return plan;
    } catch (e) {
      if (this.closed) return { ...plan, status: "failed", error: "服务已关闭，未执行任务。" };
      const current = this.get(owner, plan.id); if (current.status !== "planning") return current;
      plan.status = "failed";
      plan.error = e instanceof Error && /^(AI 服务|规划|技能规划|模型选择|无法连接模型|技能选项|该技能|请填写|请指定|连接方式|关联参数|海报参数)/.test(e.message) ? e.message.slice(0, 500) : "规划失败，没有执行任务；可手动选择技能。";
      this.save(plan); return plan;
    } finally { this.active.delete(plan.id); }
  }
  forApproval(owner: string, id: string, expected: unknown): SkillPlan {
    const plan = this.get(owner, id);
    if (!plan.approvalDigest || expected !== plan.approvalDigest || plan.approvalDigest !== approvalDigest(plan)) throw new SkillRequestError("确认内容与方案不一致，请重新查看方案。", 409);
    if (!["review", "executed"].includes(plan.status) || plan.decision?.kind !== "plan") throw new SkillRequestError("该方案不可执行，已取消或没有有效工具建议。", 409);
    return plan;
  }
  checkCurrent(plan: SkillPlan) {
    if (plan.status !== "review") throw new SkillRequestError("该方案已处理，不会重复执行。", 409);
    if (Date.parse(plan.expiresAt) <= Date.now()) throw new SkillRequestError("方案已超过15分钟有效期，请重新规划。", 410);
    if (plan.decision?.kind !== "plan") throw new SkillRequestError("没有待确认的技能。", 409);
    const decision = plan.decision;
    const current = runtimeSkills.find(s => s.id === decision.skillId && s.status === "ready" && s.version === plan.skillVersion && s.expertIds.includes(decision.expertId) && (!plan.skillScope || plan.skillScope.includes(s.id)));
    if (!current) throw new SkillRequestError("技能版本或可用性已变化，请重新规划。", 409);
  }
  markExecuted(plan: SkillPlan, owner: string, runId: string) {
    const latest = this.get(owner, plan.id); this.checkCurrent(latest);
    this.save({ ...latest, status: "executed", runId });
  }
  cancel(owner: string, id: string) {
    const plan = this.get(owner, id);
    if (plan.status === "executed") throw new SkillRequestError("方案已提交执行，请在运行记录中取消任务。", 409);
    this.active.get(id)?.abort(); plan.status = "cancelled"; this.save(plan); return plan;
  }
  remove(owner: string, id: string) { this.get(owner, id); this.active.get(id)?.abort(); this.db.prepare("DELETE FROM skill_plans WHERE owner=? AND id=?").run(owner, id); return { deleted: true }; }
  close() { this.closed = true; for (const controller of this.active.values()) controller.abort(); this.active.clear(); }
}
