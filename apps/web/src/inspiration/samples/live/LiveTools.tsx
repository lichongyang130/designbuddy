import { useEffect, useMemo, useState } from "react";
import { download, useSampleState } from "../shared";
import { csvValue } from "../media-utils";
import { readBlob } from "../hyperframes/HyperFramesSet";
import { LVShell, mulberry } from "./LiveSet";
import "./live-set.css";

/* ----------------------------- live-form ----------------------------- */

type FormQ = { q: string; options: string[] };
const formQs: FormQ[] = [
  { q: "你每周使用设计工具的频率是？", options: ["几乎每天", "每周 3-4 天", "每周 1-2 天", "偶尔用"] },
  { q: "你最希望模板帮你省掉哪一步？", options: ["找灵感", "搭版式", "写文案", "做适配"] },
  { q: "如果只能保留一个功能，你选？", options: ["一键套用", "AI 封面", "实时协作", "版本回溯"] },
];
const formBase: number[][] = [
  [486, 372, 218, 154],
  [291, 508, 246, 185],
  [402, 318, 275, 235],
];
type FormBlob = { a: number[]; c: number[][]; s: boolean };
const formDefaults: FormBlob = {
  a: [-1, -1, -1],
  c: formBase.map((r) => [...r]),
  s: false,
};

function cleanForm(raw: Partial<FormBlob>): FormBlob {
  return {
    a: formDefaults.a.map((v, i) =>
      Array.isArray(raw.a) && Number.isInteger(raw.a[i]) && (raw.a as number[])[i] >= -1 && (raw.a as number[])[i] <= 3
        ? (raw.a as number[])[i]
        : v,
    ),
    c: formDefaults.c.map((row, qi) =>
      row.map((v, oi) =>
        Array.isArray(raw.c) && Array.isArray(raw.c[qi]) && Number.isInteger(raw.c[qi][oi]) && (raw.c[qi][oi] as number) >= 0 && (raw.c[qi][oi] as number) <= 999999
          ? (raw.c[qi][oi] as number)
          : v,
      ),
    ),
    s: raw.s === true,
  };
}

