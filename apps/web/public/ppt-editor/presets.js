/**
 * WPS 级演示文稿预设库：
 * - 12 套专业配色主题
 * - 6 组字体方案
 * - 15 种页面版式模板
 * - 24 种几何图形 / 箭头 / 流程图形状与矢量渲染器
 * - 8 种「+ 添加版块」高频复合组件
 * - 32 枚内置可改色 SVG 矢量图标
 * - 6 种页面切换 & 8 种元素出场/强调/退出动画
 */

export const WPS_THEMES = [
  {
    id: 'paper-minimal',
    name: '纸白极简',
    paper: '#FBFAF6',
    ink: '#141412',
    accent: '#1F4FFF',
    second: '#9A6A2F',
    muted: '#6D6A63',
    rule: '#E2DED4',
    body: '#33312C',
    card: '#F3F1EA',
    display: 'serif',
  },
  {
    id: 'deep-space',
    name: '深空科技',
    paper: '#0B1220',
    ink: '#EEF4FF',
    accent: '#5B96FF',
    second: '#25D0E6',
    muted: '#8598BA',
    rule: '#1E2D47',
    body: '#C6D4EA',
    card: '#121D33',
    display: 'sans',
  },
  {
    id: 'slate-biz',
    name: '石板商务',
    paper: '#F6F8FC',
    ink: '#0F1F38',
    accent: '#1F4BD8',
    second: '#0F766E',
    muted: '#5D6B80',
    rule: '#DBE3EF',
    body: '#39424F',
    card: '#FFFFFF',
    display: 'sans',
  },
  {
    id: 'warm-pitch',
    name: '暖橙路演',
    paper: '#FFFCF6',
    ink: '#1F1408',
    accent: '#D1451B',
    second: '#0E7C6B',
    muted: '#6F6153',
    rule: '#EFE2D2',
    body: '#3B3228',
    card: '#FFF5E8',
    display: 'sans',
  },
  {
    id: 'forest-eco',
    name: '墨绿生态',
    paper: '#F4F7F4',
    ink: '#12241B',
    accent: '#18794E',
    second: '#B4782C',
    muted: '#596D62',
    rule: '#D7E2DA',
    body: '#2C3E35',
    card: '#FFFFFF',
    display: 'sans',
  },
  {
    id: 'academic-blue',
    name: '学术深蓝',
    paper: '#FFFFFF',
    ink: '#111827',
    accent: '#1D4ED8',
    second: '#B91C1C',
    muted: '#6B7280',
    rule: '#E5E7EB',
    body: '#374151',
    card: '#F8FAFC',
    display: 'serif',
  },
  {
    id: 'cinnabar-edit',
    name: '朱砂人文',
    paper: '#F6F1E4',
    ink: '#24211C',
    accent: '#A8342A',
    second: '#31507E',
    muted: '#7D7566',
    rule: '#CFC4AC',
    body: '#3D3830',
    card: '#EFE8D6',
    display: 'serif',
  },
  {
    id: 'obsidian-gold',
    name: '曜石黑金',
    paper: '#121214',
    ink: '#F5F3EE',
    accent: '#D4A853',
    second: '#8B9BB4',
    muted: '#8E8B82',
    rule: '#2A2926',
    body: '#D1CEC7',
    card: '#1C1C20',
    display: 'serif',
  },
  {
    id: 'glacier-teal',
    name: '冰川青灰',
    paper: '#F3F8F9',
    ink: '#0E2428',
    accent: '#0891B2',
    second: '#4F46E5',
    muted: '#5B7379',
    rule: '#D5E5E8',
    body: '#2A4247',
    card: '#FFFFFF',
    display: 'sans',
  },
  {
    id: 'royal-violet',
    name: '绛紫创意',
    paper: '#FAF8FF',
    ink: '#1C142B',
    accent: '#6D28D9',
    second: '#DB2777',
    muted: '#6D6380',
    rule: '#E5DFF2',
    body: '#39304A',
    card: '#FFFFFF',
    display: 'sans',
  },
  {
    id: 'soft-apricot',
    name: '浅杏温和',
    paper: '#FDF8F3',
    ink: '#281E18',
    accent: '#B45309',
    second: '#3F6212',
    muted: '#78685E',
    rule: '#EADCD0',
    body: '#453830',
    card: '#FFFDFB',
    display: 'serif',
  },
  {
    id: 'midnight-cyan',
    name: '极夜霓虹',
    paper: '#090D16',
    ink: '#F8FAFC',
    accent: '#06B6D4',
    second: '#818CF8',
    muted: '#94A3B8',
    rule: '#1E293B',
    body: '#CBD5E1',
    card: '#111827',
    display: 'sans',
  },
]

