import { useEffect, useMemo, useRef, useState } from "react";
import { SampleTop, Notice, copySample, download, useSampleState, type SampleId, type Photo } from "./shared";
import { soundSamples, wavBlob, waveform } from "./media-utils";
import filmUrl from "../../assets/media/lakeside-film.mp4";
import seedAudio from "../../assets/media/soft-signals.wav";
import "./media.css";
import "./samples.css"; // Ensure standard CSS is loaded for GenericTemplate thumbnails

function DynamicShell({
  id,
  draftId,
  state,
  error,
  children,
  actions,
  title,
  typeStr,
  isFilm
}: {
  id: string;
  draftId?: string;
  state: unknown;
  error: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  title: string;
  typeStr: string;
  isFilm: boolean;
}) {
  const [notice, setNotice] = useState("");
  return (
    <main className={`media-work media-${isFilm ? 'film' : 'sound'}`}>
      <SampleTop
        type={typeStr}
        title={title}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(id as SampleId, state);
          } catch {
            setNotice("副本保存失败，请先检查浏览器存储。");
          }
        }}
      >
        {actions}
      </SampleTop>
      <Notice text={error || notice} />
      {children}
      <footer className="media-provenance">
        <strong>关于这个扩展样板</strong>
        {isFilm ? (
          <p>
            这段视频是对标准 MP4 引擎的真实调用预览，支持字幕、倍速与自定义画板联动。这是生成的测试模板，使用统一测试影像。
          </p>
        ) : (
          <p>
            这段音频是对 Web Audio API 的深度合成预览，节奏、音调和增益参数可以自由调控并导出为独立 WAV，这是系统自动生成的音频测试环境。
          </p>
        )}
      </footer>
    </main>
  );
}


function formatVttTime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function vtt(captions: Array<{start: number, end: number, text: string}>) {
  return "WEBVTT\n\n" + captions.map((c: any) => 
    `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n\n`
  ).join("");
}

const captionSeed = [
  { start: 0.5, end: 3, text: "这里是增强型多媒体模板。" },
  { start: 3.5, end: 7, text: "展示 HTML5 视频流结合交互逻辑。" },
  { start: 7.5, end: 12, text: "下方可以附加更多业务页面和状态。" },
];

const googleVideos = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
];

