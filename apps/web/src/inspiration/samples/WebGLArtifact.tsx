import { useEffect, useRef, useState, type RefObject } from "react";
import { safeJson } from "./media-utils";
export const vertexSource = `attribute vec3 position;attribute vec3 normal;uniform vec2 rotation;uniform float aspect;uniform float zoom;varying vec3 n;varying vec3 world;vec3 rotate(vec3 p){float a=rotation.x,b=rotation.y;vec3 q=vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);return vec3(q.x,cos(b)*q.y-sin(b)*q.z,sin(b)*q.y+cos(b)*q.z);}void main(){vec3 p=rotate(position)*zoom;n=rotate(normal);world=p;float z=4.0-p.z;gl_Position=vec4(p.x*1.9/aspect,p.y*1.9,z*1.002002-0.2002,z);}`;
export const fragmentSource = `precision mediump float;uniform vec3 color;varying vec3 n;varying vec3 world;void main(){vec3 N=normalize(n);vec3 L=normalize(vec3(-.6,.8,1.0));float diffuse=max(0.0,dot(N,L));float shine=pow(max(0.0,dot(reflect(-L,N),normalize(vec3(0.,0.,4.)-world))),42.0);float rim=pow(1.0-max(0.0,dot(N,normalize(vec3(0.,0.,4.)-world))),3.0);gl_FragColor=vec4(color*(.25+.72*diffuse)+vec3(.8,.9,1.)*shine*.65+vec3(.22,.28,.32)*rim,1.);}`;
export function mesh(shape: string) {
  const positions: number[] = [],
    normals: number[] = [];
  const point = (u: number, v: number) => {
    if (shape === "sphere") {
      const a = u * Math.PI * 2,
        b = v * Math.PI;
      const n = [
        Math.sin(b) * Math.cos(a),
        Math.cos(b),
        Math.sin(b) * Math.sin(a),
      ];
      return { p: n.map((x) => x * 1.12), n };
    }
    const a = u * Math.PI * 2,
      b = v * Math.PI * 2;
    return {
      p: [
        (1 + 0.36 * Math.cos(b)) * Math.cos(a),
        0.36 * Math.sin(b),
        (1 + 0.36 * Math.cos(b)) * Math.sin(a),
      ],
      n: [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)],
    };
  };
  for (let u = 0; u < 64; u++)
    for (let v = 0; v < 32; v++)
      for (const [du, dv] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
        [1, 1],
        [0, 1],
      ]) {
        const p = point((u + du) / 64, (v + dv) / 32);
        positions.push(...p.p);
        normals.push(...p.n);
      }
  return { positions, normals };
}
function initialize(canvas: HTMLCanvasElement, shape: string) {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl)
    throw new Error(
      "当前浏览器无法启用 WebGL。请启用硬件加速或使用支持 WebGL 的浏览器。",
    );
  const shaders: WebGLShader[] = [];
  const buffers: WebGLBuffer[] = [];
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL 程序创建失败");
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("无法创建着色器");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("着色器编译失败");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("WebGL 程序链接失败");
    gl.useProgram(program);
    const geometry = mesh(shape);
    for (const [name, values] of [
      ["position", geometry.positions],
      ["normal", geometry.normals],
    ] as const) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("显存不足");
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    }
    gl.enable(gl.DEPTH_TEST);
    return {
      draw(color: string, yaw: number, pitch: number, zoom: number) {
        if (gl.isContextLost()) return;
        gl.useProgram(program);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(
          gl.getUniformLocation(program, "aspect"),
          canvas.width / Math.max(1, canvas.height),
        );
        gl.uniform1f(gl.getUniformLocation(program, "zoom"), zoom);
        gl.uniform2f(gl.getUniformLocation(program, "rotation"), yaw, pitch);
        gl.uniform3f(
          gl.getUniformLocation(program, "color"),
          parseInt(color.slice(1, 3), 16) / 255,
          parseInt(color.slice(3, 5), 16) / 255,
          parseInt(color.slice(5, 7), 16) / 255,
        );
        gl.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3);
      },
      dispose() {
        buffers.forEach((b) => gl.deleteBuffer(b));
        shaders.forEach((s) => gl.deleteShader(s));
        gl.deleteProgram(program);
      },
    };
  } catch (error) {
    buffers.forEach((b) => gl.deleteBuffer(b));
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteProgram(program);
    throw error;
  }
}
export function GLScene({
  shape = "ring",
  color = "#92c8b3",
  yaw = 0.55,
  pitch = 0.65,
  zoom = 1,
  spin = false,
  canvasRef,
  onRotate,
}: {
  shape?: string;
  color?: string;
  yaw?: number;
  pitch?: number;
  zoom?: number;
  spin?: boolean;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  onRotate?: (yaw: number, pitch: number) => void;
}) {
  const ownRef = useRef<HTMLCanvasElement>(null),
    values = useRef({ color, yaw, pitch, zoom, spin });
  values.current = { color, yaw, pitch, zoom, spin };
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const redraw = useRef<(() => void) | null>(null),
    drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(
      null,
    );
  useEffect(() => {
    const canvas = ownRef.current!;
    if (canvasRef) canvasRef.current = canvas;
    let renderer: ReturnType<typeof initialize> | undefined,
      raf = 0,
      active = true,
      offset = 0,
      last = performance.now();
    const draw = () => {
      if (!renderer || !active) return;
      const v = values.current;
      renderer.draw(v.color, v.yaw + offset, v.pitch, v.zoom);
    };
    const tick = (now: number) => {
      if (!active) return;
      const v = values.current;
      if (v.spin && !document.hidden)
        offset += Math.min(0.05, (now - last) / 1000) * 0.45;
      last = now;
      draw();
      if (v.spin && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(box.width * scale));
      canvas.height = Math.max(1, Math.round(box.height * scale));
      draw();
    };
    const resume = () => {
      cancelAnimationFrame(raf);
      offset = 0;
      last = performance.now();
      draw();
      if (values.current.spin && !document.hidden)
        raf = requestAnimationFrame(tick);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      active = false;
      cancelAnimationFrame(raf);
      setError("WebGL 上下文已丢失。可以重试，编辑参数仍然保留。");
    };
    const observer = new ResizeObserver(resize);
    try {
      renderer = initialize(canvas, shape);
      setError("");
      redraw.current = resume;
      observer.observe(canvas);
      canvas.addEventListener("webglcontextlost", lost);
      document.addEventListener("visibilitychange", resume);
      resize();
      resume();
    } catch (e) {
      setError((e as Error).message);
    }
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", resume);
      renderer?.dispose();
      redraw.current = null;
      if (canvasRef) canvasRef.current = null;
    };
  }, [shape, attempt, canvasRef]);
  useEffect(() => redraw.current?.(), [color, yaw, pitch, zoom, spin]);
  return (
    <div className="media-gl-surface">
      <canvas
        key={attempt}
        ref={ownRef}
        aria-label="实时 WebGL 三维作品"
        tabIndex={onRotate ? 0 : -1}
        data-rendered={error ? "false" : "true"}
        onKeyDown={(e) => {
          if (!onRotate || !e.key.startsWith("Arrow")) return;
          e.preventDefault();
          onRotate(
            yaw +
              (e.key === "ArrowRight"
                ? 0.12
                : e.key === "ArrowLeft"
                  ? -0.12
                  : 0),
            Math.max(
              -1.5,
              Math.min(
                1.5,
                pitch +
                  (e.key === "ArrowDown"
                    ? 0.12
                    : e.key === "ArrowUp"
                      ? -0.12
                      : 0),
              ),
            ),
          );
        }}
        onPointerDown={(e) => {
          if (!onRotate) return;
          drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && onRotate)
            onRotate(
              d.yaw + (e.clientX - d.x) * 0.008,
              Math.max(
                -1.5,
                Math.min(1.5, d.pitch + (e.clientY - d.y) * 0.008),
              ),
            );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {error && (
        <div className="media-gl-error" role="alert">
          <strong>无法显示三维作品</strong>
          <p>{error}</p>
          {onRotate && (
            <button onClick={() => setAttempt((v) => v + 1)}>重试 WebGL</button>
          )}
        </div>
      )}
    </div>
  );
}
export function webglHtml(data: {
  shape: string;
  accent: string;
  yaw: number;
  pitch: number;
  zoom: number;
}) {
  const geometry = mesh(data.shape);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORM / WebGL material study</title><style>body{margin:0;background:#162425;color:#d9e9df;font:14px system-ui;padding:25px}canvas{display:block;width:100%;height:75vh;touch-action:none}label{margin-right:20px}button{padding:8px}input{vertical-align:middle}</style><h1>FORM / 材质与光</h1><p>原生 WebGL · 拖动旋转 · 不依赖网络或三维引擎</p><canvas aria-label="三维模型"></canvas><label>材质颜色 <input id="color" type="color" value="${data.accent}"></label><label>缩放 <input id="zoom" type="range" min=".6" max="1.6" step=".05" value="${data.zoom}"></label><p id="error" role="alert"></p><script>const data=${safeJson(data)},mesh=${safeJson(geometry)},canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{antialias:true});try{if(!gl)throw Error('浏览器不支持 WebGL');const program=gl.createProgram();for(const[type,source]of [[gl.VERTEX_SHADER,${JSON.stringify(vertexSource)}],[gl.FRAGMENT_SHADER,${JSON.stringify(fragmentSource)}]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('着色器编译失败');gl.attachShader(program,s)}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('程序链接失败');gl.useProgram(program);for(const[name,list]of [['position',mesh.positions],['normal',mesh.normals]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(list),gl.STATIC_DRAW);const l=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,0,0)}gl.enable(gl.DEPTH_TEST);function draw(){canvas.width=Math.round(canvas.clientWidth*Math.min(devicePixelRatio,2));canvas.height=Math.round(canvas.clientHeight*Math.min(devicePixelRatio,2));gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.085,.14,.145,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);gl.uniform1f(gl.getUniformLocation(program,'zoom'),data.zoom);gl.uniform2f(gl.getUniformLocation(program,'rotation'),data.yaw,data.pitch);gl.uniform3f(gl.getUniformLocation(program,'color'),...data.accent.slice(1).match(/../g).map(v=>parseInt(v,16)/255));gl.drawArrays(gl.TRIANGLES,0,mesh.positions.length/3)}let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,a:data.yaw,b:data.pitch};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;data.yaw=drag.a+(e.clientX-drag.x)*.008;data.pitch=Math.max(-1.5,Math.min(1.5,drag.b+(e.clientY-drag.y)*.008));draw()};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;document.querySelector('#color').oninput=e=>{data.accent=e.target.value;draw()};document.querySelector('#zoom').oninput=e=>{data.zoom=+e.target.value;draw()};window.onresize=draw;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.querySelector('#error').textContent='WebGL 上下文丢失，请刷新页面重试。'});draw()}catch(e){document.querySelector('#error').textContent=e.message}</script></html>`;
}