export const WPS_FONT_PAIRS = [
  {
    id: 'sans-modern',
    name: '现代无衬线（苹方 / 思源黑体）',
    heading: "ui-sans-serif, system-ui, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
    body: "ui-sans-serif, system-ui, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
  },
  {
    id: 'serif-editorial',
    name: '刊物衬线（思源宋体 / Georgia）',
    heading: "Georgia, 'Songti SC', 'Noto Serif SC', 'STSong', serif",
    body: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    id: 'serif-classic',
    name: '全篇典雅衬线（宋体报告）',
    heading: "Georgia, 'Songti SC', 'Noto Serif SC', serif",
    body: "Georgia, 'Songti SC', 'Noto Serif SC', serif",
  },
  {
    id: 'biz-yahei',
    name: '政企汇报黑体（微软雅黑 / 苹方）',
    heading: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
    body: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
  },
  {
    id: 'tech-geo',
    name: '科技几何（Inter / SF Pro）',
    heading: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
  },
  {
    id: 'mono-geek',
    name: '技术架构等宽混排',
    heading: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'PingFang SC', monospace",
    body: "ui-sans-serif, system-ui, 'PingFang SC', sans-serif",
  },
]

export const WPS_LAYOUTS = [
  { k: 'cover', name: '封面页', desc: '主标题 + 副标题 + 主视觉构图' },
  { k: 'toc', name: '目录页', desc: '编号章节清单与导读' },
  { k: 'section', name: '章节过渡', desc: '大号章节编码 + 本章核心命题' },
  { k: 'columns', name: '三栏并列', desc: '三张并列要点卡片，适合痛点/能力/策略' },
  { k: 'stats', name: '关键指标', desc: '三大核心数字指标 + 口径说明' },
  { k: 'bars', name: '数据图表', desc: '内置可编辑数据对比图表页' },
  { k: 'steps', name: '四步流程', desc: '01–04 递进架构或实施步骤' },
  { k: 'timeline', name: '时间轴路线图', desc: '里程碑阶段与交付规划' },
  { k: 'compare', name: '左右对比', desc: '传统做法 vs 本方案结构化对照' },
  { k: 'table', name: '数据表格', desc: '结构化多列明细对比表' },
  { k: 'split', name: '左图右文', desc: '配图视觉 + 要点拆解分栏' },
  { k: 'metric', name: '大数冲击', desc: '超大单一核心指标强调' },
  { k: 'statement', name: '核心金句', desc: '居中/大字号核心判断与主张' },
  { k: 'quote', name: '客户证言', desc: '引言反馈 + 来源署名' },
  { k: 'end', name: '封底致谢', desc: '品牌徽标 + 行动号召与联系方式' },
  { k: 'blank', name: '空白画布', desc: '完全自由排版的干净页面' },
]

