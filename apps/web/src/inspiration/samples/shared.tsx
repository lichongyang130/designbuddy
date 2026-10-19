import { welcomeTemplates, type WelcomeSampleId } from "../welcomeTemplates";
import { TemplateCloudControls, useTemplateBinding } from "../TemplateCloud";
import { useEffect, useState } from "react";
import { restoreSample } from "./stateValidation";
import original from "../../assets/inspiration/sources.json";
import expansion from "../../assets/expansion/sources.json";
import added from "../../assets/samples/sources.json";
import { navigateTo } from "../../../../../frontend/workspace/workspaceRoutes";
import { generateTemplatePhotos } from "./imageGenerator";
const files = import.meta.glob<string>(
  [
    "../../assets/inspiration/*.webp",
    "../../assets/samples/*.webp",
    "../../assets/expansion/*.webp",
  ],
  { eager: true, query: "?url", import: "default" },
);
export type Photo = {
  url: string;
  label: string;
  credit: string;
  license: string;
  source: string;
};
const old = (n: number): Photo => {
  const p = original[n - 1];
  return { ...p, url: files[`../../assets/inspiration/${p.file}`] };
};
const fresh = (name: string): Photo => {
  const p = added.find((x) => x.file === name + ".webp")!;
  return { ...p, url: files[`../../assets/samples/${p.file}`] };
};
export const travelPhotos = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(old);
export const slidePhotos = [
  "hubble_deep_field",
  "astronaut",
  "rocket",
  "camera",
  "chelsea",
].map(fresh);
export const reportPhotos = ["brick", "grass", "gravel", "cell", "retina"].map(
  fresh,
);
export const brandPhotos = [
  fresh("coffee"),
  old(11),
  old(10),
  fresh("11-tests"),
  fresh("33-type_error"),
];
const pack = (group: string): Photo[] =>
  expansion
    .filter((p) => p.group === group)
    .map((p) => ({ ...p, url: files[`../../assets/expansion/${p.file}`] }));
export const museumPhotos = pack("museum"),
  cityPhotos = pack("city"),
  handbookPhotos = pack("handbook"),
  naturePhotos = pack("nature");
export type SampleId =
  | WelcomeSampleId
  | "leader-decision"
  | "visual-directions"
  | "content-director"
  | "word-pro"
  | "travel"
  | "luma"
  | "research"
  | "chishan"
  | "museum"
  | "city"
  | "handbook"
  | "nature"
  | "hyperframes"
  | "film"
  | "sound"
  | "live"
  | "webgl"
  | "forme"
  | "atelier"
  | "roots"
  | "daylight"
  | "tide"
  | "morrow"
  | "hf-tour"
  | "hf-story"
  | "hf-quest"
  | "hf-lesson"
  | "live-board"
  | "live-event"
  | "live-form"
  | "live-status";
