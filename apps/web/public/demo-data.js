// 演示数据（示例内容，不对应真实插件或服务）
// 只用于界面样张；真实数据来自 plugins.rows / presets.list / tools.list。
// 线上接入后应整份替换或删除。

export const EX_CATEGORIES = [
  { name: '电商运营', icon: 'cart', tone: 'c-violet', items: ['中国电商运营专家', '商家宣传页与海报设计师', '跨境电商专家'] },
  { name: '内容创作', icon: 'pen', tone: 'c-green', items: ['内容创作专家团', '内容创作专家', '微信公众号运营专家'] },
  { name: '投资分析', icon: 'trend', tone: 'c-blue', items: ['交易分析团队', '股票研究专家', '腾讯自选股股票投研专家团'] },
  { name: '法律咨询', icon: 'scale', tone: 'c-slate', items: ['法律检索专家', '资深合同法务专家', '财税合规专家团'] },
  { name: '小微企业', icon: 'storefront', tone: 'c-mint', items: ['销售教练', '微信公众号运营专家', '创业伙伴'] },
  { name: '数据分析', icon: 'barchart', tone: 'c-sky', items: ['数据分析报告师', '深度研究团队', '花叔数据分析专家团'] },
]

export const EX_DEMO = [
  { name: '高级开发工程师', desc: '10 年以上全栈经验，精通多种技术栈与工程实践。', tags: ['全栈开发', '架构设计', '代码质量'], stat: '1958.65w', weight: 19586500, cats: ['技术工程'] },
  { name: '全栈开发专家', desc: '全栈开发专家，精通前后端架构与接口集成。', tags: ['全栈开发', '后端架构', '接口集成'], stat: '162.78w', weight: 1627800, cats: ['技术工程'] },
  { name: '资深全栈开发工程师', desc: '精通全栈开发全生命周期，覆盖部署与运维。', tags: ['后端开发', '前端开发', '部署运维'], stat: '52.27w', weight: 522700, cats: ['技术工程'] },
  { name: '微信小程序开发专家', desc: '精通微信小程序原生开发框架与云开发。', tags: ['小程序开发', '微信生态', '云开发'], stat: '75.3w', weight: 753000, cats: ['技术工程'], badge: '招募' },
  { name: 'Godot 游戏脚本工程师', desc: '精通 GDScript 2.0 和 Godot 4 的游戏逻辑实现。', tags: ['脚本工程', '游戏逻辑', 'GDScript'], stat: '108.48w', weight: 1084800, cats: ['游戏空间'] },
  { name: 'Python 全栈工程师', desc: '开发 Python 后端、数据分析与自动化脚本。', tags: ['后端开发', '数据与 AI 工程'], stat: '77.85w', weight: 778500, cats: ['技术工程', '数据智能'] },
  { name: '职业机会搜索助手', desc: '通过建议深化求职意图，联动岗位与人岗匹配。', tags: ['职业搜索', '人岗匹配', '定时订阅'], stat: '8,663', weight: 8663, cats: ['运营人力'] },
  { name: '嵌入式单片机老工程师', desc: '十年嵌入式老工程师，覆盖入门到 RTOS 实践。', tags: ['嵌入式学习', '单片机入门', 'RTOS'], stat: '12.89w', weight: 128900, cats: ['技术工程'] },
  { name: '创业伙伴', desc: '林老师分身 + 读书伙伴，覆盖创业判断与 GTM。', tags: ['创业判断', 'GTM 落地', '客户心法'], stat: '23.38w', weight: 233800, cats: ['销售商务'] },
  { name: '工作台搭建师', desc: '为不同人群定制专属数字工作台与响应式网页。', tags: ['工作台搭建', '响应式网页'], stat: '839w', weight: 8390000, cats: ['产品设计'] },
]

export const EX_CHIPS = ['全部', 'OPC·一人公司', '腾讯专家', '双十一', '产品设计', '技术工程', '金融投资', '全球发展',
  '教育学习', '游戏空间', '数据智能', '营销增长', '内容创作', '销售商务', '运营人力', '健康医疗', '法务安全',
  '项目质量', '行业顾问']

