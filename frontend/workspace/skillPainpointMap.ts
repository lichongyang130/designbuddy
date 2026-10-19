export type SkillModeId = "office" | "design" | "code";
export interface SkillPainpoint {
  id: string;
  title: string;
  expertId: string;
  summary: string;
  skillIds: string[];
}
export const skillModeLabels: Record<SkillModeId, string> = {
  office: "办公提效",
  design: "设计制作",
  code: "网页应用",
};
/** UI filter only; server skill/expert bindings remain authoritative at execution time. */
export const skillPainpoints: Record<SkillModeId, SkillPainpoint[]> = {
  office: [
    { id: "office-documents", title: "文档整理", expertId: "documents", summary: "解析、结构整理、PDF/OCR 与 DOCX/PDF 输出。", skillIds: ["document.format", "document.structure", "document.summarize", "pdf.extract", "pdf.ocr", "pdf.ocr-batch", "image.ocr"] },
    { id: "office-tables", title: "数据表格", expertId: "data", summary: "表格清洗、公式重算、多表关联与CSV分组统计及财务报告。", skillIds: ["table.analyze", "table.calculate", "table.join", "table.join-multi", "data.report", "finance.report"] },
    { id: "office-meetings", title: "会议纪要", expertId: "meeting", summary: "整理用户提供的文字记录；未接入中文、多语种或长会议转写。", skillIds: [] },
    { id: "office-reports", title: "周报总结", expertId: "weekly", summary: "可用模型依据真实记录辅助写作；没有项目系统自动采集技能。", skillIds: [] },
    { id: "office-slides", title: "汇报PPT", expertId: "slides", summary: "授权后按真实材料规划商业演示，交付原生PPTX/PDF、逐页预览及来源/质量报告；另支持结构编排与PPTX检查，所有草稿仍需人工验收。", skillIds: ["slides.create", "slides.compose", "slides.inspect", "pdf.extract"] },
    { id: "office-email", title: "邮件沟通", expertId: "communication", summary: "可生成可预览的HTML营销邮件与纯文本；不接收收件人、不自动发送或管理退订。", skillIds: ["email.marketing"] },
    { id: "office-planning", title: "计划排期", expertId: "communication", summary: "排期校验、OKR进度记分卡与入职任务日历导出；不写入外部日历或持续同步。", skillIds: ["collaboration.schedule", "team.okrs", "hr.onboarding"] },
    { id: "office-research", title: "调研分析", expertId: "research-summary", summary: "基于实际提供的资料整理；没有联网检索或已授权的专属摘要绑定。", skillIds: [] },
    { id: "office-process", title: "流程规范", expertId: "documents", summary: "可整理流程文档；没有组织制度或审批规则验证器。", skillIds: ["document.format", "document.structure"] },
    { id: "office-followup", title: "协作跟进", expertId: "communication", summary: "可校验排期并导出 ICS；消息发送与外部日历同步未接入。", skillIds: ["collaboration.schedule", "collaboration.sync"] },
    { id: "office-other", title: "其他问题", expertId: "triage", summary: "先澄清并分诊；确认具体任务后再选择已接通的工具。", skillIds: [] },
  ],
  design: [
    { id: "design-posters", title: "海报配图", expertId: "visual", summary: "用用户提供素材进行固定版式或图层排版导出，不生成新图。", skillIds: ["image.marketing", "image.layout", "image.web-pack"] },
    { id: "design-products", title: "产品展示", expertId: "product-visual", summary: "商品图尺寸适配；抠图、重绘与生成式图片未接入。", skillIds: ["image.product", "image.web-pack"] },
    { id: "design-social", title: "社媒内容", expertId: "visual", summary: "可生成3:4封面卡片与多页轮播图；不自动创作文案或发布社媒。", skillIds: ["image.marketing", "image.layout", "image.web-pack", "social.carousel", "social.card"] },
    { id: "design-brand", title: "品牌物料", expertId: "brand", summary: "真实校验品牌色板、设计令牌并导出CSS及受限品牌资产；不是商标检索。", skillIds: ["brand.assets", "brand.system", "design.tokens"] },
    { id: "design-infographics", title: "信息图表", expertId: "infographics", summary: "按明确数据、口径和图表目的导出图表；不推断业务含义。", skillIds: ["infographic.compose"] },
    { id: "design-commerce", title: "电商物料", expertId: "product-visual", summary: "商品图片有限尺寸适配；不抠图、改商品细节或生成背景。", skillIds: ["image.product", "image.web-pack"] },
    { id: "design-longform", title: "宣传长图", expertId: "visual", summary: "可使用素材做受限排版导出，并将用户提供的长文整理为杂志风格HTML。", skillIds: ["image.marketing", "image.layout", "image.web-pack", "article.magazine"] },
    { id: "design-slides", title: "演示制作与检查", expertId: "slides", summary: "用设计 token 生成原生文本/形状/柱状图/折线图，或提取PPTX结构并逐页渲染；不等于模板导入、整套视觉自动验收或语义可编辑性认证。", skillIds: ["slides.create", "slides.compose", "slides.inspect"] },
    { id: "design-direction", title: "视觉方案", expertId: "visual", summary: "可校验现有设计令牌并整理需求简报；不会凭空生成视觉创意。", skillIds: ["design.tokens", "design.brief"] },
    { id: "design-image", title: "图片优化", expertId: "visual", summary: "可执行图层排版和多尺寸WebP压缩；生成、抠图、修复未接入。", skillIds: ["image.layout", "image.web-pack"] },
  ],
  code: [
    { id: "web-corporate", title: "企业官网", expertId: "web-design", summary: "生成受限的真实静态网站文件，并对HTML/CSS做静态检查；不等于浏览器运行验收。", skillIds: ["web.scaffold", "web.audit", "web.css-audit", "design.review", "web.verify"] },
    { id: "web-events", title: "活动页面", expertId: "web-design", summary: "生成静态活动页面并审查HTML/CSS；表单提交与发布服务仍未接入。", skillIds: ["web.scaffold", "web.audit", "web.css-audit", "design.review", "web.verify"] },
    { id: "web-prototypes", title: "产品原型", expertId: "product", summary: "整理设计需求简报、结构化产品规格并生成受限静态原型；不是交互原型或运行验收。", skillIds: ["requirements.check", "design.brief", "product.spec", "web.scaffold"] },
    { id: "web-dashboards", title: "数据看板", expertId: "developer", summary: "可生成静态页面骨架并审查CSS/JS；不连接业务数据或运行看板。", skillIds: ["web.scaffold", "web.css-audit", "design.review", "code.inspect", "code.build"] },
    { id: "web-tools", title: "实用工具", expertId: "developer", summary: "可生成静态页面、检查CSS/JS并整理工程事故Runbook；隔离构建与生产处置未接入。", skillIds: ["web.scaffold", "web.css-audit", "design.review", "code.inspect", "engineering.runbook", "code.build"] },
    { id: "web-portfolios", title: "作品展示", expertId: "web-design", summary: "生成静态展示页骨架并审查HTML/CSS；浏览器视觉验收未接通。", skillIds: ["web.scaffold", "web.audit", "web.css-audit", "design.review", "web.verify"] },
    { id: "web-services", title: "商品服务", expertId: "web-design", summary: "可生成真实静态展示页；交易、支付或服务接口未接通。", skillIds: ["web.scaffold", "web.audit", "web.css-audit", "design.review", "web.verify"] },
    { id: "web-forms", title: "表单收集", expertId: "developer", summary: "可生成静态表单展示骨架；后端存储、隐私和真实提交未接入。", skillIds: ["web.scaffold", "web.css-audit", "design.review", "code.inspect", "code.build"] },
    { id: "web-admin", title: "业务后台", expertId: "developer", summary: "可生成静态前端展示骨架；数据库、权限与后台运行技能未接入。", skillIds: ["web.scaffold", "web.css-audit", "design.review", "code.inspect", "code.build"] },
    { id: "web-content", title: "内容站点", expertId: "web-design", summary: "生成静态内容页、杂志式长文和可搜索FAQ，并检查HTML/CSS；发布与CMS未接通。", skillIds: ["web.scaffold", "article.magazine", "faq.page", "web.audit", "web.css-audit", "design.review", "web.verify"] },
  ],
};