export const samples: {
  id: SampleId;
  category: string;
  title: string;
  description: string;
  format: string;
  photos: Photo[];
}[] = [
  ...welcomeTemplates.map(t=>({id:t.id,category:"图片",title:`欢迎页 ${t.number} · ${t.name}`,description:"欢迎页设计 / 独立 AI 主视觉 / 完整界面",format:"PNG · 1440 × 1000",photos:[]})),
  {id:"word-pro",category:"文档",title:"Word专业排版 · 真实分页与有限修复",description:"商业报告 / 项目方案 · 同源PDF / 原生表格 / 修复证据",format:"DOCX / PDF",photos:[]},
  {id:"content-director",category:"幻灯片",title:"内容导演 · 让表达由证据决定",description:"逐页任务 / 整套节奏 / 原生结构与流程 · 同内容对照",format:"PPTX / PDF",photos:[]},
  {id:"visual-directions",category:"幻灯片",title:"视觉叙事 · 三种艺术方向",description:"咨询极简 / 科技发布 / 品牌图文 · 同内容真实导出",format:"PPTX / PDF",photos:[]},
  {
    id: "leader-decision",
    category: "幻灯片",
    title: "领导决策汇报 · PPT引擎试点建议",
    description: "自适应V2 · 新旧同内容对照 · 12页/15分钟 · 来源与讲稿",
    format: "PPTX / PDF",
    photos: [],
  },
  {
    id: "travel" as const,
    category: "原型",
    title: "慢游 · 城市旅行预订",
    description: "20 个业务页面 · 搜索、行程与预订流程",
    format: "交互原型",
    photos: travelPhotos,
  },
  {
    id: "luma" as const,
    category: "幻灯片",
    title: "LUMA · 影像工作台发布",
    description: "20 页 16:9 幻灯片 · 演讲备注与 PPTX",
    format: "PPTX 演示文稿",
    photos: slidePhotos,
  },
  {
    id: "research" as const,
    category: "文档",
    title: "开放影像 · 多尺度结构研究",
    description: "20 页 A4 报告 · 目录、批注与打印",
    format: "分页研究报告",
    photos: reportPhotos,
  },
  {
    id: "chishan" as const,
    category: "图片",
    title: "迟山 · 山野咖啡视觉系统",
    description: "20 张设计画板 · 海报、标签与社交视觉",
    format: "SVG / PNG 图片集",
    photos: brandPhotos,
  },

  {
    id: "museum",
    category: "原型",
    title: "拾光 · 城市展馆预约",
    description: "20 个业务页面 · 展览、场次与预约管理",
    format: "展馆预约原型",
    photos: museumPhotos,
  },
  {
    id: "city",
    category: "幻灯片",
    title: "WALK · 城市漫步提案",
    description: "20 页编辑式幻灯片 · 路线、观察与执行",
    format: "PPTX 策划提案",
    photos: cityPhotos,
  },
  {
    id: "handbook",
    category: "文档",
    title: "出发之前 · 旅行行动手册",
    description: "20 章实用文档 · 清单、预案与行前复核",
    format: "A4 出行手册",
    photos: handbookPhotos,
  },
  {
    id: "nature",
    category: "图片",
    title: "野生来信 · 自然摄影海报集",
    description: "20 张独立画板 · 摄影、植物与季节构图",
    format: "SVG / PNG 摄影海报",
    photos: naturePhotos,
  },
  {
    id: "hyperframes",
    category: "HyperFrames",
    title: "NEXT FRAME · 品牌动效分镜",
    description: "4 段可编辑动效 · 播放、定位与独立网页",
    format: "HTML / CSS 动效",
    photos: generateTemplatePhotos("hyperframes"),
  },
  {
    id: "film",
    category: "视频",
    title: "LAKESIDE · 慢下来的一天",
    description: "18 秒摄影剪辑 · 播放、章节与字幕编辑",
    format: "MP4 / VTT 字幕",
    photos: generateTemplatePhotos("film"),
  },
  {
    id: "sound",
    category: "音频",
    title: "SOFT SIGNALS · 声音标识实验",
    description: "8 秒原创合成 · 参数调音与真实波形",
    format: "WAV / PCM 音频",
    photos: generateTemplatePhotos("sound"),
  },
  {
    id: "live",
    category: "实时产物",
    title: "SCOPE · 实时报价工作台",
    description: "即时计算 · 服务清单、税费与交互交付",
    format: "交互 HTML / CSV",
    photos: generateTemplatePhotos("live"),
  },
  {
    id: "webgl",
    category: "WebGL",
    title: "FORM · 材质与光",
    description: "实时三维 · 旋转、缩放与材质探索",
    format: "WebGL HTML / OBJ",
    photos: generateTemplatePhotos("webgl"),
  },
  {
    id: "forme",
    category: "原型",
    title: "FORME · 家具选配与空间采购",
    description: "24 个业务页面 · 产品选配、空间布局与本地报价",
    format: "家具采购原型 / CSV / HTML",
    photos: generateTemplatePhotos("forme"),
  },
  {
    id: "atelier",
    category: "原型",
    title: "ATELIER · 独立服饰订制",
    description: "24 个内容页面 · 量体、结构配置、试衣与技术档案",
    format: "订制原型 / SVG / CSV / HTML",
    photos: generateTemplatePhotos("atelier"),
  },
  {
    id: "roots",
    category: "原型",
    title: "ROOTS · 植物与花园规划",
    description: "24 个规划页面 · 选种、平面、土水预算与养护",
    format: "花园原型 / SVG / CSV / HTML",
    photos: generateTemplatePhotos("roots"),
  },
  {
    id: "daylight",
    category: "原型",
    title: "DAYLIGHT · 联合办公空间",
    description: "24 个办公页面 · 预约冲突、团队座位、费用与日历",
    format: "空间原型 / ICS / SVG / HTML",
    photos: generateTemplatePhotos("daylight"),
  },
  {
    id: "tide",
    category: "原型",
    title: "TIDE · 帆船俱乐部会员",
    description: "24 个会员页面 · 时间意向、月度时数、学习记录与交付",
    format: "会员原型 / SVG / CSV / HTML",
    photos: generateTemplatePhotos("tide"),
  },
  {
    id: "morrow",
    category: "原型",
    title: "MORROW · 精品咖啡订阅",
    description: "24 个咖啡页面 · 拼配、冲煮、四期计划、库存与费用",
    format: "订阅原型 / SVG / CSV / HTML",
    photos: generateTemplatePhotos("morrow"),
  },
  {
    id: "hf-tour",
    category: "HyperFrames",
    title: "SPOTLIGHT · 新功能分帧导览",
    description: "5 步聚光导览 · 自动播放、可编辑话术与离线回放",
    format: "HTML 分帧导览",
    photos: generateTemplatePhotos("hf-tour"),
  },
  {
    id: "hf-story",
    category: "HyperFrames",
    title: "RISE · 一图读懂数据故事",
    description: "5 章滚动叙事 · 动态计数与图表演绎",
    format: "HTML 数据故事",
    photos: generateTemplatePhotos("hf-story"),
  },
  {
    id: "hf-quest",
    category: "HyperFrames",
    title: "CROSSROADS · 分支剧情",
    description: "多结局互动剧情 · 打字机叙事与路线图",
    format: "HTML 分支剧情",
    photos: generateTemplatePhotos("hf-quest"),
  },
  {
    id: "hf-lesson",
    category: "HyperFrames",
    title: "SPARK · 五分钟微课",
    description: "章节播放器 · 随堂测验与即时反馈",
    format: "HTML 微课",
    photos: generateTemplatePhotos("hf-lesson"),
  },
  {
    id: "live-board",
    category: "实时产物",
    title: "PULSE · 实时数据大屏",
    description: "6 路实时指标 · 投屏模式与 CSV 导出",
    format: "实时看板 / CSV",
    photos: generateTemplatePhotos("live-board"),
  },
  {
    id: "live-event",
    category: "实时产物",
    title: "MOMENT · 发布会倒计时",
    description: "实时倒计时 · 签到、抽奖与名单导出",
    format: "落地页 / CSV",
    photos: generateTemplatePhotos("live-event"),
  },
  {
    id: "live-form",
    category: "实时产物",
    title: "VOICE · 实时问卷",
    description: "3 题问卷 · 提交即看实时统计",
    format: "问卷 / 实时统计",
    photos: generateTemplatePhotos("live-form"),
  },
  {
    id: "live-status",
    category: "实时产物",
    title: "STEADY · 服务状态页",
    description: "服务心跳 · 90 天在线率与事件线",
    format: "状态页 / 事件线",
    photos: generateTemplatePhotos("live-status"),
  },
];
export type DraftRecord = {
  id: string;
  sample: SampleId;
  title: string;
  createdAt: string;
};
export function drafts(): DraftRecord[] {
  try {
    const x = JSON.parse(
      localStorage.getItem("designbuddy.samples.drafts.v2") || "[]",
    );
    return Array.isArray(x)
      ? x
          .filter(
            (v) =>
              v &&
              typeof v.id === "string" &&
              typeof v.title === "string" &&
              typeof v.createdAt === "string" &&
              !Number.isNaN(Date.parse(v.createdAt)) &&
              /^[a-zA-Z0-9-]{1,60}$/.test(v.id) &&
              samples.some((s) => s.id === v.sample),
          )
          .slice(0, 40)
      : [];
  } catch {
    return [];
  }
}
export function useSampleState<T extends object>(
  sample: SampleId,
  draftId: string | undefined,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void, string] {
  const key = `designbuddy.samples.v2.${sample}.${draftId || "sample"}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > 500000) return initial;
      const data = JSON.parse(raw);
      return restoreSample(sample, initial, data);
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState("");
  useTemplateBinding(value, (raw) =>
    setValue(restoreSample(sample, initial, raw)),
  );
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setError("");
    } catch {
      setError("浏览器存储不可用，修改仍在页面中，请先导出备份。");
    }
  }, [key, value]);
  return [value, setValue, error];
}
export function copySample(sample: SampleId, state: unknown) {
  const id = crypto.randomUUID();
  const info = samples.find((x) => x.id === sample)!;
  localStorage.setItem(
    `designbuddy.samples.v2.${sample}.${id}`,
    JSON.stringify(state),
  );
  localStorage.setItem(
    "designbuddy.samples.drafts.v2",
    JSON.stringify(
      [
        {
          id,
          sample,
          title: info.title + " · 副本",
          createdAt: new Date().toISOString(),
        },
        ...drafts(),
      ].slice(0, 40),
    ),
  );
  navigateTo(`/inspiration/${sample}/draft/${id}`);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function dataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("本地素材读取失败");
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("素材读取失败"));
    reader.readAsDataURL(blob);
  });
}
export function Credits({ photos }: { photos: Photo[] }) {
  return (
    <details className="sample-credits">
      <summary>此作品的 {photos.length} 张摄影素材与许可</summary>
      <p>
        真实摄影素材，仅用于虚构作品演示，不表示摄影师或机构的认可。已缩放、转换格式；图片集中还进行了排版裁切。
      </p>
      {photos.map((p) => (
        <p key={p.source}>
          <a href={p.source} target="_blank" rel="noopener noreferrer">
            {p.label}
          </a>{" "}
          — {p.credit} · {p.license}
        </p>
      ))}
    </details>
  );
}
export function SampleTop({
  type,
  title,
  draftId,
  onCopy,
  children,
}: {
  type: string;
  title: string;
  draftId?: string;
  onCopy(): void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="sample-top">
        <button onClick={() => navigateTo("/inspiration")}>← 社区</button>
        <div>
          <small>
            {type} {draftId ? "/ 我的副本" : "/ 完整样板"}
          </small>
          <strong>{title}</strong>
        </div>
        <div className="sample-top-actions">
          {children}
          <button onClick={onCopy}>做同款 · 保留此类型</button>
        </div>
      </header>
      <TemplateCloudControls />
    </>
  );
}
export function Notice({ text }: { text: string }) {
  return text ? (
    <p className="sample-notice" role="status">
      {text}
    </p>
  ) : null;
}

// Office-compatible raster assets: do not embed WebP into PPTX.
export async function jpegDataUrl(url: string): Promise<string> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法转换演示文稿图片");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.94);
}