export const SKILL_FEATURED = [
  { name: '腾讯ima', desc: 'ima 笔记与知识库管理（读取/写入）', use: '33.95w', install: '53.16w', hue: 210 },
  { name: '腾讯文档 PDFKit', desc: 'PDF 全能工具箱，覆盖阅读与拆分', use: '40.65w', install: '26.99w', hue: 6 },
  { name: '企业微信套件', desc: '企业微信官方 CLI 套件，覆盖消息与日程', use: '38.53w', install: '21.1w', hue: 205 },
  { name: '腾讯自选股-金融数据', desc: '由腾讯自选股团队提供，查询行情与财报', use: '27.14w', install: '15.85w', hue: 350 },
  { name: '腾讯乐享', desc: '支持多源导入、多模态问答', use: '8.76w', install: '5.88w', hue: 195 },
]

export const SKILL_GRID = [
  { name: 'AI交付前全自动自检', desc: '自动检查交付物的完整性与一致性', use: '128.45w', install: '20.46w', cats: ['开发工具'], hue: 220 },
  { name: 'NeoData金融搜索服务', desc: '自然语言查询股票、基金、宏观数据', use: '355.86w', install: '15.04w', cats: ['投资理财'], hue: 225 },
  { name: 'Word 文档处理', desc: '创建、读取、编辑、排版、审阅', use: '615.96w', install: '24.93w', cats: ['办公协同'], hue: 150 },
  { name: 'Excel 表格处理', desc: '创建、编辑、分析 Excel 表格', use: '448.24w', install: '63.47w', cats: ['办公协同'], hue: 145 },
  { name: 'Web Access（浏览器）', desc: 'CDP 直连本地 Chrome，智能浏览', use: '69.35w', install: '22.02w', cats: ['开发工具'], hue: 215 },
  { name: 'PDF 文档处理', desc: 'PDF 文档处理工具，支持文本与表格', use: '322.88w', install: '42.17w', cats: ['办公协同'], hue: 140 },
  { name: 'MiniMax H3 提示词顾问', desc: '为 T2VA、I2VA、FL2VA 优化提示词', use: '12.13w', install: '7.01w', cats: ['效率工具'], hue: 350 },
  { name: 'MarkItDown', desc: '文档转 Markdown（PDF / Word / PPT）', use: '38.49w', install: '28.54w', cats: ['办公协同'], hue: 30 },
  { name: '技能创建指南', desc: '创建和维护自定义技能的指南', use: '425.1w', install: '11.09w', cats: ['知识与学习'], hue: 340 },
  { name: 'grill-me', desc: '深度追问式方案审查：逐层拆解', use: '20.19w', install: '12.07w', cats: ['商业运营'], hue: 100 },
  { name: 'Word 文档创作与美化', desc: '专业 Word 文档（.docx）创作与美化', use: '380.69w', install: '2.69w', cats: ['办公协同'], hue: 145 },
  { name: '法条速查', desc: '查法条原文、核对引用、看清效力', use: '11.78w', install: '1.04w', cats: ['知识与学习'], hue: 225 },
  { name: '企业微信套件', desc: '企业微信官方 CLI 套件', use: '38.53w', install: '21.1w', cats: ['办公协同'], hue: 205 },
  { name: '系统化问题定位', desc: '用可复现证据定位问题根因', use: '4w', install: '1.57w', cats: ['开发工具'], hue: 160 },
  { name: '腾讯自选股-金融数据', desc: '由腾讯自选股团队提供，查询行情', use: '27.14w', install: '15.85w', cats: ['投资理财'], hue: 350 },
  { name: '钉钉套件', desc: '钉钉 CLI 套件，覆盖消息与日程', use: '16.17w', install: '11.94w', cats: ['办公协同'], hue: 210 },
  { name: 'Excel 文件处理', desc: 'Excel 文件创建与分析', use: '43.68w', install: '56.8w', cats: ['办公协同'], hue: 145 },
  { name: 'Karpathy行为准则', desc: '减少 LLM 编码常见错误的行为准则', use: '2.29w', install: '1.91w', cats: ['知识与学习'], hue: 265 },
  { name: '金山文档WPS云文档', desc: '金山文档官方 Skill。对话即操作', use: '31.78w', install: '25.41w', cats: ['办公协同'], hue: 210 },
  { name: 'BrowserSkill', desc: '腾讯开源的一体化浏览器 Skill', use: '20.83w', install: '11.66w', cats: ['开发工具'], hue: 25 },
]

export const SK_CHIPS = ['全部', 'OPC·一人公司', '办公协同', '双十一', '开发工具', '投资理财', '效率工具',
  '内容创作', '信息资讯', '教育学习', '数据分析', '网站部署', '生活服务', '商业运营', '知识与学习', '健康医疗']

