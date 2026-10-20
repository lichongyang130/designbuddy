import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  SampleTop,
  Notice,
  copySample,
  download,
  useSampleState,
  type SampleId,
} from "../shared";
import { escapeHtml } from "../media-utils";
import "./hyperframes-set.css";

type HFId = "hf-tour" | "hf-story" | "hf-quest" | "hf-lesson";

const hfTypes: Record<HFId, string> = {
  "hf-tour": "HyperFrames / 分帧导览",
  "hf-story": "HyperFrames / 数据故事",
  "hf-quest": "HyperFrames / 分支剧情",
  "hf-lesson": "HyperFrames / 微课",
};
const hfTitles: Record<HFId, string> = {
  "hf-tour": "SPOTLIGHT · 新功能分帧导览",
  "hf-story": "RISE · 一图读懂数据故事",
  "hf-quest": "CROSSROADS · 分支剧情",
  "hf-lesson": "SPARK · 五分钟微课",
};
const hfProvenance: Record<HFId, string> = {
  "hf-tour":
    "分镜里的产品界面是虚构演示，不是真实后台截图。话术可以编辑，导出为可离线回放的动效网页，不是视频文件。",
  "hf-story":
    "图表数字是演示用虚构数据，不代表任何真实业务。可以修改数值并重新演绎，导出为单页数据故事，不是 BI 看板。",
  "hf-quest":
    "剧情为原创虚构小故事。路线图只记录本浏览器的游玩进度，不上传，不连接任何游戏存档服务。",
  "hf-lesson":
    "课程与测验是内容样板，播放进度只保存在本浏览器。讲义导出为图文网页，不含真实视频文件。",
};

