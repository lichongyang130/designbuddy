import { useCallback, useEffect, useRef, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { navigateTo } from "../workspaceRoutes";
import {
  fetchAdminOverview,
  retryAdminTask,
  setAdminAccountDisabled,
  setAdminScheduleEnabled,
  type AdminOverview,
} from "../api/admin";
import "./admin.css";

function when(value: number): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN");
}

function number(value: number): string {
  return value.toLocaleString("zh-CN");
}

/**
 * The operator console of this server.
 *
 * It answers the questions an operator actually has: who uses the server, what
 * the models cost, what failed, what the platform can really run, and what
 * happened recently. The three actions are real server state changes.
 */
export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const actionError = useRef(false);
  const fail = (message: string) => {
    actionError.current = true;
    setError(message);
  };
  const clearError = () => {
    actionError.current = false;
    setError("");
  };

  const load = useCallback(async () => {
    try {
      setOverview(await fetchAdminOverview());
      if (!actionError.current) setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "管理后台暂不可用。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setNotice(success);
      clearError();
      await load();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbuddy-app community-workspace">
      <WorkBuddySidebar
        active="plugins"
        go={navigateTo}
        setNotice={setNotice}
        projectCount={0}
        workspaceCount={0}
      />
      <main className="ad-main" aria-label="管理后台">
        <div className="ad-content">
          <section className="ad-hero">
            <div>
              <span className="ad-eyebrow">这台服务器</span>
              <h1>管理后台</h1>
              <p>
                谁在用、模型用了多少、什么失败了、平台现在真能跑哪些技能。
                管理员名单由服务端环境变量 <code>DESIGNBUDDY_ADMIN_ACCOUNTS</code> 决定；
                没有配置时这个页面不会给任何普通账号看。
              </p>
            </div>
          </section>

          {(error || notice) && (
            <p className={error ? "ad-message is-error" : "ad-message"} role="status">{error || notice}</p>
          )}

          {!overview && !error && <p className="ad-note">正在读取服务器状态…</p>}

          {overview && (
            <>
              <section className="ad-stats" aria-label="总览">
                <div className="ad-stat">
                  <strong>{number(overview.accounts.total)}</strong>
                  <span>账号（{overview.accounts.disabled} 个已停用）</span>
                </div>
                <div className="ad-stat">
                  <strong>{number(overview.tasks.total)}</strong>
                  <span>任务记录</span>
                </div>
                <div className="ad-stat">
                  <strong>{number(overview.usage.calls)}</strong>
                  <span>模型调用（{number(overview.usage.totalTokens)} tokens）</span>
                </div>
                <div className="ad-stat">
                  <strong>{number(overview.schedules.enabled)}/{number(overview.schedules.total)}</strong>
                  <span>定时任务在跑</span>
                </div>
                <div className="ad-stat">
                  <strong>{number(overview.skills.ready)}/{number(overview.skills.total)}</strong>
                  <span>技能可执行</span>
                </div>
              </section>

              <section className="ad-card" aria-label="账号">
                <h2>账号（{overview.accounts.total}）</h2>
                <p className="ad-note">停用账号会立刻结束它的所有会话，并拒绝它再次登录；操作会写进审计。</p>
                <ul className="ad-list">
                  {overview.accounts.list.map((account) => (
                    <li key={account.id} data-account={account.username}>
                      <div className="ad-item-head">
                        <strong>{account.username}</strong>
                        <span>
                          {account.displayName || "未填显示名"} · {account.email || "未填邮箱"} · 注册于{" "}
                          {account.createdAt ? new Date(account.createdAt).toLocaleString("zh-CN") : "—"}
                        </span>
                      </div>
                      <div className="ad-item-actions">
                        {account.disabled ? <span className="ad-flag is-off">已停用</span> : <span className="ad-flag">在用</span>}
                        <button
                          className="ad-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void act(
                            () => setAdminAccountDisabled(account.id, !account.disabled).then(() => undefined),
                            account.disabled ? `已恢复「${account.username}」。` : `已停用「${account.username}」，它的会话已失效。`,
                          )}
                        >
                          {account.disabled ? "恢复" : "停用"}
                        </button>
                      </div>
                    </li>
                  ))}
                  {!overview.accounts.list.length && <li className="ad-empty">这台服务器还没有注册账号。</li>}
                </ul>
              </section>

              <section className="ad-card" aria-label="模型用量">
                <h2>模型用量</h2>
                <p className="ad-note">
                  调用 {number(overview.usage.calls)} 次 · 输入 {number(overview.usage.promptTokens)} · 输出{" "}
                  {number(overview.usage.completionTokens)} · 失败 {number(overview.usage.errors)} 次 · 平均{" "}
                  {number(overview.usage.averageLatencyMs)} ms
                </p>
                <ul className="ad-list is-compact">
                  {overview.usage.byModel.map((model) => (
                    <li key={`${model.provider}:${model.model}`}>
                      <strong>{model.model || "未登记模型"}</strong>
                      <span>
                        {model.provider || "未登记服务商"} · {number(model.calls)} 次 ·{" "}
                        {number(model.totalTokens)} tokens
                      </span>
                    </li>
                  ))}
                  {!overview.usage.byModel.length && <li className="ad-empty">还没有模型调用记录。</li>}
                </ul>
              </section>

              <section className="ad-card" aria-label="失败的任务">
                <h2>失败的任务（{overview.tasks.failures.length}）</h2>
                <p className="ad-note">重试会按任务后端的真实重试逻辑执行；失败原因原样显示，不做美化。</p>
                <ul className="ad-list">
                  {overview.tasks.failures.map((task) => (
                    <li key={task.id}>
                      <div className="ad-item-head">
                        <strong>{task.title || task.id}</strong>
                        <span>
                          {task.kind} · 账号 {task.ownerId.slice(0, 8)} · {when(task.updatedAt)}
                        </span>
                        {task.error && <em className="ad-error">{task.error}</em>}
                      </div>
                      <div className="ad-item-actions">
                        <button
                          className="ad-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void act(
                            () => retryAdminTask(task.ownerId, task.id).then(() => undefined),
                            `已重新排队「${task.title || task.id}」。`,
                          )}
                        >
                          重试
                        </button>
                      </div>
                    </li>
                  ))}
                  {!overview.tasks.failures.length && <li className="ad-empty">没有失败的任务。</li>}
                </ul>
              </section>

              <section className="ad-card" aria-label="定时任务">
                <h2>定时任务（{overview.schedules.total}）</h2>
                <ul className="ad-list">
                  {overview.schedules.list.map((schedule) => (
                    <li key={schedule.id}>
                      <div className="ad-item-head">
                        <strong>{schedule.name}</strong>
                        <span>
                          {schedule.cron} · {schedule.timezone} · 账号 {schedule.ownerId.slice(0, 8)} · 上次{" "}
                          {when(schedule.lastRunAt)} {schedule.lastStatus ? `（${schedule.lastStatus}）` : ""}
                        </span>
                        {schedule.lastDetail && <em className="ad-note-inline">{schedule.lastDetail}</em>}
                      </div>
                      <div className="ad-item-actions">
                        {schedule.enabled ? <span className="ad-flag">在跑</span> : <span className="ad-flag is-off">已停</span>}
                        <button
                          className="ad-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void act(
                            () => setAdminScheduleEnabled(schedule.ownerId, schedule.id, !schedule.enabled).then(() => undefined),
                            schedule.enabled ? `已停止「${schedule.name}」。` : `已启动「${schedule.name}」。`,
                          )}
                        >
                          {schedule.enabled ? "停止" : "启动"}
                        </button>
                      </div>
                    </li>
                  ))}
                  {!overview.schedules.list.length && <li className="ad-empty">没有定时任务。</li>}
                </ul>
              </section>

              <section className="ad-card" aria-label="技能健康">
                <h2>技能健康（{overview.skills.ready}/{overview.skills.total} 可执行）</h2>
                <p className="ad-note">不可用的技能会写明缺什么凭据或通道；平台不会用占位结果代替。</p>
                <ul className="ad-list is-compact">
                  {overview.skills.unavailableList.map((skill) => (
                    <li key={skill.id}>
                      <strong>{skill.name}</strong>
                      <span>{skill.id}</span>
                      <em className="ad-error">{skill.reason}</em>
                    </li>
                  ))}
                  {!overview.skills.unavailableList.length && <li className="ad-empty">当前所有技能都能执行。</li>}
                </ul>
              </section>

              <section className="ad-card" aria-label="审计">
                <h2>最近审计（{overview.audit.length}）</h2>
                <ul className="ad-list is-compact">
                  {overview.audit.map((event) => (
                    <li key={event.id}>
                      <strong>{event.action}</strong>
                      <span>
                        {event.username || event.accountId.slice(0, 8)} · {when(event.createdAt)}
                        {event.detail ? ` · ${event.detail}` : ""}
                      </span>
                    </li>
                  ))}
                  {!overview.audit.length && <li className="ad-empty">还没有审计记录。</li>}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
