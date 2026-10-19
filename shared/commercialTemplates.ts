import type { WordDocument } from "./wordDocument";

/** Authored sample content, not customer evidence or third-party claims. No external service calls. */
export const benchmarkVersion = "2026.10.20-1";
export const benchmarkTemplates = [
  {
    id: "forme",
    category: "原型",
    name: "FORME · 家具采购",
    en: "SPACE / PROCUREMENT",
    summary: "规格、空间、预算与采购清单的完整任务链",
    format: "交互原型 / CSV / HTML",
    accent: "#556749",
    unit: "24 个业务页面",
    boundary: "虚构产品与本地采购演示，不生成真实订单。",
  },
  {
    id: "pro-review",
    category: "幻灯片",
    name: "NORTH · 季度经营复盘",
    en: "QUARTERLY / REVIEW",
    summary: "从指标口径到决策请求的 10 页经营叙事",
    format: "PPTX / PDF / JSON",
    accent: "#355870",
    unit: "10 页完整讲稿",
    boundary: "合成经营数据，不是实际公司业绩；办公软件兼容性仍需复核。",
  },
  {
    id: "pro-project",
    category: "文档",
    name: "FIELDNOTE · 项目实施方案",
    en: "PROJECT / DELIVERY",
    summary: "范围、交付、责任、变更与验收的完整项目约定",
    format: "DOCX / PDF / JSON",
    accent: "#79634b",
    unit: "8 节实施内容",
    boundary: "原创方法样例，不是合同或已批准的项目承诺。",
  },
  {
    id: "pro-launch",
    category: "图片",
    name: "ORBIT · 新品发布视觉",
    en: "PRODUCT / CAMPAIGN",
    summary: "主视觉、卖点、细节与行动入口组成的六张传播画板",
    format: "SVG / PNG / ZIP",
    accent: "#be5736",
    unit: "6 张独立画板",
    boundary: "原创程序图形与虚构品牌；SVG 文字可编辑，不包含摄影或印刷认证。",
  },
  {
    id: "pro-tour",
    category: "HyperFrames",
    name: "WAYFINDER · 产品上手导览",
    en: "PRODUCT / ONBOARDING",
    summary: "从创建项目到交付复核的五步分帧教学",
    format: "交互 HTML / JSON",
    accent: "#6b5b91",
    unit: "5 步可编辑导览",
    boundary: "教学式交互，不自动操作外部软件，也不录制用户行为。",
  },
  {
    id: "pro-film",
    category: "视频",
    name: "FORM / FUNCTION · 产品短片",
    en: "PRODUCT / MOTION",
    summary: "问题、设计、细节、场景与行动组成的五镜头演示",
    format: "MP4 / VTT / 分镜 JSON",
    accent: "#3b6866",
    unit: "20 秒 / 5 个镜头",
    boundary:
      "程序绘制的虚构产品、无音乐；下载视频为固定样片，编辑分镜不会重编码样片。",
  },
  {
    id: "pro-cues",
    category: "音频",
    name: "SIGNAL · 产品提示音",
    en: "INTERFACE / SONIC",
    summary: "成功、提醒、警告、错误与完成的五种声音语义",
    format: "WAV / ZIP / 参数 JSON",
    accent: "#5e697e",
    unit: "5 个原创合成音效",
    boundary: "本地合成、非音乐与人声；初始低音量试听，不替代视觉提示。",
  },
  {
    id: "pro-cost",
    category: "实时产物",
    name: "LEDGER · 项目成本测算",
    en: "PROJECT / ESTIMATE",
    summary: "工时、外采、预备金与税费的逐项可复算预算",
    format: "HTML / CSV / JSON",
    accent: "#44705c",
    unit: "3 类工种 / 双情景",
    boundary: "本地即时计算，不是合同、财税建议、市场报价或付款凭据。",
  },
  {
    id: "pro-config",
    category: "WebGL",
    name: "OBJECT · 三维产品选配",
    en: "OBJECT / CONFIGURATION",
    summary: "参数化边几、颜色、相机与配置清单的实时预演",
    format: "WebGL HTML / OBJ / JSON",
    accent: "#795b50",
    unit: "原创参数化模型",
    boundary: "视觉示意，非工程测量、真实物理仿真或商品报价。",
  },
] as const;
export type BenchmarkId = (typeof benchmarkTemplates)[number]["id"];
export type NewBenchmarkId = Exclude<BenchmarkId, "forme">;
export const newBenchmarkIds = benchmarkTemplates
  .filter((t) => t.id !== "forme")
  .map((t) => t.id) as NewBenchmarkId[];
