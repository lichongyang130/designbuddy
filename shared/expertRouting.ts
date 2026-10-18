/** Shared, tool-free expert contracts. Profiles guide work; they do not grant permissions. */
export interface ExpertProfile {
  id: string;
  name: string;
  description: string;
  method: string[];
  checks: string[];
}
export interface CoreExpert extends ExpertProfile {
  mode: "office" | "design" | "code";
  homeCategories: string[];
  materials: string[];
  deliverables: string[];
  limits: string;
  taskIds: string[];
}
// The sole built-in catalog used by the expert directory and homepage matching.
export const routingExperts: CoreExpert[] = [
  {
    "id": "documents",
    "name": "文档整理专家",
    "mode": "office",
    "description": "把零散资料整理成清晰正文、会议结论和可追踪的行动清单。",
    "homeCategories": [
      "文档整理",
      "会议纪要",
      "周报总结",
      "流程规范"
    ],
    "materials": [
      "原始文档或会议文字记录",
      "目标读者、篇幅与格式",
      "已有流程或工作记录"
    ],
    "method": [
      "确认资料范围和输出对象",
      "保留原文依据，区分事实、讨论和决定",
      "整理正文、负责人、截止时间及待确认项"
    ],
    "deliverables": [
      "分层摘要",
      "会议纪要",
      "周报正文",
      "流程清单"
    ],
    "checks": [
      "重要限定与争议不丢失",
      "负责人、时间和业绩不能猜测",
      "检查术语、编号和来源位置"
    ],
    "limits": "执行台已提供文档整理、中文PDF导出、PDF逐页文本提取及图片OCR。新增DOCX正文表格/合并/图片结构提取，非Word分页还原；聊天不会自动调用；新增扫描PDF逐页OCR及2至3个PDF打包批处理（ZIP≤2MB，全部合计≤6页），未识别页明确警告，仍须人工复核；已配置的Linux服务端可手动转写0.5–15秒英语PCM WAV并核对词级时间；须声明英语，非中文/长会议/说话人分离，全部结果须听音复核。",
    "taskIds": [
      "office-documents-1-1",
      "office-meetings-2-1",
      "office-reports-1-1"
    ]
  },
  {
    "id": "data",
    "name": "数据分析专家",
    "mode": "office",
    "description": "核对表格和统计口径，找出数据变化背后的证据与限制。",
    "homeCategories": [
      "数据表格",
      "调研分析"
    ],
    "materials": [
      "字段含义、时间范围与原始表格",
      "统计口径与比较周期",
      "需要核验的业务问题"
    ],
    "method": [
      "确认字段、统计粒度、时间范围和单位",
      "保留原始数据，检查重复、缺失与关联关系",
      "拆解变化来源，给出证据及替代解释"
    ],
    "deliverables": [
      "差异清单",
      "指标表",
      "分析说明"
    ],
    "checks": [
      "核对分母和汇总结果",
      "不将相关性写成因果，不编造缺失数据",
      "交付指标表、分析结论、限制与复核项"
    ],
    "limits": "执行台可清洗统计首表、按指定字段关联同一XLSX的两个表，或按ZIP内joins.json顺序跨2–5个CSV执行1–4步精确关联并追踪来源行号；右侧键须唯一、CSV文本精确匹配，公式子集有限。不能自动判断业务口径/关联键、不做多对多扩行、不连接外部数据源。聊天不会自动处理文件。",
    "taskIds": [
      "office-tables-2-1",
      "office-tables-2-3",
      "office-tables-2-4"
    ]
  },
  {
    "id": "slides",
    "name": "汇报提案专家",
    "mode": "office",
    "description": "把材料组织成面向领导或客户的论证，让结论、证据与决策连起来。",
    "homeCategories": [
      "汇报PPT",
      "周报总结",
      "调研分析"
    ],
    "materials": [
      "汇报对象、时间与决策目标",
      "真实成果、数据与背景材料",
      "已有提纲或待比较方案"
    ],
    "method": [
      "确认听众、时长及需要作出的决策",
      "按结论、证据、方案和行动组织主线",
      "逐页给出正文、图表建议和讲解备注"
    ],
    "deliverables": [
      "汇报故事线",
      "逐页内容",
      "提案论证",
      "讲解备注"
    ],
    "checks": [
      "不得仅以目录代替正文",
      "每个关键判断有材料支持",
      "区分内容方案与实际生成的演示文件"
    ],
    "limits": "执行台可把实际材料分页为可编辑PPTX，并提取PDF文本；固定排版不等于AI论证、配图或PowerPoint渲染验收，聊天不会自动导出。",
    "taskIds": [
      "office-slides-1-1",
      "office-slides-2-1",
      "office-research-2-1"
    ]
  },
  {
    "id": "communication",
    "name": "工作协作专家",
    "mode": "office",
    "description": "把沟通、任务拆解和跨部门推进转成明确的行动与责任边界。",
    "homeCategories": [
      "邮件沟通",
      "计划排期",
      "协作跟进"
    ],
    "materials": [
      "沟通对象、关系与真实背景",
      "交付目标、期限和可用资源",
      "当前阻塞与已有约定"
    ],
    "method": [
      "明确共同目标、事实、责任和约束",
      "拆解工作包、依赖、优先级与验收条件",
      "给出得体沟通草稿及跟进节点"
    ],
    "deliverables": [
      "邮件草稿",
      "任务清单",
      "排期建议",
      "跟进说明"
    ],
    "checks": [
      "不编造承诺与借口",
      "区分已约定和待确认时间",
      "不声称已发送邮件或创建日历"
    ],
    "limits": "执行台可校验CSV任务排期、冲突与依赖，通过时导出ICS。不会自动联系他人、发送消息或同步外部日程。",
    "taskIds": [
      "office-email-1-1",
      "office-planning-1-3",
      "office-followup-1-2"
    ]
  },
  {
    "id": "brand",
    "name": "品牌视觉专家",
    "mode": "design",
    "description": "建立一致的品牌识别，让配色、字体与日常物料有明确依据。",
    "homeCategories": [
      "品牌物料",
      "视觉方案"
    ],
    "materials": [
      "品牌定位与目标受众",
      "现有标识、色彩及授权素材",
      "应用媒介和制作预算"
    ],
    "method": [
      "明确品牌定位与视觉约束",
      "建立配色、字体、留白和版式原则",
      "说明跨物料应用与制作规格"
    ],
    "deliverables": [
      "视觉方向",
      "配色字体规范",
      "品牌物料方案"
    ],
    "checks": [
      "检查对比度与字体授权",
      "不虚构品牌资质和机构背书",
      "概念稿不等于注册商标或印刷成品"
    ],
    "limits": "执行台可从真实图片提取色板、计算对比度并导出CSS变量；不等于完整品牌设计。商标可用性和印前工艺仍需专业核验。",
    "taskIds": [
      "design-brand-1-1",
      "design-brand-1-2",
      "design-direction-2-3"
    ]
  },
  {
    "id": "visual",
    "name": "营销物料专家",
    "mode": "design",
    "description": "把宣传重点变成清楚的画面结构，适配海报、社媒和长图。",
    "homeCategories": [
      "海报配图",
      "社媒内容",
      "宣传长图"
    ],
    "materials": [
      "真实活动信息和文案",
      "发布平台、尺寸与目标受众",
      "品牌规范和可用素材"
    ],
    "method": [
      "明确传播目标和行动入口",
      "安排主视觉、文字层级与阅读顺序",
      "给出多画幅适配及制作说明"
    ],
    "deliverables": [
      "海报方案",
      "社媒图组结构",
      "长图版式"
    ],
    "checks": [
      "关键信息和限制条件不能遗漏",
      "不虚构时间、优惠与传播效果",
      "检查素材授权和手机阅读尺寸"
    ],
    "limits": "执行台支持固定海报导出，也可在图层画布编辑文字、色块和实际图片的位置、尺寸、层级、透明度及撤销，明确上传后由后台生成PNG/SVG与可编辑JSON。草稿不自动保存；不是AI生图/智能改图、旋转分组、PSD兼容或发布。聊天不会自动编辑或执行。",
    "taskIds": [
      "design-posters-1-1",
      "design-social-2-1",
      "design-longform-1-1"
    ]
  },
  {
    "id": "product-visual",
    "name": "产品展示专家",
    "mode": "design",
    "description": "用真实卖点和使用场景讲清产品价值，组织主图与详情页。",
    "homeCategories": [
      "产品展示",
      "电商物料",
      "图片优化"
    ],
    "materials": [
      "产品照片、规格与真实卖点",
      "目标客户、购买疑问和渠道",
      "商品规则及品牌素材"
    ],
    "method": [
      "提炼卖点与视觉证据的对应关系",
      "规划主图、细节、对比和使用场景",
      "提供详情页信息顺序与图像处理要求"
    ],
    "deliverables": [
      "卖点图方案",
      "商品详情结构",
      "场景图说明"
    ],
    "checks": [
      "不添加不存在的功能、销量和评价",
      "保持产品比例、颜色与关键细节",
      "优惠、规格与服务规则需核实"
    ],
    "limits": "执行台可修正方向、等比缩放和白底留边，交付多尺寸商品图；不抠图、不改商品细节、不生成背景，也不自动上架。",
    "taskIds": [
      "design-products-1-1",
      "design-commerce-1-2",
      "design-image-1-2"
    ]
  },
  {
    "id": "infographics",
    "name": "信息可视化专家",
    "mode": "design",
    "description": "把复杂信息讲清楚，优化图表、流程图和演示页面的可读性。",
    "homeCategories": [
      "信息图表",
      "演示美化",
      "图片优化"
    ],
    "materials": [
      "已核对的数据或现有演示稿",
      "信息关系、受众和展示环境",
      "目标尺寸与已有视觉规范"
    ],
    "method": [
      "先明确问题、逻辑关系和阅读顺序",
      "选择合适图表与信息层级",
      "统一标注、版式、对比度和多尺寸适配"
    ],
    "deliverables": [
      "图表结构",
      "信息图方案",
      "逐页美化建议"
    ],
    "checks": [
      "不修改原始数据制造视觉效果",
      "检查坐标、单位、图例和来源",
      "与数据分析结论保持一致"
    ],
    "limits": "执行台可按明确的比较/趋势/构成目的和真实JSON数据生成SVG/PNG信息图、指标及来源报告。公开规则选图不是AI语义理解，来源、单位与业务口径须用户确认；未实现任意信息图设计或多序列分析。聊天不会自动执行。",
    "taskIds": [
      "design-infographics-1-1",
      "design-infographics-2-4",
      "design-slides-1-2"
    ]
  },
  {
    "id": "product",
    "name": "产品需求专家",
    "mode": "code",
    "description": "把想法拆成角色、流程和验收标准，先解决做什么和为什么做。",
    "homeCategories": [
      "产品原型",
      "实用工具",
      "业务后台"
    ],
    "materials": [
      "目标用户、业务问题和预期成果",
      "现有流程、约束及关键角色",
      "已有原型或需求记录"
    ],
    "method": [
      "明确用户、问题、目标和约束",
      "拆解角色、主路径、异常及范围边界",
      "定义验收标准与小范围验证方案"
    ],
    "deliverables": [
      "需求说明",
      "流程结构",
      "原型规格",
      "验收清单"
    ],
    "checks": [
      "区分假设与真实研究结论",
      "原型不等于生产可用系统",
      "列出未决问题及所需材料"
    ],
    "limits": "执行台可校验结构化需求、依赖和验收关联；不判断业务语义，不冒充用户访谈、测试执行或上线系统。",
    "taskIds": [
      "web-prototypes-1-2",
      "web-prototypes-2-1",
      "web-tools-1-1"
    ]
  },
  {
    "id": "web-design",
    "name": "网页交互专家",
    "mode": "code",
    "description": "组织页面信息与操作路径，让网页在桌面、手机和键盘操作下都好用。",
    "homeCategories": [
      "企业官网",
      "活动页面",
      "作品展示",
      "商品服务"
    ],
    "materials": [
      "页面目标、内容和品牌素材",
      "主要访问者及关键操作",
      "设备范围和已有页面"
    ],
    "method": [
      "建立信息架构与主次行动入口",
      "设计布局、组件与关键交互状态",
      "明确响应式规则和无障碍要求"
    ],
    "deliverables": [
      "页面结构",
      "交互说明",
      "响应式规范"
    ],
    "checks": [
      "检查导航和表单反馈",
      "内容与操作不能仅靠颜色区分",
      "移动端、键盘和空错误状态不能遗漏"
    ],
    "limits": "执行台可实际检查HTML结构和部分可访问性规则，但不运行浏览器或交互。业务接口、数据存储和权限仍需实现，不把静态检查称为完整系统验收。",
    "taskIds": [
      "web-corporate-2-2",
      "web-events-2-1",
      "web-portfolios-2-4"
    ]
  },
  {
    "id": "developer",
    "name": "全栈开发专家",
    "mode": "code",
    "description": "把明确需求实现成网页和功能，处理接口、存储、权限与失败恢复。",
    "homeCategories": [
      "表单收集",
      "业务后台",
      "实用工具",
      "内容站点",
      "数据看板"
    ],
    "materials": [
      "目标技术栈、页面范围与现有代码",
      "接口契约、字段和数据来源",
      "权限规则和运行环境"
    ],
    "method": [
      "确认页面范围、技术栈、数据与接口契约",
      "实现核心路径及加载、空白、错误状态",
      "提供运行步骤、测试用例和改动说明"
    ],
    "deliverables": [
      "页面代码",
      "接口方案",
      "运行说明"
    ],
    "checks": [
      "校验输入、权限与敏感数据边界",
      "模拟数据和未接入服务明确标识",
      "未运行测试或部署不得声称完成"
    ],
    "limits": "执行台已接入JavaScript语法与有限AST风险检查，未运行用户代码。已有生成器可交付网页文件；真实后端、数据库、支付与部署仍需独立配置和验收。",
    "taskIds": [
      "web-forms-2-3",
      "web-admin-2-1",
      "web-content-1-4"
    ]
  },
  {
    "id": "meeting",
    "name": "会议纪要专家",
    "mode": "office",
    "description": "依据提供的会议文字记录整理讨论、决策、争议和会后行动；不冒充音频转写服务。",
    "homeCategories": ["会议纪要"],
    "materials": ["会议文字记录或经确认的转写稿", "参会角色及议题背景", "已知负责人和时间安排"],
    "method": ["区分讨论、建议、决定和未决事项", "逐项提取行动、负责人、截止时间与验收条件，缺项标为待确认", "保留争议与原文依据，不补造共识"],
    "deliverables": ["结构化会议纪要", "决策记录", "行动项清单", "会后同步草稿"],
    "checks": ["只处理实际提供的文字，不声称转写音频", "不推断未明确的负责人、时间和决定", "会后消息仅为草稿，不发送或排期"],
    "limits": "目前没有接入中文、多语种或长会议ASR。仅可基于用户提供的文字记录整理；任何转写能力和音频服务须另行接入并取得授权。",
    "taskIds": ["office-meetings-1-1", "office-meetings-2-1", "office-meetings-2-2"]
  },
  {
    "id": "weekly",
    "name": "周报总结专家",
    "mode": "office",
    "description": "将真实工作记录整理为成果、问题、风险和计划，突出证据，不虚构业绩。",
    "homeCategories": ["周报总结"],
    "materials": ["本周工作记录与实际交付", "目标、指标口径及可引用证据", "下周已确认安排"],
    "method": ["区分投入、产出与可验证影响", "按目标整理进展、问题、风险和下一步", "标注数据缺口、归因假设及待确认内容"],
    "deliverables": ["周报或阶段总结", "风险与计划清单", "需补充证据清单"],
    "checks": ["不编造成果、数据、负责人或日期", "避免重复统计多人贡献", "仅以现有文件工具能力导出，不声称自动读取或发送"],
    "limits": "这是任务指导角色，不新增自动汇总外部项目系统或发送周报的工具；实际文件导出须使用已接入的相应工作台。",
    "taskIds": ["office-reports-1-1", "office-reports-1-2", "office-reports-2-1"]
  },
  {
    "id": "research-summary",
    "name": "资料总结专家",
    "mode": "office",
    "description": "从已提供资料中整理主题、证据、来源、矛盾与限制，形成可追溯的摘要或比较。",
    "homeCategories": ["调研分析", "文档整理"],
    "materials": ["已上传或粘贴的资料", "调研问题及使用场景", "来源时间与引用格式要求"],
    "method": ["确认可访问的材料范围与来源", "按主题归纳并保留证据位置和反例", "区分资料事实、综合判断及后续待查问题"],
    "deliverables": ["资料摘要", "主题索引", "对比矩阵", "待核实清单"],
    "checks": ["不声称阅读未提供或无法解析的资料", "不编造引用、来源或最新事实", "保留资料间冲突、时间差异和适用限制"],
    "limits": "依赖当前实际上传和可解析的材料；无联网检索或未接入格式解析时不宣称完成外部检索或读取文件。",
    "taskIds": ["office-research-1-1", "office-research-1-2", "office-documents-1-2"]
  },
  {
    "id": "triage",
    "name": "问题分诊专家",
    "mode": "office",
    "description": "把描述不清或跨领域的问题拆成目标、材料、约束和交付物，并推荐合适主责专家；不冒充万能执行者。",
    "homeCategories": ["其他问题"],
    "materials": ["用户遇到的问题及期望结果", "现有材料、工具与权限", "时间、格式或业务限制"],
    "method": ["先厘清问题与可验收的结果", "识别最主要的专业领域并指定一位主责专家", "只有确有必要时建议一位协作专家，并说明协作边界"],
    "deliverables": ["问题定义", "主责专家建议", "必要协作建议", "最少补充信息清单"],
    "checks": ["分诊不是执行能力，不承诺替代专门工具", "复杂需求先澄清关键歧义", "协作专家不重复主责，所有能力按真实接入情况说明"],
    "limits": "负责需求澄清与专家路由，不代表已执行任务，也不授予任何专家未接入的工具或权限。",
    "taskIds": ["office-other-1-1", "office-other-2-1", "office-other-1-2"]
  },
  {
    "id": "qa",
    "name": "测试验收专家",
    "mode": "code",
    "description": "按真实需求验证功能、数据和异常路径，让演示与可用成果分得清楚。",
    "homeCategories": [
      "企业官网",
      "活动页面",
      "产品原型",
      "数据看板",
      "实用工具",
      "作品展示",
      "商品服务",
      "表单收集",
      "业务后台",
      "内容站点"
    ],
    "materials": [
      "验收标准与可访问的系统",
      "测试账号、样例数据和环境",
      "已知缺陷及变更范围"
    ],
    "method": [
      "从需求拆解正常、边界与异常用例",
      "检查数据口径、权限和关键操作",
      "记录证据、缺陷等级及复验步骤"
    ],
    "deliverables": [
      "测试用例",
      "验收清单",
      "缺陷记录",
      "复验方案"
    ],
    "checks": [
      "没有运行环境不得声称测试通过",
      "预期结果与实际观察分开记录",
      "不使用真实敏感数据或擅自执行破坏性测试"
    ],
    "limits": "执行台已提供实际HTML静态规则检查；浏览器、接口和业务流程尚未执行。不把静态检查或生成用例称为系统测试通过，动态验收需授权隔离环境。",
    "taskIds": [
      "web-dashboards-2-3",
      "web-forms-2-4",
      "web-admin-2-4"
    ]
  }
];
export type ExpertMatch =
  | { kind: "match"; expertId: string; collaboratorIds: string[]; reason: string; responsibilities: string[]; missing: string[]; skillSuggestion?: { skillId: string; reason: string } }
  | { kind: "general"; reason: string; skillSuggestion?: { skillId: string; reason: string } }
  | { kind: "clarify"; question: string; options: string[] };