export function LiveForm({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("live-form", draftId, {
    tab: 0,
    message: JSON.stringify(formDefaults),
  });
  const [notice, setNotice] = useState("");
  const blob = useMemo(() => cleanForm(readBlob<Partial<FormBlob>>(state.message, {})), [state.message]);
  const answered = blob.a.filter((a) => a >= 0).length;

  const pick = (qi: number, oi: number) => {
    const a = blob.a.map((v, i) => (i === qi ? oi : v));
    set((v) => ({ ...v, message: JSON.stringify({ ...blob, a }) }));
  };
  const removeVote = (b: FormBlob): FormBlob => {
    if (!b.s) return b;
    return {
      ...b,
      c: b.c.map((row, qi) => row.map((v, oi) => (oi === b.a[qi] ? Math.max(v - 1, 0) : v))),
      s: false,
    };
  };
  const submit = () => {
    if (answered < formQs.length) {
      setNotice(`还有 ${formQs.length - answered} 道题没答，答完再提交。`);
      return;
    }
    const cleared = removeVote(blob);
    const c = cleared.c.map((row, qi) => row.map((v, oi) => (oi === blob.a[qi] ? v + 1 : v)));
    set((v) => ({ ...v, tab: 1, message: JSON.stringify({ ...cleared, c, s: true }) }));
    setNotice("提交成功，结果已实时更新。");
  };
  const clearMine = () => {
    set((v) => ({ ...v, message: JSON.stringify(removeVote(blob)) }));
    setNotice("已清空你的投票，统计已回退。");
  };
  const exportCsv = () => {
    const lines = formQs.flatMap((q, qi) => [
      q.q,
      ...q.options.map((opt, oi) => [opt, String(blob.c[qi][oi])].map(csvValue).join(",")),
      "",
    ]);
    download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "voice-results.csv");
  };
  return (
    <LVShell
      id="live-form"
      draftId={draftId}
      state={state}
      error={error}
      actions={<button className="lv-action-btn primary" onClick={exportCsv}>导出结果 CSV</button>}
    >
      <div className="lv-layout">
        <section className="lv-stage" style={{ animation: 'lv-fade-in 0.4s ease' }}>
          <div className="lv-tabs" role="tablist" aria-label="问卷视图">
            {(["📝 填写问卷", "📊 实时统计"] as const).map((label, i) => (
              <button key={label} role="tab" aria-selected={state.tab === i} className={state.tab === i ? "is-active" : ""} onClick={() => set((v) => ({ ...v, tab: i }))}>
                {label}
              </button>
            ))}
          </div>
          {notice && <p className="lv-inline-notice" role="status" style={{ animation: 'lv-rise 0.3s ease', color: notice.includes('成功') ? 'var(--lv-lime)' : '' }}>{notice}</p>}
          {state.tab === 0 ? (
            <div className="lv-quiz" style={{ animation: 'lv-rise 0.4s ease' }}>
              <p className="lv-hint">已答 {answered} / {formQs.length} 题 · 提交后可在统计页实时看到结果</p>
              {formQs.map((q, qi) => (
                <fieldset key={q.q}>
                  <legend>第 {qi + 1} 题 · {q.q}</legend>
                  {q.options.map((opt, oi) => (
                    <label key={opt} className={blob.a[qi] === oi ? "is-picked" : ""}>
                      <input type="radio" name={`vq${qi}`} checked={blob.a[qi] === oi} onChange={() => pick(qi, oi)} />
                      {opt}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div className="lv-row">
                <button className={`lv-action-btn ${answered === formQs.length ? 'primary' : ''}`} onClick={submit}>提交问卷</button>
                {blob.s && <button className="lv-action-btn" onClick={clearMine}>清空我的投票</button>}
              </div>
            </div>
          ) : (
            <div className="lv-results" key={blob.c.flat().join("-")} style={{ animation: 'lv-rise 0.4s ease' }}>
              {!blob.s && <p className="lv-hint">你还没有投票——以下为已有 {blob.c[0].reduce((a, b) => a + b, 0)} 份答卷的实时统计。</p>}
              {formQs.map((q, qi) => {
                const total = blob.c[qi].reduce((a, b) => a + b, 0);
                return (
                  <div key={q.q} className="lv-result-block">
                    <h3>第 {qi + 1} 题 · {q.q}</h3>
                    {q.options.map((opt, oi) => {
                      const pct = total ? (blob.c[qi][oi] / total) * 100 : 0;
                      return (
                        <div key={opt} className={`lv-bar-row ${blob.s && blob.a[qi] === oi ? "is-mine" : ""}`}>
                          <span>{opt}{blob.s && blob.a[qi] === oi ? "（我的选择）" : ""}</span>
                          <div className="lv-bar-track"><i style={{ width: `${pct}%` }} /></div>
                          <b>{pct.toFixed(1)}% · {blob.c[qi][oi].toLocaleString()}</b>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <aside className="lv-side">
          <h2>问卷说明</h2>
          <p className="lv-hint">共 {formQs.length} 道单选题。投票会计入统计并自动保存；返回修改后重新提交会自动更正。</p>
          <dl className="lv-facts">
            <div><dt>累计答卷</dt><dd>{blob.c[0].reduce((a, b) => a + b, 0).toLocaleString()} 份</dd></div>
            <div><dt>我的状态</dt><dd>{blob.s ? "已投票" : "未投票"}</dd></div>
          </dl>
        </aside>
      </div>
    </LVShell>
  );
}

/* ---------------------------- live-status ---------------------------- */

type Svc = { id: string; name: string; latency: number };
const statusSvcs: Svc[] = [
  { id: "api", name: "API 网关", latency: 42 },
  { id: "order", name: "订单服务", latency: 87 },
  { id: "pay", name: "支付通道", latency: 120 },
  { id: "cdn", name: "图片 CDN", latency: 28 },
  { id: "push", name: "消息推送", latency: 65 },
];
type SvcState = "up" | "degraded" | "down";
const svcLabels: Record<SvcState, string> = { up: "正常", degraded: "波动", down: "故障" };
type Incident = { t: string; title: string; detail: string; state: SvcState };
const statusSeed: Incident[] = [
  { t: "10-14 21:40", title: "支付通道波动已恢复", detail: "上游银行通道抖动 12 分钟，失败订单已自动重试。", state: "degraded" },
  { t: "10-09 03:12", title: "消息推送延迟", detail: "队列积压导致推送延迟约 6 分钟，已扩容消费节点。", state: "degraded" },
];
type StatusBlob = { st: Record<string, SvcState>; inc: Incident[] };
// Service states (small) live in `message` (≤1000 chars); the incident log
// (long) lives in `reservation` (≤6000 chars) so reloads never truncate it.
const statusDefaults: StatusBlob = {
  st: Object.fromEntries(statusSvcs.map((s) => [s.id, "up" as SvcState])),
  inc: statusSeed,
};

function cleanStates(raw: unknown): Record<string, SvcState> {
  const record = readBlob<Record<string, unknown>>(typeof raw === "string" ? raw : "", {});
  const st: Record<string, SvcState> = {};
  for (const s of statusSvcs) {
    const v = record[s.id];
    st[s.id] = v === "degraded" || v === "down" ? v : "up";
  }
  return st;
}

function cleanIncidents(raw: unknown): Incident[] {
  const list = readBlob<unknown>(typeof raw === "string" ? raw : "", []);
  if (!Array.isArray(list)) return statusSeed;
  return list
    .filter(
      (x): x is Incident =>
        !!x && typeof x === "object" && typeof (x as Incident).title === "string" && typeof (x as Incident).detail === "string" && typeof (x as Incident).t === "string",
    )
    .map((x) => ({
      t: x.t.slice(0, 24),
      title: x.title.slice(0, 60),
      detail: x.detail.slice(0, 200),
      state: (x.state === "down" || x.state === "degraded" ? x.state : "up") as SvcState,
    }))
    .slice(0, 30);
}

const nextState = (s: SvcState): SvcState => (s === "up" ? "degraded" : s === "degraded" ? "down" : "up");

export function LiveStatus({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("live-status", draftId, {
    message: JSON.stringify(statusDefaults.st),
    reservation: JSON.stringify(statusDefaults.inc),
  });
  const [jitter, setJitter] = useState(0);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [notice, setNotice] = useState("");
  const blob = useMemo<StatusBlob>(
    () => ({ st: cleanStates(state.message), inc: cleanIncidents(state.reservation) }),
    [state.message, state.reservation],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setJitter((j) => j + 1), 2000);
    return () => window.clearInterval(timer);
  }, []);

  const states = statusSvcs.map((s) => blob.st[s.id]);
  const overall: SvcState = states.includes("down") ? "down" : states.includes("degraded") ? "degraded" : "up";
  const days = useMemo(() => {
    const rand = mulberry(4242);
    return Array.from({ length: 90 }, (_, i) => {
      const r = rand();
      return { day: i, state: (r > 0.97 ? "down" : r > 0.93 ? "degraded" : "up") as SvcState };
    });
  }, []);
  const uptime = ((days.filter((d) => d.state === "up").length / days.length) * 100).toFixed(2);

  const cycle = (svc: Svc) => {
    const from = blob.st[svc.id];
    const to = nextState(from);
    const now = new Date();
    const stamp = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const entry: Incident =
      to === "up"
        ? { t: stamp, title: `${svc.name}已恢复正常`, detail: "手动拨测确认，延迟回到基线，事件关闭。", state: "up" }
        : { t: stamp, title: `${svc.name}出现${svcLabels[to]}`, detail: "演示拨动：状态为手动设置，不代表真实故障。", state: to };
    const inc = [entry, ...blob.inc].slice(0, 30);
    set((v) => ({
      ...v,
      message: JSON.stringify({ ...blob.st, [svc.id]: to }),
      reservation: JSON.stringify(inc),
    }));
  };
  const subscribe = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice("邮箱格式不对，请检查后再订阅。");
      return;
    }
    setSubscribed(true);
    setNotice(`已订阅 ${email.trim()}，有事件时会第一时间通知（演示，不会真发邮件）。`);
  };
  const exportLog = () => {
    const body = blob.inc.map((i) => `[${i.t}] ${i.title}\n${i.detail}`).join("\n\n");
    download(new Blob([`STEADY · 事件时间线\n总体状态：${svcLabels[overall]}\n90 天在线率：${uptime}%\n\n${body}\n`], { type: "text/plain;charset=utf-8" }), "steady-incidents.txt");
  };
  return (
    <LVShell
      id="live-status"
      draftId={draftId}
      state={state}
      error={error}
      actions={<button className="lv-action-btn primary" onClick={exportLog}>导出事件线</button>}
    >
      <div className="lv-layout">
        <section className="lv-stage" style={{ animation: 'lv-fade-in 0.4s ease' }}>
          <div className={`lv-banner is-${overall}`} role="status" style={{ transition: 'all 0.4s ease', transform: overall === 'down' ? 'scale(1.02)' : 'scale(1)' }}>
            <span className="lv-pulse" aria-hidden="true" />
            <div>
              <strong>
                {overall === "up" ? "🟢 所有系统正常运行" : overall === "degraded" ? "🟡 部分服务出现波动" : "🔴 有服务发生故障，正在处理"}
              </strong>
              <small>90 天在线率 {uptime}% · 每 30 秒拨测一次</small>
            </div>
          </div>
          <ul className="lv-svcs">
            {statusSvcs.map((s) => {
              const st = blob.st[s.id];
              const rand = mulberry(s.latency * 13 + jitter * 7)();
              const ms = Math.round(s.latency * (0.9 + rand * 0.25));
              return (
                <li key={s.id}>
                  <button className={`lv-svc is-${st}`} onClick={() => cycle(s)} title="点击模拟状态变化" style={{ transition: 'all 0.3s', transform: st === 'down' ? 'translateX(4px)' : 'none' }}>
                    <span className="lv-dot" aria-hidden="true" />
                    <span className="lv-svc-name">{s.name}</span>
                    <span className="lv-svc-ms">{st === "down" ? "超时" : `${ms} ms`}</span>
                    <b>{svcLabels[st]}</b>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="lv-hint">点击任意服务可模拟「正常 → 波动 → 故障 → 恢复」，事件线会自动追加记录。</p>
          <h3 className="lv-sub">90 天在线率</h3>
          <div className="lv-days" role="img" aria-label={`90 天在线率 ${uptime}%，绿色为正常`}>
            {days.map((d) => (
              <i key={d.day} className={`is-${d.state}`} title={`第 ${d.day + 1} 天：${svcLabels[d.state]}`} style={{ transition: 'background-color 0.3s' }} />
            ))}
          </div>
          <div className="lv-days-legend"><span><i className="is-up" />正常</span><span><i className="is-degraded" />波动</span><span><i className="is-down" />故障</span></div>
          <h3 className="lv-sub">事件时间线</h3>
          <ol className="lv-timeline">
            {blob.inc.map((i, idx) => (
              <li key={`${i.t}-${idx}`} className={`is-${i.state}`} style={{ animation: idx === 0 ? 'lv-rise 0.4s ease forwards' : 'none' }}>
                <b>{i.t}</b>
                <div><strong>{i.title}</strong><p>{i.detail}</p></div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="lv-side">
          <h2>订阅通知</h2>
          {subscribed ? (
            <p className="lv-hint" style={{ color: 'var(--lv-lime)' }}>✅ 已订阅事件通知，演示环境不会真实发送。</p>
          ) : (
            <>
              <label>邮箱<input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="订阅邮箱" /></label>
              <button className="lv-action-btn primary" onClick={subscribe}>订阅事件通知</button>
            </>
          )}
          {notice && <p className="lv-inline-notice" role="status" style={{ animation: 'lv-fade-in 0.3s', color: notice.includes('已订阅') ? 'var(--lv-lime)' : 'var(--lv-red)' }}>{notice}</p>}
          <dl className="lv-facts">
            <div><dt>监控服务</dt><dd>{statusSvcs.length} 个</dd></div>
            <div><dt>拨测间隔</dt><dd>30 秒</dd></div>
            <div><dt>事件记录</dt><dd>{blob.inc.length} 条</dd></div>
          </dl>
        </aside>
      </div>
    </LVShell>
  );
}
