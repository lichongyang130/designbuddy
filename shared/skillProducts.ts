import type { RuntimeSkill } from "./skillRuntime";

/** Outcome-level navigation, not a new executor or permission grant. */
export type SkillProduct = {
  id: string;
  name: string;
  area: "办公提效" | "设计制作" | "网页与项目";
  icon:
    | "slides"
    | "document"
    | "chart"
    | "palette"
    | "speaker"
    | "code"
    | "clock"
    | "checkCircle";
  description: string;
  delivery: string[];
  primary: string;
  workflows: { id: string; label: string }[];
  skillIds: string[];
  stages: string[];
  boundary: string;
};
export const skillProductsVersion = "2026.10.20-1";
export const skillProducts: SkillProduct[] = [
  {
    id: "presentations",
    name: "专业演示与汇报",
    area: "办公提效",
    icon: "slides",
    description: "从材料、叙事和页面设计到原生演示、真实渲染与质量报告。",
    delivery: ["可编辑 PPTX", "PDF / 全页预览", "来源与质量报告"],
    primary: "slides.create",
    workflows: [],
    skillIds: ["slides.create", "slides.compose", "slides.inspect"],
    stages: [
      "确认目标与材料",
      "规划与原生生成",
      "真实渲染",
      "质量检查与草稿交付",
    ],
    boundary:
      "沿用已有商业演示管线。AI 规划需服务端模型凭据与单次授权；渲染不等于目标 PowerPoint/WPS 或商业视觉验收。",
  },
  {
    id: "documents",
    name: "专业文档与资料处理",
    area: "办公提效",
    icon: "document",
    description: "正式成稿、原文整理与提取各有明确路径；保留来源，不编造材料。",
    delivery: ["DOCX / PDF", "正文与表格", "来源及分页证据"],
    primary: "document.create",
    workflows: [
      { id: "doc-brief", label: "原文整理 → 授权提要" },
      { id: "doc-structure", label: "提取正文、表格与原图" },
    ],
    skillIds: [
      "document.create",
      "document.format",
      "document.structure",
      "document.summarize",
      "pdf.extract",
      "pdf.ocr-batch",
      "pdf.ocr",
      "image.ocr",
      "audio.transcribe-en",
      "article.magazine",
    ],
    stages: ["选择成稿或提取", "核对实际材料", "处理与渲染", "来源与人工复核"],
    boundary:
      "正式 Word 已有同源渲染和有限修复。旧文档整理不保证布局保真；摘要需第三方授权；转写仅支持所列短英语 WAV，不是中文长会议服务。",
  },
  {
    id: "data",
    name: "表格分析与业务报告",
    area: "办公提效",
    icon: "chart",
    description:
      "把清洗、关联、复算和报告收在同一入口，字段、来源与计算口径可查。",
    delivery: ["可编辑 XLSX", "图表与统计", "计算 / 异常记录"],
    primary: "table.analyze",
    workflows: [
      { id: "table-insights", label: "表格读取 → 清洗统计 → 图表" },
      { id: "business-infographic", label: "明确口径 → 选图计算 → 信息图" },
    ],
    skillIds: [
      "table.analyze",
      "table.calculate",
      "table.join",
      "table.join-multi",
      "data.connect",
      "data.report",
      "finance.report",
      "infographic.compose",
    ],
    stages: ["确认字段和口径", "校验与计算", "生成报告", "复算与来源核对"],
    boundary:
      "不同数据场景有不同输入和上限，不会把不兼容格式自动串接。公式白名单、纯值输出不是完整 Excel 保真编辑；数据连接仍受服务端允许目录与域名限制。",
  },
  {
    id: "brand",
    name: "品牌与视觉系统",
    area: "设计制作",
    icon: "palette",
    description: "将品牌信息、标志构形、色彩变量、规范页面和静态检查组合交付。",
    delivery: ["矢量标志与图标", "品牌规范 / CSS", "检查与许可记录"],
    primary: "workflow:brand-delivery",
    workflows: [
      { id: "brand-delivery", label: "品牌信息 → 系列资产 → CSS / HTML 检查" },
    ],
    skillIds: ["brand.assets", "brand.system", "design.tokens", "design.brief"],
    stages: ["确认品牌信息", "生成统一资产", "静态检查", "品牌负责人审阅"],
    boundary:
      "当前是确定性品牌草案与规则检查，不是商标检索、独占性证明或完整 AI 品牌创意；字体、品牌名称及实际使用仍需核权。",
  },
  {
    id: "visual",
    name: "营销与商品视觉",
    area: "设计制作",
    icon: "speaker",
    description:
      "上传实际图片和文案，一次完成多版式海报及网页图片适配，或进入可编辑图层。",
    delivery: ["多尺寸 PNG / SVG", "WebP 适配", "图层或布局参数"],
    primary: "workflow:marketing-delivery",
    workflows: [
      { id: "marketing-delivery", label: "实际图文 → 两种海报 → 网页图片适配" },
      { id: "social-card", label: "文案与色彩 → 社媒封面" },
    ],
    skillIds: [
      "image.marketing",
      "image.layout",
      "image.product",
      "image.generate",
      "social.card",
      "social.carousel",
      "image.web-pack",
    ],
    stages: [
      "确认素材和文案",
      "排版与多尺寸生成",
      "适配与导出",
      "裁切 / 字体 / 权利复核",
    ],
    boundary:
      "海报 SVG 文字为轮廓，不冒充文字可编辑；修改文案后需重做。图层编辑另有入口。生图是需凭据与单次授权的可选能力，不会用缩放冒充抠图。",
  },
  {
    id: "web",
    name: "网页与交互原型",
    area: "网页与项目",
    icon: "code",
    description:
      "生成静态站点后自动传递 HTML、CSS、脚本到检查工序，不必重复下载上传。",
    delivery: ["源码与静态站点 ZIP", "HTML / CSS / JS", "逐工序检查报告"],
    primary: "workflow:web-delivery",
    workflows: [
      { id: "web-delivery", label: "页面制作 → HTML / CSS / JS 三项检查" },
      { id: "faq-page", label: "实际问答 → 搜索与分类帮助页" },
    ],
    skillIds: ["web.scaffold", "faq.page", "code.build"],
    stages: ["确认页面内容", "生成源码", "静态门槛检查", "下载与浏览器复测"],
    boundary:
      "默认流程只做静态检查，没有自动部署、数据库或全栈业务。浏览器验收在质量检查入口单独授权。任意代码构建尚无真正隔离，不对普通用户开放。",
  },
  {
    id: "projects",
    name: "项目方案与执行计划",
    area: "网页与项目",
    icon: "clock",
    description:
      "把需求、交付、验收与计划整理在一个工作区，不为每种文稿单开技能卡。",
    delivery: ["方案与验收矩阵", "任务表 / ICS", "风险与待确认清单"],
    primary: "workflow:project-delivery",
    workflows: [
      { id: "project-delivery", label: "需求表单 → 验收覆盖 → 规格与静态检查" },
    ],
    skillIds: [
      "requirements.check",
      "product.spec",
      "collaboration.schedule",
      "collaboration.sync",
      "team.okrs",
      "hr.onboarding",
      "engineering.runbook",
      "email.marketing",
    ],
    stages: [
      "确认真实范围",
      "校验需求与依赖",
      "生成计划和清单",
      "责任人与外发确认",
    ],
    boundary:
      "计划生成不代表已通知同事或写入日历；邮件模板不等于发送。真实日历/邮件通道需单次授权，不生成虚构负责人、预算或完成状态。",
  },
  {
    id: "quality",
    name: "设计与交付质量检查",
    area: "网页与项目",
    icon: "checkCircle",
    description:
      "针对实际文件或明确测试目标提供问题定位、限制和检查证据，区分发现与修复。",
    delivery: ["问题与定位", "检查 / 截图证据", "复测记录"],
    primary: "web.audit",
    workflows: [],
    skillIds: [
      "design.review",
      "web.audit",
      "web.css-audit",
      "code.inspect",
      "web.verify",
      "test.browser",
    ],
    stages: [
      "选择检查范围",
      "执行明确规则",
      "查看问题与证据",
      "修复后重新检查",
    ],
    boundary:
      "静态扫描不等于浏览器、全量无障碍或安全认证；自动修复与跨产物统一验收仍待扩展。浏览器访问受允许来源约束。",
  },
];

export const maintenanceSkillIds = ["code.build"];
export function productForSkill(id: string) {
  return skillProducts.find((product) => product.skillIds.includes(id));
}
export function migrateSkillFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((id): id is string => typeof id === "string")
        .map((id) =>
          skillProducts.some((p) => p.id === id) ? id : productForSkill(id)?.id,
        )
        .filter((id): id is string => !!id),
    ),
  ];
}
export function productSearch(
  product: SkillProduct,
  catalog: RuntimeSkill[],
  query: string,
) {
  const text = [
    product.name,
    product.area,
    product.description,
    ...product.delivery,
    ...product.skillIds.flatMap((id) => {
      const skill = catalog.find((s) => s.id === id);
      return [id, skill?.name || "", skill?.description || ""];
    }),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return !query.trim() || text.includes(query.trim().toLocaleLowerCase());
}