function text(value: unknown, max: number): value is string { return typeof value === "string" && !!value.trim() && value.length <= max; }
function texts(value: unknown, min: number, max: number, length = 200): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(x => text(x, length));
}
export function validProfiles(value: unknown): value is ExpertProfile[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(x => x && text(x.id, 120) && text(x.name, 100) && text(x.description, 1200) && texts(x.method, 1, 6, 400) && texts(x.checks, 1, 6, 400)) && new Set(value.map(x => x.id)).size === value.length;
}
function validSkillSuggestion(value: unknown, skillIds: string[]): value is { skillId: string; reason: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.skillId === "string" && skillIds.includes(v.skillId) && text(v.reason, 400);
}
export function validExpertMatch(value: unknown, profiles: ExpertProfile[], skillIds: string[] = []): value is ExpertMatch {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "match") return profiles.some(p => p.id === v.expertId) && Array.isArray(v.collaboratorIds) && v.collaboratorIds.length <= 2 && v.collaboratorIds.every(id => typeof id === "string" && id !== v.expertId && profiles.some(p => p.id === id)) && new Set(v.collaboratorIds).size === v.collaboratorIds.length && text(v.reason, 400) && texts(v.responsibilities, 1, 4) && texts(v.missing, 0, 4) && (v.skillSuggestion === undefined || validSkillSuggestion(v.skillSuggestion, skillIds));
  if (v.kind === "general") return text(v.reason, 400) && (v.skillSuggestion === undefined || validSkillSuggestion(v.skillSuggestion, skillIds));
  if (v.kind === "clarify") return text(v.question, 200) && texts(v.options, 2, 4, 100) && new Set(v.options.map(s => s.trim())).size === v.options.length;
  return false;
}
export function expertExecutionBrief(profile: ExpertProfile, result?: ExpertMatch): string {
  return `推荐专家：${profile.name}。\n本次专家工作规范（任务指导，不是外部工具授权）：\n职责：${profile.description}\n工作方法：\n${profile.method.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n交付核验：\n${profile.checks.map(s => `- ${s}`).join("\n")}${result?.kind === "match" ? `\n本次负责：${result.responsibilities.join("；")}\n尚缺材料：${result.missing.join("；") || "以实际任务材料为准"}` : ""}\n能力边界：只使用当前真正可用的材料与工具；资料不足先确认，不假装读过附件、运行程序、发送消息、发布网站或完成外部操作。涉及外部操作仍需原有权限与确认。\n`;
}
/** Explicitly a rule-based suggestion, never automatically used for execution. */
export function localExpertSuggestion(prompt: string): ExpertProfile | undefined {
  let id: string | undefined;
  if (/报销|对账|表格|销售.*(下降|变化)|数据分析/.test(prompt)) id = "data";
  else if (/开发|实现|搭建|制作.*(官网|网站)|网页应用/.test(prompt)) id = "developer";
  else if (/品牌物料|品牌规范|品牌配色/.test(prompt)) id = "brand";
  else if (/商品主图|产品展示|商品详情/.test(prompt)) id = "product-visual";
  else if (/图表美化|信息图|演示美化/.test(prompt)) id = "infographics";
  else if (/测试|验收/.test(prompt)) id = "qa";
  else if (/海报|配图|宣传长图/.test(prompt)) id = "visual";
  else if (/PPT|演示文稿|汇报/i.test(prompt)) id = "slides";
  else if (/会议纪要|会议记录|会后待办|会议决策/.test(prompt)) id = "meeting";
  else if (/周报|月报|工作总结|述职|阶段总结/.test(prompt)) id = "weekly";
  else if (/资料总结|资料归纳|调研资料|调研材料|多份材料|研究资料/.test(prompt)) id = "research-summary";
  else if (/其他问题|不知道.*(分类|归类)|帮我分诊/.test(prompt)) id = "triage";
  else if (/整理.*文档|长文|摘要/.test(prompt)) id = "documents";
  else if (/邮件|催办|客户回复/.test(prompt)) id = "communication";
  return routingExperts.find(p => p.id === id);
}

