import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import { deleteSchedule, fetchScheduleRuns, fetchSchedules, saveSchedule, type ServerSchedule } from "../api/tasks";
import { navigateTo } from "../workspaceRoutes";
import "./schedules.css";

type ScheduleRun = { id: string; startedAt: number; finishedAt: number | null; status: string; detail: string };

const statusLabel: Record<string, string> = { succeeded: "成功", failed: "失败", skipped: "跳过", running: "执行中" };

function time(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Scheduled checks.
 *
 * Every plan is a real server-side schedule: the backend runs the request on
 * time, records the attempt and raises a notification when it fails. The page
 * only shows what the server actually reports.
 */
export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ServerSchedule[] | null>(null);
  const [runs, setRuns] = useState<Record<string, ScheduleRun[]>>({});
  const [expanded, setExpanded] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://127.0.0.1:8787/api/health");
  const [cron, setCron] = useState("*/30 * * * *");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [expectStatus, setExpectStatus] = useState("200");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSchedules(await fetchSchedules());
      setError("");
    } catch (cause) {
      setSchedules([]);
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "计划服务暂不可用，请确认后端已启动。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function showRuns(id: string) {
    if (expanded === id) { setExpanded(""); return; }
    setExpanded(id);
    try {
      const history = await fetchScheduleRuns(id);
      setRuns((current) => ({ ...current, [id]: history }));
    } catch {
      setRuns((current) => ({ ...current, [id]: [] }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const created = await saveSchedule({
        name: name.trim() || "定时检查",
        url: url.trim(),
        cron: cron.trim(),
        timezone: timezone.trim() || "UTC",
        expectStatus: Number(expectStatus) || 200,
        enabled: true,
      });
      setNotice(`已创建计划「${created.name}」，下次运行：${time(created.nextRunAt)}。`);
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "计划规则无效，请检查表达式与地址。");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(schedule: ServerSchedule) {
    setBusy(true);
    try {
      await saveSchedule({
        id: schedule.id,
        name: schedule.name,
        url: schedule.url,
        cron: schedule.cron,
        timezone: schedule.timezone,
        expectStatus: schedule.expectStatus,
        timeoutMs: schedule.timeoutMs,
        enabled: !schedule.enabled,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(schedule: ServerSchedule) {
    setBusy(true);
    try {
      await deleteSchedule(schedule.id);
      setNotice(`已删除计划「${schedule.name}」。`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  }

  return <div className="workbuddy-app schedules-workspace">
    <WorkBuddySidebar active="plugins" go={navigateTo} setNotice={setNotice} projectCount={0} />
    <main className="schedules-main" aria-label="定时任务">
      <header className="schedules-topbar"><MarketNavigation active="connectors" className="schedules-nav" /><button className="schedules-create-button" type="button" onClick={() => document.getElementById("schedule-form")?.scrollIntoView({ behavior: "smooth" })}><HomeIcon name="plus" size={18} />新建计划</button></header>
      <div className="schedules-content">
        <section className="schedules-hero"><div><span className="schedules-eyebrow">服务器调度 · 真实执行</span><h1>定时任务</h1><p>计划由服务器按 cron 与时区执行，每次运行都会留下记录；失败会进入通知中心。</p></div></section>
        {(notice || error) && <p className={error ? "schedules-message is-error" : "schedules-message"} role="status">{error || notice}</p>}
        <form id="schedule-form" className="schedule-form" onSubmit={submit}>
          <h2>新建定时检查</h2>
          <div className="schedule-form-grid">
            <label>名称<input aria-label="名称" value={name} maxLength={60} placeholder="例如：官网可用性" onChange={event => setName(event.target.value)} /></label>
            <label>检查地址<input aria-label="检查地址" value={url} maxLength={200} onChange={event => setUrl(event.target.value)} required /></label>
            <label>cron 表达式<input aria-label="cron 表达式" value={cron} maxLength={60} onChange={event => setCron(event.target.value)} required /><small>分 时 日 月 周，例如 */30 * * * *</small></label>
            <label>时区<input aria-label="时区" value={timezone} maxLength={60} onChange={event => setTimezone(event.target.value)} required /><small>IANA 名称，例如 Asia/Shanghai</small></label>
            <label>期望状态码<input aria-label="期望状态码" value={expectStatus} maxLength={3} onChange={event => setExpectStatus(event.target.value)} /></label>
          </div>
          <button className="schedules-primary" type="submit" disabled={busy}>{busy ? "正在保存…" : "创建计划"}</button>
        </form>
        <section className="schedule-list" aria-label="计划列表">
          <h2>已有计划（{schedules?.length ?? 0}）</h2>
          {!schedules ? <p role="status">正在读取服务器计划…</p> : !schedules.length ? <p className="schedule-empty" role="status">还没有计划。创建后由服务器按计划真实发起检查。</p> : <ul>
            {schedules.map(schedule => <li key={schedule.id} className={schedule.enabled ? "" : "is-paused"}>
              <div className="schedule-row"><div><strong>{schedule.name}</strong><span>{schedule.url}</span></div><div className="schedule-meta"><span>{schedule.cron} · {schedule.timezone}</span><span>期望 HTTP {schedule.expectStatus}</span><span>下次：{time(schedule.nextRunAt)}</span><span>上次：{time(schedule.lastRunAt)}{schedule.lastStatus ? `（${statusLabel[schedule.lastStatus] || schedule.lastStatus}）` : ""}</span></div>
              <div className="schedule-actions"><button type="button" onClick={() => void showRuns(schedule.id)}>{expanded === schedule.id ? "收起记录" : "运行记录"}</button><button type="button" disabled={busy} onClick={() => void toggle(schedule)}>{schedule.enabled ? "暂停" : "启用"}</button><button type="button" disabled={busy} onClick={() => void remove(schedule)}>删除</button></div></div>
              {expanded === schedule.id && <div className="schedule-runs"><h3>运行记录</h3>{!runs[schedule.id]?.length ? <p role="status">还没有运行记录。</p> : <ul>{runs[schedule.id]!.map(run => <li key={run.id}><span>{time(run.startedAt)}</span><span>{statusLabel[run.status] || run.status}</span><span>{run.detail}</span></li>)}</ul>}</div>}
            </li>)}
          </ul>}
        </section>
      </div>
    </main>
  </div>;
}
