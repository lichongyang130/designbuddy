import { slidePhotos } from "./shared";
export const slideData = [
  ["LUMA", "给影像，\n一个新的视角。", "影像工作台 · 概念产品发布", "cover", 0],
  [
    "01 / WHY NOW",
    "照片越来越多，\n灵感却越来越散。",
    "文件夹、标注与版本分散在不同工具。\n创作者需要一条更短的观察与表达路径。",
    "statement",
    3,
  ],
  [
    "THE PROBLEM",
    "我们不是缺少图像。",
    "我们缺少的是：\n01  找到那一张\n02  记住为什么选它\n03  把观察变成作品",
    "split",
    4,
  ],
  [
    "OUR BELIEF",
    "好的工具，应当让观察先发生。",
    "先浏览，再整理，最后表达。\nLUMA 是围绕这条路径设计的概念工作台。",
    "quote",
    0,
  ],
  [
    "MEET LUMA",
    "看见 · 整理 · 表达",
    "一个连贯的影像工作空间。\n从摄影参考到作品提案，保留创作过程。",
    "triptych",
    0,
  ],
  [
    "02 / THE EXPERIENCE",
    "一次完整的创作旅程",
    "导入素材 → 标注观察 → 比较版本 → 输出提案",
    "journey",
    3,
  ],
  [
    "01  COLLECT",
    "先找到，让你停下来的画面。",
    "大图浏览与键盘导航。\n摄影来源与说明伴随素材保留。",
    "fullphoto",
    0,
  ],
  [
    "02  ORGANIZE",
    "让每次选择，\n都留下理由。",
    "按项目组织素材，为照片添加观察笔记。\n同一份素材可以属于不同的创作方向。",
    "split",
    1,
  ],
  [
    "03  COMPARE",
    "不是更多版本，\n而是更清楚的取舍。",
    "并排比较两种叙事方向。\n让反馈对应具体画面，而不是零散聊天。",
    "compare",
    2,
  ],
  [
    "04  PRESENT",
    "从素材，到一场有节奏的讲述。",
    "把选好的影像编入演示。\n内容层次、留白与照片同样重要。",
    "fullphoto",
    2,
  ],
  [
    "DESIGN PRINCIPLES",
    "克制的界面，\n完整的表达。",
    "内容优先 / 渐进展开 / 保留上下文\n不让工具栏比作品更抢眼。",
    "principles",
    3,
  ],
  [
    "WORKFLOW STUDY",
    "少一次切换，多一分专注。",
    "演示流程对比：6 次工具切换 → 2 次。\n此数值只用于版式与概念说明，并非测量结果。",
    "metric",
    4,
  ],
  [
    "FOR CREATORS",
    "一个工作台，三种创作角色。",
    "摄影师：组织作品与参考。\n设计师：建立素材与表达之间的连接。\n研究者：给观察保留可追溯的说明。",
    "personas",
    1,
  ],
  [
    "OPEN BY DESIGN",
    "作品属于你，\n格式不应成为围墙。",
    "保留来源链接，支持可编辑文本与图片导出。\n这里展示的是概念产品方向，而非已上线服务。",
    "statement",
    0,
  ],
  [
    "PROPOSED PLANS",
    "从一个项目开始。",
    "个人 / 自由整理灵感\n工作室 / 跨项目管理素材\n团队 / 协作审阅与版本约定",
    "pricing",
    3,
  ],
  [
    "LAUNCH PLAN",
    "小步发布，认真打磨。",
    "第一阶段：基础整理与浏览\n第二阶段：比较、备注与提案\n第三阶段：验证协作与导出工作流",
    "timeline",
    2,
  ],
  [
    "A PRACTICAL EXAMPLE",
    "从深空摄影到视觉提案。",
    "选择素材、记录观察、建立叙事节奏。\n用一个项目，验证完整的创作路径。",
    "mosaic",
    0,
  ],
  [
    "RESPONSIBLE DESIGN",
    "不是所有事情，\n都该自动完成。",
    "来源与许可必须保留。\n重要决策由创作者确认。\n不把示例数据包装成真实成果。",
    "principles",
    1,
  ],
  [
    "WHAT COMES NEXT",
    "现在，轮到你的视角。",
    "选择一组照片，为它们找到一个值得讲述的主题。\n复制这套幻灯片，修改你的发布故事。",
    "quote",
    4,
  ],
  [
    "LUMA / THANK YOU",
    "重新看见。",
    "产品发布概念样板 · 20 页\n摄影：NASA / SpaceX / Lav Varshney / Stefan van der Walt\n公开授权素材，不代表机构或摄影师认可此虚构品牌。",
    "closing",
    0,
  ],
].map(([kicker, title, body, layout, photo], index) => ({
  kicker: String(kicker),
  title: String(title),
  body: String(body),
  layout: String(layout),
  photo: Number(photo),
  index,
}));
export type SlideElement = {
  kind: "rect" | "text" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  fill?: string;
  text?: string;
  size?: number;
  bold?: boolean;
  photo?: number;
};
export function slideElements(
  index: number,
  title?: string,
  body?: string,
): SlideElement[] {
  const s = slideData[index];
  const e: SlideElement[] = [];
  const dark = [0, 3, 4, 6, 9, 13, 16, 19].includes(index);
  const bg = dark ? "111919" : "F4F1E9",
    ink = dark ? "F4F1E9" : "192525",
    muted = dark ? "9AABA5" : "718079",
    accent = "D4F282";
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    e.push({ kind: "rect", x, y, w, h, fill });
  const text = (
    v: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number = 22,
    color = ink,
    bold = false,
  ) => e.push({ kind: "text", text: v, x, y, w, h, size, color, bold });
  const image = (p: number, x: number, y: number, w: number, h: number) =>
    e.push({ kind: "image", photo: p % slidePhotos.length, x, y, w, h });
  rect(0, 0, 960, 540, bg);
  const t = title ?? s.title,
    b = body ?? s.body;
  if (s.layout === "cover" || s.layout === "closing") {
    image(s.photo, 460, 0, 500, 480);
    rect(0, 0, 470, 480, bg);
    text(t, 48, 130, 420, 210, 58, ink, true);
    text(b, 50, 360, 375, 100, 15, muted);
    rect(48, 92, 38, 4, accent);
  } else if (s.layout === "fullphoto") {
    image(s.photo, 0, 0, 960, 540);
    rect(0, 335, 960, 205, "111919");
    text(s.kicker, 48, 355, 760, 20, 12, accent);
    text(t, 48, 390, 870, 64, 36, "FFFFFF", true);
    text(b, 48, 456, 750, 58, 15, "C5D0CB");
  } else if (s.layout === "split") {
    image(s.photo, 520, 88, 392, 370);
    text(t, 48, 126, 445, 160, 40, ink, true);
    text(b, 48, 316, 410, 130, 19, muted);
  } else if (s.layout === "quote" || s.layout === "statement") {
    text("“", 48, 86, 100, 100, 108, dark ? accent : "A7B89A");
    text(t, 125, 144, 730, 170, 48, ink, true);
    rect(130, 336, 65, 3, dark ? accent : "789368");
    text(b, 130, 368, 700, 100, 21, muted);
  } else if (s.layout === "triptych") {
    text(t, 48, 88, 850, 75, 48, ink, true);
    text(b, 50, 162, 840, 60, 20, muted);
    [0, 1, 2].forEach((n) => {
      image(n, 48 + n * 294, 250, 276, 178);
      text(
        ["01 / 观察", "02 / 组织", "03 / 表达"][n],
        48 + n * 294,
        444,
        270,
        24,
        14,
        accent,
      );
    });
  } else if (s.layout === "journey" || s.layout === "timeline") {
    text(t, 48, 95, 850, 92, 43, ink, true);
    const labels =
      s.layout === "journey"
        ? ["导入素材", "标注观察", "比较版本", "输出提案"]
        : ["基础浏览", "比较与提案", "协作验证"];
    rect(78, 290, 780, 2, "CED6C7");
    labels.forEach((v, i) => {
      const x = 48 + i * (860 / labels.length);
      rect(x, 261, 48, 48, "D4F282");
      text("0" + (i + 1), x + 7, 270, 42, 32, 22, ink, true);
      text(v, x, 337, 215, 40, 24, ink, true);
    });
    text(b, 48, 421, 840, 60, 16, muted);
  } else if (s.layout === "metric") {
    text(t, 48, 89, 820, 78, 42, ink, true);
    text("06", 60, 180, 300, 155, 125, "AFB9AC", true);
    text("→", 380, 220, 160, 100, 70, muted);
    text("02", 580, 180, 320, 155, 125, ink, true);
    rect(58, 365, 844, 2, "CBD1C6");
    text(b, 58, 394, 844, 70, 18, muted);
  } else if (s.layout === "compare") {
    text(t, 48, 82, 850, 105, 38, ink, true);
    image(s.photo, 48, 218, 415, 188);
    image((s.photo + 1) % 5, 497, 218, 415, 188);
    text("A / 开阔叙事", 48, 422, 410, 24, 15);
    text("B / 人物视角", 497, 422, 410, 24, 15);
    text(b, 48, 465, 820, 36, 12, muted);
  } else if (s.layout === "mosaic") {
    image(0, 48, 90, 520, 358);
    image(1, 586, 90, 326, 170);
    image(2, 586, 278, 326, 170);
    rect(48, 333, 520, 115, "192525");
    text(t, 67, 350, 475, 70, 29, "FFFFFF", true);
    text(b, 50, 457, 840, 35, 12, muted);
  } else {
    text(t, 48, 88, 850, 118, 42, ink, true);
    const lines = b.split("\n");
    lines.slice(0, 3).forEach((v, i) => {
      const x = 48 + i * 294;
      rect(x, 246, 276, 201, dark ? "243332" : "E8EBDF");
      text(
        "0" + (i + 1),
        x + 22,
        268,
        210,
        42,
        32,
        dark ? accent : "789368",
        true,
      );
      text(v, x + 22, 331, 226, 92, 19, ink);
    });
  }
  if (s.layout !== "fullphoto") {
    text(s.kicker, 48, 30, 700, 22, 11, muted, true);
    text(
      String(index + 1).padStart(2, "0") + " / 20",
      840,
      498,
      80,
      18,
      10,
      muted,
    );
    text("LUMA / CONCEPT LAUNCH · 演示内容", 48, 500, 650, 18, 9, muted);
  }
  return e;
}
