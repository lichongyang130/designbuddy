export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const safeJson = (value: unknown) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");
export const csvValue = (value: unknown) => {
  let text = String(value);
  if (/^\s*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function soundSamples(tempo = 72, tone = 45, gain = 65) {
  const rate = 22050,
    duration = 8,
    pcm = new Float32Array(rate * duration),
    notes = [
      261.6256, 329.6276, 391.9954, 523.2511, 391.9954, 329.6276, 293.6648,
      261.6256,
    ];
  for (let i = 0; i < pcm.length; i++) {
    const t = i / rate;
    let value = 0;
    for (let n = 0; n < notes.length; n++) {
      const dt = t - (n * 60) / clamp(tempo, 50, 140);
      if (dt >= 0 && dt < 2.5) {
        const envelope = (1 - Math.exp(-dt * 55)) * Math.exp(-dt * 2.5);
        value +=
          envelope *
          (Math.sin(2 * Math.PI * notes[n] * dt) +
            (clamp(tone, 0, 100) / 100) *
              0.3 *
              Math.sin(2 * Math.PI * notes[n] * 2 * dt)) *
          0.26;
      }
    }
    pcm[i] = clamp(
      (value *
        Math.min(1, t / 0.06, (duration - t) / 0.2) *
        clamp(gain, 0, 100)) /
        100,
      -1,
      1,
    );
  }
  return pcm;
}
export function wavBlob(pcm: Float32Array) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2),
    view = new DataView(buffer);
  const word = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 22050, true);
  view.setUint32(28, 44100, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++)
    view.setInt16(44 + i * 2, Math.round(clamp(pcm[i], -1, 1) * 32767), true);
  return new Blob([buffer], { type: "audio/wav" });
}
export function waveform(pcm: Float32Array) {
  return Array.from({ length: 100 }, (_, i) => {
    let peak = 0;
    const start = Math.floor((i * pcm.length) / 100),
      end = Math.floor(((i + 1) * pcm.length) / 100);
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(pcm[j]));
    return peak;
  });
}
export type MotionFrame = {
  title: string;
  caption: string;
  duration: number;
  color: string;
};
export const motionFrames: MotionFrame[] = [
  {
    title: "把想法，\n变成下一帧。",
    caption: "FRAME 01 / A NEW PERSPECTIVE",
    duration: 4,
    color: "#b6decc",
  },
  {
    title: "让故事，\n有自己的节奏。",
    caption: "FRAME 02 / FIND YOUR RHYTHM",
    duration: 4,
    color: "#d7c3ef",
  },
  {
    title: "少一点噪声，\n多一点表达。",
    caption: "FRAME 03 / LESS, BUT BETTER",
    duration: 4,
    color: "#f3bf91",
  },
  {
    title: "现在，\n让灵感发生。",
    caption: "FRAME 04 / MADE TO MOVE",
    duration: 4,
    color: "#dce799",
  },
];
export function motionHtml(frames: MotionFrame[]) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HyperFrames / 动效分镜</title><style>*{box-sizing:border-box}body{margin:0;padding:5vw;background:#151a1b;color:#f5f7ef;font:16px/1.7 system-ui}main{position:relative;min-height:65vh;padding:6vw;overflow:hidden;border:1px solid #343b38;border-radius:14px}h1{position:relative;z-index:1;font-size:clamp(32px,6vw,80px);line-height:1.2;white-space:pre-line;max-width:70%}small{letter-spacing:3px;color:#9aa59d}#orb{position:absolute;right:8%;top:22%;width:24vw;height:24vw;background:var(--accent);border-radius:35%;opacity:.7}footer{display:flex;gap:20px;align-items:center;margin-top:25px;flex-wrap:wrap}button{background:#e4efdf;border:0;padding:12px 20px;border-radius:6px;cursor:pointer}input{flex:1;min-width:150px}p{color:#93a397}button:focus-visible,input:focus-visible{outline:3px solid #8cb79b}</style><main><small>HYPERFRAMES / MOTION STUDY</small><div id="orb"></div><h1 id="title"></h1><p id="caption"></p></main><footer><button id="play">播放</button><input aria-label="播放位置" id="seek" type="range" min="0" step=".01"><output id="time"></output></footer><p>独立 HTML / CSS 动效分镜，没有使用第三方 HyperFrames 引擎。用户点击后播放。</p><script>const frames=${safeJson(frames)};let time=0,playing=false,raf=0,last=0;const total=frames.reduce((s,f)=>s+f.duration,0),seek=document.querySelector('#seek'),button=document.querySelector('#play');seek.max=total;function draw(){let start=0,index=frames.length-1;for(let i=0;i<frames.length;i++){if(time<start+frames[i].duration){index=i;break}start+=frames[i].duration}const f=frames[index],p=Math.max(0,Math.min(1,(time-Math.min(start,total-f.duration))/f.duration));document.querySelector('#title').textContent=f.title;document.querySelector('#caption').textContent=f.caption;document.querySelector('main').style.setProperty('--accent',f.color);document.querySelector('#orb').style.transform=matchMedia('(prefers-reduced-motion: reduce)').matches?'none':'rotate('+(p*90+index*45)+'deg) scale('+(1+p*.2)+')';seek.value=time;document.querySelector('#time').textContent=time.toFixed(1)+' / '+total.toFixed(1)+' s'}function stop(){playing=false;button.textContent='播放';cancelAnimationFrame(raf)}function tick(now){if(!playing)return;time=Math.min(total,time+(now-last)/1000);last=now;draw();if(time===total)stop();else raf=requestAnimationFrame(tick)}button.onclick=()=>{if(playing){stop();return}if(time>=total)time=0;playing=true;button.textContent='暂停';last=performance.now();raf=requestAnimationFrame(tick)};seek.oninput=()=>{time=+seek.value;draw()};document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});draw();</script></html>`;
}