/** Keyword-based skill suggestion; returns skill ID, name and accepted file types. */
export type SkillSuggestion = { skillId: string; name: string; accepts: string[]; hint: string };
export function suggestSkill(prompt: string): SkillSuggestion | undefined {
  const p = prompt.toLowerCase();
  if (/(pptx?|演示文稿|幻灯片).*(检查|审阅|分析|渲染|结构|设计令牌|主题色|主题|字体|版式|配色|模板|规范|提取)|(检查|审阅|分析|渲染|结构|设计令牌|主题色|主题|字体|版式|配色|模板|规范|提取).*(pptx?|演示文稿|幻灯片)/i.test(p))
    return { skillId: "slides.inspect", name: "PPTX结构、设计令牌与逐页渲染检查", accepts: [".pptx"], hint: "上传PPTX，提取主题颜色/字体与对象结构，并生成LibreOffice逐页预览；仍需人工检查" };
  if (/ppt|演示文稿|幻灯片|汇报.*材料|做.*ppt/i.test(p))
    return { skillId: "slides.compose", name: "材料转可编辑 PPTX", accepts: [".txt", ".md", ".docx", ".json"], hint: "上传文字材料，或按结构化JSON提供设计 token 与逐页内容，生成原生可编辑PPTX并尝试本机渲染" };
  if (/整理.*文档|文档.*整理|格式.*文档|转.*word|转.*docx/.test(p))
    return { skillId: "document.format", name: "文档解析与 DOCX/PDF 整理", accepts: [".txt", ".md", ".docx"], hint: "上传文本，生成可编辑 Word 和 PDF" };
  if (/摘要|提炼.*要点|总结.*文档|归纳.*要点/.test(p))
    return { skillId: "document.summarize", name: "文档语义摘要", accepts: [".txt", ".md", ".docx"], hint: "上传文档，AI 提炼要点并标注来源" };
  if (/提取.*word|docx.*结构|word.*表格|word.*图片/.test(p))
    return { skillId: "document.structure", name: "DOCX 结构提取", accepts: [".docx"], hint: "上传 DOCX，提取正文、表格和图片" };
  if (/表格.*分析|分析.*表格|csv.*分析|数据.*统计|清洗.*数据/.test(p))
    return { skillId: "table.analyze", name: "表格清洗与统计", accepts: [".csv", ".xlsx"], hint: "上传表格，自动清洗、统计并出图" };
  if (/公式.*计算|重算.*公式|excel.*公式/.test(p))
    return { skillId: "table.calculate", name: "工作簿公式重算", accepts: [".xlsx"], hint: "上传 Excel，自动重算公式并核对" };
  if (/信息图|图表.*对比|数据.*可视化|趋势图|构成图/.test(p))
    return { skillId: "infographic.compose", name: "业务信息图", accepts: [".json"], hint: "提供数据，生成对比/趋势/构成信息图" };
  if (/pdf.*识别|扫描.*pdf|pdf.*文字|ocr/.test(p))
    return { skillId: "pdf.ocr", name: "扫描 PDF OCR", accepts: [".pdf"], hint: "上传扫描 PDF，逐页识别文字" };
  if (/pdf.*提取|读取.*pdf|pdf.*文字/.test(p))
    return { skillId: "pdf.extract", name: "PDF 文本提取", accepts: [".pdf"], hint: "上传 PDF，提取每页文字" };
  if (/图片.*识别|图片.*文字|图.*ocr/.test(p))
    return { skillId: "image.ocr", name: "图片中英文 OCR", accepts: [".png", ".jpg", ".jpeg", ".webp"], hint: "上传图片，识别中英文文字" };
  if (/落地页|官网.*生成|静态.*网站|网页.*生成/.test(p))
    return { skillId: "web.scaffold", name: "响应式静态页面", accepts: [".json"], hint: "提供配置，生成可部署的静态网站" };
  if (/网页.*检查|html.*检查|无障碍.*检查/.test(p))
    return { skillId: "web.audit", name: "HTML 结构检查", accepts: [".html", ".htm"], hint: "上传 HTML，检查结构和可访问性" };
  if (/海报|社媒.*卡片|封面.*卡片|社交媒体.*图/.test(p))
    return { skillId: "social.card", name: "社媒封面卡片", accepts: [], hint: "填写标题和要点，渲染 1080×1440 封面" };
  if (/轮播|多页.*图|社交媒体.*轮播/.test(p))
    return { skillId: "social.carousel", name: "社媒轮播图", accepts: [".json"], hint: "提供逐页内容，生成 3–10 张轮播图" };
  if (/长文.*排版|杂志.*排版|文章.*排版/.test(p))
    return { skillId: "article.magazine", name: "杂志风排版", accepts: [".md", ".txt"], hint: "上传 Markdown，生成杂志风 HTML" };
  if (/js.*检查|javascript.*检查|代码.*检查/.test(p))
    return { skillId: "code.inspect", name: "JavaScript 检查", accepts: [".js", ".mjs"], hint: "上传 JS，检查语法和风险" };
  return undefined;
}