export function GenericFilm({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const vidUrl = googleVideos[seed % googleVideos.length];


  const [state, set, error] = useSampleState(sample.id as SampleId, draftId, {
    title: sample.title,
    captions: captionSeed,
    rate: 1,
    page: 0
  });
  
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [notice, setNotice] = useState(""),
    [trackUrl, setTrack] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([vtt(state.captions)], { type: "text/vtt" })
    );
    setTrack(url);
    return () => URL.revokeObjectURL(url);
  }, [state.captions]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = state.rate;
  }, [state.rate]);

  const downloadFilm = async () => {
    try {
      const response = await fetch(vidUrl);
      if (!response.ok) throw new Error();
      download(await response.blob(), sample.id + ".mp4");
    } catch {
      setNotice("视频文件读取失败，请重试。");
    }
  };

  return (
    <DynamicShell
      id={sample.id}
      draftId={draftId}
      state={state}
      error={error || notice}
      title={sample.title}
      typeStr={sample.format}
      isFilm={true}
      actions={
        <button onClick={downloadFilm}>下载当前样片 MP4</button>
      }
    >
      <section className="media-workspace">
        <header>
          <input
            value={state.title}
            onChange={(e) => set((s) => ({ ...s, title: e.target.value }))}
            aria-label="短片标题"
          />
        </header>
        <div className="media-film-stage">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            poster={sample.photos[0]?.url}
            aria-label="动态演示片段"
            src={vidUrl}
            
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            {trackUrl && <track kind="captions" src={trackUrl} default />}
          </video>
        </div>
        <div className="media-film-tools">
          <div className="media-film-captions">
            <h3>字幕轨道</h3>
            <div className="media-film-timeline">
              {state.captions.map((c: any, i: number) => {
                const active = time >= c.start && time < c.end;
                return (
                  <div key={i} className={active ? "active" : ""}>
                    <input
                      value={c.text}
                      onChange={(e) =>
                        set((s) => {
                          const next = [...s.captions];
                          next[i] = { ...next[i], text: e.target.value };
                          return { ...s, captions: next };
                        })
                      }
                      aria-label={`字幕段落 ${i + 1}`}
                    />
                    <small>
                      {c.start.toFixed(1)}s - {c.end.toFixed(1)}s
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="media-film-meta">
            <h3>播放参数</h3>
            <label>
              <span>倍速 ({state.rate}x)</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.25"
                value={state.rate}
                onChange={(e) =>
                  set((s) => ({ ...s, rate: parseFloat(e.target.value) }))
                }
              />
            </label>
            <div className="media-film-info">
              <p>来源：DesignBuddy Studio</p>
              <p>许可：PRO / {sample.category}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Generic Thumbnails for extended viewing */}
      
      <section className="generic-template-content" style={{ marginTop: '40px', padding: '20px', background: '#fff', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '20px', color: '#111' }}>音景画板 ({sample.photos.length} 张)</h3>
        <div className="generic-template-preview" style={{ marginBottom: '24px' }}>
          <img src={sample.photos[state.page]?.url} style={{ width: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
        </div>
        <div className="generic-template-thumbnails" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
          {sample.photos.map((p: Photo, i: number) => (
             <button 
               key={i} 
               onClick={() => set(s => ({ ...s, page: i }))}
               className={'thumbnail ' + (i === state.page ? 'active' : '')}
               style={{ border: i === state.page ? '2px solid #667eea' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: 0, overflow: 'hidden' }}
             >
               <img src={p.url} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
             </button>
          ))}
        </div>
      </section>
    </DynamicShell>

  );
}

export function GenericSound({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const initialTempo = 40 + (seed * 23) % 100;
  const initialTone = 20 + (seed * 37) % 80;
  const initialGain = 40 + (seed * 17) % 60;

  const [state, set, error] = useSampleState(sample.id as SampleId, draftId, {
    title: sample.title,
    tempo: initialTempo,
    tone: initialTone,
    gain: initialGain,
    page: 0
  });

  const pcm = useMemo(
      () => soundSamples(state.tempo, state.tone, state.gain, seed),
      [state.tempo, state.tone, state.gain, seed],
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
    <DynamicShell
      id={sample.id}
      draftId={draftId}
      state={state}
      error={error || notice}
      title={sample.title}
      typeStr={sample.format}
      isFilm={false}
      actions={
        <button onClick={() => download(wavBlob(pcm), sample.id + ".wav")}>
          下载定制音频 WAV
        </button>
      }
    >
      <section className="media-workspace">
        <header>
          <input
            value={state.title}
            onChange={(e) => set((s) => ({ ...s, title: e.target.value }))}
            aria-label="音频标题"
          />
        </header>
        <div className="media-sound-stage">
          <audio
            controls
            src={url}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          />
          <div className="media-sound-waveform" aria-hidden="true">
            {peaks.map((p, i) => (
              <i
                key={i}
                style={{
                  height: `${Math.max(4, p * 100)}%`,
                  opacity: i / peaks.length < time / 8 ? 1 : 0.2,
                }}
              />
            ))}
          </div>
        </div>
        <div className="media-sound-tools">
          <label>
            <span>节奏 Tempo ({state.tempo})</span>
            <input
              type="range"
              min="40"
              max="160"
              value={state.tempo}
              onChange={(e) =>
                set((s) => ({ ...s, tempo: parseInt(e.target.value) }))
              }
            />
          </label>
          <label>
            <span>明亮度 Tone ({state.tone})</span>
            <input
              type="range"
              min="20"
              max="100"
              value={state.tone}
              onChange={(e) =>
                set((s) => ({ ...s, tone: parseInt(e.target.value) }))
              }
            />
          </label>
          <label>
            <span>增益 Gain ({state.gain})</span>
            <input
              type="range"
              min="10"
              max="100"
              value={state.gain}
              onChange={(e) =>
                set((s) => ({ ...s, gain: parseInt(e.target.value) }))
              }
            />
          </label>
        </div>
      </section>

      {/* Embedded Generic Thumbnails for extended viewing */}
      <section className="generic-template-content" style={{ marginTop: '40px', padding: '20px', background: '#fff', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '20px' }}>音景画板 ({sample.photos.length} 张)</h3>
        <div className="generic-template-preview" style={{ marginBottom: '24px' }}>
          <img src={sample.photos[state.page]?.url} style={{ width: '100%', borderRadius: '8px' }} />
        </div>
        <div className="generic-template-thumbnails" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
          {sample.photos.map((p: Photo, i: number) => (
             <button 
               key={i} 
               onClick={() => set(s => ({ ...s, page: i }))}
               className={`thumbnail ${i === state.page ? 'active' : ''}`}
               style={{ border: i === state.page ? '2px solid #667eea' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: 0 }}
             >
               <img src={p.url} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
             </button>
          ))}
        </div>
      </section>
    </DynamicShell>
  );
}