export const CN_CONNECTORS = [
  { name: '通达信', desc: '通过通达信 MCP 查询全球股票行情', hue: 350 },
  { name: '腾讯自选股', desc: '直连腾讯自选股，实时掌握毫秒级行情', hue: 10 },
  { name: 'QQ邮箱', desc: '收发、搜索和整理 QQ 邮件。', hue: 45 },
  { name: 'ima', desc: '腾讯 AI 知识管家，连接后支持知识库问答', hue: 120 },
  { name: '乐享知识库', desc: '搜索、创建和管理乐享知识库内容', hue: 150 },
  { name: '腾讯文档', desc: '创建、编辑和协作腾讯文档。', hue: 210 },
  { name: '腾讯会议', desc: '通过命令行创建、查询和管理会议', hue: 205 },
  { name: '企业微信', desc: '企业微信官方 CLI 套件，覆盖消息与日程', hue: 200 },
  { name: '飞书', desc: '通过命令行管理飞书 / Lark 全量能力', hue: 190 },
  { name: '钉钉', desc: '通过命令行管理钉钉全产品能力', hue: 215 },
  { name: '腾讯问卷', desc: '创建、管理和分析腾讯问卷。', hue: 140 },
  { name: 'TAPD', desc: '管理需求、缺陷、任务和迭代', hue: 200 },
  { name: '腾讯金融科技NeoData', desc: '由腾讯金融科技链接各大权威数据源', hue: 225 },
  { name: 'CNB', desc: '通过自然语言管理 CNB 平台资源', hue: 15 },
  { name: '微云', desc: '查看、下载、删除微云文件', hue: 205 },
  { name: '福帮手', desc: '福帮手连接器：保留身份、场景与权限', hue: 205 },
  { name: '金山文档WPS云文档', desc: '金山文档官方 Skill。对话即操作', hue: 210 },
  { name: '北大法宝·法律智能检索', desc: '检索 + 核验一体：语义与法条双向定位', hue: 355 },
  { name: '企查查', desc: '一次连接，查询企业工商与股东信息', hue: 210 },
  { name: '天眼查', desc: '通过天眼查 MCP 查询多维度企业数据', hue: 205 },
  { name: '百度网盘', desc: '连接百度网盘，支持文件与分享管理', hue: 205 },
  { name: 'Tushare', desc: 'Tushare 金融数据服务，支持行情与财报', hue: 35 },
  { name: 'OpenBoost 跨境数据', desc: '支持市场研究、选品分析、竞品监测', hue: 20 },
  { name: '邓白氏查全球', desc: '通过自然语言查询邓白氏全球企业数据', hue: 215 },
  { name: '新华财经资讯MCP', desc: '公告、新闻、政策数据，包含全文检索', hue: 215 },
  { name: 'GitHub', desc: '在 GitHub 上克隆、推送代码、管理 PR', hue: 0 },
  { name: 'Notion', desc: '创建、搜索和管理 Notion 工作区', hue: 0 },
  { name: '腾讯企点客服', desc: '腾讯企点客服连接器：用自然语言管理会话', hue: 150 },
  { name: 'EdgeOne Makers', desc: '将项目部署到 EdgeOne Makers', hue: 205 },
  { name: '腾讯云 CloudBase', desc: '腾讯云开发 CloudBase 全栈能力', hue: 150 },
  { name: 'Bugly 质量概览', desc: '查看产品的质量概览，包括崩溃与 ANR', hue: 215 },
  { name: '销售易CRM', desc: '用自然语言查客户、推商机、跟进任务', hue: 215 },
  { name: '小鹅通', desc: '用自然语言管理小鹅通店铺与课程', hue: 205 },
  { name: '华宇元典法律数据', desc: '华宇元典法律数据为智能体提供法规检索', hue: 190 },
  { name: '微盛企微管家SCRM', desc: '查询或管理企业微信中的客户与标签', hue: 240 },
  { name: '中兴新云AI智报', desc: '财务云 AI 报销助手：用自然语言提交报销', hue: 215 },
  { name: '腾讯营销投放', desc: '腾讯营销投放 Skill，为大模型提供投放能力', hue: 215 },
  { name: '恒生聚源 MCP', desc: '连接恒生聚源 MCP，查询金融数据', hue: 195 },
  { name: '腾讯地图', desc: '接入腾讯地图各类位置服务', hue: 210 },
  { name: '启信慧眼', desc: '通过启信慧眼 MCP 接入企业风险数据', hue: 215 },
]
