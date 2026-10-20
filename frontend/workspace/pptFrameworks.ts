import type { Slide } from "../../apps/web/src/components/scene-demos/Slides";
import { extractTopic } from "./pptStore";

export type FrameworkTheme = {
  primary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  headingFont?: string;
  bodyFont?: string;
};

export type Framework = {
  id: string;
  name: string;
  narrative: string;
  description: string;
  layouts: string[];
  suitable: string[];
  theme: FrameworkTheme;
  eyebrowPrefix: string;
};

export const frameworks: Framework[] = [
  {
    id: "classic",
    name: "经典汇报",
    narrative: "结论 -> 洞察 -> 解法 -> 证据 -> 计划 -> 对比 -> 行动",
    description: "最稳的7页，适合周报复盘",
    layouts: ["cover", "cards", "split", "chart", "timeline", "table", "cover"],
    suitable: ["汇报", "复盘", "总结", "周报", "季度", "运营"],
    theme: { primary: "#294C3B", background: "#F4F1E9", surface: "#FFFFFF", text: "#1C2822", muted: "#66736B", accent: "#D2744C", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "REPORT",
  },
  {
    id: "story",
    name: "故事线",
    narrative: "引语 -> 冲突 -> 转折 -> 高潮 -> 收尾",
    description: "带情绪，适合品牌故事",
    layouts: ["cover", "quote", "cards", "split", "timeline", "cover"],
    suitable: ["品牌", "故事", "发布", "产品", "价值"],
    theme: { primary: "#3B2E5A", background: "#F7F2FF", surface: "#FFFFFF", text: "#2B2340", muted: "#7A7490", accent: "#8B5CF6", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "STORY",
  },
  {
    id: "pyramid",
    name: "金字塔原理",
    narrative: "核心结论 -> 三组论据 -> 数据佐证 -> 下一步",
    description: "结论先行，适合高层",
    layouts: ["cover", "bullets", "bullets", "metrics", "table", "cover"],
    suitable: ["金字塔", "结论", "策略", "决策", "高层"],
    theme: { primary: "#1F3A5F", background: "#EFF4FF", surface: "#FFFFFF", text: "#182840", muted: "#6B7A92", accent: "#3B82F6", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "PYRAMID",
  },
  {
    id: "timeline",
    name: "时间线驱动",
    narrative: "背景 -> 里程碑 -> 成果 -> 未来",
    description: "按时间展开，适合历程回顾",
    layouts: ["cover", "timeline", "timeline", "cards", "timeline", "cover"],
    suitable: ["时间", "历程", "复盘", "里程碑", "计划", "路线图"],
    theme: { primary: "#854D0E", background: "#FFFBEB", surface: "#FFFFFF", text: "#3B2A0A", muted: "#9A8460", accent: "#F59E0B", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "TIMELINE",
  },
  {
    id: "compare",
    name: "对比论证",
    narrative: "痛点 -> 对比 -> 推荐 -> 行动",
    description: "多选项对比，适合选型",
    layouts: ["cover", "cards", "table", "split", "bullets", "cover"],
    suitable: ["对比", "选型", "立项", "方案", "评估", "竞品"],
    theme: { primary: "#7C2D12", background: "#FFF7ED", surface: "#FFFFFF", text: "#3B1A0A", muted: "#9A7A68", accent: "#EA580C", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "COMPARE",
  },
  {
    id: "pitch",
    name: "融资路演",
    narrative: "钩子 -> 痛点 -> 方案 -> 市场 -> 团队 -> 融资",
    description: "投资人视角，快节奏",
    layouts: ["cover", "quote", "split", "chart", "metrics", "cards", "cover"],
    suitable: ["融资", "路演", "pitch", "投资", "创业", "BP"],
    theme: { primary: "#0F172A", background: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", accent: "#0EA5E9", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "PITCH",
  },
  {
    id: "data",
    name: "数据驱动",
    narrative: "指标 -> 趋势 -> 归因 -> 对策",
    description: "数据说话，适合增长复盘",
    layouts: ["cover", "metrics", "chart", "chart", "table", "cover"],
    suitable: ["数据", "指标", "增长", "转化", "分析", "报表"],
    theme: { primary: "#14532D", background: "#F0FDF4", surface: "#FFFFFF", text: "#12261A", muted: "#5B7A62", accent: "#22C55E", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "DATA",
  },
  {
    id: "problem-solution",
    name: "问题解法",
    narrative: "问题 -> 根因 -> 解法 -> 试点 -> 推广",
    description: "问题导向，适合改进提案",
    layouts: ["cover", "bullets", "cards", "split", "timeline", "cover"],
    suitable: ["问题", "解法", "改进", "故障", "复盘", "方案"],
    theme: { primary: "#701A75", background: "#FDF4FF", surface: "#FFFFFF", text: "#2E1040", muted: "#8A6A90", accent: "#D946EF", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "SOLVE",
  },
  {
    id: "minimal",
    name: "极简5页",
    narrative: "主题 -> 三要点 -> 一图 -> 行动",
    description: "极简，适合快闪",
    layouts: ["cover", "cards", "split", "chart", "cover"],
    suitable: ["极简", "快闪", "电梯", "简短", "概述"],
    theme: { primary: "#27272A", background: "#FAFAF9", surface: "#FFFFFF", text: "#1C1C1F", muted: "#71717A", accent: "#A1A1AA", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "MINIMAL",
  },
  {
    id: "training",
    name: "培训课",
    narrative: "目标 -> 知识点1 -> 知识点2 -> 练习 -> 总结",
    description: "教学节奏，适合内训",
    layouts: ["cover", "bullets", "cards", "split", "timeline", "cover"],
    suitable: ["培训", "课程", "教学", "内训", "学习", "知识"],
    theme: { primary: "#9A3412", background: "#FFF7ED", surface: "#FFFFFF", text: "#3B1A0A", muted: "#9A7A68", accent: "#F97316", headingFont: "Microsoft YaHei", bodyFont: "Microsoft YaHei" },
    eyebrowPrefix: "TRAIN",
  },
];

export function getFramework(id: string): Framework | undefined {
  return frameworks.find((f) => f.id === id);
}
export function listFrameworks(): Framework[] {
  return frameworks.slice();
}
export function scoreFramework(prompt: string, framework: Framework): number {
  const lower = prompt.toLowerCase();
  let score = 0;
  for (const kw of framework.suitable) {
    if (lower.includes(kw.toLowerCase())) score += 2;
  }
  score += Math.random() * 0.6;
  return score;
}
export function pickRandomFrameworks(prompt: string, count: number, excludeIds: string[]): Framework[] {
  const scored = frameworks
    .filter((f) => excludeIds.indexOf(f.id) === -1)
    .map((f) => ({ f, score: scoreFramework(prompt, f) }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 6).map((s) => s.f);
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = top[i];
    top[i] = top[j];
    top[j] = tmp;
  }
  return top.slice(0, count);
}
export function pickSingleFramework(prompt: string, excludeIds: string[]): Framework {
  const arr = pickRandomFrameworks(prompt, 1, excludeIds);
  return arr[0] || frameworks[0];
}

export type OutlineSlideSpec = {
  title: string;
  body: string;
  layout: string;
  eyebrow: string;
  notes: string;
};

export type OutlineCandidate = {
  id: string;
  frameworkId: string;
  frameworkName: string;
  narrative: string;
  description: string;
  theme: FrameworkTheme;
  eyebrowPrefix: string;
  slides: OutlineSlideSpec[];
};

const placeholderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function titleForLayout(layout: string, topicShort: string, index: number, total: number): string {
  const map: Record<string, string[]> = {
    cover: [topicShort, topicShort + " 关键一页", "下一步行动"],
    quote: ['"值得记住的一句话"', "为什么重要", "让选择有据可依"],
    cards: ["我们看到了什么", "三个关键洞察", "用户的真实声音"],
    bullets: ["核心观点", "三点论据", "需要对齐什么"],
    split: ["我们的解法", "把复杂变简单", "聚焦关键路径"],
    chart: ["数据说话", "趋势与变化", "各阶段完成情况"],
    metrics: ["关键指标", "进展概览", "本期成果"],
    timeline: ["如何落地", "四步走", "里程碑时间线"],
    table: ["对比与选择", "选项评估", "维度对比"],
  };
  const pool = map[layout] || ["要点", "洞察", "行动"];
  if (index === 0) return topicShort;
  if (index === total - 1) return "下一步行动";
  return pool[index % pool.length];
}

function bodyForLayout(layout: string, topicShort: string): string {
  const map: Record<string, string> = {
    cards: "用户需要的不是更多功能\n而是更少打扰。\n围绕 " + topicShort + " 的真实场景",
    bullets: "聚焦 " + topicShort + " 的关键路径\n把复杂流程拆成3步\n让选择有据可依",
    split: "聚焦 " + topicShort + " 的关键路径\n把复杂流程拆成3步\n让选择有据可依",
    quote: "好的 " + topicShort + " 不是功能堆砌，而是让正确的事更顺畅。",
    chart: "第一阶段｜3\n第二阶段｜5\n第三阶段｜7",
    metrics: "完成场次｜7 场｜截至本季度末\n访谈人数｜24 人｜两类点位\n待跟进｜5 项｜团队确认",
    timeline: "W1｜明确范围与素材\nW2｜联调内容与视觉\nW3｜小范围预演反馈\nW4｜正式汇报复盘",
    table: "维度｜我们｜常规做法\n聚焦度｜核心场景｜功能堆砌\n协同｜一次对齐｜多次补会",
  };
  return map[layout] || "要点一：关于 " + topicShort + "\n要点二：关键洞察\n要点三：下一步";
}

export function buildLocalOutlines(prompt: string, count: number, excludeIds: string[]): OutlineCandidate[] {
  const topic = extractTopic(prompt);
  const topicShort = topic.slice(0, 22) || "精彩汇报";
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const chosen = pickRandomFrameworks(prompt, count, excludeIds);
  return chosen.map((fw) => {
    const slides: OutlineSlideSpec[] = fw.layouts.map((layout, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === fw.layouts.length - 1;
      let eyebrow = "";
      if (isFirst) eyebrow = fw.eyebrowPrefix + " / 2026";
      else if (isLast) eyebrow = fw.eyebrowPrefix + " / NEXT";
      else eyebrow = String(idx).padStart(2, "0") + " / " + layout.toUpperCase();
      let notes = "";
      if (isFirst) notes = "封面：用一句话点明 " + topicShort + " 要解决什么。";
      else if (isLast) notes = "致谢：" + today + " 留联系方式。";
      else notes = "按 " + fw.narrative + " 讲解这一页。";
      return {
        title: titleForLayout(layout, topicShort, idx, fw.layouts.length),
        body: bodyForLayout(layout, topicShort),
        layout: layout,
        eyebrow: eyebrow,
        notes: notes,
      };
    });
    return {
      id: crypto.randomUUID(),
      frameworkId: fw.id,
      frameworkName: fw.name,
      narrative: fw.narrative,
      description: fw.description,
      theme: fw.theme,
      eyebrowPrefix: fw.eyebrowPrefix,
      slides: slides,
    };
  });
}

export function buildSlidesFromCandidate(candidate: OutlineCandidate): Slide[] {
  const slides: Slide[] = candidate.slides.map((spec, i) => ({
    id: "slide-" + i + "-" + candidate.id.slice(0, 4),
    title: spec.title.slice(0, 80),
    eyebrow: spec.eyebrow,
    body: spec.body,
    layout: spec.layout,
    image: placeholderImage,
    focus: 50,
    notes: spec.notes,
  } as unknown as Slide));
  return slides;
}

export function buildSlidesWithFramework(prompt: string, frameworkId: string): Slide[] {
  const fw = getFramework(frameworkId);
  if (!fw) throw new Error("未知框架 " + frameworkId);
  const topic = extractTopic(prompt);
  const topicShort = topic.slice(0, 22);
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const slides: OutlineSlideSpec[] = fw.layouts.map((layout, idx) => {
    const eyebrow = idx === 0 ? fw.eyebrowPrefix + " / 2026" : idx === fw.layouts.length - 1 ? fw.eyebrowPrefix + " / NEXT" : String(idx).padStart(2, "0") + " / " + layout.toUpperCase();
    const notes = idx === 0 ? "封面：" + topicShort : idx === fw.layouts.length - 1 ? "致谢：" + today : "按 " + fw.narrative + " 讲解";
    return {
      title: titleForLayout(layout, topicShort, idx, fw.layouts.length),
      body: bodyForLayout(layout, topicShort),
      layout: layout,
      eyebrow: eyebrow,
      notes: notes,
    };
  });
  const result: Slide[] = slides.map((spec, i) => ({
    id: "slide-" + i + "-" + fw.id,
    title: spec.title,
    eyebrow: spec.eyebrow,
    body: spec.body,
    layout: spec.layout,
    image: placeholderImage,
    focus: 50,
    notes: spec.notes,
  } as unknown as Slide));
  return result;
}

export function buildAiOutlinePrompt(prompt: string, frameworks: Framework[]): string {
  const topic = extractTopic(prompt);
  const pool = frameworks.map((f) => "- " + f.id + " " + f.name + ": " + f.narrative).join("\n");
  return "你是资深演示专家 主题:" + topic + " 原始需求:" + prompt.slice(0, 500) + "\n框架池:\n" + pool + "\n请返回JSON数组3套大纲";
}
