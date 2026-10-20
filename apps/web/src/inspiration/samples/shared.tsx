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
export type SampleId = string;
export const samples: {
  id: SampleId;
  category: string;
  title: string;
  description: string;
  format: string;
  photos: Photo[];
}[] = [
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
  {
    id: "slide-1-gen",
    category: "幻灯片",
    title: "AURA · 视觉提案",
    description: "20-26 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-1-gen-" + i}/1200/800`,
      label: `AURA · 视觉提案 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-2-gen",
    category: "幻灯片",
    title: "AURA · 商业路演",
    description: "20-23 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-2-gen-" + i}/1200/800`,
      label: `AURA · 商业路演 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-3-gen",
    category: "幻灯片",
    title: "PULSE · 产品发布",
    description: "20-29 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-3-gen-" + i}/1200/800`,
      label: `PULSE · 产品发布 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-4-gen",
    category: "幻灯片",
    title: "PULSE · 全员大会",
    description: "20-27 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-4-gen-" + i}/1200/800`,
      label: `PULSE · 全员大会 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-5-gen",
    category: "幻灯片",
    title: "QUANTA · 全员大会",
    description: "20-29 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-5-gen-" + i}/1200/800`,
      label: `QUANTA · 全员大会 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-6-gen",
    category: "幻灯片",
    title: "ZENITH · 产品发布",
    description: "20-26 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-6-gen-" + i}/1200/800`,
      label: `ZENITH · 产品发布 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-7-gen",
    category: "幻灯片",
    title: "PRISM · 商业路演",
    description: "20-30 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-7-gen-" + i}/1200/800`,
      label: `PRISM · 商业路演 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "slide-8-gen",
    category: "幻灯片",
    title: "ECHO · 视觉提案",
    description: "20-28 个高级组件 · 沉浸式幻灯片体验，配备完整演示内容",
    format: "增强型 幻灯片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"slide-8-gen-" + i}/1200/800`,
      label: `ECHO · 视觉提案 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-1-gen",
    category: "文档",
    title: "LUMINA · 商业企划",
    description: "20-30 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-1-gen-" + i}/1200/800`,
      label: `LUMINA · 商业企划 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-2-gen",
    category: "文档",
    title: "NEXUS · 白皮书",
    description: "20-24 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-2-gen-" + i}/1200/800`,
      label: `NEXUS · 白皮书 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-3-gen",
    category: "文档",
    title: "ZENITH · 深度报告",
    description: "20-24 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-3-gen-" + i}/1200/800`,
      label: `ZENITH · 深度报告 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-4-gen",
    category: "文档",
    title: "LUMINA · 标准协议",
    description: "20-25 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-4-gen-" + i}/1200/800`,
      label: `LUMINA · 标准协议 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-5-gen",
    category: "文档",
    title: "NEXUS · 标准协议",
    description: "20-27 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-5-gen-" + i}/1200/800`,
      label: `NEXUS · 标准协议 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-6-gen",
    category: "文档",
    title: "VERTEX · 研究手册",
    description: "20-26 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-6-gen-" + i}/1200/800`,
      label: `VERTEX · 研究手册 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-7-gen",
    category: "文档",
    title: "LUMINA · 研究手册",
    description: "20-29 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-7-gen-" + i}/1200/800`,
      label: `LUMINA · 研究手册 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "doc-8-gen",
    category: "文档",
    title: "PRISM · 商业企划",
    description: "20-21 个高级组件 · 沉浸式文档体验，配备完整演示内容",
    format: "增强型 文档",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"doc-8-gen-" + i}/1200/800`,
      label: `PRISM · 商业企划 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-1-gen",
    category: "图片",
    title: "PRISM · 品牌视觉",
    description: "20-25 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-1-gen-" + i}/1200/800`,
      label: `PRISM · 品牌视觉 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-2-gen",
    category: "图片",
    title: "VERTEX · 数字合集",
    description: "20-28 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-2-gen-" + i}/1200/800`,
      label: `VERTEX · 数字合集 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-3-gen",
    category: "图片",
    title: "VERTEX · 品牌视觉",
    description: "20-22 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-3-gen-" + i}/1200/800`,
      label: `VERTEX · 品牌视觉 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-4-gen",
    category: "图片",
    title: "VERTEX · 数字合集",
    description: "20-21 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-4-gen-" + i}/1200/800`,
      label: `VERTEX · 数字合集 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-5-gen",
    category: "图片",
    title: "VERTEX · 数字合集",
    description: "20-28 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-5-gen-" + i}/1200/800`,
      label: `VERTEX · 数字合集 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-6-gen",
    category: "图片",
    title: "AURA · 品牌视觉",
    description: "20-28 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-6-gen-" + i}/1200/800`,
      label: `AURA · 品牌视觉 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-7-gen",
    category: "图片",
    title: "LUMINA · 品牌视觉",
    description: "20-20 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-7-gen-" + i}/1200/800`,
      label: `LUMINA · 品牌视觉 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "img-8-gen",
    category: "图片",
    title: "ECHO · 海报集",
    description: "20-25 个高级组件 · 沉浸式图片体验，配备完整演示内容",
    format: "增强型 图片",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"img-8-gen-" + i}/1200/800`,
      label: `ECHO · 海报集 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "hf-1-gen",
    category: "HyperFrames",
    title: "LUMINA · 交互视界",
    description: "20-24 个高级组件 · 沉浸式HyperFrames体验，配备完整演示内容",
    format: "增强型 HyperFrames",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"hf-1-gen-" + i}/1200/800`,
      label: `LUMINA · 交互视界 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "hf-2-gen",
    category: "HyperFrames",
    title: "VERTEX · 微动效",
    description: "20-24 个高级组件 · 沉浸式HyperFrames体验，配备完整演示内容",
    format: "增强型 HyperFrames",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"hf-2-gen-" + i}/1200/800`,
      label: `VERTEX · 微动效 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "hf-3-gen",
    category: "HyperFrames",
    title: "VERTEX · 交互视界",
    description: "20-21 个高级组件 · 沉浸式HyperFrames体验，配备完整演示内容",
    format: "增强型 HyperFrames",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"hf-3-gen-" + i}/1200/800`,
      label: `VERTEX · 交互视界 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "hf-4-gen",
    category: "HyperFrames",
    title: "PULSE · 转场设计",
    description: "20-20 个高级组件 · 沉浸式HyperFrames体验，配备完整演示内容",
    format: "增强型 HyperFrames",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"hf-4-gen-" + i}/1200/800`,
      label: `PULSE · 转场设计 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "hf-5-gen",
    category: "HyperFrames",
    title: "HORIZON · 转场设计",
    description: "20-29 个高级组件 · 沉浸式HyperFrames体验，配备完整演示内容",
    format: "增强型 HyperFrames",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"hf-5-gen-" + i}/1200/800`,
      label: `HORIZON · 转场设计 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-1-gen",
    category: "视频",
    title: "AURA · 概念剪辑",
    description: "20-28 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-1-gen-" + i}/1200/800`,
      label: `AURA · 概念剪辑 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-2-gen",
    category: "视频",
    title: "HORIZON · 概念剪辑",
    description: "20-28 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-2-gen-" + i}/1200/800`,
      label: `HORIZON · 概念剪辑 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-3-gen",
    category: "视频",
    title: "QUANTA · 电影级预告",
    description: "20-21 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-3-gen-" + i}/1200/800`,
      label: `QUANTA · 电影级预告 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-4-gen",
    category: "视频",
    title: "NEXUS · 电影级预告",
    description: "20-22 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-4-gen-" + i}/1200/800`,
      label: `NEXUS · 电影级预告 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-5-gen",
    category: "视频",
    title: "PRISM · 空间纪实",
    description: "20-20 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-5-gen-" + i}/1200/800`,
      label: `PRISM · 空间纪实 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-6-gen",
    category: "视频",
    title: "NEXUS · 空间纪实",
    description: "20-26 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-6-gen-" + i}/1200/800`,
      label: `NEXUS · 空间纪实 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-7-gen",
    category: "视频",
    title: "AURA · 电影级预告",
    description: "20-26 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-7-gen-" + i}/1200/800`,
      label: `AURA · 电影级预告 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-8-gen",
    category: "视频",
    title: "ZENITH · 空间纪实",
    description: "20-27 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-8-gen-" + i}/1200/800`,
      label: `ZENITH · 空间纪实 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "vid-9-gen",
    category: "视频",
    title: "LUMINA · 概念剪辑",
    description: "20-30 个高级组件 · 沉浸式视频体验，配备完整演示内容",
    format: "增强型 视频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"vid-9-gen-" + i}/1200/800`,
      label: `LUMINA · 概念剪辑 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-1-gen",
    category: "音频",
    title: "LUMINA · 混音工程",
    description: "20-25 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-1-gen-" + i}/1200/800`,
      label: `LUMINA · 混音工程 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-2-gen",
    category: "音频",
    title: "HORIZON · 冥想音序",
    description: "20-28 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-2-gen-" + i}/1200/800`,
      label: `HORIZON · 冥想音序 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-3-gen",
    category: "音频",
    title: "QUANTA · 冥想音序",
    description: "20-26 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-3-gen-" + i}/1200/800`,
      label: `QUANTA · 冥想音序 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-4-gen",
    category: "音频",
    title: "AURA · 混音工程",
    description: "20-28 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-4-gen-" + i}/1200/800`,
      label: `AURA · 混音工程 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-5-gen",
    category: "音频",
    title: "VERTEX · 冥想音序",
    description: "20-24 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-5-gen-" + i}/1200/800`,
      label: `VERTEX · 冥想音序 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-6-gen",
    category: "音频",
    title: "ZENITH · 合成波形",
    description: "20-28 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-6-gen-" + i}/1200/800`,
      label: `ZENITH · 合成波形 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-7-gen",
    category: "音频",
    title: "ECHO · 冥想音序",
    description: "20-21 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-7-gen-" + i}/1200/800`,
      label: `ECHO · 冥想音序 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-8-gen",
    category: "音频",
    title: "LUMINA · 混音工程",
    description: "20-28 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-8-gen-" + i}/1200/800`,
      label: `LUMINA · 混音工程 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "aud-9-gen",
    category: "音频",
    title: "VERTEX · 氛围音景",
    description: "20-22 个高级组件 · 沉浸式音频体验，配备完整演示内容",
    format: "增强型 音频",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"aud-9-gen-" + i}/1200/800`,
      label: `VERTEX · 氛围音景 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "live-1-gen",
    category: "实时产物",
    title: "LUMINA · 动态大盘",
    description: "20-30 个高级组件 · 沉浸式实时体验，配备完整演示内容",
    format: "增强型 实时产物",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"live-1-gen-" + i}/1200/800`,
      label: `LUMINA · 动态大盘 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "live-2-gen",
    category: "实时产物",
    title: "PULSE · 事件流",
    description: "20-29 个高级组件 · 沉浸式实时体验，配备完整演示内容",
    format: "增强型 实时产物",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"live-2-gen-" + i}/1200/800`,
      label: `PULSE · 事件流 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "live-3-gen",
    category: "实时产物",
    title: "ZENITH · 事件流",
    description: "20-23 个高级组件 · 沉浸式实时体验，配备完整演示内容",
    format: "增强型 实时产物",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"live-3-gen-" + i}/1200/800`,
      label: `ZENITH · 事件流 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "live-4-gen",
    category: "实时产物",
    title: "VERTEX · 服务追踪",
    description: "20-28 个高级组件 · 沉浸式实时体验，配备完整演示内容",
    format: "增强型 实时产物",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"live-4-gen-" + i}/1200/800`,
      label: `VERTEX · 服务追踪 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "live-5-gen",
    category: "实时产物",
    title: "HORIZON · 仪表盘",
    description: "20-30 个高级组件 · 沉浸式实时体验，配备完整演示内容",
    format: "增强型 实时产物",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"live-5-gen-" + i}/1200/800`,
      label: `HORIZON · 仪表盘 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-1-gen",
    category: "WebGL",
    title: "HORIZON · 材质空间",
    description: "20-27 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-1-gen-" + i}/1200/800`,
      label: `HORIZON · 材质空间 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-2-gen",
    category: "WebGL",
    title: "ZENITH · 几何宇宙",
    description: "20-20 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-2-gen-" + i}/1200/800`,
      label: `ZENITH · 几何宇宙 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-3-gen",
    category: "WebGL",
    title: "ZENITH · 三维展馆",
    description: "20-27 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-3-gen-" + i}/1200/800`,
      label: `ZENITH · 三维展馆 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-4-gen",
    category: "WebGL",
    title: "ZENITH · 材质空间",
    description: "20-24 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-4-gen-" + i}/1200/800`,
      label: `ZENITH · 材质空间 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-5-gen",
    category: "WebGL",
    title: "VERTEX · 材质空间",
    description: "20-21 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-5-gen-" + i}/1200/800`,
      label: `VERTEX · 材质空间 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-6-gen",
    category: "WebGL",
    title: "PRISM · 三维展馆",
    description: "20-20 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-6-gen-" + i}/1200/800`,
      label: `PRISM · 三维展馆 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-7-gen",
    category: "WebGL",
    title: "NEXUS · 几何宇宙",
    description: "20-30 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-7-gen-" + i}/1200/800`,
      label: `NEXUS · 几何宇宙 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-8-gen",
    category: "WebGL",
    title: "LUMINA · 光学实验",
    description: "20-20 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-8-gen-" + i}/1200/800`,
      label: `LUMINA · 光学实验 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "gl-9-gen",
    category: "WebGL",
    title: "NEXUS · 材质空间",
    description: "20-29 个高级组件 · 沉浸式WebGL体验，配备完整演示内容",
    format: "增强型 WebGL",
    photos: Array.from({ length: 25 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"gl-9-gen-" + i}/1200/800`,
      label: `NEXUS · 材质空间 - 页面 ${i + 1}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'Internal'
    })),
  },
  {
    id: "proto-1-gen",
    category: "原型",
    title: "Nexus Admin · SaaS 与管理后台",
    description: "8 个核心交互页面 · 包含仪表盘、数据表格、权限管理等核心SaaS流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-1-gen-" + i}/1200/800`,
      label: `Nexus Admin - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'SaaS 与管理后台'
    })),
  },
  {
    id: "proto-2-gen",
    category: "原型",
    title: "Pulse Analytics · SaaS 与管理后台",
    description: "8 个核心交互页面 · 包含仪表盘、数据表格、权限管理等核心SaaS流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-2-gen-" + i}/1200/800`,
      label: `Pulse Analytics - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'SaaS 与管理后台'
    })),
  },
  {
    id: "proto-3-gen",
    category: "原型",
    title: "CRM Pro · SaaS 与管理后台",
    description: "8 个核心交互页面 · 包含仪表盘、数据表格、权限管理等核心SaaS流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-3-gen-" + i}/1200/800`,
      label: `CRM Pro - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'SaaS 与管理后台'
    })),
  },
  {
    id: "proto-4-gen",
    category: "原型",
    title: "TeamSync · SaaS 与管理后台",
    description: "8 个核心交互页面 · 包含仪表盘、数据表格、权限管理等核心SaaS流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-4-gen-" + i}/1200/800`,
      label: `TeamSync - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'SaaS 与管理后台'
    })),
  },
  {
    id: "proto-5-gen",
    category: "原型",
    title: "CloudDash · SaaS 与管理后台",
    description: "8 个核心交互页面 · 包含仪表盘、数据表格、权限管理等核心SaaS流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-5-gen-" + i}/1200/800`,
      label: `CloudDash - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'SaaS 与管理后台'
    })),
  },
  {
    id: "proto-6-gen",
    category: "原型",
    title: "Wristy Store · 电商与零售",
    description: "8 个核心交互页面 · 包含商品列表、详情页、购物车、结算与支付流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-6-gen-" + i}/1200/800`,
      label: `Wristy Store - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '电商与零售'
    })),
  },
  {
    id: "proto-7-gen",
    category: "原型",
    title: "Vogue Fashion · 电商与零售",
    description: "8 个核心交互页面 · 包含商品列表、详情页、购物车、结算与支付流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-7-gen-" + i}/1200/800`,
      label: `Vogue Fashion - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '电商与零售'
    })),
  },
  {
    id: "proto-8-gen",
    category: "原型",
    title: "TechGadget · 电商与零售",
    description: "8 个核心交互页面 · 包含商品列表、详情页、购物车、结算与支付流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-8-gen-" + i}/1200/800`,
      label: `TechGadget - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '电商与零售'
    })),
  },
  {
    id: "proto-9-gen",
    category: "原型",
    title: "FreshMart · 电商与零售",
    description: "8 个核心交互页面 · 包含商品列表、详情页、购物车、结算与支付流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-9-gen-" + i}/1200/800`,
      label: `FreshMart - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '电商与零售'
    })),
  },
  {
    id: "proto-10-gen",
    category: "原型",
    title: "LuxeHome · 电商与零售",
    description: "8 个核心交互页面 · 包含商品列表、详情页、购物车、结算与支付流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-10-gen-" + i}/1200/800`,
      label: `LuxeHome - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '电商与零售'
    })),
  },
  {
    id: "proto-11-gen",
    category: "原型",
    title: "Cascade Bank · 金融与数据",
    description: "8 个核心交互页面 · 包含财务总览、交易记录、K线图表与转账流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-11-gen-" + i}/1200/800`,
      label: `Cascade Bank - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '金融与数据'
    })),
  },
  {
    id: "proto-12-gen",
    category: "原型",
    title: "CoinVest · 金融与数据",
    description: "8 个核心交互页面 · 包含财务总览、交易记录、K线图表与转账流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-12-gen-" + i}/1200/800`,
      label: `CoinVest - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '金融与数据'
    })),
  },
  {
    id: "proto-13-gen",
    category: "原型",
    title: "BudgetTracker · 金融与数据",
    description: "8 个核心交互页面 · 包含财务总览、交易记录、K线图表与转账流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-13-gen-" + i}/1200/800`,
      label: `BudgetTracker - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '金融与数据'
    })),
  },
  {
    id: "proto-14-gen",
    category: "原型",
    title: "WealthDash · 金融与数据",
    description: "8 个核心交互页面 · 包含财务总览、交易记录、K线图表与转账流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-14-gen-" + i}/1200/800`,
      label: `WealthDash - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '金融与数据'
    })),
  },
  {
    id: "proto-15-gen",
    category: "原型",
    title: "CryptoEx · 金融与数据",
    description: "8 个核心交互页面 · 包含财务总览、交易记录、K线图表与转账流程",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-15-gen-" + i}/1200/800`,
      label: `CryptoEx - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '金融与数据'
    })),
  },
  {
    id: "proto-16-gen",
    category: "原型",
    title: "NextDocs AI · AI 与效率",
    description: "8 个核心交互页面 · 包含对话界面、提示词输入、结果生成与历史记录",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-16-gen-" + i}/1200/800`,
      label: `NextDocs AI - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'AI 与效率'
    })),
  },
  {
    id: "proto-17-gen",
    category: "原型",
    title: "Emerald Agent · AI 与效率",
    description: "8 个核心交互页面 · 包含对话界面、提示词输入、结果生成与历史记录",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-17-gen-" + i}/1200/800`,
      label: `Emerald Agent - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'AI 与效率'
    })),
  },
  {
    id: "proto-18-gen",
    category: "原型",
    title: "ChatFlow · AI 与效率",
    description: "8 个核心交互页面 · 包含对话界面、提示词输入、结果生成与历史记录",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-18-gen-" + i}/1200/800`,
      label: `ChatFlow - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'AI 与效率'
    })),
  },
  {
    id: "proto-19-gen",
    category: "原型",
    title: "GenArt Studio · AI 与效率",
    description: "8 个核心交互页面 · 包含对话界面、提示词输入、结果生成与历史记录",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-19-gen-" + i}/1200/800`,
      label: `GenArt Studio - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'AI 与效率'
    })),
  },
  {
    id: "proto-20-gen",
    category: "原型",
    title: "CodeCopilot · AI 与效率",
    description: "8 个核心交互页面 · 包含对话界面、提示词输入、结果生成与历史记录",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-20-gen-" + i}/1200/800`,
      label: `CodeCopilot - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: 'AI 与效率'
    })),
  },
  {
    id: "proto-21-gen",
    category: "原型",
    title: "EduLearn · 教育与内容",
    description: "8 个核心交互页面 · 包含课程大纲、视频播放、图文阅读与评论互动",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-21-gen-" + i}/1200/800`,
      label: `EduLearn - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '教育与内容'
    })),
  },
  {
    id: "proto-22-gen",
    category: "原型",
    title: "SkillShare · 教育与内容",
    description: "8 个核心交互页面 · 包含课程大纲、视频播放、图文阅读与评论互动",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-22-gen-" + i}/1200/800`,
      label: `SkillShare - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '教育与内容'
    })),
  },
  {
    id: "proto-23-gen",
    category: "原型",
    title: "ReadSpace · 教育与内容",
    description: "8 个核心交互页面 · 包含课程大纲、视频播放、图文阅读与评论互动",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-23-gen-" + i}/1200/800`,
      label: `ReadSpace - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '教育与内容'
    })),
  },
  {
    id: "proto-24-gen",
    category: "原型",
    title: "CreatorHub · 教育与内容",
    description: "8 个核心交互页面 · 包含课程大纲、视频播放、图文阅读与评论互动",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-24-gen-" + i}/1200/800`,
      label: `CreatorHub - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '教育与内容'
    })),
  },
  {
    id: "proto-25-gen",
    category: "原型",
    title: "VideoCast · 教育与内容",
    description: "8 个核心交互页面 · 包含课程大纲、视频播放、图文阅读与评论互动",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-25-gen-" + i}/1200/800`,
      label: `VideoCast - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '教育与内容'
    })),
  },
  {
    id: "proto-26-gen",
    category: "原型",
    title: "HotelBook · 生活与预订",
    description: "8 个核心交互页面 · 包含搜索筛选、地图定位、日期选择与订单确认",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-26-gen-" + i}/1200/800`,
      label: `HotelBook - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '生活与预订'
    })),
  },
  {
    id: "proto-27-gen",
    category: "原型",
    title: "TableRes · 生活与预订",
    description: "8 个核心交互页面 · 包含搜索筛选、地图定位、日期选择与订单确认",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-27-gen-" + i}/1200/800`,
      label: `TableRes - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '生活与预订'
    })),
  },
  {
    id: "proto-28-gen",
    category: "原型",
    title: "EventTix · 生活与预订",
    description: "8 个核心交互页面 · 包含搜索筛选、地图定位、日期选择与订单确认",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-28-gen-" + i}/1200/800`,
      label: `EventTix - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '生活与预订'
    })),
  },
  {
    id: "proto-29-gen",
    category: "原型",
    title: "CleanHome · 生活与预订",
    description: "8 个核心交互页面 · 包含搜索筛选、地图定位、日期选择与订单确认",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-29-gen-" + i}/1200/800`,
      label: `CleanHome - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '生活与预订'
    })),
  },
  {
    id: "proto-30-gen",
    category: "原型",
    title: "CityGuide · 生活与预订",
    description: "8 个核心交互页面 · 包含搜索筛选、地图定位、日期选择与订单确认",
    format: "商业交互原型",
    photos: Array.from({ length: 8 }, (_, i) => ({
      url: `https://picsum.photos/seed/${"proto-30-gen-" + i}/1200/800`,
      label: `CityGuide - ${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '生活与预订'
    })),
  }
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
