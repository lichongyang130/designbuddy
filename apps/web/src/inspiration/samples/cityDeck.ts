import type { SlideElement } from "./slideContent";
export const citySlides = [
  [
    "WALK / FIELD NOTES",
    "把城市，\n重新走一遍。",
    "一份关于日常观察的漫步提案\n概念路线 · 不对应真实组织活动",
    "cover",
    0,
  ],
  [
    "01 / THE QUESTION",
    "离开目的地思维",
    "这次不追求打卡数量。\n我们把注意力交还给路径、停留和人与城市的关系。",
    "wide",
    1,
  ],
  [
    "BRIEF",
    "一次漫步，三个目标",
    "看见被忽略的公共空间\n记录街区尺度与行走感受\n形成可以复查的观察笔记",
    "brief",
    2,
  ],
  [
    "AUDIENCE",
    "谁适合一起出发？",
    "初次认识街区的访客\n愿意分享日常经验的居民\n关注公共空间的设计学习者",
    "people",
    4,
  ],
  [
    "OBSERVATION",
    "从绿地开始",
    "在进入热闹街区之前，先观察树荫、道路边缘和休息设施。\n记录能看见的条件，不猜测规划者的意图。",
    "photo",
    0,
  ],
  [
    "ROUTE A / DEMO",
    "绿地 → 路口 → 街角",
    "路线不是导航地图。\n实地组织前必须核验通行条件、路程与开放时间。",
    "route",
    1,
  ],
  [
    "ROUTE B / DEMO",
    "港口 → 街区 → 餐桌",
    "从城市轮廓到生活细节。\n把大尺度观察与近距离记录放进同一条叙事。",
    "pair",
    2,
  ],
  [
    "TIME DESIGN",
    "90分钟，留出空白",
    "步行 40 分钟\n观察 30 分钟\n休息与交流 20 分钟\n时间分配为策划示例，不是已执行数据。",
    "bars",
    0,
  ],
  [
    "FIELD KIT",
    "带上轻一点的工具",
    "纸笔与简易路线卡\n饮水、合适鞋履和天气防护\n电量充足的手机与离线联系方式",
    "kit",
    3,
  ],
  [
    "STREET CROSSING",
    "在路口，先顾及安全",
    "不在车流中拍照或停留。\n选择合法通行位置；观察与交通安全冲突时，放弃观察。",
    "split",
    1,
  ],
  [
    "WINTER WALK",
    "季节改变路线",
    "同一段路在冬季可能具有完全不同的条件。\n提前检查结冰、日照与保暖需求，不套用夏季时间表。",
    "photo",
    3,
  ],
  [
    "EVERYDAY LIFE",
    "日常不是布景",
    "拍摄前征得同意，避免打扰工作和交易。\n不把路人的面孔当作设计提案的免费装饰。",
    "wide",
    4,
  ],
  [
    "ACCESSIBILITY",
    "把可达性放在起点",
    "确认台阶与坡度\n提供可缩短的路线\n设置可随时退出的集合点\n这些条件需实地核验，不能凭照片保证。",
    "matrix",
    0,
  ],
  [
    "RECORDING",
    "一张观察卡的四个字段",
    "位置 / 具体观察点\n现象 / 能直接描述的内容\n条件 / 天气、时间与视角\n疑问 / 还需要核实什么",
    "cards",
    2,
  ],
  [
    "STORYTELLING",
    "不要急着下结论",
    "先写看到了什么，再写可能的解释。\n把事实、感受与推测分栏，避免一张照片承担整座城市的故事。",
    "statement",
    2,
  ],
  [
    "DELIVERABLES",
    "从散步到一份小型档案",
    "一条经核验的路线\n五张带来源与同意说明的照片\n三条有条件限定的观察\n一份未解决问题清单",
    "number",
    0,
  ],
  [
    "PLAN B",
    "天气改变，计划也能改变",
    "轻微天气变化：缩短路线并增加休息。\n不适宜户外活动：延期或改为室内资料整理。\n不把完成计划置于参与者安全之上。",
    "decision",
    3,
  ],
  [
    "RUN OF SHOW",
    "组织者的执行节奏",
    "活动前：勘察与确认\n集合时：说明边界与退出方式\n行走中：定点清点与记录\n结束后：整理资料与授权",
    "timeline",
    1,
  ],
  [
    "REVIEW",
    "怎样评价这次漫步？",
    "不是数走了多少步，而是检查记录能否解释。\n是否写清观察条件？是否尊重被拍摄者？是否留下可行动的下一步？",
    "check",
    4,
  ],
  [
    "WALK / THANK YOU",
    "从熟悉的街角，\n开始新的观察。",
    "概念提案结束 / 摄影署名保留在演讲备注中\n照片为独立参考素材，不表示它们构成同一条真实路线。",
    "end",
    2,
  ],
].map(([kicker, title, body, layout, photo], index) => ({
  kicker: String(kicker),
  title: String(title),
  body: String(body),
  layout: String(layout),
  photo: Number(photo),
  index,
}));

