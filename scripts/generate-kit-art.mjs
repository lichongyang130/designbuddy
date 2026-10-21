#!/usr/bin/env node
/**
 * Generate the original artwork for the data-driven template sets.
 *
 * Every image is drawn here as SVG geometry: gradients, layered shapes and a
 * seeded grain, so each set gets its own visual language and the files are
 * reproducible byte for byte. Nothing is downloaded and nothing is a stock
 * photo; the provenance note is written next to the files.
 *
 * Usage: node scripts/generate-kit-art.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "apps/web/src/assets/kit");

/** Small deterministic PRNG so a set always looks the same. */
function seeded(seed) {
  let state = 0;
  for (const character of seed) state = (state * 31 + character.charCodeAt(0)) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const sets = [
  {
    id: "studio-nine",
    title: "STUDIO NINE · 摄影棚排期",
    palette: ["#14161a", "#1d2126", "#c7d0d8", "#e0703a", "#f2f4f6"],
    motifs: ["aperture", "grid", "beam", "silhouette", "contact-sheet", "arc", "lens", "strip"],
    count: 8,
  },
  {
    id: "wellspring",
    title: "WELLSPRING · 运动课程管理",
    palette: ["#0f1c17", "#163023", "#d8ead9", "#f2c14e", "#f6f7f2"],
    motifs: ["lane", "arc", "wave", "grid", "pulse", "badge", "schedule", "leaf"],
    count: 8,
  },
  {
    id: "circuit",
    title: "CIRCUIT · 二手数码检测交易",
    palette: ["#101418", "#182028", "#c3d3e6", "#3fa7d6", "#eef2f6"],
    motifs: ["board", "grid", "chip", "wave", "meter", "scan", "stack", "grid"],
    count: 8,
  },
  {
    id: "paperhouse",
    title: "PAPERHOUSE · 独立书店选书",
    palette: ["#1d1916", "#2a241f", "#e8dfd3", "#c97a40", "#f8f4ec"],
    motifs: ["stack", "strip", "grid", "arc", "contact-sheet", "leaf", "beam", "badge"],
    count: 8,
  },
  {
    id: "campus",
    title: "CAMPUS · 成人教育学习平台",
    palette: ["#101926", "#182638", "#cbdae9", "#4f9cf9", "#f2f6fb"],
    motifs: ["schedule", "grid", "lane", "pulse", "arc", "stack", "meter", "beam"],
    count: 8,
  },
  {
    id: "paws",
    title: "PAWS · 宠物护理服务",
    palette: ["#1a221d", "#243029", "#d7e5dc", "#e08f58", "#f7faf8"],
    motifs: ["leaf", "wave", "badge", "arc", "silhouette", "schedule", "pulse", "strip"],
    count: 8,
  },
];

function motifPath(motif, random, width, height) {
  const parts = [];
  const cx = width / 2;
  const cy = height / 2;
  if (motif === "aperture") {
    const blades = 9;
    for (let index = 0; index < blades; index += 1) {
      const angle = (index / blades) * Math.PI * 2;
      const radius = Math.min(width, height) * (0.26 + random() * 0.16);
      parts.push(`<path d="M ${cx} ${cy} L ${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius} A ${radius} ${radius} 0 0 1 ${cx + Math.cos(angle + 0.6) * radius} ${cy + Math.sin(angle + 0.6) * radius} Z" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.85"/>`);
    }
  } else if (motif === "grid" || motif === "lane" || motif === "strip") {
    const columns = 6 + Math.floor(random() * 5);
    const rows = 4 + Math.floor(random() * 4);
    for (let column = 0; column <= columns; column += 1) {
      const x = (column / columns) * width;
      parts.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${height}" stroke="currentColor" stroke-width="0.7" opacity="0.35"/>`);
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = (row / rows) * height;
      parts.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="0.7" opacity="0.35"/>`);
    }
  } else if (motif === "beam" || motif === "wave" || motif === "arc") {
    const count = 4 + Math.floor(random() * 4);
    for (let index = 0; index < count; index += 1) {
      const y = (index / count) * height + random() * 12;
      const amplitude = 12 + random() * 46;
      parts.push(`<path d="M 0 ${y.toFixed(1)} Q ${width * 0.25} ${(y - amplitude).toFixed(1)} ${width * 0.5} ${y.toFixed(1)} T ${width} ${(y + amplitude * 0.4).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(1 + random() * 2).toFixed(2)}" opacity="0.6"/>`);
    }
  } else if (motif === "silhouette" || motif === "leaf" || motif === "badge") {
    const count = 3 + Math.floor(random() * 4);
    for (let index = 0; index < count; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const size = 30 + random() * 90;
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="currentColor" opacity="0.12"/>`);
    }
  } else if (motif === "contact-sheet" || motif === "stack" || motif === "scan") {
    const count = 6;
    for (let index = 0; index < count; index += 1) {
      const x = 40 + (index % 3) * 120;
      const y = 40 + Math.floor(index / 3) * 100;
      parts.push(`<rect x="${x}" y="${y}" width="96" height="72" rx="4" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>`);
    }
  } else if (motif === "chip" || motif === "board" || motif === "meter" || motif === "schedule" || motif === "pulse") {
    const count = 5 + Math.floor(random() * 4);
    for (let index = 0; index < count; index += 1) {
      const x = 60 + random() * (width - 120);
      const y = 60 + random() * (height - 120);
      const size = 18 + random() * 46;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="3" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.7"/>`);
    }
  }
  return parts.join("");
}

