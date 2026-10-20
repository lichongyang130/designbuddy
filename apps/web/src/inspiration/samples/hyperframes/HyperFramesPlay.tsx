import { useEffect, useMemo, useState } from "react";
import { download, useSampleState } from "../shared";
import { escapeHtml } from "../media-utils";
import { HFShell, readBlob } from "./HyperFramesSet";
import "./hyperframes-set.css";

/* ------------------------------ hf-quest ------------------------------ */

type QuestNode = {
  title: string;
  text: string;
  choices: { label: string; next: string }[];
  ending?: string;
};
const questNodes: Record<string, QuestNode> = {
  start: {
    title: "序幕 · 天台的风",
    text: "深夜十一点，林晚把最后一版方案发出去，独自上了公司天台。手机在她手里震了两次：一个陌生号码的来电，和一封标题只有四个字的邮件——「好久不见」。",
    choices: [
      { label: "接起那通电话", next: "call" },
      { label: "先点开那封邮件", next: "mail" },
    ],
  },
  call: {
    title: "第一幕 · 失联十年的声音",
    text: "「是我，陈默。」电话那头顿了顿，「我们高中那支乐队，下周在老地方重聚，就差你一个贝斯手。」风把她的回答吹得很慢。",
    choices: [
      { label: "答应赴约，琴还在老家", next: "endA" },
      { label: "婉拒，项目离不开人", next: "endB" },
    ],
  },
  mail: {
    title: "第一幕 · 四个字的邮件",
    text: "邮件没有正文，只有一个附件：waveform_final.wav。发件人一栏空着，发送时间显示为——明天凌晨三点。",
    choices: [
      { label: "点开那段音频", next: "attach" },
      { label: "先存档，明天再说", next: "endB" },
    ],
  },
  attach: {
    title: "第二幕 · 来自明天的心跳",
    text: "耳机里先是一段电流 noise，接着响起她自己的声音，清唱着乐队解散那晚没写完的歌。末尾还有一句气声：「别删，追下去。」",
    choices: [
      { label: "追查邮件来源", next: "endC" },
      { label: "太诡异了，删除邮件", next: "endB" },
    ],
  },
  endA: {
    title: "结局 A · 重逢",
    text: "重聚那晚她迟到了四十分钟，抱着落灰的贝斯推开门。四个中年人笑得像十七岁。原来有些歌，十年后再弹，前奏一响就全想起来了。",
    choices: [],
    ending: "A",
  },
  endB: {
    title: "结局 B · 平行线",
    text: "她把手机调成静音，回到工位改完了方案。第二天方案一次通过，老板请全组喝了咖啡。只是偶尔加班到深夜，她会想起那个没接的电话。",
    choices: [],
    ending: "B",
  },
  endC: {
    title: "结局 C · 未寄出的歌",
    text: "邮件来自她自己的旧邮箱，定时发送设在十年前：解散那晚，她给未来的自己留了这首歌。她把它听完，订了回老家的票——琴还在，时间也还来得及。",
    choices: [],
    ending: "C",
  },
};
const questOrder = ["start", "call", "mail", "attach", "endA", "endB", "endC"];
type QuestBlob = { v: string[]; e: string[] };

