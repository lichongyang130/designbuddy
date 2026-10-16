import { TaskBackend, type ScheduleRecord } from "./task-backend";

/**
 * Server-side scheduler.
 *
 * It runs the schedules that are due, records every attempt as a run record and
 * raises a notification when a check fails. The scheduler never invents a
 * target: the URL comes from the schedule the owner created.
 *
 * Duplicate protection: a schedule whose previous run is still marked
 * `running` is skipped instead of started a second time.
 */
export class ScheduleRunner {
  private running = false;

  constructor(private tasks: TaskBackend) {}

  static allowedHosts(): Set<string> {
    const configured = (process.env.SKILL_SCHEDULER_ALLOWED_HOSTS || "")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    if (configured.length) return new Set(configured);
    return new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  }

  async runOnce(schedule: ScheduleRecord): Promise<{ status: string; detail: string }> {
    const host = new URL(schedule.url).host.toLowerCase();
    const allowed = ScheduleRunner.allowedHosts();
    if (!allowed.has(host) && !allowed.has(new URL(schedule.url).hostname.toLowerCase()))
      return { status: "failed", detail: `目标 ${host} 不在允许列表内，未执行。` };
    try {
      const response = await fetch(schedule.url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(schedule.timeoutMs),
      });
      await response.body?.cancel();
      const ok = response.status === schedule.expectStatus;
      return {
        status: ok ? "succeeded" : "failed",
        detail: `HTTP ${response.status}（期望 ${schedule.expectStatus}）`,
      };
    } catch (error) {
      return { status: "failed", detail: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) };
    }
  }

  /** Process every schedule that is due. Returns the number of executed runs. */
  async tick(now = Date.now()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let executed = 0;
    try {
      for (const schedule of this.tasks.dueSchedules(now)) {
        const history = this.tasks.listScheduleRuns(schedule.ownerId, schedule.id);
        if (history.some(run => run.status === "running")) {
          this.tasks.recordScheduleResult(schedule, "skipped");
          continue;
        }
        const runId = this.tasks.startScheduleRun(schedule);
        const result = await this.runOnce(schedule);
        this.tasks.finishScheduleRun(runId, result.status, result.detail);
        this.tasks.recordScheduleResult(schedule, result.status);
        executed += 1;
        if (result.status !== "succeeded")
          this.tasks.addNotification(schedule.ownerId, {
            kind: "error",
            title: `定时检查失败：${schedule.name}`,
            description: `${schedule.url} ${result.detail}`,
          });
      }
    } finally {
      this.running = false;
    }
    return executed;
  }

  start(intervalMs = Number(process.env.SKILL_SCHEDULER_INTERVAL_MS || 30000)): () => void {
    const timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }
}