export const WPS_SHAPES = [
  { id: 'rect', name: '矩形', group: '基础' },
  { id: 'roundRect', name: '圆角矩形', group: '基础' },
  { id: 'pill', name: '胶囊形', group: '基础' },
  { id: 'ellipse', name: '圆形/椭圆', group: '基础' },
  { id: 'triangle', name: '等腰三角形', group: '基础' },
  { id: 'rightTriangle', name: '直角三角形', group: '基础' },
  { id: 'diamond', name: '菱形', group: '基础' },
  { id: 'parallelogram', name: '平行四边形', group: '基础' },
  { id: 'pentagon', name: '五边形', group: '基础' },
  { id: 'hexagon', name: '六边形', group: '基础' },
  { id: 'star5', name: '五角星', group: '基础' },
  { id: 'badge', name: '标签盾牌', group: '基础' },
  { id: 'line', name: '直线分隔', group: '线条箭头' },
  { id: 'arrowRight', name: '右向箭头', group: '线条箭头' },
  { id: 'arrowLeft', name: '左向箭头', group: '线条箭头' },
  { id: 'arrowUp', name: '上向箭头', group: '线条箭头' },
  { id: 'arrowDown', name: '下向箭头', group: '线条箭头' },
  { id: 'arrowBoth', name: '双向箭头', group: '线条箭头' },
  { id: 'chevron', name: '燕尾流程块', group: '线条箭头' },
  { id: 'flowStart', name: '流程：起止框', group: '流程图' },
  { id: 'flowProcess', name: '流程：处理框', group: '流程图' },
  { id: 'flowDecision', name: '流程：判断框', group: '流程图' },
  { id: 'flowDoc', name: '流程：文档框', group: '流程图' },
  { id: 'callout', name: '气泡标注框', group: '流程图' },
]

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/**
 * 渲染任意预设几何形状的自适应矢量 SVG 背景层（支持渐变、描边、虚线、圆角）
 */