export function HFQuest({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("hf-quest", draftId, {
    node: "start",
    message: JSON.stringify({ v: ["start"], e: [] } as QuestBlob),
  });
  const [shown, setShown] = useState(0);
  const blob = useMemo<QuestBlob>(
    () => {
      const raw = readBlob<Partial<QuestBlob>>(state.message, {});
      return {
        v: Array.isArray(raw.v) ? raw.v.filter((x) => typeof x === "string") : ["start"],
        e: Array.isArray(raw.e) ? raw.e.filter((x) => typeof x === "string") : [],
      };
    },
    [state.message],
  );
  const nodeId = questNodes[state.node] ? state.node : "start";
  const node = questNodes[nodeId];
  const done = shown >= node.text.length;

  useEffect(() => {
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n >= node.text.length) {
          window.clearInterval(timer);
          return n;
        }
        return n + 2;
      });
    }, 32);
    return () => window.clearInterval(timer);
  }, [nodeId, node.text.length]);

  const handleSkip = () => {
    if (!done) {
      setShown(node.text.length);
    }
  };

  const handleRestart = () => {
    set((v) => ({
      ...v,
      node: "start",
      message: JSON.stringify({ v: ["start"], e: [] } as QuestBlob),
    }));
  };

  useEffect(() => {
    if (!node.ending || blob.e.includes(node.ending)) return;
    const next = { v: blob.v, e: [...blob.e, node.ending] };
    set((v) => ({ ...v, message: JSON.stringify(next) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const go = (next: string) => {
    const v = blob.v.includes(next) ? blob.v : [...blob.v, next];
    set({ node: next, message: JSON.stringify({ v, e: blob.e }) });
  };
  const restart = () => set((v) => ({ ...v, node: "start" }));
  const exportScript = () => {
    const lines = blob.v.map((id) => questNodes[id]).filter(Boolean);
    const body = lines
      .map((n) => `【${n.title}】\n${n.text}\n${n.choices.map((c) => `→ ${c.label}`).join("\n")}`)
      .join("\n\n");
    download(new Blob([`CROSSROADS · 我的游玩路线\n已解锁结局：${blob.e.join(" / ") || "无"}\n\n${body}\n`], { type: "text/plain;charset=utf-8" }), "crossroads-route.txt");
  };
  return (
    <HFShell
      id="hf-quest"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button onClick={exportScript}>下载路线剧本</button>
          <button onClick={handleRestart}>重新开始游玩</button>
        </>
      }
    >
      <div className="hf-layout">
        <section className="hf-stage">
          <div className="hf-quest-card" key={nodeId}>
            <small>{node.title}</small>
            <p
              className="hf-typewriter"
              onClick={handleSkip}
              title={done ? "" : "点击跳过打字效果"}
              style={{ cursor: done ? "default" : "pointer" }}
            >
              {node.text.slice(0, shown)}
              {!done && <i className="hf-caret" />}
            </p>
            {done && node.choices.length > 0 && (
              <div className="hf-choices">
                {node.choices.map((c) => (
                  <button 
                    key={c.next} 
                    onClick={() => go(c.next)}
                    className="hf-choice-btn"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {done && node.ending && (
              <div className="hf-ending">
                <strong>结局 {node.ending} · 已收录</strong>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button onClick={handleRestart} className="hf-action-btn">清除存档并重启</button>
                  <button onClick={() => go("start")} className="hf-action-btn primary">回到序幕换条路</button>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="hf-side">
          <h2>路线图</h2>
          <p className="hf-hint">已解锁结局 {blob.e.length} / 3，进度自动保存。</p>
          <ol className="hf-map">
            {questOrder.map((id) => {
              const n = questNodes[id];
              const visited = blob.v.includes(id);
              const isEnding = !!n.ending;
              const unlocked = !isEnding || blob.e.includes(n.ending!);
              return (
                <li key={id} className={`${visited ? "is-visited" : ""} ${id === nodeId ? "is-here" : ""} ${isEnding ? "is-ending" : ""}`}>
                  <button onClick={() => visited && go(id)} disabled={!visited} title={visited ? "回到这一幕" : "尚未到达"}>
                    <b>{isEnding ? (unlocked ? n.ending : "?") : "·"}</b>
                    <span>{isEnding && !unlocked ? "未解锁的结局" : n.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="hf-endings">
            {["A", "B", "C"].map((e) => (
              <span key={e} className={blob.e.includes(e) ? "is-got" : ""}>{e}</span>
            ))}
          </div>
        </aside>
      </div>
    </HFShell>
  );
}

/* ------------------------------ hf-lesson ------------------------------ */

type LessonChapter = { title: string; duration: number; points: string[]; note: string };
const lessonChapters: LessonChapter[] = [
  { title: "第 1 节 · 什么是好文案", duration: 96, points: ["好文案 = 一个清晰的承诺", "先说人话，再说修辞", "删掉所有「赋能」和「抓手」"], note: "带着问题听：你最近写的一句话，能让用户复述出来吗？" },
  { title: "第 2 节 · 三秒标题公式", duration: 128, points: ["数字 + 结果 + 时间", "反常识开头，证据收尾", "标题先写 10 个再挑 1 个"], note: "暂停一下，给你的产品写 3 个标题，选最敢发的那版。" },
  { title: "第 3 节 · 正文的滑梯结构", duration: 114, points: ["第一句只干一件事：让人读第二句", "短段落 + 小标题 = 防滑条", "每 150 字放一个钩子"], note: "检查你的正文：读者在第几行会第一次走神？" },
  { title: "第 4 节 · 结尾的行动召唤", duration: 88, points: ["一个页面只放一个动作", "把按钮文案写成用户收益", "犹豫点提前写进 FAQ"], note: "结尾不是总结，是把读者轻轻推过门槛的那只手。" },
];
type Quiz = { q: string; options: string[]; answer: number; explain: string };
const lessonQuiz: Quiz[] = [
  { q: "下面哪个标题最符合「三秒公式」？", options: ["我们的匠心之作，敬请期待", "3 天学会做周报，老板追着问", "关于进一步提升效率的通知", "好产品，会说话"], answer: 1, explain: "数字（3 天）+ 结果（学会做周报）+ 悬念，一秒就能看懂收益。" },
  { q: "正文第一句最重要的任务是？", options: ["介绍公司背景", "让人愿意读第二句", "堆砌关键词", "表明写作目的"], answer: 1, explain: "滑梯结构：每一句都只为下一句服务，第一句决定 80% 的打开率。" },
  { q: "行动召唤按钮最好的文案是？", options: ["提交", "免费获取我的周报模板", "点击这里", "确定"], answer: 1, explain: "按钮文案要写成用户收益，而不是系统动作——用户点的永远是好处。" },
];
type LessonBlob = { d: boolean[]; a: number[] };
const lessonDefaults: LessonBlob = { d: [false, false, false, false], a: [-1, -1, -1] };

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function HFLesson({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("hf-lesson", draftId, {
    chapter: 0,
    message: JSON.stringify(lessonDefaults),
  });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const blob = useMemo<LessonBlob>(
    () => {
      const raw = readBlob<Partial<LessonBlob>>(state.message, {});
      return {
        d: lessonDefaults.d.map((v, i) => (Array.isArray(raw.d) ? raw.d[i] === true : v)),
        a: lessonDefaults.a.map((v, i) => (Array.isArray(raw.a) && Number.isInteger(raw.a[i]) ? (raw.a as number[])[i] : v)),
      };
    },
    [state.message],
  );
  const chapter = Math.min(Math.max(state.chapter, 0), lessonChapters.length - 1);
  const current = lessonChapters[chapter];
  const score = blob.a.filter((a, i) => a === lessonQuiz[i].answer).length;
  const answered = blob.a.filter((a) => a >= 0).length;

  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [chapter]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTime((t) => {
        const next = t + 0.25 * rate;
        if (next >= current.duration) {
          window.clearInterval(timer);
          setPlaying(false);
          set((v) => {
            const prev = readBlob<Partial<LessonBlob>>(v.message, {});
            const d = lessonDefaults.d.map((done, i) =>
              i === chapter ? true : Array.isArray(prev.d) ? prev.d[i] === true : done,
            );
            return { ...v, message: JSON.stringify({ ...lessonDefaults, ...prev, d }) };
          });
          return current.duration;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, rate, current.duration, chapter, set]);

  const answer = (qi: number, oi: number) => {
    if (blob.a[qi] >= 0) return;
    const a = blob.a.map((v, i) => (i === qi ? oi : v));
    set((v) => ({ ...v, message: JSON.stringify({ ...blob, a }) }));
  };
  const retryQuiz = () => set((v) => ({ ...v, message: JSON.stringify({ ...blob, a: [-1, -1, -1] }) }));
  const pick = (i: number) => set((v) => ({ ...v, chapter: i }));
  const exportNotes = () => {
    const body = lessonChapters
      .map((c) => `<section><h2>${escapeHtml(c.title)}</h2><ul>${c.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul><p>思考：${escapeHtml(c.note)}</p></section>`)
      .join("\n");
    const quiz = lessonQuiz
      .map((q, i) => `<section><h3>测验 ${i + 1} · ${escapeHtml(q.q)}</h3><p>答案：${escapeHtml(q.options[q.answer])}</p><p>${escapeHtml(q.explain)}</p></section>`)
      .join("\n");
    download(
      new Blob(
        [`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SPARK · 课程讲义</title><body style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.8"><h1>SPARK · 五分钟微课讲义</h1>${body}<hr>${quiz}</body></html>`],
        { type: "text/html;charset=utf-8" },
      ),
      "spark-notes.html",
    );
  };
  return (
    <HFShell
      id="hf-lesson"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button className="hf-action-btn primary" onClick={exportNotes}>下载讲义 HTML</button>
        </>
      }
    >
      <div className="hf-layout">
        <section className="hf-stage">
          <div className="hf-player" key={chapter}>
            <div className="hf-screen">
              <small>{current.title}</small>
              <strong>{current.points[0]}</strong>
              <span className="hf-play-glyph" aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
              <em>{fmt(time)} / {fmt(current.duration)}</em>
            </div>
            <div className="hf-transport">
              <button 
                className={`hf-action-btn ${playing ? '' : 'primary'}`}
                onClick={() => { if (time >= current.duration) setTime(0); setPlaying((p) => !p); }}
              >
                {playing ? "⏸ 暂停" : "▶ 播放"}
              </button>
              <input aria-label="播放位置" type="range" min={0} max={current.duration} step={0.5} value={time} onChange={(e) => setTime(+e.target.value)} />
              <select aria-label="播放倍速" value={rate} onChange={(e) => setRate(+e.target.value)}>
                {[1, 1.5, 2].map((r) => (<option key={r} value={r}>{r}x</option>))}
              </select>
              {blob.d[chapter] && <span className="hf-done-flag">✅ 已学完</span>}
            </div>
            <ul className="hf-points">
              {current.points.map((p) => (<li key={p}>{p}</li>))}
            </ul>
            <p className="hf-note">思考 · {current.note}</p>
          </div>
          <div className="hf-quiz">
            <h2>随堂测验 · {score} / {lessonQuiz.length} 分</h2>
            {lessonQuiz.map((q, qi) => {
              const picked = blob.a[qi];
              return (
                <fieldset key={q.q} className={picked >= 0 ? (picked === q.answer ? "is-right" : "is-wrong") : ""}>
                  <legend>第 {qi + 1} 题 · {q.q}</legend>
                  {q.options.map((opt, oi) => (
                    <button
                      key={opt}
                      disabled={picked >= 0}
                      className={`hf-quiz-btn ${picked === oi ? "is-picked" : ""} ${picked >= 0 && oi === q.answer ? "is-answer" : ""}`}
                      onClick={() => answer(qi, oi)}
                    >
                      {opt}
                      {picked === oi && <span className="hf-quiz-icon">{picked === q.answer ? "✨" : "❌"}</span>}
                    </button>
                  ))}
                  {picked >= 0 && (
                    <p className={`hf-explain ${picked === q.answer ? 'is-correct' : 'is-wrong-hint'}`}>
                      {picked === q.answer ? "回答正确。" : "再想想——"} {q.explain}
                    </p>
                  )}
                </fieldset>
              );
            })}
            {answered === lessonQuiz.length && (
              <div className={`hf-score ${score === 3 ? 'is-perfect' : ''}`}>
                <strong>
                  {score === 3 ? "🏆 三题全对，可以出师了。" : score === 2 ? "答对两题，再看一遍第 2 节就稳了。" : "建议重看第 2 节，然后再测一次。"}
                </strong>
                <button className="hf-action-btn primary" onClick={retryQuiz}>重新测验</button>
              </div>
            )}
          </div>
        </section>
        <aside className="hf-side">
          <h2>课程大纲</h2>
          <p className="hf-hint">已学完 {blob.d.filter(Boolean).length} / {lessonChapters.length} 节，进度自动保存。</p>
          <ol className="hf-step-list">
            {lessonChapters.map((c, i) => (
              <li key={c.title}>
                <button className={i === chapter ? "is-active" : ""} onClick={() => pick(i)}>
                  <b>{blob.d[i] ? "✓" : i + 1}</b>
                  <span>{c.title}<small>{fmt(c.duration)}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </HFShell>
  );
}