export function HFShell({
  id,
  draftId,
  state,
  error,
  actions,
  children,
}: {
  id: HFId;
  draftId?: string;
  state: unknown;
  error: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [notice, setNotice] = useState("");
  return (
    <main className={`hf-work hf-${id}`}>
      <SampleTop
        type={hfTypes[id]}
        title={hfTitles[id]}
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
      <footer className="hf-provenance">
        <strong>关于这个样板</strong>
        <p>{hfProvenance[id]}</p>
        <small>
          参数默认在当前浏览器自动保存；可用顶部按钮手动备份到服务器。请在清理网站数据前保留备份。
        </small>
      </footer>
    </main>
  );
}

/** Editable text collections live in the `message` string slot (≤1000 chars). */
export function readBlob<T>(raw: string, fallback: T): T {
  try {
    const data = JSON.parse(raw) as T;
    return data && typeof data === "object" ? data : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------- hf-tour ------------------------------- */

type TourStep = {
  target: string;
  rect: { x: number; y: number; w: number; h: number };
  title: string;
  caption: string;
};
const tourSteps: TourStep[] = [
  {
    target: "核心指标区",
    rect: { x: 24, y: 16, w: 50, h: 20 },
    title: "第 1 步 · 一眼看到健康度",
    caption: "四个核心指标卡：今日订单、转化率、客单价与退款率，异常会自动标红。",
  },
  {
    target: "趋势图表",
    rect: { x: 24, y: 40, w: 34, h: 34 },
    title: "第 2 步 · 趋势不用猜",
    caption: "销量曲线支持按小时、天、周切换粒度，悬停任意节点查看精确数值。",
  },
  {
    target: "订单明细表",
    rect: { x: 60, y: 40, w: 36, h: 44 },
    title: "第 3 步 · 明细随手查",
    caption: "最新订单实时滚动，点击任意行即可侧滑查看该订单的完整履约轨迹。",
  },
  {
    target: "左侧导航",
    rect: { x: 2, y: 12, w: 19, h: 72 },
    title: "第 4 步 · 导航有记忆",
    caption: "常用模块会自动置顶，键盘输入 / 即可唤起全局搜索直达任意页面。",
  },
  {
    target: "导出按钮",
    rect: { x: 82, y: 3, w: 15, h: 8 },
    title: "第 5 步 · 一键带走数据",
    caption: "当前筛选条件可导出为 CSV 或打印为日报，导出的数字与屏幕完全一致。",
  },
];
const tourDefaults = {
  t: tourSteps.map((s) => s.title),
  c: tourSteps.map((s) => s.caption),
};
type TourBlob = { t: string[]; c: string[] };

function DimMask({ rect }: { rect: TourStep["rect"] }) {
  const { x, y, w, h } = rect;
  return (
    <>
      <div className="hf-dim" style={{ left: 0, top: 0, width: "100%", height: `${y}%` }} />
      <div className="hf-dim" style={{ left: 0, top: `${y + h}%`, width: "100%", height: `${100 - y - h}%` }} />
      <div className="hf-dim" style={{ left: 0, top: `${y}%`, width: `${x}%`, height: `${h}%` }} />
      <div className="hf-dim" style={{ left: `${x + w}%`, top: `${y}%`, width: `${100 - x - w}%`, height: `${h}%` }} />
      <div className="hf-spot" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} />
    </>
  );
}

function MockDashboard() {
  return (
    <div className="hf-mock" aria-hidden="true">
      <div className="hf-mock-side">
        <i className="hf-mock-logo" />
        {["概览", "订单", "商品", "客户", "营销", "设置"].map((n, i) => (
          <span key={n} className={i === 0 ? "is-active" : ""}>{n}</span>
        ))}
      </div>
      <div className="hf-mock-main">
        <div className="hf-mock-top">
          <span className="hf-mock-search">搜索订单 / 商品 / 客户…</span>
          <span className="hf-mock-export">导出报表</span>
        </div>
        <div className="hf-mock-kpis">
          {[
            ["今日订单", "1,284"],
            ["转化率", "3.6%"],
            ["客单价", "¥268"],
            ["退款率", "1.1%"],
          ].map(([k, v]) => (
            <div key={k}><small>{k}</small><strong>{v}</strong></div>
          ))}
        </div>
        <div className="hf-mock-body">
          <div className="hf-mock-chart">
            {[42, 58, 47, 66, 74, 61, 82, 70, 88, 79, 94, 86].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="hf-mock-table">
            {["#A-9012 待发货", "#A-9011 已签收", "#A-9010 退款中", "#A-9009 已签收", "#A-9008 待发货"].map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HFTour({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("hf-tour", draftId, {
    step: 0,
    message: JSON.stringify(tourDefaults),
  });
  const [playing, setPlaying] = useState(false);
  const blob = useMemo<TourBlob>(
    () => ({ ...tourDefaults, ...readBlob<Partial<TourBlob>>(state.message, {}) }),
    [state.message],
  );
  const step = Math.min(Math.max(state.step, 0), tourSteps.length - 1);
  const titles = tourSteps.map((s, i) => blob.t[i] ?? s.title);
  const captions = tourSteps.map((s, i) => blob.c[i] ?? s.caption);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      set((v) => ({ ...v, step: (Math.min(Math.max(v.step, 0), 4) + 1) % tourSteps.length }));
    }, 3200);
    return () => window.clearInterval(timer);
  }, [playing, set, step]);

  const patch = (index: number, key: "t" | "c", value: string) => {
    const next = { t: [...titles], c: [...captions] };
    next[key][index] = value;
    const raw = JSON.stringify(next);
    if (raw.length <= 1000) set((v) => ({ ...v, message: raw }));
  };
  const exportHtml = () => {
    const items = tourSteps
      .map((s, i) => `<section><h2>${escapeHtml(titles[i])}</h2><p><b>聚光：${escapeHtml(s.target)}</b></p><p>${escapeHtml(captions[i])}</p></section>`)
      .join("\n");
    download(
      new Blob(
        [`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SPOTLIGHT · 导览话术</title><body style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.8"><h1>SPOTLIGHT · 新功能分帧导览</h1>${items}</body></html>`],
        { type: "text/html;charset=utf-8" },
      ),
      "spotlight-tour.html",
    );
  };
  return (
    <HFShell
      id="hf-tour"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button className="hf-action-btn primary" onClick={exportHtml}>下载话术 HTML</button>
        </>
      }
    >
      <div className="hf-layout">
        <section
          className="hf-stage"
          tabIndex={0}
          aria-label="导览舞台：左右方向键切换步骤"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") set((v) => ({ ...v, step: Math.min(step + 1, 4) }));
            if (e.key === "ArrowLeft") set((v) => ({ ...v, step: Math.max(step - 1, 0) }));
          }}
        >
          <div className="hf-tour-frame">
            <MockDashboard />
            <DimMask rect={tourSteps[step].rect} />
            <span className="hf-step-badge">{step + 1} / {tourSteps.length}</span>
          </div>
          <div className="hf-caption" key={step}>
            <strong>{titles[step]}</strong>
            <p>{captions[step]}</p>
          </div>
          <div className="hf-transport">
            <button onClick={() => set((v) => ({ ...v, step: Math.max(step - 1, 0) }))} disabled={step === 0}>上一步</button>
            <button onClick={() => { if (step >= 4) set((v) => ({ ...v, step: 0 })); setPlaying((p) => !p); }}>
              {playing ? "暂停播放" : "自动播放"}
            </button>
            <button onClick={() => set((v) => ({ ...v, step: Math.min(step + 1, 4) }))} disabled={step === 4}>下一步</button>
            <div className="hf-dots" role="tablist" aria-label="导览步骤">
              {tourSteps.map((s, i) => (
                <button
                  key={s.target}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`第 ${i + 1} 步：${s.target}`}
                  className={i === step ? "is-active" : i < step ? "is-done" : ""}
                  onClick={() => { setPlaying(false); set((v) => ({ ...v, step: i })); }}
                />
              ))}
            </div>
          </div>
          {playing && <div className="hf-progress" key={`p${step}`}><i /></div>}
        </section>
        <aside className="hf-side">
          <h2>分镜话术 · 可编辑</h2>
          <p className="hf-hint">修改会即时同步到舞台，并随样板自动保存。</p>
          <label>当前步骤标题<input value={titles[step]} maxLength={24} onChange={(e) => patch(step, "t", e.target.value)} aria-label="当前步骤标题" /></label>
          <label>当前步骤解说<textarea value={captions[step]} maxLength={90} rows={3} onChange={(e) => patch(step, "c", e.target.value)} aria-label="当前步骤解说" /></label>
          <ol className="hf-step-list">
            {tourSteps.map((s, i) => (
              <li key={s.target}>
                <button className={i === step ? "is-active" : ""} onClick={() => { setPlaying(false); set((v) => ({ ...v, step: i })); }}>
                  <b>{i + 1}</b><span>{s.target}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </HFShell>
  );
}

/* ------------------------------ hf-story ------------------------------ */

type StoryChapter = {
  kicker: string;
  headline: string;
  stat: number;
  unit: string;
  label: string;
  bars: number[];
  decimals: number;
};
const storyChapters: StoryChapter[] = [
  { kicker: "第一章 · 起点", headline: "一家社区咖啡店的线上化实验", stat: 1, unit: "家店", label: "实验开始时的门店数", bars: [12, 14, 13, 15, 14, 16], decimals: 0 },
  { kicker: "第二章 · 增长", headline: "三个月，外卖订单翻了 18 倍", stat: 18, unit: "倍", label: "外卖订单增长", bars: [14, 22, 31, 44, 58, 76], decimals: 0 },
  { kicker: "第三章 · 留存", headline: "会员复购率做到行业 2.4 倍", stat: 2.4, unit: "倍", label: "相对行业均值的复购率", bars: [30, 38, 44, 52, 63, 78], decimals: 1 },
  { kicker: "第四章 · 口碑", headline: "462 条五星评价，零差评季度", stat: 462, unit: "条", label: "累计五星评价", bars: [22, 30, 41, 55, 72, 95], decimals: 0 },
  { kicker: "尾声 · 下一步", headline: "第 5 家店正在装修，故事继续", stat: 5, unit: "家店", label: "即将开业的门店总数", bars: [40, 48, 56, 66, 78, 92], decimals: 0 },
];
const storyDefaults = { stats: storyChapters.map((c) => c.stat) };

function useTweenedNumber(target: number, decimals: number) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return value.toFixed(decimals);
}

export function HFStory({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("hf-story", draftId, {
    chapter: 0,
    message: JSON.stringify(storyDefaults),
  });
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const blob = useMemo(
    () => ({ ...storyDefaults, ...readBlob<Partial<typeof storyDefaults>>(state.message, {}) }),
    [state.message],
  );
  const chapter = Math.min(Math.max(state.chapter, 0), storyChapters.length - 1);
  const stats = storyChapters.map((c, i) =>
    typeof blob.stats[i] === "number" && Number.isFinite(blob.stats[i]) ? blob.stats[i] : c.stat,
  );
  const current = storyChapters[chapter];
  const shown = useTweenedNumber(stats[chapter], current.decimals);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      set((v) => ({ ...v, chapter: (Math.min(Math.max(v.chapter, 0), 4) + 1) % storyChapters.length }));
    }, 3600);
    return () => window.clearInterval(timer);
  }, [playing, set, chapter]);

  const patchStat = (value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 999999) return;
    const next = { stats: stats.map((s, i) => (i === chapter ? Math.round(num * 10) / 10 : s)) };
    set((v) => ({ ...v, message: JSON.stringify(next) }));
  };
  const exportHtml = () => {
    const items = storyChapters
      .map((c, i) => `<section><p>${escapeHtml(c.kicker)}</p><h2>${escapeHtml(c.headline)}</h2><p><b>${stats[i]}${escapeHtml(c.unit)}</b> · ${escapeHtml(c.label)}</p></section>`)
      .join("\n");
    download(
      new Blob(
        [`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>RISE · 数据故事</title><body style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.8"><h1>RISE · 一图读懂数据故事</h1>${items}</body></html>`],
        { type: "text/html;charset=utf-8" },
      ),
      "rise-story.html",
    );
  };
  return (
    <HFShell
      id="hf-story"
      draftId={draftId}
      state={state}
      error={error}
      actions={<button onClick={exportHtml}>下载故事 HTML</button>}
    >
      <div className="hf-layout">
        <section className="hf-stage">
          <div className="hf-story-card" key={`${chapter}-${replay}`}>
            <small>{current.kicker}</small>
            <h2>{current.headline}</h2>
            <div className="hf-stat">
              <strong>{shown}<span>{current.unit}</span></strong>
              <em>{current.label}</em>
            </div>
            <div className="hf-bars" aria-hidden="true">
              {current.bars.map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          </div>
          <div className="hf-transport">
            <button onClick={() => set((v) => ({ ...v, chapter: Math.max(chapter - 1, 0) }))} disabled={chapter === 0}>上一章</button>
            <button onClick={() => { if (chapter >= 4) set((v) => ({ ...v, chapter: 0 })); setPlaying((p) => !p); }}>
              {playing ? "暂停演绎" : "自动演绎"}
            </button>
            <button onClick={() => setReplay((r) => r + 1)}>重播本章动画</button>
            <button onClick={() => set((v) => ({ ...v, chapter: Math.min(chapter + 1, 4) }))} disabled={chapter === 4}>下一章</button>
          </div>
          <div className="hf-rail" role="tablist" aria-label="故事章节">
            {storyChapters.map((c, i) => (
              <button key={c.kicker} role="tab" aria-selected={i === chapter} className={i === chapter ? "is-active" : ""} onClick={() => { setPlaying(false); set((v) => ({ ...v, chapter: i })); }}>
                <b>{String(i + 1).padStart(2, "0")}</b><span>{c.kicker.replace(/^.*·\s*/, "")}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="hf-side">
          <h2>本章数字 · 可编辑</h2>
          <p className="hf-hint">修改后计数动画会用新数字重新演绎。</p>
          <label>关键数字<input type="number" min={0} max={999999} step="any" value={stats[chapter]} onChange={(e) => patchStat(e.target.value)} aria-label="本章关键数字" /></label>
          <dl className="hf-facts">
            <div><dt>单位</dt><dd>{current.unit}</dd></div>
            <div><dt>口径</dt><dd>{current.label}</dd></div>
            <div><dt>章节</dt><dd>{chapter + 1} / {storyChapters.length}</dd></div>
          </dl>
        </aside>
      </div>
    </HFShell>
  );
}