export const isNewBenchmark = (value: string): value is NewBenchmarkId =>
  newBenchmarkIds.includes(value as NewBenchmarkId);

export type ContentPage = {
  title: string;
  lead: string;
  points: string[];
  note: string;
};
export const reviewMetrics = [
  { label: "净收入", unit: "万元", target: 120, actual: 108 },
  { label: "新增客户", unit: "家", target: 40, actual: 36 },
  { label: "续约率", unit: "%", target: 85, actual: 88 },
];
export const reviewPages: ContentPage[] = [
  {
    title: "把增长问题拆到可执行的动作",
    lead: "NORTH / 第三季度经营复盘",
    points: [
      "结论：收入与新增客户未达标，续约指标高于目标。",
      "本次决策：确认下一季度优先处理线索质量与实施产能。",
      "全套数字为合成教学样例；不代表任何企业。",
    ],
    note: "先说明数据性质，再讲结论。本样例单位为万元、家、百分比，不混用。",
  },
  {
    title: "先统一口径，再讨论表现",
    lead: "样例观察期：2026-07-01 至 2026-09-30",
    points: [
      "净收入：期间确认收入，不含税，不等同于回款或签约额。",
      "新增客户：期间首次付费的组织，同一组织去重。",
      "续约率：完成续约的到期客户数 / 期间到期客户数。",
    ],
    note: "来源是本模板内嵌的合成数据。真实使用时替换数据、期间和来源，不仅替换图表数值。",
  },
  {
    title: "收入完成 90%，新增客户完成 90%",
    lead: "目标与实际必须使用同一时间范围",
    points: [
      "净收入 108 / 120 万元；差额 -12 万元。",
      "新增客户 36 / 40 家；差额 -4 家。",
      "续约率 88% / 85%；高于目标 3 个百分点。",
    ],
    note: "完成率 = 实际 / 目标。百分比差异用百分点，不写成增长 3%。",
  },
  {
    title: "收入缺口需要拆解，不能直接归因",
    lead: "观察不等于原因",
    points: [
      "已知：总量未达标，但续约表现较好。",
      "未知：新客数量、客单价、确认时点分别贡献多少。",
      "下一步：补客户分组与收入确认明细，避免从总量推断个体原因。",
    ],
    note: "本样例没有交易明细，不虚构瀑布归因。展示待核查问题，而不是编造驱动贡献。",
  },
  {
    title: "新客流程要同时看数量与质量",
    lead: "把线索、试用、签约与交付连接起来",
    points: [
      "入口：记录线索来源、行业与需求完整度。",
      "过程：在每个阶段记录进入/退出时间与退出原因。",
      "结果：新增客户 36 家是已知样例值；阶段转化率尚未提供。",
    ],
    note: "建议建立漏斗事件表；没有分母时不绘制看似精确的转化率。",
  },
  {
    title: "保持续约表现，同时验证成本",
    lead: "较高续约率不能单独证明利润改善",
    points: [
      "观察：续约率高于目标 3 个百分点。",
      "需补：续约折扣、服务工时、客户规模分层。",
      "行动：回看续约客户的服务负载与反馈，识别可复制做法。",
    ],
    note: "不把续约率自动解释为满意度、净收入留存率或毛利率。",
  },
  {
    title: "把风险写成触发条件",
    lead: "风险 → 观察信号 → 处理动作",
    points: [
      "线索质量：连续两次评审出现需求缺失，先补资格审查。",
      "交付产能：待排期任务超出可用工时，调整承诺并做容量评审。",
      "数据质量：指标分母缺失或定义变化，停止跨期对比并标注。",
    ],
    note: "触发条件是建议规则，需由实际团队确认，不是已发生的事故。",
  },
  {
    title: "下一季度聚焦三项行动",
    lead: "负责人使用岗位，不虚构具体人员",
    points: [
      "销售负责人：建立线索资格标准与每周复盘记录。",
      "交付负责人：把在制项目、可用工时与承诺日期放在一张容量表。",
      "数据负责人：维护指标字典、来源与口径变更记录。",
    ],
    note: "日期和负责人在真实项目启动时确认。本模板不声称任务已分配。",
  },
  {
    title: "需要管理层确认的取舍",
    lead: "批准什么、不批准什么",
    points: [
      "确认优先级：先修线索质量与交付容量，再扩大获客投放。",
      "确认边界：不基于缺失明细直接制定个人绩效结论。",
      "确认复核点：补齐数据后重新评估预算与目标，不先承诺收益。",
    ],
    note: "这是决策请求，不是批准记录；现场记录结论、负责人和下次复核日期。",
  },
  {
    title: "来源、公式与会后交付",
    lead: "让每个数字和行动可以回溯",
    points: [
      "来源：shared/commercialTemplates.ts 中的合成指标表。",
      "公式：完成率 = 实际 / 目标；续约差额 = 实际率 - 目标率。",
      "交付：演示文稿、讲稿、指标表与待补明细清单。",
    ],
    note: "在 PowerPoint/WPS 中打开后复核字体与可编辑对象。正式报告必须绑定真实来源。",
  },
];
export const projectPages: ContentPage[] = [
  {
    title: "目标与背景",
    lead: "把网站改版从页面交付变成有验收依据的项目",
    points: [
      "适用对象：委托方产品负责人、设计负责人、实施与验收人员。",
      "目标：形成一套可追溯的需求、页面实现、测试与交付文件。",
      "样例项目为虚构的品牌网站改版；本方案不是合同或已批准预算。",
    ],
    note: "启动时需确认项目名称、品牌材料、目标用户、决策人和现有系统访问范围。",
  },
  {
    title: "范围与不含项",
    lead: "边界先于排期",
    points: [
      "包含：首页、产品介绍、案例结构、联系表单前端与响应式规范。",
      "包含：可编辑内容、源代码、部署说明、素材清单和测试记录。",
      "不含：支付、CRM 对接、真实邮件发送、法律审查与未经授权的数据迁移。",
    ],
    note: "新增页面、第三方接口或语言版本进入变更流程，不默认为原范围内工作。",
  },
  {
    title: "交付物与关卡",
    lead: "每个关卡都留下可审阅的证据",
    points: [
      "G1 需求确认：需求清单、页面地图、输入材料与未决问题。",
      "G2 设计确认：关键页面、组件规则、移动端与异常状态。",
      "G3 实施交付：源码、测试、部署、回退与交接文件。",
    ],
    note: "关卡表示依赖顺序，不是实际完成状态。具体日期由资源与依赖确认后填写。",
  },
  {
    title: "角色与沟通",
    lead: "责任按岗位描述，避免虚构人员承诺",
    points: [
      "委托方负责人：确认范围、材料真实性和最终验收结论。",
      "交付负责人：维护版本、风险、问题与变更记录，安排评审。",
      "实施与测试人员：提交实现证据、复现步骤、缺陷修复和回归结果。",
    ],
    note: "每次评审记录版本、结论、未决项、责任岗位和下一次复核条件。",
  },
  {
    title: "变更管理",
    lead: "先记录影响，再批准实施",
    points: [
      "提交：记录变更原因、原需求、新需求与提出人岗位。",
      "评估：说明内容、设计、实现、测试与时间/费用影响。",
      "确认：由授权负责人批准或拒绝；批准前不覆盖已确认基线。",
    ],
    note: "变更表字段：编号、日期、范围、影响、决定、批准岗位、实施版本。",
  },
  {
    title: "风险与应对",
    lead: "明确触发信号与升级方式",
    points: [
      "材料延迟：关键文案或授权缺失，暂停相应页面定稿并登记阻断。",
      "接口不可用：保留错误态与模拟数据标识，不伪装真实提交成功。",
      "字体和素材：许可不明或缺字时更换来源，随后重新渲染与复核。",
    ],
    note: "敏感数据不写入公开样例或日志。需要生产权限时另行通过安全渠道授予。",
  },
  {
    title: "验收条件",
    lead: "硬性失败不能被综合评分抵消",
    points: [
      "内容：已确认需求逐项映射到页面，不存在无意义占位或遗漏。",
      "功能：主流程、失败与取消路径可执行，保存与重新打开行为一致。",
      "交付：源文件可开、导出与预览同版、素材许可齐全；严重错误修复后回归。",
    ],
    note: "业务负责人确认语义与范围；测试确认执行证据。验收框未勾选不表示通过。",
  },
  {
    title: "交接与维护",
    lead: "交付后也能找到版本、数据与负责人",
    points: [
      "交接清单：源码版本、构建命令、环境变量名、部署与回退步骤。",
      "维护清单：备份、恢复演练、依赖更新、域名/证书与问题反馈入口。",
      "来源声明：本文件为原创方法样例，不含真实客户数据或商业承诺。",
    ],
    note: "访问凭据在服务器 Secret 中保存，不附在本文件或聊天记录里。",
  },
];
export const guidePages: ContentPage[] = [
  {
    title: "创建一个明确的项目",
    lead: "先写清楚给谁看、解决什么问题",
    points: [
      "填写项目名称和目标受众。",
      "说明交付格式与使用场景。",
      "没有材料时先记录缺口，不编造客户事实。",
    ],
    note: "确认后进入材料整理。",
  },
  {
    title: "整理输入与来源",
    lead: "把事实、推断与建议分开",
    points: [
      "为材料记录名称、日期和来源位置。",
      "标记未确认的数据和使用授权。",
      "不把涉密文件发送到未批准的外部服务。",
    ],
    note: "缺失授权是阻断项，不通过继续按钮自动放行。",
  },
  {
    title: "选择结构，而不只选封面",
    lead: "每个页面承担一个表达任务",
    points: [
      "先选业务结构，再调整字体和配色。",
      "核对正文、表格与异常状态。",
      "保留样例原件，创建自己的编辑副本。",
    ],
    note: "本导览是教学，不替你操作其他软件。",
  },
  {
    title: "检查实际输出",
    lead: "预览通过不代表文件通过",
    points: [
      "下载后用目标软件打开。",
      "检查全部页面、可编辑对象和字体。",
      "核对版本、素材来源和内容一致性。",
    ],
    note: "文件失败时保留错误证据，不冒称导出完成。",
  },
  {
    title: "带着版本交付",
    lead: "让接收者能够复核与继续编辑",
    points: [
      "整理源文件、说明、许可与已验证导出。",
      "明确已完成、待确认与不支持事项。",
      "记录接收反馈并维护变更版本。",
    ],
    note: "完成教学流程不代表真实项目已经通过验收。",
  },
];
export const filmPages: ContentPage[] = [
  {
    title: "把空间留给真正重要的事",
    lead: "00:00–00:04 / 场景引入",
    points: [
      "画面：留白中的参数化边几轮廓。",
      "字幕：一件家具，回到它的功能。",
    ],
    note: "原创程序图形，虚构产品，不含音乐。",
  },
  {
    title: "轮廓决定第一眼",
    lead: "00:04–00:08 / 设计展示",
    points: [
      "画面：台面与支撑结构逐层出现。",
      "字幕：清楚的结构，不需要多余装饰。",
    ],
    note: "使用几何图形表达，不冒充真实摄影。",
  },
  {
    title: "把细节放大",
    lead: "00:08–00:12 / 细节特写",
    points: ["画面：台面边缘与连接位置。", "字幕：让比例与接触面更容易阅读。"],
    note: "视觉示意，不声称实际承重或材料性能。",
  },
  {
    title: "适配每一种停留",
    lead: "00:12–00:16 / 场景变化",
    points: [
      "画面：两种配色与不同背景。",
      "字幕：在阅读与休息之间，留一个支点。",
    ],
    note: "颜色为屏幕表现，不是实物色差保证。",
  },
  {
    title: "从一个想法开始",
    lead: "00:16–00:20 / 行动收尾",
    points: [
      "画面：品牌与参数化轮廓收束。",
      "字幕：OBJECT / 探索你的空间方案。",
    ],
    note: "固定样片下载；修改后的分镜可导出 JSON，需重新编码才能变成视频。",
  },
];
export function pagesFor(id: string): ContentPage[] {
  return id === "pro-review"
    ? reviewPages
    : id === "pro-project"
      ? projectPages
      : id === "pro-tour"
        ? guidePages
        : filmPages;
}
export type BenchmarkState = {
  title: string;
  subtitle: string;
  accent: string;
  page: number;
  edits: string[];
  hours: number[];
  rates: number[];
  external: number;
  reserve: number;
  tax: number;
  volume: number;
  cue: number;
  width: number;
  height: number;
  yaw: number;
};
export function initialBenchmark(id: NewBenchmarkId): BenchmarkState {
  const template = benchmarkTemplates.find((t) => t.id === id)!;
  return {
    title: template.name.split(" · ")[0],
    subtitle:
      id === "pro-launch" ? "为日常，留一个新的轨道。" : template.summary,
    accent: template.accent,
    page: 0,
    edits: pagesFor(id).map((p) => p.title),
    hours: [24, 48, 16],
    rates: [180, 240, 160],
    external: 2000,
    reserve: 10,
    tax: 6,
    volume: 25,
    cue: 0,
    width: 80,
    height: 55,
    yaw: 30,
  };
}
const finite = (x: unknown, low: number, high: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= low && x <= high;
export function restoreBenchmark(
  id: NewBenchmarkId,
  raw: unknown,
): BenchmarkState {
  const next = initialBenchmark(id);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return next;
  const v = raw as Record<string, unknown>;
  for (const k of ["title", "subtitle"] as const)
    if (typeof v[k] === "string" && v[k].trim())
      next[k] = v[k].slice(0, k === "title" ? 40 : 100);
  if (typeof v.accent === "string" && /^#[\da-f]{6}$/i.test(v.accent))
    next.accent = v.accent;
  for (const [k, lo, hi] of [
    ["page", 0, pagesFor(id).length - 1],
    ["cue", 0, 4],
    ["external", 0, 1000000],
    ["reserve", 0, 50],
    ["tax", 0, 30],
    ["volume", 0, 60],
    ["width", 40, 140],
    ["height", 30, 100],
    ["yaw", -180, 180],
  ] as const)
    if (finite(v[k], lo, hi) && Number.isInteger(v[k])) next[k] = v[k];
  for (const k of ["hours", "rates"] as const)
    if (
      Array.isArray(v[k]) &&
      v[k].length === 3 &&
      v[k].every(
        (x) =>
          finite(x, 0, k === "hours" ? 1000 : 10000) && Number.isInteger(x),
      )
    )
      next[k] = [...v[k]] as number[];
  if (Array.isArray(v.edits) && v.edits.length === next.edits.length)
    next.edits = next.edits.map((s, i) =>
      typeof (v.edits as unknown[])[i] === "string" &&
      String((v.edits as unknown[])[i]).trim()
        ? String((v.edits as unknown[])[i]).slice(0, 48)
        : s,
    );
  return next;
}
export function costBreakdown(s: BenchmarkState, multiplier = 1) {
  const labor = s.hours.reduce(
    (sum, h, i) => sum + Math.round(h * multiplier) * s.rates[i] * 100,
    0,
  );
  const external = Math.round(s.external * 100),
    base = labor + external;
  const reserve = Math.round((base * s.reserve) / 100),
    tax = Math.round(((base + reserve) * s.tax) / 100);
  return { labor, external, base, reserve, tax, total: base + reserve + tax };
}
export function projectSpec(s = initialBenchmark("pro-project")): WordDocument {
  const blocks: WordDocument["blocks"] = [];
  const roles = [
    "objectives",
    "scope",
    "deliverables",
    undefined,
    undefined,
    "risks",
    "acceptance",
    undefined,
  ];
  projectPages.forEach((p, i) => {
    blocks.push({
      id: `section-${i}`,
      type: "heading",
      level: 1,
      text: s.edits[i],
      role: roles[i],
      refs: ["authored"],
    });
    [p.lead, ...p.points, p.note].forEach((text, j) =>
      blocks.push({
        id: `body-${i}-${j}`,
        type: "paragraph",
        text,
        refs: ["authored"],
      }),
    );
    if (i === 2)
      blocks.push({
        id: "deliverables",
        type: "table",
        caption: "交付与验收对应表",
        headers: ["交付物", "确认依据", "确认岗位"],
        rows: [
          ["需求与页面地图", "范围清单逐项对应", "委托方负责人"],
          ["设计与实现", "页面预览与功能测试记录", "设计/实施负责人"],
          ["部署与交接", "构建、回退、备份说明", "运维/验收负责人"],
        ],
        scope: "虚构网站改版项目；列出交付类别，不代表已完成。",
        calculation: "非数值表格，不作总计。",
        refs: ["authored"],
        repeatHeader: true,
        widthsMm: [50, 65, 45],
      });
  });
  return {
    schemaVersion: 1,
    documentType: "project-plan",
    title: s.title,
    subtitle: s.subtitle,
    blocks,
    sources: [
      {
        id: "authored",
        name: "原创项目管理方法样例",
        locator: "shared/commercialTemplates.ts projectPages",
        text: projectPages
          .map((p) => [p.title, p.lead, ...p.points, p.note].join("\n"))
          .join("\n\n"),
      },
    ],
  };
}
