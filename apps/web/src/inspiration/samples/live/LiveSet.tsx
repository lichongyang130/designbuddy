import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SampleTop,
  Notice,
  copySample,
  download,
  useSampleState,
  type SampleId,
} from "../shared";
import { csvValue } from "../media-utils";
import { readBlob } from "../hyperframes/HyperFramesSet";
import "./live-set.css";

type LVId = "live-board" | "live-event" | "live-form" | "live-status";

const lvTypes: Record<LVId, string> = {
  "live-board": "实时产物 / 数据大屏",
  "live-event": "实时产物 / 活动落地页",
  "live-form": "实时产物 / 实时问卷",
  "live-status": "实时产物 / 服务状态页",
};
const lvTitles: Record<LVId, string> = {
  "live-board": "PULSE · 实时数据大屏",
  "live-event": "MOMENT · 发布会倒计时",
  "live-form": "VOICE · 实时问卷",
  "live-status": "STEADY · 服务状态页",
};
const lvProvenance: Record<LVId, string> = {
  "live-board":
    "指标由本地模拟数据流驱动，不是真实业务数据，也未连接任何统计服务。暂停、投屏与导出都只在本浏览器生效。",
  "live-event":
    "签到名单只保存在本浏览器，不会发送短信或创建真实报名。抽奖为演示用随机抽取，不构成任何承诺。",
  "live-form":
    "问卷结果为演示数据叠加你的投票，不会上传答案。统计只在本浏览器计算，可随时清空你的投票。",
  "live-status":
    "服务状态是可手动拨动的演示开关，不代表任何真实系统的可用性。事件线只保存在本浏览器。",
};

export function LVShell({
  id,
  draftId,
  state,
  error,
  actions,
  children,
}: {
  id: LVId;
  draftId?: string;
  state: unknown;
  error: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [notice, setNotice] = useState("");
  return (
    <main className={`lv-work lv-${id}`}>
      <SampleTop
        type={lvTypes[id]}
        title={lvTitles[id]}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(id as SampleId, state);
          } catch {
            setNotice("副本保存失败，请先下载作品并检查浏览器存储。");
          }
        }}
      >
        {actions}
      </SampleTop>
      <Notice text={error || notice} />
      {children}
      <footer className="lv-provenance">
        <strong>关于这个样板</strong>
        <p>{lvProvenance[id]}</p>
        <small>
          参数默认在当前浏览器自动保存；可用顶部按钮手动备份到服务器。请在清理网站数据前保留备份。
        </small>
      </footer>
    </main>
  );
}

/** Deterministic PRNG so demo streams are stable across renders. */
export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------- live-board ----------------------------- */

type Metric = {
  id: string;
  label: string;
  prefix: string;
  suffix: string;
  base: number;
  jitter: number;
  decimals: number;
  invert?: boolean;
};
const boardMetrics: Metric[] = [
  { id: "orders", label: "今日订单", prefix: "", suffix: "", base: 1284, jitter: 14, decimals: 0 },
  { id: "gmv", label: "实时成交额", prefix: "¥", suffix: "", base: 342800, jitter: 2600, decimals: 0 },
  { id: "conversion", label: "转化率", prefix: "", suffix: "%", base: 3.62, jitter: 0.06, decimals: 2 },
  { id: "visitors", label: "在线访客", prefix: "", suffix: "", base: 842, jitter: 22, decimals: 0 },
  { id: "refund", label: "退款率", prefix: "", suffix: "%", base: 1.08, jitter: 0.03, decimals: 2, invert: true },
  { id: "ticket", label: "客单价", prefix: "¥", suffix: "", base: 268, jitter: 3, decimals: 0 },
];
const boardRanges = [
  { id: "1h", label: "近 1 小时", mult: 1 },
  { id: "24h", label: "近 24 小时", mult: 1.8 },
  { id: "7d", label: "近 7 天", mult: 2.6 },
];
const fmtNum = (v: number, d: number) =>
  v.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });

function seedHistory(m: Metric, seed: number): number[] {
  const rand = mulberry(seed);
  const out: number[] = [];
  let v = m.base;
  for (let i = 0; i < 24; i++) {
    v += (rand() - 0.5) * m.jitter * 2;
    v = Math.min(Math.max(v, m.base * 0.7), m.base * 1.4);
    out.push(v);
  }
  return out;
}