export function renderShapeSvg(shapeId, w, h, style = {}, uid = 'sh') {
  const sw = Math.max(0, Number(style.strokeWidth) || 0)
  const stroke = sw > 0 && style.stroke ? style.stroke : 'none'
  const dash =
    style.strokeDash === 'dashed'
      ? `stroke-dasharray="${Math.max(6, sw * 4)} ${Math.max(4, sw * 2.5)}"`
      : style.strokeDash === 'dotted'
        ? `stroke-dasharray="${Math.max(2, sw)} ${Math.max(3, sw * 2)}"`
        : ''

  let defs = ''
  let fill = style.fill || 'transparent'
  if (style.fillGradient && style.fillGradient.from && style.fillGradient.to) {
    const gid = `grad-${uid}`
    const ang = Number(style.fillGradient.angle ?? 135)
    const rad = ((ang - 90) * Math.PI) / 180
    const x1 = Math.round(50 - Math.cos(rad) * 50)
    const y1 = Math.round(50 - Math.sin(rad) * 50)
    const x2 = Math.round(50 + Math.cos(rad) * 50)
    const y2 = Math.round(50 + Math.sin(rad) * 50)
    defs = `<defs><linearGradient id="${gid}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${escAttr(style.fillGradient.from)}"/><stop offset="100%" stop-color="${escAttr(style.fillGradient.to)}"/></linearGradient></defs>`
    fill = `url(#${gid})`
  }

  const W = Math.max(10, Number(w) || 120)
  const H = Math.max(4, Number(h) || 60)
  const pad = sw / 2
  const x0 = pad
  const y0 = pad
  const iw = Math.max(2, W - sw)
  const ih = Math.max(2, H - sw)
  const common = `fill="${escAttr(fill)}" stroke="${escAttr(stroke)}" stroke-width="${sw}" stroke-linejoin="round" ${dash}`

  let geom = ''
  switch (shapeId) {
    case 'line': {
      const lc = style.stroke || style.fill || '#17171B'
      const lw = Math.max(1.5, sw || Math.min(8, H))
      geom = `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="${escAttr(lc)}" stroke-width="${lw}" stroke-linecap="round" ${dash}/>`
      break
    }
    case 'ellipse':
    case 'circle':
      geom = `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${iw / 2}" ry="${ih / 2}" ${common}/>`
      break
    case 'pill':
    case 'flowStart': {
      const r = Math.min(iw, ih) / 2
      geom = `<rect x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${r}" ry="${r}" ${common}/>`
      break
    }
    case 'roundRect': {
      const r = Math.min(iw / 2, ih / 2, Number(style.radius ?? 14))
      geom = `<rect x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${r}" ry="${r}" ${common}/>`
      break
    }
    case 'triangle':
      geom = `<polygon points="${W / 2},${y0} ${x0 + iw},${y0 + ih} ${x0},${y0 + ih}" ${common}/>`
      break
    case 'rightTriangle':
      geom = `<polygon points="${x0},${y0} ${x0 + iw},${y0 + ih} ${x0},${y0 + ih}" ${common}/>`
      break
    case 'diamond':
    case 'flowDecision':
      geom = `<polygon points="${W / 2},${y0} ${x0 + iw},${H / 2} ${W / 2},${y0 + ih} ${x0},${H / 2}" ${common}/>`
      break
    case 'parallelogram': {
      const sk = Math.min(iw * 0.22, 36)
      geom = `<polygon points="${x0 + sk},${y0} ${x0 + iw},${y0} ${x0 + iw - sk},${y0 + ih} ${x0},${y0 + ih}" ${common}/>`
      break
    }
    case 'pentagon':
      geom = `<polygon points="${W * 0.5},${y0} ${x0 + iw},${H * 0.38} ${W * 0.81},${y0 + ih} ${W * 0.19},${y0 + ih} ${x0},${H * 0.38}" ${common}/>`
      break
    case 'hexagon': {
      const dx = Math.min(iw * 0.22, ih * 0.5)
      geom = `<polygon points="${x0 + dx},${y0} ${x0 + iw - dx},${y0} ${x0 + iw},${H / 2} ${x0 + iw - dx},${y0 + ih} ${x0 + dx},${y0 + ih} ${x0},${H / 2}" ${common}/>`
      break
    }
    case 'star5': {
      const cx = W / 2
      const cy = H / 2
      const rx = iw / 2
      const ry = ih / 2
      const pts = []
      for (let i = 0; i < 10; i += 1) {
        const rad = ((i * 36 - 90) * Math.PI) / 180
        const ratio = i % 2 === 0 ? 1 : 0.4
        pts.push(`${(cx + Math.cos(rad) * rx * ratio).toFixed(1)},${(cy + Math.sin(rad) * ry * ratio).toFixed(1)}`)
      }
      geom = `<polygon points="${pts.join(' ')}" ${common}/>`
      break
    }
    case 'badge': {
      const tip = Math.min(iw * 0.24, 34)
      geom = `<polygon points="${x0},${y0} ${x0 + iw - tip},${y0} ${x0 + iw},${H / 2} ${x0 + iw - tip},${y0 + ih} ${x0},${y0 + ih}" ${common}/>`
      break
    }
    case 'chevron': {
      const d = Math.min(iw * 0.22, 32)
      geom = `<polygon points="${x0},${y0} ${x0 + iw - d},${y0} ${x0 + iw},${H / 2} ${x0 + iw - d},${y0 + ih} ${x0},${y0 + ih} ${x0 + d},${H / 2}" ${common}/>`
      break
    }
    case 'arrowRight': {
      const head = Math.min(iw * 0.38, ih * 0.95)
      const sy = y0 + ih * 0.26
      const ey = y0 + ih * 0.74
      geom = `<polygon points="${x0},${sy} ${x0 + iw - head},${sy} ${x0 + iw - head},${y0} ${x0 + iw},${H / 2} ${x0 + iw - head},${y0 + ih} ${x0 + iw - head},${ey} ${x0},${ey}" ${common}/>`
      break
    }
    case 'arrowLeft': {
      const head = Math.min(iw * 0.38, ih * 0.95)
      const sy = y0 + ih * 0.26
      const ey = y0 + ih * 0.74
      geom = `<polygon points="${x0 + iw},${sy} ${x0 + head},${sy} ${x0 + head},${y0} ${x0},${H / 2} ${x0 + head},${y0 + ih} ${x0 + head},${ey} ${x0 + iw},${ey}" ${common}/>`
      break
    }
    case 'arrowUp': {
      const head = Math.min(ih * 0.38, iw * 0.95)
      const sx = x0 + iw * 0.26
      const ex = x0 + iw * 0.74
      geom = `<polygon points="${W / 2},${y0} ${x0 + iw},${y0 + head} ${ex},${y0 + head} ${ex},${y0 + ih} ${sx},${y0 + ih} ${sx},${y0 + head} ${x0},${y0 + head}" ${common}/>`
      break
    }
    case 'arrowDown': {
      const head = Math.min(ih * 0.38, iw * 0.95)
      const sx = x0 + iw * 0.26
      const ex = x0 + iw * 0.74
      geom = `<polygon points="${sx},${y0} ${ex},${y0} ${ex},${y0 + ih - head} ${x0 + iw},${y0 + ih - head} ${W / 2},${y0 + ih} ${x0},${y0 + ih - head} ${sx},${y0 + ih - head}" ${common}/>`
      break
    }
    case 'arrowBoth': {
      const head = Math.min(iw * 0.26, ih * 0.85)
      const sy = y0 + ih * 0.28
      const ey = y0 + ih * 0.72
      geom = `<polygon points="${x0},${H / 2} ${x0 + head},${y0} ${x0 + head},${sy} ${x0 + iw - head},${sy} ${x0 + iw - head},${y0} ${x0 + iw},${H / 2} ${x0 + iw - head},${y0 + ih} ${x0 + iw - head},${ey} ${x0 + head},${ey} ${x0 + head},${y0 + ih}" ${common}/>`
      break
    }
    case 'flowDoc': {
      const bh = y0 + ih * 0.84
      geom = `<path d="M ${x0} ${y0} H ${x0 + iw} V ${bh} Q ${x0 + iw * 0.75} ${y0 + ih * 1.04}, ${W / 2} ${bh} T ${x0} ${bh} Z" ${common}/>`
      break
    }
    case 'callout': {
      const r = Math.min(14, iw * 0.1, ih * 0.15)
      const bh = y0 + ih * 0.78
      geom = `<path d="M ${x0 + r} ${y0} H ${x0 + iw - r} Q ${x0 + iw} ${y0} ${x0 + iw} ${y0 + r} V ${bh - r} Q ${x0 + iw} ${bh} ${x0 + iw - r} ${bh} H ${x0 + iw * 0.38} L ${x0 + iw * 0.2} ${y0 + ih} L ${x0 + iw * 0.24} ${bh} H ${x0 + r} Q ${x0} ${bh} ${x0} ${bh - r} V ${y0 + r} Q ${x0} ${y0} ${x0 + r} ${y0} Z" ${common}/>`
      break
    }
    case 'rect':
    case 'flowProcess':
    default: {
      const r = Math.max(0, Number(style.radius ?? 0))
      geom = `<rect x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${r}" ry="${r}" ${common}/>`
      break
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="100%" style="display:block;overflow:visible">${defs}${geom}</svg>`
}

/**
 * 8 种「+ 添加版块」智能复合组件：一键往当前页插入排版精美的组合块
 */
export function buildSmartBlock(blockId, theme) {
  const accent = theme?.accent || '#1F4FFF'
  const ink = theme?.ink || '#141412'
  const muted = theme?.muted || '#6D6A63'
  const card = theme?.card || '#F4F4F2'
  const rule = theme?.rule || '#E2DED4'

  switch (blockId) {
    case 'kpi-card':
      return [
        { type: 'shape', shape: 'roundRect', x: 440, y: 240, w: 380, h: 190, text: '', style: { fill: card, stroke: rule, strokeWidth: 1.5, radius: 16 } },
        { type: 'text', x: 468, y: 262, w: 320, h: 68, text: '+148%', style: { fontSize: 48, bold: true, color: accent } },
        { type: 'text', x: 468, y: 334, w: 320, h: 32, text: '核心业务指标同比增长', style: { fontSize: 18, bold: true, color: ink } },
        { type: 'text', x: 468, y: 370, w: 320, h: 40, text: '统计口径：2026 Q3 实际交付数据', style: { fontSize: 13, color: muted } },
      ]
    case 'feature-card':
      return [
        { type: 'shape', shape: 'roundRect', x: 440, y: 230, w: 400, h: 210, text: '', style: { fill: card, stroke: rule, strokeWidth: 1.5, radius: 14 } },
        { type: 'shape', shape: 'pill', x: 466, y: 254, w: 68, h: 28, text: '01', style: { fill: accent, color: '#FFFFFF', fontSize: 13, bold: true, align: 'center', valign: 'middle' } },
        { type: 'text', x: 466, y: 296, w: 348, h: 36, text: '新增关键能力要点', style: { fontSize: 21, bold: true, color: ink } },
        { type: 'text', x: 466, y: 338, w: 348, h: 82, text: '双击可直接修改这段说明文字，阐述该模块解决的具体痛点与交付标准。', style: { fontSize: 15, color: muted, lineHeight: 1.5 } },
      ]
    case 'callout-banner':
      return [
        { type: 'shape', shape: 'roundRect', x: 180, y: 540, w: 920, h: 84, text: '', style: { fill: card, stroke: accent, strokeWidth: 2, radius: 12 } },
        { type: 'shape', shape: 'roundRect', x: 198, y: 558, w: 8, h: 48, text: '', style: { fill: accent, radius: 4 } },
        { type: 'text', x: 224, y: 556, w: 856, h: 52, text: '核心结论提示：把关键判断单独拎出来，让听众在 3 秒内抓住重点。', style: { fontSize: 18, bold: true, color: ink, valign: 'middle' } },
      ]
    case 'quote-box':
      return [
        { type: 'shape', shape: 'roundRect', x: 320, y: 220, w: 640, h: 230, text: '', style: { fill: card, stroke: rule, strokeWidth: 1, radius: 16 } },
        { type: 'text', x: 356, y: 244, w: 568, h: 120, text: '“真正好的工具不是替人做决定，而是把重复琐碎的排版工作降到零。”', style: { fontSize: 24, italic: true, bold: true, color: ink, lineHeight: 1.45 } },
        { type: 'text', x: 356, y: 382, w: 568, h: 34, text: '—— 客户访谈实录 · 产品负责人', style: { fontSize: 14, color: muted, align: 'right' } },
      ]
    case 'vs-pair':
      return [
        { type: 'shape', shape: 'roundRect', x: 260, y: 230, w: 350, h: 220, text: '', style: { fill: card, stroke: rule, strokeWidth: 1.5, radius: 14 } },
        { type: 'text', x: 286, y: 254, w: 298, h: 34, text: '传统人工方式', style: { fontSize: 19, bold: true, color: muted } },
        { type: 'text', x: 286, y: 300, w: 298, h: 120, text: '• 跨文档手工搬运信息\n• 每次改配色都要重排全稿\n• 平均耗时 3–5 个工作日', style: { fontSize: 15, color: muted, lineHeight: 1.65 } },
        { type: 'shape', shape: 'roundRect', x: 650, y: 230, w: 350, h: 220, text: '', style: { fill: card, stroke: accent, strokeWidth: 2, radius: 14 } },
        { type: 'text', x: 676, y: 254, w: 298, h: 34, text: '升级后自动化方案', style: { fontSize: 19, bold: true, color: accent } },
        { type: 'text', x: 676, y: 300, w: 298, h: 120, text: '• 结构化大纲一键成稿\n• 全局主题与单页版式秒级切换\n• 30 分钟直接导出可编辑 PPTX', style: { fontSize: 15, color: ink, lineHeight: 1.65 } },
      ]
    case 'step-flow':
      return [0, 1, 2].flatMap((i) => [
        {
          type: 'shape',
          shape: 'chevron',
          x: 220 + i * 285,
          y: 300,
          w: 265,
          h: 92,
          text: `阶段 0${i + 1} · ${['需求对齐', '方案验证', '规模交付'][i]}`,
          style: { fill: i === 2 ? accent : card, stroke: i === 2 ? accent : rule, strokeWidth: 1.5, color: i === 2 ? '#FFFFFF' : ink, fontSize: 17, bold: true, align: 'center', valign: 'middle' },
        },
      ])
    case 'person-card':
      return [
        { type: 'shape', shape: 'roundRect', x: 460, y: 220, w: 360, h: 210, text: '', style: { fill: card, stroke: rule, strokeWidth: 1.5, radius: 16 } },
        { type: 'shape', shape: 'ellipse', x: 488, y: 248, w: 64, h: 64, text: '林', style: { fill: accent, color: '#FFFFFF', fontSize: 24, bold: true, align: 'center', valign: 'middle' } },
        { type: 'text', x: 568, y: 252, w: 228, h: 32, text: '林致远 · 架构负责人', style: { fontSize: 18, bold: true, color: ink } },
        { type: 'text', x: 568, y: 286, w: 228, h: 28, text: '12 年分布式系统与算力调度经验', style: { fontSize: 13, color: accent } },
        { type: 'text', x: 488, y: 330, w: 308, h: 78, text: '主导超大规模集群弹性编排引擎研发，单集群资源利用率提升至 82%。', style: { fontSize: 14, color: muted, lineHeight: 1.5 } },
      ]
    case 'tag-group':
    default:
      return ['核心壁垒', '低成本扩展', '全链路可控', '开箱即用'].map((label, i) => ({
        type: 'shape',
        shape: 'pill',
        x: 280 + i * 184,
        y: 330,
        w: 168,
        h: 46,
        text: label,
        style: {
          fill: i === 0 ? accent : card,
          stroke: i === 0 ? accent : rule,
          strokeWidth: 1.5,
          color: i === 0 ? '#FFFFFF' : ink,
          fontSize: 15,
          bold: true,
          align: 'center',
          valign: 'middle',
        },
      }))
  }
}

export const WPS_BLOCK_LIST = [
  { id: 'kpi-card', name: 'KPI 数字指标卡', desc: '大号增长数字 + 标题 + 口径' },
  { id: 'feature-card', name: '编号要点卡片', desc: '徽章编号 + 小标题 + 详情段落' },
  { id: 'callout-banner', name: '重点结论横幅', desc: '底部/顶部高亮强调提示条' },
  { id: 'quote-box', name: '引言金句卡片', desc: '客户证言或核心主张框' },
  { id: 'vs-pair', name: '双栏优劣对比块', desc: '传统做法 vs 升级方案并排卡片' },
  { id: 'step-flow', name: '三步燕尾流程条', desc: '01 → 02 → 03 阶段推进图' },
  { id: 'person-card', name: '核心成员名片卡', desc: '头像徽标 + 履历介绍卡' },
  { id: 'tag-group', name: '胶囊标签组', desc: '四枚并列关键词胶囊' },
]

/** 24 枚干净的内置 SVG 图标（插入为可缩放可改色矢量图片） */
export const WPS_ICONS = [
  { id: 'rocket', name: '火箭增长', path: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z' },
  { id: 'cpu', name: '芯片算力', path: 'M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3' },
  { id: 'trend', name: '趋势上升', path: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6' },
  { id: 'shield', name: '安全合规', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4' },
  { id: 'target', name: '核心目标', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { id: 'layers', name: '架构分层', path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'zap', name: '极速闪电', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { id: 'globe', name: '全球网络', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' },
  { id: 'users', name: '团队客户', path: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { id: 'database', name: '数据中心', path: 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' },
  { id: 'cloud', name: '云端部署', path: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z' },
  { id: 'award', name: '行业认证', path: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12' },
  { id: 'clock', name: '交付周期', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2' },
  { id: 'dollar', name: '商业营收', path: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id: 'pie', name: '市场份额', path: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z' },
  { id: 'check', name: '达成验收', path: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3' },
  { id: 'bulb', name: '创新洞察', path: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z' },
  { id: 'code', name: '研发代码', path: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
  { id: 'briefcase', name: '企业服务', path: 'M2 7h20v14H2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
  { id: 'compass', name: '战略方向', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z' },
  { id: 'link', name: '生态协同', path: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { id: 'calendar', name: '路线排期', path: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
  { id: 'message', name: '客户反馈', path: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'star', name: '重点标星', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
]

export function iconToDataUrl(iconPath, color = '#1F4FFF') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const WPS_TRANSITIONS = [
  { id: 'none', name: '无切换' },
  { id: 'fade', name: '淡出淡入' },
  { id: 'push', name: '平滑推入' },
  { id: 'wipe', name: '横向擦除' },
  { id: 'zoom', name: '景深缩放' },
  { id: 'morph', name: '平滑移动 (Morph)' },
]

export const WPS_ANIMATIONS = [
  { id: 'none', name: '无动画', kind: 'none' },
  { id: 'fadeIn', name: '淡入出现', kind: 'in' },
  { id: 'flyInUp', name: '向上浮入', kind: 'in' },
  { id: 'flyInLeft', name: '自左飞入', kind: 'in' },
  { id: 'zoomIn', name: '缩放弹出', kind: 'in' },
  { id: 'wipeIn', name: '擦除展开', kind: 'in' },
  { id: 'pulse', name: '脉冲强调', kind: 'emphasis' },
  { id: 'fadeOut', name: '淡出消失', kind: 'out' },
]