// Independent editorial layouts; only the SVG/PPTX element primitives are shared.
export function cityElements(
  index: number,
  title?: string,
  body?: string,
): SlideElement[] {
  const s = citySlides[index],
    e: SlideElement[] = [],
    blue = "183D69",
    red = "EF6649",
    paper = "F7F3EB",
    ink = "1D293B",
    muted = "627185";
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    e.push({ kind: "rect", x, y, w, h, fill });
  const text = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size = 24,
    color = ink,
    bold = false,
  ) => e.push({ kind: "text", x, y, w, h, text: value, size, color, bold });
  const image = (photo: number, x: number, y: number, w: number, h: number) =>
    e.push({ kind: "image", photo, x, y, w, h });
  const t = title ?? s.title,
    b = body ?? s.body;
  rect(0, 0, 960, 540, paper);
  if (s.layout === "cover") {
    image(0, 360, 0, 600, 540);
    rect(0, 0, 360, 540, blue);
    text("WALK", 34, 92, 320, 100, 80, paper, true);
    rect(35, 213, 64, 7, red);
    text(t, 34, 249, 315, 135, 39, paper, true);
    text(b, 35, 425, 290, 65, 14, "D3DFED");
  } else if (s.layout === "end") {
    rect(0, 0, 960, 540, blue);
    image(s.photo, 0, 240, 450, 300);
    text(t, 490, 125, 420, 170, 43, paper, true);
    text(b, 490, 347, 410, 104, 17, "D3DFED");
    rect(490, 87, 66, 7, red);
  } else if (s.layout === "wide") {
    text(t, 40, 80, 850, 72, 45, blue, true);
    image(s.photo, 40, 190, 550, 282);
    text(b, 625, 220, 280, 220, 23);
    rect(40, 170, 870, 3, red);
  } else if (s.layout === "photo") {
    image(s.photo, 0, 0, 960, 340);
    rect(0, 340, 960, 200, blue);
    text(t, 40, 356, 860, 60, 38, paper, true);
    text(b, 40, 430, 870, 65, 19, "E2EAF3");
  } else if (s.layout === "route") {
    text(t, 40, 90, 860, 80, 42, blue, true);
    rect(65, 270, 815, 5, blue);
    ["起点 / 绿地", "转折 / 路口", "终点 / 街角"].forEach((v, i) => {
      const x = 55 + i * 300;
      rect(x, 247, 55, 55, red);
      text(String(i + 1), x + 15, 251, 35, 45, 32, paper, true);
      text(v, x, 326, 260, 45, 26, blue, true);
    });
    text(b, 45, 425, 850, 66, 19);
  } else if (s.layout === "pair") {
    text(t, 40, 79, 870, 75, 43, blue, true);
    image(2, 40, 180, 420, 227);
    image(4, 490, 180, 430, 227);
    text(b, 40, 430, 870, 65, 18);
  } else if (s.layout === "bars") {
    text(t, 40, 85, 850, 72, 44, blue, true);
    [40, 30, 20].forEach((v, i) => {
      const y = 204 + i * 74;
      rect(330, y, v * 12, 38, i === 1 ? red : blue);
      text(["步行", "观察", "休息"][i], 40, y, 230, 43, 25);
      text(String(v) + " min", 340 + v * 12, y + 4, 100, 34, 18);
    });
    text(b, 40, 448, 870, 65, 13, muted);
  } else if (s.layout === "split") {
    image(s.photo, 0, 0, 480, 540);
    text(t, 520, 100, 390, 130, 42, blue, true);
    rect(520, 254, 70, 6, red);
    text(b, 520, 301, 390, 156, 24);
  } else if (s.layout === "statement") {
    rect(0, 0, 960, 540, red);
    text("“", 45, 82, 110, 120, 105, paper, true);
    text(t, 160, 126, 750, 105, 54, paper, true);
    text(b, 162, 300, 690, 142, 25, paper);
  } else if (s.layout === "number") {
    text("01 / 05 / 03", 40, 125, 870, 125, 85, blue, true);
    text(t, 40, 283, 870, 67, 38, blue, true);
    text(b, 40, 389, 870, 110, 19);
  } else if (s.layout === "timeline") {
    text(t, 40, 79, 870, 70, 42, blue, true);
    b.split("\n").forEach((v, i) => {
      rect(40, 184 + i * 70, 65, 48, i % 2 ? red : blue);
      text("0" + (i + 1), 54, 191 + i * 70, 48, 33, 24, paper, true);
      text(v, 135, 191 + i * 70, 760, 44, 24);
    });
  } else if (s.layout === "decision") {
    text(t, 40, 84, 870, 75, 42, blue, true);
    b.split("\n").forEach((v, i) => {
      rect(40, 196 + i * 94, 870, 74, i === 2 ? blue : "E8DDD2");
      text(v, 62, 211 + i * 94, 822, 49, 21, i === 2 ? paper : ink);
    });
  } else if (s.layout === "matrix" || s.layout === "cards") {
    text(t, 40, 85, 870, 76, 40, blue, true);
    b.split("\n")
      .slice(0, 4)
      .forEach((v, i) => {
        const x = 40 + (i % 2) * 452,
          y = 197 + Math.floor(i / 2) * 135;
        rect(x, y, 427, 114, i === 3 ? blue : "E8E9E7");
        text(
          "0" + (i + 1),
          x + 16,
          y + 14,
          50,
          33,
          22,
          i === 3 ? paper : red,
          true,
        );
        text(v, x + 80, y + 16, 325, 83, 21, i === 3 ? paper : ink);
      });
  } else {
    text(t, 40, 86, 870, 85, 45, blue, true);
    const lines = b.split("\n");
    lines.forEach((v, i) => {
      const y = 215 + i * 86;
      rect(42, y + 7, 12, 12, red);
      text(v, 80, y, 795, 70, 26);
    });
  }
  const light = ["cover", "end", "photo", "split", "statement"].includes(
    s.layout,
  );
  text(
    s.kicker,
    36,
    24,
    s.layout === "cover" ? 300 : 870,
    22,
    11,
    light && s.layout !== "split" ? paper : blue,
    true,
  );
  if (s.layout !== "cover" && s.layout !== "photo")
    text(
      "WALK / 概念路线 · 非真实活动",
      40,
      514,
      750,
      16,
      9,
      s.layout === "end" || s.layout === "statement" ? paper : muted,
    );
  text(
    `${String(index + 1).padStart(2, "0")} / 20`,
    850,
    511,
    80,
    18,
    11,
    ["end", "photo", "statement"].includes(s.layout) ? paper : muted,
  );
  return e;
}
