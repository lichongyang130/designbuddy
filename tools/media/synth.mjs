/* 极简合成器：给「音频」与「视频」两套案例做真文件用的声音素材。
 * 只有正弦/三角波 + 噪声 + 简单包络，够用且完全可复现。 */
import { writeFileSync } from 'node:fs'

const SR = 44100

function rnd(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function makeBuf(seconds) {
  const n = Math.round(SR * seconds)
  return { n, l: new Float32Array(n), r: new Float32Array(n) }
}

const TAU = Math.PI * 2

function addTone(buf, { freq, amp, start, dur, kind = 'sine', detune = 0, pan = 0, attack = 0.6, release = 0.8, vibrato = 0 }) {
  const s0 = Math.round(start * SR)
  const len = Math.round(dur * SR)
  const gl = Math.sqrt((1 - pan) / 2), gr = Math.sqrt((1 + pan) / 2)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const idx = s0 + i
    if (idx < 0 || idx >= buf.n) continue
    const env = Math.min(1, t / attack, (dur - t) / release)
    if (env <= 0) continue
    const f = freq * (detune ? 1 + detune * Math.sin(TAU * 0.13 * t) : 1) * (vibrato ? 1 + vibrato * Math.sin(TAU * 5.1 * t) : 1)
    const ph = TAU * f * t
    let v = Math.sin(ph)
    if (kind === 'triangle') v = (2 / Math.PI) * Math.asin(Math.sin(ph))
    if (kind === 'sawsoft') v = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph)
    const a = amp * env * v
    buf.l[idx] += a * gl
    buf.r[idx] += a * gr
  }
}

function addNoise(buf, { amp, start, dur, seed = 7, lp = 0.02, swell = 1 }) {
  const rand = rnd(seed)
  const s0 = Math.round(start * SR)
  const len = Math.round(dur * SR)
  let y = 0
  for (let i = 0; i < len; i++) {
    const idx = s0 + i
    if (idx < 0 || idx >= buf.n) continue
    const t = i / SR
    const x = rand() * 2 - 1
    y += lp * (x - y)
    const env = Math.min(1, t / (dur * 0.35), (dur - t) / (dur * 0.5))
    const w = 0.5 + 0.5 * Math.sin(TAU * (0.07 + swell * 0.02) * t)
    const a = amp * env * y * (0.6 + 0.4 * w)
    buf.l[idx] += a
    buf.r[idx] += a * 0.92
  }
}

function addHorn(buf, { freq, amp, start, dur }) {
  addTone(buf, { freq, amp, start, dur, kind: 'sawsoft', attack: 0.35, release: dur * 0.55 })
  addTone(buf, { freq: freq * 2, amp: amp * 0.28, start, dur, attack: 0.4, release: dur * 0.5 })
  addTone(buf, { freq: freq * 0.5, amp: amp * 0.5, start, dur: dur * 1.1, attack: 0.5, release: dur * 0.6 })
}

function toWav(buf) {
  const n = buf.n
  const data = Buffer.alloc(44 + n * 4)
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8)
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22)
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34)
  data.write('data', 36); data.writeUInt32LE(n * 4, 40)
  // 简单软限幅
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf.l[i]), Math.abs(buf.r[i]))
  const gain = peak > 0 ? Math.min(1, 0.92 / peak) : 1
  for (let i = 0; i < n; i++) {
    const l = Math.tanh(buf.l[i] * gain * 1.1)
    const r = Math.tanh(buf.r[i] * gain * 1.1)
    data.writeInt16LE(Math.round(l * 32000), 44 + i * 4)
    data.writeInt16LE(Math.round(r * 32000), 46 + i * 4)
  }
  return data
}

/* ── 1. 「雾笛」：48 秒环境音乐 ──────────────────── */
function fogSignal() {
  const b = makeBuf(48)
  // 底层：D 与 A 的长音，缓慢交叉
  addTone(b, { freq: 73.42, amp: 0.30, start: 0, dur: 48, attack: 3.5, release: 4.5, kind: 'sine', vibrato: 0.002 })
  addTone(b, { freq: 110.0, amp: 0.16, start: 2, dur: 44, attack: 5, release: 5, kind: 'sine' })
  addTone(b, { freq: 146.83, amp: 0.075, start: 10, dur: 32, attack: 6, release: 6, kind: 'triangle' })
  addTone(b, { freq: 220.0, amp: 0.05, start: 18, dur: 26, attack: 5, release: 7, kind: 'sine', pan: 0.35 })
  addTone(b, { freq: 174.61, amp: 0.04, start: 26, dur: 20, attack: 4, release: 6, kind: 'sine', pan: -0.35 })
  // 风与海面
  addNoise(b, { amp: 0.10, start: 0, dur: 48, seed: 11, lp: 0.012 })
  addNoise(b, { amp: 0.05, start: 4, dur: 40, seed: 29, lp: 0.05, swell: 2 })
  // 三次雾笛
  addHorn(b, { freq: 98.0, amp: 0.26, start: 7.5, dur: 4.2 })
  addHorn(b, { freq: 98.0, amp: 0.20, start: 24.0, dur: 5.0 })
  addHorn(b, { freq: 87.31, amp: 0.17, start: 38.5, dur: 6.0 })
  // 远处的小铃
  addTone(b, { freq: 587.33, amp: 0.05, start: 16.2, dur: 1.6, attack: 0.01, release: 1.5, kind: 'sine', pan: 0.5 })
  addTone(b, { freq: 880.0, amp: 0.03, start: 33.4, dur: 2.0, attack: 0.01, release: 1.9, kind: 'sine', pan: -0.45 })
  return b
}

/* ── 2. 片子的底噪（24 秒，给视频用）───────────── */
function filmBed() {
  const b = makeBuf(24)
  addTone(b, { freq: 73.42, amp: 0.22, start: 0, dur: 24, attack: 4, release: 5, kind: 'sine' })
  addTone(b, { freq: 110.0, amp: 0.10, start: 6, dur: 18, attack: 5, release: 5, kind: 'sine' })
  addNoise(b, { amp: 0.09, start: 0, dur: 24, seed: 41, lp: 0.02 })
  addHorn(b, { freq: 98.0, amp: 0.14, start: 12.0, dur: 5.0 })
  return b
}

const [which, out] = process.argv.slice(2)
const buf = which === 'fog' ? fogSignal() : filmBed()
writeFileSync(out, toWav(buf))
let peak = 0
for (let i = 0; i < buf.n; i++) peak = Math.max(peak, Math.abs(buf.l[i]))
console.log(which, (buf.n / SR).toFixed(1) + 's', 'peak', peak.toFixed(3), '→', out)