export function LiveBoard({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("live-board", draftId, {
    range: "1h",
    paused: false,
    focus: "",
  });
  const [present, setPresent] = useState(false);
  const [tick, setTick] = useState(0);
  const [histories, setHistories] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(boardMetrics.map((m, i) => [m.id, seedHistory(m, 1000 + i * 77)])),
  );
  const range = boardRanges.find((r) => r.id === state.range) ?? boardRanges[0];
  const focus = boardMetrics.find((m) => m.id === state.focus) ?? null;

  useEffect(() => {
    if (state.paused) return;
    const timer = window.setInterval(() => {
      setHistories((prev) => {
        const next: Record<string, number[]> = {};
        for (const m of boardMetrics) {
          const line = prev[m.id];
          const last = line[line.length - 1];
          const v = Math.min(
            Math.max(last + (Math.random() - 0.5) * m.jitter * range.mult, m.base * 0.7),
            m.base * 1.4,
          );
          next[m.id] = [...line.slice(-23), v];
        }
        return next;
      });
      setTick((t) => t + 1);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [state.paused, range.mult]);

  const snapshot = () => {
    const rows = boardMetrics.map((m) => {
      const v = histories[m.id][histories[m.id].length - 1];
      return [m.label, `${m.prefix}${fmtNum(v, m.decimals)}${m.suffix}`].map(csvValue).join(",");
    });
    download(
      new Blob([`指标,数值（${range.label}）\n${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" }),
      "pulse-snapshot.csv",
    );
  };
  return (
    <LVShell
      id="live-board"
      draftId={draftId}
      state={state}
      error={error}
      actions={<button onClick={snapshot}>导出快照 CSV</button>}
    >
      <div className={`lv-layout ${present ? "is-present" : ""}`}>
        <section className="lv-stage">
          <div className="lv-board-head">
            <div>
              <small>{state.paused ? "数据流已暂停" : "● 数据流实时更新中"} · {range.label} · 第 {tick + 1} 拍</small>
              <h2>今日经营总览</h2>
            </div>
            <div className="lv-board-controls">
              <select aria-label="时间范围" value={range.id} onChange={(e) => set((v) => ({ ...v, range: e.target.value }))}>
                {boardRanges.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
              </select>
              <button onClick={() => set((v) => ({ ...v, paused: !v.paused }))}>{state.paused ? "恢复推送" : "暂停推送"}</button>
              <button onClick={() => setPresent((p) => !p)} aria-pressed={present}>{present ? "退出投屏" : "投屏模式"}</button>
            </div>
          </div>
          <div className="lv-metrics">
            {boardMetrics.map((m) => {
              const line = histories[m.id];
              const v = line[line.length - 1];
              const delta = v - line[0];
              const good = m.invert ? delta <= 0 : delta >= 0;
              const max = Math.max(...line);
              const min = Math.min(...line);
              const pts = line
                .map((p, i) => `${(i / (line.length - 1)) * 100},${34 - ((p - min) / (max - min || 1)) * 30}`)
                .join(" ");
              return (
                <button
                  key={m.id}
                  className={`lv-metric ${state.focus === m.id ? "is-focus" : ""}`}
                  onClick={() => set((s) => ({ ...s, focus: s.focus === m.id ? "" : m.id }))}
                  aria-pressed={state.focus === m.id}
                >
                  <small>{m.label}</small>
                  <strong>{m.prefix}{fmtNum(v, m.decimals)}{m.suffix}</strong>
                  <span className={`lv-delta ${good ? "is-good" : "is-bad"}`}>
                    {delta >= 0 ? "▲" : "▼"} {m.prefix}{fmtNum(Math.abs(delta), m.decimals)}{m.suffix}
                  </span>
                  <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
                    <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              );
            })}
          </div>
          {focus && (
            <div className="lv-focus" key={focus.id}>
              <strong>{focus.label} · {range.label}分位</strong>
              <p>
                最高 {focus.prefix}{fmtNum(Math.max(...histories[focus.id]), focus.decimals)}{focus.suffix}
                {" · "}最低 {focus.prefix}{fmtNum(Math.min(...histories[focus.id]), focus.decimals)}{focus.suffix}
                {" · "}均值 {focus.prefix}{fmtNum(histories[focus.id].reduce((a, b) => a + b, 0) / histories[focus.id].length, focus.decimals)}{focus.suffix}
              </p>
            </div>
          )}
        </section>
        <aside className="lv-side">
          <h2>看板说明</h2>
          <p className="lv-hint">点击任意指标卡查看分位详情；投屏模式放大字号，适合会议室展示。</p>
          <dl className="lv-facts">
            <div><dt>推送节拍</dt><dd>1.5 秒 / 拍</dd></div>
            <div><dt>窗口</dt><dd>最近 24 拍</dd></div>
            <div><dt>范围</dt><dd>{range.label}</dd></div>
          </dl>
        </aside>
      </div>
    </LVShell>
  );
}

/* ----------------------------- live-event ----------------------------- */

const defaultDeadline = () => {
  const d = new Date(Date.now() + 9 * 86400000 + 5 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const eventAgenda = [
  { time: "14:00", item: "开场 · 年度回顾短片" },
  { time: "14:20", item: "新品发布 · 设计引擎 3.0" },
  { time: "15:10", item: "用户故事 · 三位共创者分享" },
  { time: "16:00", item: "幸运抽奖 · 全场大奖" },
];

export function LiveEvent({ draftId }: { draftId?: string }) {
  const [initial] = useState(defaultDeadline);
  const [state, set, error] = useSampleState("live-event", draftId, {
    deadline: initial,
    signed: 0,
    reservation: "[]",
  });
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState("");
  const [flash, setFlash] = useState("");
  const names = useMemo(() => {
    const raw = readBlob<unknown>(state.reservation, []);
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 80) : [];
  }, [state.reservation]);
  const total = names.length + Math.max(state.signed, 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const target = Date.parse(state.deadline);
  const validTarget = Number.isFinite(target);
  const diff = validTarget ? Math.max(target - now, 0) : 0;
  const units = [
    { v: Math.floor(diff / 86400000), u: "天" },
    { v: Math.floor((diff / 3600000) % 24), u: "时" },
    { v: Math.floor((diff / 60000) % 60), u: "分" },
    { v: Math.floor((diff / 1000) % 60), u: "秒" },
  ];
  const live = validTarget && target <= now;

  const checkin = () => {
    const clean = name.trim().slice(0, 12);
    if (!clean) {
      setNotice("请先填写名字再签到。");
      return;
    }
    if (names.length >= 80) {
      setNotice("演示名单已满（80 人），请导出后清空再试。");
      return;
    }
    const next = [...names, clean];
    const raw = JSON.stringify(next);
    if (raw.length > 6000) {
      setNotice("名单过长，请先导出备份。");
      return;
    }
    set({ ...state, reservation: raw });
    setName("");
    setNotice(`欢迎 ${clean}，你是第 ${next.length + Math.max(state.signed, 0)} 位到场。`);
  };
  const draw = () => {
    if (rolling || names.length === 0) {
      if (names.length === 0) setNotice("名单是空的，先签到再抽奖。");
      return;
    }
    setRolling(true);
    setWinner("");
    const timer = window.setInterval(() => {
      setFlash(names[Math.floor(Math.random() * names.length)]);
    }, 90);
    window.setTimeout(() => {
      window.clearInterval(timer);
      const pick = names[Math.floor(Math.random() * names.length)];
      setWinner(pick);
      setRolling(false);
      setNotice(`恭喜 ${pick} 获得全场大奖！`);
    }, 1400);
  };
  const exportCsv = () => {
    const rows = names.map((n, i) => [String(i + 1), n].map(csvValue).join(","));
    download(
      new Blob([`序号,姓名\n${rows.join("\n")}\n\n现场补录,${state.signed}人\n`], { type: "text/csv;charset=utf-8" }),
      "moment-checkin.csv",
    );
  };
  return (
    <LVShell
      id="live-event"
      draftId={draftId}
      state={state}
      error={error}
      actions={<button onClick={exportCsv}>导出名单 CSV</button>}
    >
      <div className="lv-layout">
        <section className="lv-stage">
          <div className="lv-event-hero">
            <small>DESIGNBUDDY 年度发布会 · 上海展览中心</small>
            <h2>设计引擎 3.0，来了</h2>
            {live ? (
              <p className="lv-live-flag">● 活动进行中，欢迎到场</p>
            ) : (
              <div className="lv-countdown" role="timer" aria-label="距离活动开始">
                {units.map((u) => (
                  <div key={u.u}>
                    <strong>{String(u.v).padStart(2, "0")}</strong>
                    <span>{u.u}</span>
                  </div>
                ))}
              </div>
            )}
            <label className="lv-datetime">
              开场时间
              <input
                type="datetime-local"
                value={Number.isFinite(target) ? state.deadline : ""}
                onChange={(e) => set((v) => ({ ...v, deadline: e.target.value }))}
              />
            </label>
            {!validTarget && <p className="lv-warn">时间格式无效，倒计时已暂停，请重新选择开场时间。</p>}
          </div>
          <div className="lv-event-grid">
            <div className="lv-checkin">
              <h3>现场签到 · 已到 {total} 人</h3>
              <div className="lv-row">
                <input
                  aria-label="签到姓名"
                  placeholder="输入你的名字"
                  maxLength={12}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkin()}
                />
                <button onClick={checkin}>签到</button>
                <button onClick={() => set((v) => ({ ...v, signed: Math.min(v.signed + 1, 9999) }))} title="无名单的现场到场人数">＋补录</button>
              </div>
              {notice && <p className="lv-inline-notice" role="status">{notice}</p>}
              <ul className="lv-names">
                {names.slice(-8).reverse().map((n, i) => (<li key={`${n}-${i}`}>{n}</li>))}
                {names.length === 0 && <li className="is-empty">还没有人签到，来做第一个吧。</li>}
              </ul>
            </div>
            <div className="lv-draw">
              <h3>幸运抽奖</h3>
              <div className="lv-winner" aria-live="polite">
                {rolling ? flash : winner ? `🎉 ${winner}` : "虚位以待"}
              </div>
              <button onClick={draw} disabled={rolling || names.length === 0}>
                {rolling ? "抽取中…" : "抽取全场大奖"}
              </button>
              <small>从已签到名单中随机抽取 1 位</small>
            </div>
          </div>
        </section>
        <aside className="lv-side">
          <h2>活动议程</h2>
          <ol className="lv-agenda">
            {eventAgenda.map((a) => (
              <li key={a.time}><b>{a.time}</b><span>{a.item}</span></li>
            ))}
          </ol>
          <p className="lv-hint">签到名单自动保存，刷新不丢失；导出 CSV 可带走全部名单。</p>
        </aside>
      </div>
    </LVShell>
  );
}
