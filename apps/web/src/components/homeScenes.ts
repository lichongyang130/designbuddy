import type { HomeIconName } from "./HomeIcon";
export type HomeMode = "office" | "code" | "design";
export type HomeShortcut = {
  title: string;
  icon: HomeIconName;
  mode: HomeMode;
  prompt: string;
};
export type SceneId =
  | "meeting"
  | "weekly"
  | "data"
  | "slides"
  | "email"
  | "website"
  | "dashboard"
  | "api"
  | "debug"
  | "tests"
  | "prototype"
  | "interface"
  | "poster"
  | "brand"
  | "campaign";
export type HomeScene = HomeShortcut & {
  id: SceneId;
  description: string;
  testHint: string;
  tag: string;
};
export const modeLabels: Record<HomeMode, string> = {
  office: "办公提效",
  code: "网页应用",
  design: "设计制作",
};
function shortcut(
  mode: HomeMode,
  title: string,
  icon: HomeIconName,
  prompt: string,
): HomeShortcut {
  return { mode, title, icon, prompt };
}
export const shortcutsByMode: Record<HomeMode, HomeShortcut[]> = {
  office: [
    shortcut(
      "office",
      "文档处理",
      "document",
      "帮我整理和处理这份文档，提炼关键信息并输出清晰的结果。",
    ),
    shortcut(
      "office",
      "图像创作",
      "palette",
      "帮我构思办公配图，明确画面内容、构图、配色和图像生成提示词。主题是：",
    ),
    shortcut(
      "office",
      "数据分析",
      "chart",
      "请分析业务数据，先检查数据口径、字段与缺失值，再整理结论。数据如下：",
    ),
    shortcut(
      "office",
      "PPT制作",
      "slides",
      "请为我的汇报主题编排演示文稿，包含逐页内容和排版建议。主题是：",
    ),
    shortcut(
      "office",
      "智能助手",
      "invite",
      "帮我拆解工作任务、安排优先级并列出下一步行动。任务是：",
    ),
  ],
  code: [
    shortcut(
      "code",
      "网页开发",
      "code",
      "请根据需求开发网页，说明页面结构、运行方式与验收步骤。需求是：",
    ),
    shortcut(
      "code",
      "功能开发",
      "grid",
      "请实现以下功能，明确输入输出、依赖、边界条件和测试方法。功能需求：",
    ),
    shortcut(
      "code",
      "问题修复",
      "tools",
      "请排查以下报错，解释根因并给出最小修复及验证方法。报错和相关代码：",
    ),
    shortcut(
      "code",
      "代码优化",
      "bolt",
      "请审查并重构以下代码，改善可读性与性能，说明变更风险并保持原有行为。代码：",
    ),
    shortcut(
      "code",
      "测试编写",
      "checkCircle",
      "请为以下功能编写单元测试，覆盖正常、异常与边界输入，并说明运行方法。功能代码：",
    ),
  ],
  design: [
    shortcut(
      "design",
      "原型设计",
      "panel",
      "请为以下产品设计交互原型，覆盖核心流程、页面结构与关键状态。产品需求：",
    ),
    shortcut(
      "design",
      "界面设计",
      "devices",
      "请设计以下产品界面，明确布局、组件、响应式规则与交互反馈。需求是：",
    ),
    shortcut(
      "design",
      "图片创作",
      "palette",
      "请构思图片创作方案，包含主题、构图、风格、配色和图像生成提示词。我的想法：",
    ),
    shortcut(
      "design",
      "品牌设计",
      "pencil",
      "请为品牌提出 Logo 方向、配色、字体与应用规范，不虚构已完成的商标检索。品牌背景：",
    ),
    shortcut(
      "design",
      "创意策划",
      "bulb",
      "请策划一个创意活动，给出主题、受众、内容方向、渠道与执行计划。活动目标：",
    ),
  ],
};
export const scenesByMode: Record<HomeMode, HomeScene[]> = {
  office: [
    {
      ...shortcut(
        "office",
        "会议纪要",
        "document",
        "请将以下会议文本整理为会议纪要，列出决策、负责人和待办事项，不补造未提及的信息。会议文本：",
      ),
      id: "meeting",
      description: "独立评审文档、决策记录与责任到人的行动表",
      testHint:
        "编辑讨论与决策，分配行动负责人和日期；交付中心可下载 DOCX 或打印 PDF。",
      tag: "文档 · 行动表 · 导出",
    },
    {
      ...shortcut(
        "office",
        "周报生成",
        "document",
        "请根据实际工作记录编写周报，区分本周成果、遇到的问题和下周计划。工作记录：",
      ),
      id: "weekly",
      description: "执行摘要、交付趋势、里程碑与风险计划",
      testHint:
        "编辑团队、项目、来源与上期数据，维护风险和计划；导出 DOCX 汇报。",
      tag: "报告 · 趋势 · 里程碑",
    },
    {
      ...shortcut(
        "office",
        "表格分析",
        "chart",
        "请分析我提供的 CSV 数据，检查字段与缺失值，整理趋势与可视化建议。CSV 数据：",
      ),
      id: "data",
      description: "可导入自己数据的销售表与联动分析报表",
      testHint:
        "导入 CSV / XLSX，编辑单元格并筛选分析；支持 CSV 与 XLSX 交付。",
      tag: "表格 · 图表 · CSV",
    },
    {
      ...shortcut(
        "office",
        "汇报PPT",
        "slides",
        "请为我的汇报编排清晰的故事线、逐页标题、重点内容与视觉建议。主题是：",
      ),
      id: "slides",
      description: "逐页编辑、摄影裁切与真正的 PPTX 演示文稿",
      testHint:
        "直接编辑页面，增删排序、换图、调整焦点、写备注并播放；导出可编辑 PPTX。",
      tag: "逐页编辑 · 播放 · PPTX",
    },
    {
      ...shortcut(
        "office",
        "邮件撰写",
        "document",
        "请根据以下背景撰写工作邮件，明确收件对象、主题、语气与需要对方采取的行动。背景：",
      ),
      id: "email",
      description: "支持独立草稿、附件、签名与设备预览的邮件工作台",
      testHint:
        "编辑多份草稿、添加附件与签名；下载 EML，在接入邮箱前不会发送。",
      tag: "邮件 · 草稿 · 校验",
    },
  ],
  code: [
    {
      ...shortcut(
        "code",
        "企业官网",
        "code",
        "请开发一个响应式企业官网，包含介绍、服务与联系页面以及表单校验。企业背景：",
      ),
      id: "website",
      description: "新能源企业的摄影型官网与项目案例",
      testHint:
        "编辑首页标题、简介与主视觉，浏览项目和联系页；可下载独立 HTML 前端。",
      tag: "企业官网 · 项目 · 咨询",
    },
    {
      ...shortcut(
        "code",
        "管理后台",
        "grid",
        "请开发业务管理后台，包含订单表格、搜索、状态筛选、详情与导出，说明数据接口。业务需求：",
      ),
      id: "dashboard",
      description: "订单、商品、客户、库存与经营报表工作台",
      testHint:
        "增删改业务记录，调整库存、导入订单与导出报表；权限仅本地演示，不触发物流。",
      tag: "后台 · 订单 · 状态流转",
    },
    {
      ...shortcut(
        "code",
        "接口开发",
        "link",
        "请为以下业务设计并实现接口，包含输入验证、错误处理和测试用例。业务需求：",
      ),
      id: "api",
      description: "集合、参数、响应与历史完整的 API 工作台",
      testHint:
        "保存请求集合，使用环境变量、参数和响应历史；请求仅在本地模拟。",
      tag: "接口 · 请求校验 · 响应",
    },
    {
      ...shortcut(
        "code",
        "报错排查",
        "tools",
        "请排查以下代码的报错，给出根因、最小修复和回归测试方法。代码和报错：",
      ),
      id: "debug",
      description: "三个具体问题的代码定位与修复验证",
      testHint:
        "定位预设问题、比较源码修复、运行案例并下载补丁；不执行任意用户代码。",
      tag: "诊断 · 源码 · 运行结果",
    },
    {
      ...shortcut(
        "code",
        "单元测试",
        "checkCircle",
        "请为以下功能编写单元测试，覆盖正常输入、零值和负值等边界，并说明运行方式。代码：",
      ),
      id: "tests",
      description: "可添加数值用例的本地测试运行器与失败详情",
      testHint:
        "为价格或数量函数添加自己的输入与预期，运行真实断言并导出报告。",
      tag: "测试 · 2 套件 · 8 用例",
    },
  ],
  design: [
    {
      ...shortcut(
        "design",
        "App原型",
        "panel",
        "请设计一个酒店旅居 App 原型，覆盖目的地、客房详情、收藏、日期与人数选择及预约流程。需求是：",
      ),
      id: "prototype",
      description: "酒店发现、客房、入住与预约预览的四页流程",
      testHint:
        "修改客房信息与价格，收藏、校验日期并保存行程草稿；不订房、不支付。",
      tag: "酒店 App · 4 页流程",
    },
    {
      ...shortcut(
        "design",
        "官网界面",
        "devices",
        "请设计一个品牌官网界面，包含首页、作品与关于页面，提供配色和响应式规范。品牌是：",
      ),
      id: "interface",
      description: "建筑工作室的摄影作品集与项目详情",
      testHint:
        "直接改标题与项目内容，换图、调整焦点和区块顺序；支持独立 HTML 交付。",
      tag: "作品集 · 分类 · 详情",
    },
    {
      ...shortcut(
        "design",
        "活动海报",
        "palette",
        "请设计活动海报方案，给出主题、排版、配色与视觉元素建议。活动信息：",
      ),
      id: "poster",
      description: "可直接编辑、拖动与导出的摄影海报画布",
      testHint:
        "点击文字编辑，拖动手柄或用方向键移动；换图裁切、多尺寸，导出 PNG / SVG。",
      tag: "艺术摄影 · 展览海报",
    },
    {
      ...shortcut(
        "design",
        "品牌视觉",
        "pencil",
        "请设计品牌视觉方案，包含字标方向、配色、字体与名片应用规范。品牌背景：",
      ),
      id: "brand",
      description: "字标、色板、矢量包装与应用规范实时联动",
      testHint:
        "修改字标、标语、品牌色与字体，包装和应用同步更新；下载矢量品牌包。",
      tag: "品牌 · 包装 · 应用规范",
    },
    {
      ...shortcut(
        "design",
        "营销策划",
        "bulb",
        "请制定营销策划方案，说明目标受众、传播主题、渠道、预算与执行计划。活动背景：",
      ),
      id: "campaign",
      description: "生活方式活动的视觉、排期与媒介预算",
      testHint:
        "定义受众和策略，拖动排期、分配负责人及预算；导出执行表，不自动投放。",
      tag: "策划 · 内容排期 · 预算",
    },
  ],
};
