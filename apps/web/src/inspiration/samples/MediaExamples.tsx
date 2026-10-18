import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  SampleTop,
  Notice,
  copySample,
  download,
  useSampleState,
  type SampleId,
} from "./shared";
import {
  clamp,
  csvValue,
  escapeHtml,
  motionFrames,
  motionHtml,
  safeJson,
  soundSamples,
  wavBlob,
  waveform,
  type MotionFrame,
} from "./media-utils";
import { GLScene, mesh, webglHtml } from "./WebGLArtifact";
import filmUrl from "../../assets/media/lakeside-film.mp4";
import filmPoster from "../../assets/media/lakeside-poster.webp";
import seedAudio from "../../assets/media/soft-signals.wav";
import "./media.css";
export const mediaIds = [
  "hyperframes",
  "film",
  "sound",
  "live",
  "webgl",
] as const;
type MediaId = (typeof mediaIds)[number];
const titles = {
  hyperframes: "NEXT FRAME · 品牌动效分镜",
  film: "LAKESIDE · 慢下来的一天",
  sound: "SOFT SIGNALS · 声音标识实验",
  live: "SCOPE · 实时报价工作台",
  webgl: "FORM · 材质与光",
};
const types = {
  hyperframes: "HyperFrames / HTML 动效",
  film: "视频 / 18 秒摄影剪辑",
  sound: "音频 / 8 秒程序合成",
  live: "实时产物 / 本地交互工具",
  webgl: "WebGL / 原生三维渲染",
};
const basePeaks = waveform(soundSamples());
const initialLines = [
  { id: "strategy", name: "策略与内容梳理", qty: 1, price: 2800 },
  { id: "design", name: "核心页面设计", qty: 6, price: 1200 },
  { id: "handoff", name: "组件规范与交付", qty: 1, price: 1600 },
];
export function Wave({
  peaks = basePeaks,
  progress = 0,
}: {
  peaks?: number[];
  progress?: number;
}) {
  return (
    <div className="media-wave" aria-hidden="true">
      {peaks.map((p, i) => (
        <i
          key={i}
          className={i < progress * 100 ? "played" : ""}
          style={{ height: `${Math.max(3, p * 220)}%` }}
        />
      ))}
    </div>
  );
}
export function MotionScene({
  frame,
  progress = 0,
}: {
  frame: MotionFrame;
  progress?: number;
}) {
  return (
    <div
      className="media-motion-scene"
      style={
        {
          "--frame-accent": frame.color,
          "--frame-progress": progress,
        } as React.CSSProperties
      }
    >
      <span>NEXT FRAME / MOTION STUDY</span>
      <div className="media-motion-orbit">
        <i />
        <i />
        <i />
      </div>
      <h1>{frame.title}</h1>
      <p>{frame.caption}</p>
      <footer>
        <b>HYPERFRAMES</b>
        <span>HTML / CSS / TIME</span>
      </footer>
    </div>
  );
}
export function MediaCover({ id }: { id: MediaId }) {
  if (id === "hyperframes")
    return (
      <div className="media-cover">
        <MotionScene frame={motionFrames[0]} progress={0.3} />
      </div>
    );
  if (id === "film")
    return (
      <div className="media-cover media-film-cover">
        <img src={filmPoster} alt="" />
        <span className="media-cover-play">▷</span>
        <footer>
          <b>LAKESIDE / VISUAL ESSAY</b>
          <span>00:18 · MP4</span>
        </footer>
      </div>
    );
  if (id === "sound")
    return (
      <div className="media-cover media-audio-cover">
        <small>SOFT SIGNALS / 001</small>
        <h2>
          让声音，
          <br />
          留下温柔的记忆。
        </h2>
        <Wave />
        <footer>8 SECONDS / ORIGINAL SYNTHESIS</footer>
      </div>
    );
  if (id === "live")
    return (
      <div className="media-cover media-live-cover">
        <small>SCOPE / LIVE ESTIMATE</small>
        <h2>把创意，算得清楚。</h2>
        <div>
          <span>项目预估</span>
          <strong>¥11,600</strong>
        </div>
        {initialLines.map((l) => (
          <p key={l.id}>
            <span>{l.name}</span>
            <b>¥{(l.qty * l.price).toLocaleString()}</b>
          </p>
        ))}
        <footer>INPUT → CALCULATE → DELIVER</footer>
      </div>
    );
  return (
    <div className="media-cover media-gl-cover">
      <small>FORM / REALTIME MATERIAL STUDY</small>
      <GLScene />
      <footer>
        <b>材质与光</b>
        <span>REAL WEBGL / DRAG TO EXPLORE</span>
      </footer>
    </div>
  );
}
function Shell({
  id,
  draftId,
  state,
  error,
  children,
  actions,
}: {
  id: MediaId;
  draftId?: string;
  state: unknown;
  error: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [notice, setNotice] = useState("");
  return (
    <main className={`media-work media-${id}`}>
      <SampleTop
        type={types[id]}
        title={titles[id]}
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
      <footer className="media-provenance">
        <strong>关于这个样板</strong>
        {id === "film" ? (
          <p>
            由三张 AI 概念摄影剪辑为真实
            MP4，无声，不是实地拍摄或真实酒店广告。字幕可以编辑，下载原片不会改变原片画面。
          </p>
        ) : id === "sound" ? (
          <p>
            原创程序合成音序，无人声、无外部采样。节奏、明亮度与音量会改变实际音频；不连接音乐或语音生成服务。
          </p>
        ) : id === "hyperframes" ? (
          <p>
            此栏目展示可独立运行的 HTML / CSS 动效分镜，不声称已集成某个第三方
            HyperFrames 引擎。导出为动画网页，不是视频文件。
          </p>
        ) : id === "live" ? (
          <p>
            输入即时驱动本地计算。这是报价草案，不是实时市场价格，也不会创建合同、支付或发送报价。
          </p>
        ) : (
          <p>
            实际使用原生 WebGL
            绘制几何体，不是三维效果截图。未连接商业建模服务；不支持 WebGL
            的设备会显示明确提示。
          </p>
        )}
        <small>
          参数默认在当前浏览器自动保存；可用顶部按钮手动备份到服务器。无自动播放或外部发布。请在清理网站数据前保留备份。
        </small>
      </footer>
    </main>
  );
}
function useMotionPlayback(total: number) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let id = 0,
      last = performance.now();
    const step = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime((v) => Math.min(total, v + delta));
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    const hidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [playing, total]);
  useEffect(() => {
    if (time >= total) setPlaying(false);
  }, [time, total]);
  return { time: Math.min(time, total), setTime, playing, setPlaying };
}
export function HyperFrames({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("hyperframes", draftId, {
    frames: motionFrames,
  });
  const [editing, setEditing] = useState(0);
  const total = state.frames.reduce((sum, f) => sum + f.duration, 0),
    play = useMotionPlayback(total);
  let active = state.frames.length - 1,
    start = 0;
  for (let i = 0; i < state.frames.length; i++) {
    if (play.time < start + state.frames[i].duration) {
      active = i;
      break;
    }
    start += state.frames[i].duration;
  }
  const frame = state.frames[active],
    progress = clamp(
      (play.time - Math.min(start, total - frame.duration)) / frame.duration,
      0,
      1,
    );
  const update = (patch: Partial<MotionFrame>) =>
    set((v) => ({
      ...v,
      frames: v.frames.map((f, i) => (i === editing ? { ...f, ...patch } : f)),
    }));
  return (
    <Shell
      id="hyperframes"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <button
          onClick={() =>
            download(
              new Blob([motionHtml(state.frames)], {
                type: "text/html;charset=utf-8",
              }),
              "next-frame.html",
            )
          }
        >
          下载动效 HTML
        </button>
      }
    >
      <div className="media-motion-layout">
        <section>
          <MotionScene frame={frame} progress={progress} />
          <div className="media-transport">
            <button
              onClick={() => {
                if (play.time >= total) play.setTime(0);
                play.setPlaying((v) => !v);
              }}
            >
              {play.playing ? "暂停动效" : "播放动效"}
            </button>
            <button
              onClick={() => {
                play.setTime(0);
                play.setPlaying(false);
              }}
            >
              回到开头
            </button>
            <input
              aria-label="动效播放位置"
              type="range"
              min={0}
              max={total}
              step={0.01}
              value={play.time}
              onChange={(e) => play.setTime(+e.target.value)}
            />
            <output aria-label="动效时间">
              {play.time.toFixed(1)} / {total.toFixed(1)} s
            </output>
          </div>
          <div className="media-frame-strip">
            {state.frames.map((f, i) => (
              <button
                aria-label={`编辑分镜${i + 1}`}
                aria-pressed={editing === i}
                key={i}
                onClick={() => {
                  setEditing(i);
                  play.setPlaying(false);
                  play.setTime(
                    state.frames
                      .slice(0, i)
                      .reduce((s, f) => s + f.duration, 0),
                  );
                }}
              >
                <i style={{ background: f.color }} />
                <span>
                  0{i + 1} / {f.duration}s
                </span>
                <strong>{f.title.replace("\n", "")}</strong>
              </button>
            ))}
          </div>
        </section>
        <aside className="media-inspector">
          <small>FRAME EDITOR / 0{editing + 1}</small>
          <h2>每一帧，都有表达。</h2>
          <label>
            分镜标题
            <textarea
              aria-label="分镜标题"
              maxLength={80}
              rows={3}
              value={state.frames[editing].title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            辅助文案
            <input
              aria-label="分镜文案"
              maxLength={100}
              value={state.frames[editing].caption}
              onChange={(e) => update({ caption: e.target.value })}
            />
          </label>
          <label>
            停留时长 · {state.frames[editing].duration}s
            <input
              aria-label="分镜时长"
              type="range"
              min={2}
              max={10}
              value={state.frames[editing].duration}
              onChange={(e) => {
                update({ duration: +e.target.value });
                play.setPlaying(false);
              }}
            />
          </label>
          <label>
            视觉主色
            <input
              aria-label="分镜颜色"
              type="color"
              value={state.frames[editing].color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
          <p>
            点击分镜后直接修改。播放、暂停和时间定位均由真实时间轴驱动。HTML
            包含当前四帧内容，可离线播放。
          </p>
        </aside>
      </div>
    </Shell>
  );
}
const captionSeed = {
  "0": "抵达湖畔，把时间留给自己。",
  "1": "窗外是风景，窗内是安静。",
  "2": "让光与空间，慢慢发生。",
};
function vtt(captions: Record<string, string>) {
  return (
    "WEBVTT\n\n" +
    [0, 1, 2]
      .map(
        (i) =>
          `${i + 1}\n00:00:${String(i * 6).padStart(2, "0")}.000 --> 00:00:${String(i * 6 + 6).padStart(2, "0")}.000\n${(captions[String(i)] || "").replace(/[<>\r\n]/g, " ")}\n`,
      )
      .join("\n")
  );
}
export function Film({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("film", draftId, {
    title: "慢下来的一天",
    captions: captionSeed,
    rate: 1,
  });
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [notice, setNotice] = useState(""),
    [trackUrl, setTrack] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([vtt(state.captions)], { type: "text/vtt" }),
    );
    setTrack(url);
    return () => URL.revokeObjectURL(url);
  }, [state.captions]);
  useEffect(() => {
    if (video.current) video.current.playbackRate = state.rate;
  }, [state.rate]);
  const downloadFilm = async () => {
    try {
      const response = await fetch(filmUrl);
      if (!response.ok) throw new Error();
      download(await response.blob(), "lakeside-film.mp4");
    } catch {
      setNotice("视频文件读取失败，请重试。");
    }
  };
  return (
    <Shell
      id="film"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button
            onClick={() =>
              download(
                new Blob([vtt(state.captions)], {
                  type: "text/vtt;charset=utf-8",
                }),
                "lakeside-subtitles.vtt",
              )
            }
          >
            下载字幕 VTT
          </button>
          <button onClick={downloadFilm}>下载原片 MP4</button>
        </>
      }
    >
      <div className="media-film-layout">
        <header>
          <small>LAKESIDE / A VISUAL ESSAY</small>
          <h1>{state.title}</h1>
          <p>十八秒，三个镜头，一次温柔的停留。</p>
        </header>
        <div className="media-film-stage">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            poster={filmPoster}
            aria-label="湖畔摄影短片"
            src={filmUrl}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() =>
              setNotice("当前浏览器无法播放此 MP4。可下载原片使用兼容播放器。")
            }
          >
            {trackUrl && (
              <track
                key={trackUrl}
                src={trackUrl}
                label="中文字幕"
                kind="subtitles"
                srcLang="zh"
                default
              />
            )}
          </video>
          <span className="media-film-label">
            PHOTOGRAPHIC FILM / SILENT / 18 SEC
          </span>
        </div>
        <div className="media-transport">
          <button
            onClick={async () => {
              if (!video.current) return;
              if (playing) video.current.pause();
              else
                try {
                  await video.current.play();
                } catch {
                  setNotice("播放被浏览器阻止，请使用视频原生播放按钮。");
                }
            }}
          >
            {playing ? "暂停短片" : "播放短片"}
          </button>
          <label>
            播放速度
            <select
              aria-label="视频播放速度"
              value={state.rate}
              onChange={(e) => set((v) => ({ ...v, rate: +e.target.value }))}
            >
              {[0.5, 1, 1.5, 2].map((r) => (
                <option value={r} key={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
          <output aria-label="短片时间">{time.toFixed(1)} / 18.0 s</output>
          <span>摄影剪辑 · 无音轨</span>
        </div>
        <div className="media-video-chapters">
          {["抵达 / ARRIVE", "入住 / STAY", "留白 / SLOW DOWN"].map((t, i) => (
            <article key={t}>
              <button
                aria-label={`跳转镜头${i + 1}`}
                onClick={() => {
                  if (video.current) video.current.currentTime = i * 6;
                }}
              >
                <span>
                  0{i + 1} / 00:{String(i * 6).padStart(2, "0")}
                </span>
                <h3>{t}</h3>
              </button>
              <label>
                本段字幕
                <input
                  aria-label={`镜头${i + 1}字幕`}
                  maxLength={44}
                  value={state.captions[String(i) as keyof typeof captionSeed]}
                  onChange={(e) =>
                    set((v) => ({
                      ...v,
                      captions: { ...v.captions, [i]: e.target.value },
                    }))
                  }
                />
              </label>
            </article>
          ))}
        </div>
        <details className="media-details">
          <summary>修改作品名称</summary>
          <input
            aria-label="短片标题"
            maxLength={80}
            value={state.title}
            onChange={(e) => set((v) => ({ ...v, title: e.target.value }))}
          />
          <p>
            标题用于作品工作区；修改字幕会更新播放器字幕及
            VTT，不会改写原片画面。
          </p>
        </details>
        <Notice text={notice} />
      </div>
    </Shell>
  );
}
export function Sound({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("sound", draftId, {
    title: "SOFT SIGNALS",
    tempo: 72,
    tone: 45,
    gain: 65,
  });
  const pcm = useMemo(
      () => soundSamples(state.tempo, state.tone, state.gain),
      [state.tempo, state.tone, state.gain],
    ),
    peaks = useMemo(() => waveform(pcm), [pcm]);
  const [url, setUrl] = useState(seedAudio),
    [time, setTime] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(wavBlob(pcm));
    setUrl(next);
    setTime(0);
    return () => URL.revokeObjectURL(next);
  }, [pcm]);
  return (
    <Shell
      id="sound"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <button onClick={() => download(wavBlob(pcm), "soft-signals.wav")}>
          下载当前音频 WAV
        </button>
      }
    >
      <div className="media-sound-layout">
        <section className="media-sound-art">
          <small>ORIGINAL SOUND IDENTITY / 001</small>
          <div className="media-vinyl">
            <i />
            <b>S</b>
          </div>
          <h1>{state.title}</h1>
          <p>清亮的音序，温柔的落点。</p>
          <Wave peaks={peaks} progress={time / 8} />
          <audio
            aria-label="声音标识试听"
            controls
            preload="metadata"
            src={url}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onError={() =>
              setNotice("音频播放失败。可下载 WAV 后使用本地播放器试听。")
            }
          />
          <div className="media-audio-spec">
            <span>00:08</span>
            <span>22.05 kHz / MONO</span>
            <span>16-BIT PCM</span>
          </div>
        </section>
        <aside className="media-inspector">
          <small>SOUND PARAMETERS</small>
          <h2>调出自己的声音。</h2>
          <label>
            作品名称
            <input
              aria-label="声音作品名称"
              maxLength={60}
              value={state.title}
              onChange={(e) => set((v) => ({ ...v, title: e.target.value }))}
            />
          </label>
          {(
            [
              ["tempo", "节奏", 50, 140, " BPM"],
              ["tone", "明亮度", 0, 100, "%"],
              ["gain", "音量", 0, 100, "%"],
            ] as const
          ).map(([key, label, min, max, unit]) => (
            <label key={key}>
              {label} · {state[key]}
              {unit}
              <input
                aria-label={`声音${label}`}
                type="range"
                min={min}
                max={max}
                value={state[key]}
                onChange={(e) => set((v) => ({ ...v, [key]: +e.target.value }))}
              />
            </label>
          ))}
          <div className="media-audio-note">
            <b>原始音序 / C E G C G E D C</b>
            <p>
              移动参数会重新合成 PCM
              波形，并重置播放位置。点击播放器开始试听；导出的 WAV
              与当前参数一致。
            </p>
          </div>
          <Notice text={notice} />
        </aside>
      </div>
    </Shell>
  );
}
export type QuoteState = {
  title: string;
  client: string;
  tax: number;
  discount: number;
  lines: typeof initialLines;
};
function totals(state: QuoteState) {
  const subtotal = state.lines.reduce(
    (sum, l) => sum + Math.round(l.price * 100) * l.qty,
    0,
  );
  const discount = Math.round((subtotal * state.discount) / 100),
    tax = Math.round(((subtotal - discount) * state.tax) / 100);
  return {
    subtotal: subtotal / 100,
    discount: discount / 100,
    tax: tax / 100,
    total: (subtotal - discount + tax) / 100,
  };
}
const currency = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
function quoteHtml(state: QuoteState) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(state.title)}</title><style>body{font:16px/1.8 system-ui;background:#f3f2ed;color:#293f3c;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:36px}table{width:100%;border-collapse:collapse;background:white}td,th{padding:15px;border-bottom:1px solid #ddd;text-align:left}input{padding:8px;max-width:110px;border:1px solid #ccc}footer{padding:25px;background:#243f39;color:white;font-size:28px;margin:20px 0}.table{overflow:auto}button{padding:10px 16px;border:1px solid #ccc;background:white}</style><small>SCOPE / LIVE ESTIMATE</small><h1>${escapeHtml(state.title)}</h1><p>${escapeHtml(state.client)}</p><div class="table"><table><thead><tr><th>服务</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody id="rows"></tbody></table></div><p><label>折扣 % <input id="discount" type="number" min="0" max="30" value="${state.discount}"></label> <label>税率 % <input id="tax" type="number" min="0" max="15" value="${state.tax}"></label></p><footer>预估合计 <strong id="total"></strong></footer><button onclick="window.print()">打印 / 保存 PDF</button><p>本地实时计算的报价草案，不是合同或付款凭据。刷新后恢复导出时的参数。</p><script>const state=${safeJson(state)},money=n=>'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),rows=document.querySelector('#rows');state.lines.forEach(l=>{const tr=document.createElement('tr'),name=document.createElement('td');name.textContent=l.name;tr.append(name);for(const key of ['qty','price']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=0;input.max=key==='qty'?999:100000;input.step=key==='qty'?1:.01;input.value=l[key];input.setAttribute('aria-label',l.name+(key==='qty'?'数量':'单价'));input.oninput=()=>{l[key]=Math.min(+input.max,Math.max(0,Number(input.value)||0));if(key==='qty')l[key]=Math.floor(l[key]);calculate()};td.append(input);tr.append(td)}const amount=document.createElement('td');amount.className='amount';tr.append(amount);rows.append(tr)});function calculate(){let cents=0;state.lines.forEach((l,i)=>{const value=Math.round(l.price*100)*l.qty;cents+=value;document.querySelectorAll('.amount')[i].textContent=money(value/100)});const discount=Math.round(cents*state.discount/100),tax=Math.round((cents-discount)*state.tax/100);document.querySelector('#total').textContent=money((cents-discount+tax)/100)}for(const key of ['discount','tax'])document.querySelector('#'+key).oninput=e=>{state[key]=Math.min(+e.target.max,Math.max(0,Number(e.target.value)||0));calculate()};calculate();</script></html>`;
}
export function LiveArtifact({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState<QuoteState>("live", draftId, {
    title: "品牌网站设计提案",
    client: "为下一次合作，做好准备。",
    tax: 0,
    discount: 0,
    lines: initialLines,
  });
  const sum = totals(state);
  const patch = (id: string, part: Partial<QuoteState["lines"][number]>) =>
    set((v) => ({
      ...v,
      lines: v.lines.map((l) => (l.id === id ? { ...l, ...part } : l)),
    }));
  const csv = () =>
    download(
      new Blob(
        [
          "\uFEFF" +
            [
              ["项目", state.title],
              ["客户", state.client],
              ["服务", "数量", "单价", "小计"],
              ...state.lines.map((l) => [
                l.name,
                l.qty,
                l.price,
                (Math.round(l.price * 100) * l.qty) / 100,
              ]),
              ["折扣", sum.discount],
              ["税额", sum.tax],
              ["含税合计", sum.total],
            ]
              .map((r) => r.map(csvValue).join(","))
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      "project-estimate.csv",
    );
  return (
    <Shell
      id="live"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button onClick={csv}>导出报价 CSV</button>
          <button
            onClick={() =>
              download(
                new Blob([quoteHtml(state)], {
                  type: "text/html;charset=utf-8",
                }),
                "live-estimate.html",
              )
            }
          >
            下载交互 HTML
          </button>
        </>
      }
    >
      <div className="media-quote-layout">
        <section>
          <header>
            <small>SCOPE / LIVE ESTIMATE</small>
            <input
              className="media-quote-title"
              aria-label="报价项目标题"
              value={state.title}
              maxLength={100}
              onChange={(e) => set((v) => ({ ...v, title: e.target.value }))}
            />
            <input
              className="media-quote-client"
              aria-label="报价客户"
              value={state.client}
              maxLength={100}
              onChange={(e) => set((v) => ({ ...v, client: e.target.value }))}
            />
            <p>调整服务、数量和单价，结果即刻更新。</p>
          </header>
          <div className="media-table-scroll">
            <table aria-label="报价项目">
              <thead>
                <tr>
                  <th>服务内容</th>
                  <th>数量</th>
                  <th>单价 / 元</th>
                  <th>小计</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.lines.map((l, i) => (
                  <tr key={l.id}>
                    <td>
                      <input
                        aria-label={`服务${i + 1}名称`}
                        maxLength={80}
                        value={l.name}
                        onChange={(e) => patch(l.id, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`服务${i + 1}数量`}
                        type="number"
                        min={0}
                        max={999}
                        value={l.qty}
                        onChange={(e) =>
                          patch(l.id, {
                            qty: Math.floor(clamp(+e.target.value, 0, 999)),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`服务${i + 1}单价`}
                        type="number"
                        min={0}
                        max={100000}
                        step={0.01}
                        value={l.price}
                        onChange={(e) =>
                          patch(l.id, {
                            price: clamp(+e.target.value, 0, 100000),
                          })
                        }
                      />
                    </td>
                    <td>
                      {currency((Math.round(l.price * 100) * l.qty) / 100)}
                    </td>
                    <td>
                      <button
                        aria-label={`删除服务${i + 1}`}
                        onClick={() => {
                          if (confirm("删除这条服务？"))
                            set((v) => ({
                              ...v,
                              lines: v.lines.filter((x) => x.id !== l.id),
                            }));
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="media-add-row"
            disabled={state.lines.length >= 20}
            onClick={() =>
              set((v) => ({
                ...v,
                lines: [
                  ...v.lines,
                  {
                    id: crypto.randomUUID(),
                    name: "新的服务",
                    qty: 1,
                    price: 1000,
                  },
                ],
              }))
            }
          >
            ＋ 添加服务
          </button>
          <div className="media-quote-chart">
            {state.lines.map((l) => (
              <div key={l.id}>
                <span>{l.name || "未命名服务"}</span>
                <i
                  style={{
                    width: `${sum.subtotal ? ((l.qty * l.price) / sum.subtotal) * 100 : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
        <aside className="media-quote-summary">
          <small>YOUR ESTIMATE</small>
          <p>项目预估总额</p>
          <strong aria-label="报价总额" aria-live="polite">
            {currency(sum.total)}
          </strong>
          <dl>
            <div>
              <dt>服务小计</dt>
              <dd>{currency(sum.subtotal)}</dd>
            </div>
            <div>
              <dt>折扣</dt>
              <dd>− {currency(sum.discount)}</dd>
            </div>
            <div>
              <dt>税额</dt>
              <dd>+ {currency(sum.tax)}</dd>
            </div>
          </dl>
          <label>
            折扣 · {state.discount}%
            <input
              aria-label="报价折扣"
              type="range"
              min={0}
              max={30}
              value={state.discount}
              onChange={(e) =>
                set((v) => ({ ...v, discount: +e.target.value }))
              }
            />
          </label>
          <label>
            税率 · {state.tax}%
            <input
              aria-label="报价税率"
              type="range"
              min={0}
              max={15}
              value={state.tax}
              onChange={(e) => set((v) => ({ ...v, tax: +e.target.value }))}
            />
          </label>
          <p className="media-live-note">
            <i />
            本地实时计算 · 修改自动保存
          </p>
          <small>
            以人民币元为单位，折扣后计税，金额按分舍入。此报价仅作草案。
          </small>
        </aside>
      </div>
    </Shell>
  );
}
export function WebGLWork({ draftId }: { draftId?: string }) {
  const [state, set, error] = useSampleState("webgl", draftId, {
    shape: "ring",
    accent: "#92c8b3",
    yaw: 0.55,
    pitch: 0.65,
    zoom: 1,
  });
  const [spin, setSpin] = useState(false),
    [notice, setNotice] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const obj = () => {
    const g = mesh(state.shape),
      lines = [
        "# DesignBuddy / original procedural geometry",
        ...Array.from(
          { length: g.positions.length / 3 },
          (_, i) => `v ${g.positions.slice(i * 3, i * 3 + 3).join(" ")}`,
        ),
        ...Array.from(
          { length: g.normals.length / 3 },
          (_, i) => `vn ${g.normals.slice(i * 3, i * 3 + 3).join(" ")}`,
        ),
        ...Array.from(
          { length: g.positions.length / 9 },
          (_, i) =>
            `f ${i * 3 + 1}//${i * 3 + 1} ${i * 3 + 2}//${i * 3 + 2} ${i * 3 + 3}//${i * 3 + 3}`,
        ),
      ];
    download(
      new Blob([lines.join("\n")], { type: "text/plain" }),
      "form-geometry.obj",
    );
  };
  return (
    <Shell
      id="webgl"
      draftId={draftId}
      state={state}
      error={error}
      actions={
        <>
          <button onClick={obj}>下载几何 OBJ</button>
          <button
            onClick={() =>
              download(
                new Blob([webglHtml(state)], {
                  type: "text/html;charset=utf-8",
                }),
                "form-webgl.html",
              )
            }
          >
            下载 WebGL HTML
          </button>
        </>
      }
    >
      <div className="media-webgl-layout">
        <section className="media-webgl-stage">
          <header>
            <small>FORM / MATERIAL LAB</small>
            <h1>材质，与光的关系。</h1>
            <p>拖动旋转，也可使用方向键探索。</p>
          </header>
          <GLScene
            {...state}
            color={state.accent}
            spin={spin}
            canvasRef={canvas}
            onRotate={(yaw, pitch) =>
              set((v) => ({ ...v, yaw: clamp(yaw, -100, 100), pitch }))
            }
          />
          <footer>
            <span>NATIVE WEBGL / REAL GEOMETRY</span>
            <span>
              {state.shape === "ring" ? "TORUS" : "SPHERE"} · 4096 TRIANGLES
            </span>
          </footer>
        </section>
        <aside className="media-inspector">
          <small>SCENE CONTROLS</small>
          <h2>
            不是图片。
            <br />
            是可探索的形体。
          </h2>
          <label>
            几何形体
            <select
              aria-label="三维形体"
              value={state.shape}
              onChange={(e) => set((v) => ({ ...v, shape: e.target.value }))}
            >
              <option value="ring">圆环 / Torus</option>
              <option value="sphere">球体 / Sphere</option>
            </select>
          </label>
          <label>
            材质颜色
            <input
              aria-label="三维材质颜色"
              type="color"
              value={state.accent}
              onChange={(e) => set((v) => ({ ...v, accent: e.target.value }))}
            />
          </label>
          <label>
            缩放 · {state.zoom.toFixed(2)}×
            <input
              aria-label="三维缩放"
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={state.zoom}
              onChange={(e) => set((v) => ({ ...v, zoom: +e.target.value }))}
            />
          </label>
          <label className="media-check">
            <input
              type="checkbox"
              checked={spin}
              onChange={(e) => setSpin(e.target.checked)}
            />
            自动旋转（当前页面）
          </label>
          <button
            onClick={() => {
              set((v) => ({ ...v, yaw: 0.55, pitch: 0.65, zoom: 1 }));
              setSpin(false);
            }}
          >
            重置视角
          </button>
          <button
            onClick={() => {
              const el = canvas.current;
              if (!el || el.dataset.rendered === "false") {
                setNotice("三维画面尚未就绪，无法截图。");
                return;
              }
              el.toBlob((blob) => {
                if (blob) download(blob, "form-view.png");
                else setNotice("截图失败，请重试。");
              }, "image/png");
            }}
          >
            保存当前视图 PNG
          </button>
          <p>
            HTML 文件含真实着色器、几何数据和拖动交互；OBJ
            只包含几何与法线，不包含着色器材质；PNG 为透明背景的模型截图。
          </p>
          <Notice text={notice} />
        </aside>
      </div>
    </Shell>
  );
}
