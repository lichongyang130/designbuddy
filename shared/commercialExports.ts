import { benchmarkFontLicense } from "./commercialFontLicense";
import {
  costBreakdown,
  guidePages,
  type BenchmarkState,
} from "./commercialTemplates";
export const htmlEscape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const json = (v: unknown) => JSON.stringify(v).replaceAll("<", "\\u003c");
export const campaignNames = [
  "品牌主视觉",
  "设计卖点",
  "结构细节",
  "使用场景",
  "发布邀请",
  "行动入口",
];
export const campaignCopy = [
  "留白，也是功能。",
  "少一点装饰，多一点秩序。",
  "轮廓清楚，关系自然。",
  "阅读、停留、重新出发。",
  "认识日常的另一种可能。",
  "从一个空间想法开始。",
];
export function campaignSvg(s: BenchmarkState, index = 0, landscape = false) {
  const w = landscape ? 1600 : 1080,
    h = landscape ? 900 : 1440;
  const y = landscape ? 260 : 540,
    cx = landscape ? 1160 : 560,
    cy = landscape ? 420 : 900;
  const title = htmlEscape(s.title);
  const wrap = (text: string, n: number) => {
    const chars = Array.from(text);
    return Array.from({ length: Math.ceil(chars.length / n) }, (_, i) =>
      chars.slice(i * n, (i + 1) * n).join(""),
    );
  };
  const titleLines = wrap(s.title, landscape ? 14 : 12),
    titleY = landscape ? 190 : 300,
    titleSize = landscape ? 45 : titleLines.length > 1 ? 70 : 94;
  const titleMarkup = titleLines
    .map(
      (line, i) =>
        `<text x="72" y="${titleY + i * (titleSize + 9)}" font-size="${titleSize}" font-weight="700">${htmlEscape(line)}</text>`,
    )
    .join("");
  const subtitleY = titleY + (titleLines.length - 1) * (titleSize + 9) + 70;
  const subtitleMarkup = wrap(s.subtitle, landscape ? 23 : 30)
    .map(
      (line, i) =>
        `<text x="72" y="${subtitleY + i * 34}" font-size="25">${htmlEscape(line)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${title} / ${campaignNames[index]}</title><rect width="${w}" height="${h}" fill="${index % 2 ? "#252e2b" : "#edeae1"}"/><g fill="none" stroke="${s.accent}" stroke-width="${index === 2 ? 3 : 2}" opacity=".45">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${cx}" cy="${cy}" r="${130 + i * 65}"/>`).join("")}</g><g fill="${s.accent}"><ellipse cx="${cx}" cy="${cy - 65}" rx="240" ry="72"/><path d="M${cx - 180} ${cy - 55}v270h28V${cy - 48}M${cx + 152} ${cy - 48}v263h28V${cy - 55}"/><ellipse cx="${cx}" cy="${cy - 50}" rx="240" ry="72" opacity=".7"/></g><g font-family="Noto Sans SC, sans-serif" fill="${index % 2 ? "#f0eee6" : "#29372e"}"><text x="72" y="90" font-size="22" letter-spacing="5">OBJECTS FOR A QUIETER DAY</text>${titleMarkup}${subtitleMarkup}<text x="72" y="${h - 180}" font-size="34">${campaignCopy[index]}</text><path d="M72 ${h - 125}H${w - 72}" stroke="${index % 2 ? "#f0eee6" : "#29372e"}"/><text x="72" y="${h - 76}" font-size="18">${campaignNames[index]} / 原创虚构品牌 · 屏幕视觉样例</text><text x="${w - 130}" y="${h - 76}" font-size="22">0${index + 1}</text></g></svg>`;
}
export const cueNames = ["成功", "提醒", "警告", "错误", "完成"];
export const cueDescriptions = [
  "轻快上行双音：操作已保存",
  "柔和单音重复：需要查看一条信息",
  "间隔三音：继续前请确认风险",
  "低频下行双音：操作未完成，保留重试入口",
  "渐弱上行三音：任务结束，请查看交付物",
];
export function cuePCM(index: number, volume = 25) {
  const rate = 22050,
    duration = index === 4 ? 1.4 : 1.0,
    pcm = new Float32Array(Math.round(rate * duration));
  const notes = [
    [523.25, 783.99],
    [659.25, 659.25],
    [440, 440, 440],
    [349.23, 261.63],
    [523.25, 659.25, 1046.5],
  ][index];
  const interval = index === 4 ? 0.28 : 0.22;
  for (let i = 0; i < pcm.length; i++) {
    const t = i / rate;
    let sum = 0;
    notes.forEach((f, n) => {
      const dt = t - n * interval;
      if (dt >= 0 && dt < 0.35) {
        const envelope = Math.min(1, dt / 0.015) * Math.pow(1 - dt / 0.35, 2);
        sum += Math.sin(2 * Math.PI * f * dt) * envelope;
      }
    });
    pcm[i] = Math.max(
      -0.95,
      Math.min(0.95, (sum * 0.45 * Math.max(0, Math.min(60, volume))) / 100),
    );
  }
  return { rate, pcm };
}
export function cueWav(index: number, volume = 25) {
  const { rate, pcm } = cuePCM(index, volume),
    bytes = new Uint8Array(44 + pcm.length * 2),
    v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(x * 32767), true));
  return bytes;
}
const css = `*{box-sizing:border-box}body{margin:0;padding:clamp(20px,5vw,70px);background:#eeeee6;color:#263d32;font:16px/1.8 system-ui}main{max-width:1100px;margin:auto}small{letter-spacing:2px}h1{font-size:clamp(32px,5vw,64px);line-height:1.15}h2{font-size:28px}button,input{font:inherit;padding:10px;border:1px solid #a7b5a7;border-radius:8px}button{cursor:pointer;background:#2c4c3d;color:white;margin:8px}button:disabled{opacity:.4}button:focus-visible,input:focus-visible{outline:3px solid #ac622d;outline-offset:3px}section{padding:28px;background:#fffdf5;border-radius:16px;margin:20px 0}label{display:inline-block;margin:10px}input{width:110px}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}output{font-size:30px;font-weight:bold}.table{overflow:auto}p{overflow-wrap:anywhere}`;
export function guideHtml(s: BenchmarkState) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(s.title)}</title><style>${css}@media(prefers-reduced-motion:no-preference){section{animation:appear .3s ease-out}@keyframes appear{from{opacity:.3;transform:translateY(8px)}to{opacity:1;transform:none}}}</style><main><small>WAYFINDER / OFFLINE GUIDE</small><h1>${htmlEscape(s.title)}</h1><p>${htmlEscape(s.subtitle)}</p><p>教学式导览，不操作外部软件、不采集数据。</p><div id="progress" aria-live="polite"></div><section id="frame" aria-live="polite"></section><button id="prev">上一步</button><button id="next">下一步</button><button id="reset">重新开始</button><p>键盘：左右方向键切换。此文件离线可用，不含外部资源。</p></main><script>const pages=${json(guidePages)},titles=${json(s.edits)};let step=0;const frame=document.getElementById('frame');function draw(){document.getElementById('progress').textContent=(step+1)+' / '+pages.length;frame.replaceChildren();const h=document.createElement('h2');h.textContent=titles[step];frame.append(h);for(const text of [pages[step].lead,...pages[step].points,pages[step].note]){const p=document.createElement('p');p.textContent=text;frame.append(p)}document.getElementById('prev').disabled=step===0;document.getElementById('next').disabled=step===pages.length-1}document.getElementById('prev').onclick=()=>{step=Math.max(0,step-1);draw()};document.getElementById('next').onclick=()=>{step=Math.min(pages.length-1,step+1);draw()};document.getElementById('reset').onclick=()=>{step=0;draw()};document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')document.getElementById('next').click();if(e.key==='ArrowLeft')document.getElementById('prev').click()});draw();</script></html>`;
}
export function costHtml(s: BenchmarkState) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(s.title)}</title><style>${css}</style><main><small>LEDGER / LOCAL CALCULATION</small><h1>${htmlEscape(s.title)}</h1><p>${htmlEscape(s.subtitle)}</p><section><div class="table"><table><thead><tr><th>岗位</th><th>工时（小时）</th><th>不含税时薪（元）</th></tr></thead><tbody>${["策略", "设计", "交付"].map((name, i) => `<tr><th>${name}</th><td><input aria-label="${name}工时" data-key="hours" data-index="${i}" type="number" min="0" max="1000" step="1" value="${s.hours[i]}"></td><td><input aria-label="${name}时薪" data-key="rates" data-index="${i}" type="number" min="0" max="10000" step="1" value="${s.rates[i]}"></td></tr>`).join("")}</tbody></table></div>${[
    ["external", "外采（元）", 1000000],
    ["reserve", "预备金率（%）", 50],
    ["tax", "税率（%）", 30],
  ]
    .map(
      ([k, label, max]) =>
        `<label>${label}<input data-key="${k}" type="number" min="0" max="${max}" step="1" value="${s[k as keyof BenchmarkState]}"></label>`,
    )
    .join(
      "",
    )}<p id="detail"></p><output id="total" aria-live="polite"></output></section><p>计算顺序：人工 + 外采 → 对小计计提预备金 → 对含预备金小计计税。各步骤以分为单位四舍五入；整小时/整元输入，币种 CNY。本地预算草案，不是合同、财税建议或市场报价；刷新恢复导出时配置。</p></main><script>const state=${json(s)};const calculate=${costBreakdown.toString()};function draw(){const c=calculate(state);document.getElementById('total').textContent='含税预算 ¥'+(c.total/100).toFixed(2);document.getElementById('detail').textContent='人工 '+(c.labor/100).toFixed(2)+' / 外采 '+(c.external/100).toFixed(2)+' / 预备金 '+(c.reserve/100).toFixed(2)+' / 税费 '+(c.tax/100).toFixed(2)}document.querySelectorAll('input').forEach(el=>el.oninput=()=>{const value=Math.round(Math.max(0,Math.min(Number(el.max),Number(el.value)||0)));if(el.dataset.index!==undefined)state[el.dataset.key][Number(el.dataset.index)]=value;else state[el.dataset.key]=value;draw()});draw();</script></html>`;
}
export function configurationGeometry(width: number, height: number) {
  const w = width / 80,
    h = height / 80,
    positions: number[] = [],
    normals: number[] = [],
    vertices: number[][] = [],
    faces: number[][] = [];
  const box = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const start = vertices.length;
    for (const [x, y, z] of [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ])
      vertices.push([cx + (x * sx) / 2, cy + (y * sy) / 2, cz + (z * sz) / 2]);
    const sides = [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ];
    for (const f of sides) {
      const q = f.map((i) => vertices[start + i]);
      const a = q[1].map((v, i) => v - q[0][i]),
        b = q[2].map((v, i) => v - q[0][i]);
      const n = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const len = Math.hypot(...n);
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        positions.push(...q[idx]);
        normals.push(...n.map((v) => v / len));
      }
      faces.push(f.map((i) => start + i + 1));
    }
  };
  box(0, h / 2, 0, w, 0.08, w * 0.7);
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      box(x * (w / 2 - 0.09), 0, z * (w * 0.35 - 0.09), 0.07, h, 0.07);
  const obj =
    "# OBJECT parameterized side table / original geometry\n# units: normalized; 1 unit = 80 cm, visual only\n" +
    vertices.map((v) => "v " + v.join(" ")).join("\n") +
    "\n" +
    faces.map((f) => "f " + f.join(" ")).join("\n") +
    "\n";
  return { positions, normals, obj };
}
export function configHtml(s: BenchmarkState) {
  const geometry = configurationGeometry(s.width, s.height);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(s.title)}</title><style>body{margin:0;background:#e7e5da;color:#34453c;font:14px system-ui}canvas{display:block;width:100%;height:60vh;min-height:240px;max-height:560px}p{padding:0 24px}input{width:120px}label{display:inline-block;margin:12px}button{padding:8px 16px}h1{margin:18px 24px 0;font-size:22px}</style><main aria-label="三维选配"><h1>${htmlEscape(s.title)}</h1><canvas aria-label="参数化边几三维预览"></canvas><p><label>视角<input aria-label="视角" type="range" min="-180" max="180" value="${s.yaw}" id="yaw"></label><button id="reset">重置相机</button></p><p>${s.width} × ${Math.round(s.width * 0.7)} × ${s.height} cm · 视觉示意，不用于工程测量。${htmlEscape(s.title)}</p><p id="status" role="status"></p></main><script>const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});if(!gl){document.getElementById('status').textContent='设备不支持 WebGL：请参考配置尺寸和参数，或使用支持 WebGL 的浏览器。';canvas.style.display='none';}else{const vs='attribute vec3 p;attribute vec3 normal;uniform float yaw;uniform float aspect;uniform float fit;varying vec3 n;void main(){float a=yaw;mat3 rot=mat3(cos(a),0.,-sin(a),0.,1.,0.,sin(a),0.,cos(a));vec3 q=rot*p;float y=q.y*.9-q.z*.4;float z=q.z*.9+q.y*.4;n=rot*normal;gl_Position=vec4(q.x/aspect*1.35*fit,y*1.35*fit,-z*.12,1.);}';const fs='precision mediump float;uniform vec3 color;varying vec3 n;void main(){float light=.35+.65*max(0.,dot(normalize(n),normalize(vec3(-.4,.8,1.))));gl_FragColor=vec4(color*light,1.);}';function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}try{const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link failed');gl.useProgram(program);const data=${json(geometry)};for(const [name,arr]of [['p',data.positions],['normal',data.normals]]){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}const rgb=${json(s.accent)}.slice(1).match(/../g).map(v=>parseInt(v,16)/255);gl.uniform3fv(gl.getUniformLocation(program,'color'),rgb);gl.enable(gl.DEPTH_TEST);function draw(){const scale=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(canvas.clientWidth*scale);canvas.height=Math.round(canvas.clientHeight*scale);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.905,.898,.855,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);gl.uniform1f(gl.getUniformLocation(program,'fit'),Math.min(1,(canvas.width/canvas.height)/${Math.max(s.width, s.height) / 80}));gl.uniform1f(gl.getUniformLocation(program,'yaw'),Number(document.getElementById('yaw').value)*Math.PI/180);gl.drawArrays(gl.TRIANGLES,0,data.positions.length/3);}document.getElementById('yaw').oninput=draw;document.getElementById('reset').onclick=()=>{document.getElementById('yaw').value='30';draw()};window.addEventListener('resize',draw);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('status').textContent='三维上下文已丢失，请重新载入。'});draw();document.getElementById('status').textContent='WebGL 已绘制 · 原创参数化模型';}catch(e){document.getElementById('status').textContent='三维渲染失败，请查看配置参数。';}}</script></html>`;
}

/** Local OFL font embedded in downloadable artifacts, never fetched from a third-party CDN. */
export function embeddedFontCss(dataUrl: string) {
  if (!dataUrl) return "";
  if (
    !/^data:(font\/woff2|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/.test(
      dataUrl,
    )
  )
    throw Error("离线字体数据无效");
  return `/* ${benchmarkFontLicense} */@font-face{font-family:"Benchmark CJK";src:url("${dataUrl}") format("woff2");font-weight:100 900;font-display:block}body,button,input,select{font-family:"Benchmark CJK",system-ui,sans-serif!important}`;
}
export function offlineHtml(html: string, fontDataUrl: string) {
  return html.replace("</style>", embeddedFontCss(fontDataUrl) + "</style>");
}
export function offlineSvg(svg: string, fontDataUrl: string) {
  return svg.replace(
    "<title>",
    `<style>${htmlEscape(embeddedFontCss(fontDataUrl))}text{font-family:"Benchmark CJK",sans-serif}</style><title>`,
  );
}