function render(set, index) {
  const random = seeded(`${set.id}:${index}`);
  const width = 1200;
  const height = 800;
  const [background, surface, line, accent, soft] = set.palette;
  const angle = Math.floor(random() * 80) + 10;
  const motif = set.motifs[index % set.motifs.length];
  const blobs = Array.from({ length: 3 + Math.floor(random() * 3) }, () => {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const r = 120 + Math.floor(random() * 260);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="0.14"/>`;
  }).join("");
  const speckles = Array.from({ length: 140 }, () => {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const r = (random() * 1.6).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${soft}" opacity="0.28"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${surface}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  ${blobs}
  <g color="${line}">${motifPath(motif, random, width, height)}</g>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.55" rx="10"/>
  ${speckles}
  <g opacity="0.5">
    <rect x="24" y="${height - 78}" width="220" height="54" rx="6" fill="${background}" opacity="0.7"/>
    <text x="42" y="${height - 44}" font-family="Georgia, serif" font-size="22" fill="${soft}">${set.title.split(" · ")[0]}</text>
  </g>
</svg>
`;
}

rmSync(outRoot, { recursive: true, force: true });
const sources = [];
for (const set of sets) {
  const directory = join(outRoot, set.id);
  mkdirSync(directory, { recursive: true });
  for (let index = 0; index < set.count; index += 1) {
    const name = `art-${String(index + 1).padStart(2, "0")}.svg`;
    writeFileSync(join(directory, name), render(set, index));
    sources.push({
      file: `${set.id}/${name}`,
      set: set.id,
      title: `${set.title.split(" · ")[0]} · 原创图形 ${index + 1}`,
      credit: "本仓库脚本生成的原创 SVG 图形",
      license: "随仓库授权，可用于展示与再编辑",
      source: "scripts/generate-kit-art.mjs",
    });
  }
  writeFileSync(
    join(directory, "SOURCES.md"),
    `# ${set.title} 素材说明\n\n本目录全部图片由 \`scripts/generate-kit-art.mjs\` 以确定性算法生成的原创 SVG 图形：渐变底、几何母题与噪点层，不含任何第三方照片或素材。重新运行脚本可逐字节复现。\n`,
  );
}
writeFileSync(join(outRoot, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`);
console.log(`generated ${sources.length} original SVG artworks for ${sets.length} template sets`);
