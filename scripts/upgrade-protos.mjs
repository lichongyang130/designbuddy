import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/shared.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Remove existing proto-*-gen
content = content.replace(/\{\s*id:\s*"proto-\d+-gen"[\s\S]*?\},/g, '');

const domains = [
  { name: 'SaaS 与管理后台', titles: ['Nexus Admin', 'Pulse Analytics', 'CRM Pro', 'TeamSync', 'CloudDash'], desc: '包含仪表盘、数据表格、权限管理等核心SaaS流程' },
  { name: '电商与零售', titles: ['Wristy Store', 'Vogue Fashion', 'TechGadget', 'FreshMart', 'LuxeHome'], desc: '包含商品列表、详情页、购物车、结算与支付流程' },
  { name: '金融与数据', titles: ['Cascade Bank', 'CoinVest', 'BudgetTracker', 'WealthDash', 'CryptoEx'], desc: '包含财务总览、交易记录、K线图表与转账流程' },
  { name: 'AI 与效率', titles: ['NextDocs AI', 'Emerald Agent', 'ChatFlow', 'GenArt Studio', 'CodeCopilot'], desc: '包含对话界面、提示词输入、结果生成与历史记录' },
  { name: '教育与内容', titles: ['EduLearn', 'SkillShare', 'ReadSpace', 'CreatorHub', 'VideoCast'], desc: '包含课程大纲、视频播放、图文阅读与评论互动' },
  { name: '生活与预订', titles: ['HotelBook', 'TableRes', 'EventTix', 'CleanHome', 'CityGuide'], desc: '包含搜索筛选、地图定位、日期选择与订单确认' }
];

const generated = [];
let counter = 1;
for (let d = 0; d < domains.length; d++) {
  const domain = domains[d];
  for (let i = 0; i < 5; i++) {
    const id = `proto-${counter}-gen`;
    const title = domain.titles[i];
    const photosCode = `Array.from({ length: 8 }, (_, i) => ({
      url: \`https://picsum.photos/seed/\${"${id}-" + i}/1200/800\`,
      label: \`${title} - \${['首页/总览', '列表/发现', '详情/主工作区', '表单/设置', '弹窗/模态框', '状态/反馈', '空状态', '加载中'][i % 8]}\`,
      credit: 'DesignBuddy Studio',
      license: 'PRO License',
      source: '${domain.name}'
    }))`;

    generated.push(`  {
    id: "${id}" as const,
    category: "原型",
    title: "${title} · ${domain.name}",
    description: "8 个核心交互页面 · ${domain.desc}",
    format: "商业交互原型",
    photos: ${photosCode},
  }`);
    counter++;
  }
}

// Ensure clean comma structure
content = content.replace(
  /];\nexport type DraftRecord = \{/,
  ',\n' + generated.join(',\n') + '\n];\nexport type DraftRecord = {'
);

fs.writeFileSync(file, content, 'utf-8');
