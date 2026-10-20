import fs from 'fs';

const TARGET_CATEGORIES = [
  "原型",
  "幻灯片",
  "文档",
  "图片",
  "HyperFrames",
  "视频",
  "音频",
  "实时产物",
  "WebGL",
];

const counts = {
  "原型": 2,
  "幻灯片": 8,
  "文档": 8,
  "图片": 8,
  "HyperFrames": 5,
  "视频": 9,
  "音频": 9,
  "实时产物": 5,
  "WebGL": 9,
};

const prefixes = {
  "原型": "Proto",
  "幻灯片": "Slide",
  "文档": "Doc",
  "图片": "Img",
  "HyperFrames": "HF",
  "视频": "Vid",
  "音频": "Aud",
  "实时产物": "Live",
  "WebGL": "GL",
};

const generatedSamples = [];

for (const cat of TARGET_CATEGORIES) {
  const count = counts[cat];
  const prefix = prefixes[cat];
  for (let i = 1; i <= count; i++) {
    const id = `${prefix.toLowerCase()}-${i}-gen`;
    
    // Generate beautiful random titles
    const titles = [
      "ECHO", "LUMINA", "NEXUS", "AURA", "VERTEX", "QUANTA", "PRISM", 
      "ZENITH", "HORIZON", "PULSE"
    ];
    const subTitles = {
      "原型": ["交互流", "控制台", "应用矩阵", "服务系统", "移动门户"],
      "幻灯片": ["全员大会", "商业路演", "年终复盘", "产品发布", "视觉提案"],
      "文档": ["白皮书", "商业企划", "深度报告", "研究手册", "标准协议"],
      "图片": ["品牌视觉", "影册", "海报集", "版画", "数字合集"],
      "HyperFrames": ["动效空间", "交互视界", "微动效", "序列分镜", "转场设计"],
      "视频": ["概念剪辑", "空间纪实", "产品宣发", "延时序列", "电影级预告"],
      "音频": ["氛围音景", "合成波形", "UI音效", "冥想音序", "混音工程"],
      "实时产物": ["仪表盘", "实时链路", "事件流", "动态大盘", "服务追踪"],
      "WebGL": ["材质空间", "粒子流", "三维展馆", "几何宇宙", "光学实验"]
    };
    
    const title = `${titles[Math.floor(Math.random() * titles.length)]} · ${subTitles[cat][Math.floor(Math.random() * subTitles[cat].length)]}`;
    const desc = `20-${Math.floor(Math.random() * 11) + 20} 个高级组件 · 沉浸式${cat.replace('产物', '')}体验，配备完整演示内容`;
    const format = `增强型 ${cat}`;
    
    // Photos generation will use picsum deterministic seeds
    const photosCode = `Array.from({ length: 25 }, (_, i) => ({
      url: \`https://picsum.photos/seed/\${"${id}-" + i}/1200/800\`,
      label: \`${title} - 页面 \${i + 1}\`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    }))`;

    generatedSamples.push(`
  {
    id: "${id}" as const,
    category: "${cat}",
    title: "${title}",
    description: "${desc}",
    format: "${format}",
    photos: ${photosCode},
  }`);
  }
}

const file = 'apps/web/src/inspiration/samples/shared.tsx';
let content = fs.readFileSync(file, 'utf-8');

const anchor = 'export const samples: {';
const targetRegex = /\];/g; // find the end of the array, wait, there are multiple arrays.
// Let's find the specific block where samples array ends.
// It ends with:
//   {
//     id: "live-status",
//     ...
//     photos: getThemePhotos("live-status"),
//   },
// ];

const injectionPointStr = `
  {
    id: "live-status",
    category: "实时产物",
    title: "STEADY · 服务状态页",
    description: "服务心跳 · 90 天在线率与事件线",
    format: "状态页 / 事件线",
    photos: getThemePhotos("live-status"),
  },
`;

if (!content.includes(injectionPointStr.trim())) {
  console.log("Could not find injection point!");
  process.exit(1);
}

const finalStr = generatedSamples.join(',') + '\n];';
content = content.replace(
  '    photos: getThemePhotos("live-status"),\n  },\n];',
  `    photos: getThemePhotos("live-status"),\n  },${generatedSamples.join(',')}\n];`
);

fs.writeFileSync(file, content, 'utf-8');
console.log("Successfully injected 63 new items!");
