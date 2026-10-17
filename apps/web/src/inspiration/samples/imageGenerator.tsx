/**
 * 智能模版预览图生成器
 * 为每个模版生成专业的 UI 预览图
 */

import type { Photo } from './shared';

// 模版颜色主题
const templateThemes = {
  hyperframes: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    bg: '#f5f7fa',
  },
  film: {
    primary: '#30cfd0',
    secondary: '#330867',
    accent: '#a8edea',
    bg: '#1a1a2e',
  },
  sound: {
    primary: '#f093fb',
    secondary: '#f5576c',
    accent: '#ffecd2',
    bg: '#2d1b69',
  },
  live: {
    primary: '#4facfe',
    secondary: '#00f2fe',
    accent: '#43e97b',
    bg: '#f0f9ff',
  },
  webgl: {
    primary: '#43e97b',
    secondary: '#38f9d7',
    accent: '#fa709a',
    bg: '#0f2027',
  },
  forme: {
    primary: '#fa709a',
    secondary: '#fee140',
    accent: '#ffecd2',
    bg: '#fff5f7',
  },
  atelier: {
    primary: '#a8edea',
    secondary: '#fed6e3',
    accent: '#ff9a9e',
    bg: '#fafafa',
  },
  roots: {
    primary: '#ff9a9e',
    secondary: '#fecfef',
    accent: '#ffecd2',
    bg: '#f0fff4',
  },
  daylight: {
    primary: '#ffecd2',
    secondary: '#fcb69f',
    accent: '#ff6e7f',
    bg: '#fffbf0',
  },
  tide: {
    primary: '#ff6e7f',
    secondary: '#bfe9ff',
    accent: '#a1c4fd',
    bg: '#f0f8ff',
  },
  morrow: {
    primary: '#a1c4fd',
    secondary: '#c2e9fb',
    accent: '#d4fc79',
    bg: '#f8f9ff',
  },
  'studio-nine': {
    primary: '#d4fc79',
    secondary: '#96e6a1',
    accent: '#84fab0',
    bg: '#f9fff9',
  },
  wellspring: {
    primary: '#84fab0',
    secondary: '#8fd3f4',
    accent: '#a1c4fd',
    bg: '#f0fff9',
  },
  circuit: {
    primary: '#cfd9df',
    secondary: '#e2ebf0',
    accent: '#a8c0ff',
    bg: '#f5f7fa',
  },
  // 新增原型模版主题
  bloom: {
    primary: '#ff6b9d',
    secondary: '#ffa8a8',
    accent: '#ffeaa7',
    bg: '#fff5f7',
  },
  harbor: {
    primary: '#0984e3',
    secondary: '#74b9ff',
    accent: '#81ecec',
    bg: '#f0f9ff',
  },
  vintage: {
    primary: '#b8860b',
    secondary: '#daa520',
    accent: '#f4e4c1',
    bg: '#fdfbf7',
  },
  zenith: {
    primary: '#e17055',
    secondary: '#fab1a0',
    accent: '#ffeaa7',
    bg: '#fff8f5',
  },
  canvas: {
    primary: '#6c5ce7',
    secondary: '#a29bfe',
    accent: '#fd79a8',
    bg: '#f8f7ff',
  },
  // 新增幻灯片主题
  summit: {
    primary: '#2d3436',
    secondary: '#636e72',
    accent: '#00b894',
    bg: '#f5f6fa',
  },
  pitch: {
    primary: '#00b894',
    secondary: '#00cec9',
    accent: '#fdcb6e',
    bg: '#f0fff4',
  },
  workshop: {
    primary: '#e84393',
    secondary: '#fd79a8',
    accent: '#a29bfe',
    bg: '#fff5f9',
  },
  keynote: {
    primary: '#000000',
    secondary: '#2d3436',
    accent: '#00b894',
    bg: '#ffffff',
  },
  review: {
    primary: '#0984e3',
    secondary: '#74b9ff',
    accent: '#fdcb6e',
    bg: '#f0f8ff',
  },
  // 新增文档主题
  thesis: {
    primary: '#2d3436',
    secondary: '#636e72',
    accent: '#0984e3',
    bg: '#ffffff',
  },
  manual: {
    primary: '#0984e3',
    secondary: '#74b9ff',
    accent: '#00b894',
    bg: '#f0f9ff',
  },
  proposal: {
    primary: '#6c5ce7',
    secondary: '#a29bfe',
    accent: '#fd79a8',
    bg: '#f8f7ff',
  },
  playbook: {
    primary: '#00b894',
    secondary: '#55efc4',
    accent: '#fdcb6e',
    bg: '#f0fff4',
  },
  casestudy: {
    primary: '#e17055',
    secondary: '#fab1a0',
    accent: '#00b894',
    bg: '#fff8f5',
  },
  // 新增图片主题
  menu: {
    primary: '#d63031',
    secondary: '#ff7675',
    accent: '#fdcb6e',
    bg: '#fff5f5',
  },
  invite: {
    primary: '#e84393',
    secondary: '#fd79a8',
    accent: '#a29bfe',
    bg: '#fff5f9',
  },
  cert: {
    primary: '#fdcb6e',
    secondary: '#ffeaa7',
    accent: '#d63031',
    bg: '#fffbf0',
  },
  badge: {
    primary: '#6c5ce7',
    secondary: '#a29bfe',
    accent: '#fd79a8',
    bg: '#f8f7ff',
  },
  infographic: {
    primary: '#00b894',
    secondary: '#55efc4',
    accent: '#0984e3',
    bg: '#f0fff4',
  },
};

// 模版页面结构定义
const templatePages = {
  hyperframes: [
    { title: '动效时间轴编辑器', icon: '⏱️', elements: ['timeline', 'keyframes', 'preview'] },
    { title: '关键帧控制面板', icon: '🎯', elements: ['properties', 'easing', 'values'] },
    { title: '实时预览播放', icon: '▶️', elements: ['canvas', 'controls', 'fps'] },
    { title: '代码编辑器', icon: '💻', elements: ['code', 'syntax', 'export'] },
    { title: '导出设置', icon: '📦', elements: ['format', 'quality', 'download'] },
  ],
  film: [
    { title: '视频播放器', icon: '🎬', elements: ['player', 'timeline', 'controls'] },
    { title: '时间轴编辑器', icon: '✂️', elements: ['tracks', 'clips', 'transitions'] },
    { title: '场景切换面板', icon: '🎞️', elements: ['scenes', 'thumbnails', 'order'] },
    { title: '字幕编辑器', icon: '💬', elements: ['subtitles', 'timing', 'style'] },
    { title: '导出设置', icon: '📤', elements: ['format', 'resolution', 'bitrate'] },
  ],
  sound: [
    { title: '音频波形编辑器', icon: '🎵', elements: ['waveform', 'selection', 'zoom'] },
    { title: '参数调节面板', icon: '🎛️', elements: ['frequency', 'amplitude', 'modulation'] },
    { title: '效果器链', icon: '🔊', elements: ['reverb', 'delay', 'filter'] },
    { title: '混音控制台', icon: '🎚️', elements: ['channels', 'faders', 'meters'] },
    { title: '导出和分享', icon: '📤', elements: ['format', 'quality', 'metadata'] },
  ],
  live: [
    { title: '服务目录', icon: '📋', elements: ['services', 'categories', 'pricing'] },
    { title: '配置选项', icon: '⚙️', elements: ['options', 'quantities', 'upgrades'] },
    { title: '实时价格计算', icon: '💰', elements: ['subtotal', 'taxes', 'total'] },
    { title: '报价单预览', icon: '📄', elements: ['items', 'terms', 'validity'] },
    { title: '导出和分享', icon: '📤', elements: ['pdf', 'email', 'link'] },
  ],
  webgl: [
    { title: '3D 场景查看器', icon: '🎨', elements: ['viewport', 'camera', 'grid'] },
    { title: '材质编辑器', icon: '🎭', elements: ['shader', 'texture', 'properties'] },
    { title: '灯光控制面板', icon: '💡', elements: ['lights', 'shadows', 'ambient'] },
    { title: '相机控制器', icon: '📷', elements: ['position', 'rotation', 'fov'] },
    { title: '渲染设置', icon: '⚙️', elements: ['quality', 'resolution', 'samples'] },
  ],
  forme: [
    { title: '产品目录', icon: '🛋️', elements: ['furniture', 'categories', 'filters'] },
    { title: '产品详情', icon: '📐', elements: ['images', 'specs', 'options'] },
    { title: '空间布局编辑器', icon: '🏠', elements: ['floorplan', 'placement', 'dimensions'] },
    { title: '配置选项', icon: '🎨', elements: ['materials', 'colors', 'finishes'] },
    { title: '报价单和结算', icon: '💳', elements: ['items', 'pricing', 'checkout'] },
  ],
  atelier: [
    { title: '款式选择', icon: '👗', elements: ['styles', 'gallery', 'favorites'] },
    { title: '量体数据录入', icon: '📏', elements: ['measurements', 'guide', 'save'] },
    { title: '面料和细节配置', icon: '🧵', elements: ['fabrics', 'buttons', 'lining'] },
    { title: '试衣预约', icon: '📅', elements: ['calendar', 'times', 'location'] },
    { title: '订单跟踪', icon: '📦', elements: ['status', 'timeline', 'delivery'] },
  ],
  roots: [
    { title: '植物目录', icon: '🌱', elements: ['plants', 'search', 'filters'] },
    { title: '平面图编辑器', icon: '🗺️', elements: ['garden', 'zones', 'placement'] },
    { title: '土壤和水分分析', icon: '💧', elements: ['soil', 'ph', 'moisture'] },
    { title: '预算计算器', icon: '💰', elements: ['plants', 'materials', 'labor'] },
    { title: '养护计划', icon: '📅', elements: ['schedule', 'tasks', 'reminders'] },
  ],
  daylight: [
    { title: '空间浏览', icon: '🏢', elements: ['spaces', 'photos', 'amenities'] },
    { title: '预约系统', icon: '📅', elements: ['calendar', 'availability', 'booking'] },
    { title: '座位选择器', icon: '💺', elements: ['floorplan', 'desks', 'selection'] },
    { title: '团队管理', icon: '👥', elements: ['members', 'roles', 'permissions'] },
    { title: '费用和账单', icon: '💳', elements: ['invoices', 'payments', 'history'] },
  ],
  tide: [
    { title: '会员首页', icon: '⛵', elements: ['dashboard', 'stats', 'upcoming'] },
    { title: '课程预约', icon: '📅', elements: ['courses', 'schedule', 'booking'] },
    { title: '学习记录', icon: '📊', elements: ['progress', 'skills', 'certificates'] },
    { title: '教练和船只选择', icon: '👨‍✈️', elements: ['instructors', 'boats', 'availability'] },
    { title: '会员权益', icon: '🎁', elements: ['benefits', 'discounts', 'events'] },
  ],
  morrow: [
    { title: '咖啡目录', icon: '☕', elements: ['beans', 'roasts', 'origins'] },
    { title: '拼配配置器', icon: '🧪', elements: ['blends', 'ratios', 'flavor'] },
    { title: '订阅计划', icon: '📦', elements: ['plans', 'frequency', 'quantity'] },
    { title: '冲煮指南', icon: '📖', elements: ['methods', 'recipes', 'tips'] },
    { title: '库存和配送', icon: '🚚', elements: ['inventory', 'shipping', 'tracking'] },
  ],
  'studio-nine': [
    { title: '影棚浏览', icon: '📸', elements: ['studios', 'equipment', 'amenities'] },
    { title: '档期日历', icon: '📅', elements: ['calendar', 'availability', 'booking'] },
    { title: '器材清单', icon: '🎥', elements: ['cameras', 'lights', 'accessories'] },
    { title: '拍摄日安排', icon: '🎬', elements: ['schedule', 'crew', 'shots'] },
    { title: '交付流程', icon: '📤', elements: ['delivery', 'formats', 'timeline'] },
  ],
  wellspring: [
    { title: '课程目录', icon: '🏃', elements: ['classes', 'categories', 'levels'] },
    { title: '排课日历', icon: '📅', elements: ['schedule', 'instructors', 'rooms'] },
    { title: '教练管理', icon: '👨‍🏫', elements: ['trainers', 'availability', 'specialties'] },
    { title: '会员预约', icon: '📱', elements: ['booking', 'waitlist', 'cancellations'] },
    { title: '数据统计', icon: '📊', elements: ['attendance', 'revenue', 'retention'] },
  ],
  circuit: [
    { title: '商品目录', icon: '📱', elements: ['devices', 'categories', 'filters'] },
    { title: '检测流程', icon: '🔍', elements: ['tests', 'checklist', 'results'] },
    { title: '成色分级', icon: '⭐', elements: ['grades', 'criteria', 'photos'] },
    { title: '行情定价', icon: '💰', elements: ['market', 'pricing', 'trends'] },
    { title: '质保和售后', icon: '🛡️', elements: ['warranty', 'returns', 'support'] },
  ],
};

/**
 * 生成单个预览图的 Canvas
 */
function generatePreviewCanvas(
  templateId: string,
  pageIndex: number,
  width: number = 800,
  height: number = 600
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  const theme = templateThemes[templateId as keyof typeof templateThemes];
  const page = templatePages[templateId as keyof typeof templatePages][pageIndex];
  
  // 背景
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  
  // 顶部导航栏
  ctx.fillStyle = theme.primary;
  ctx.fillRect(0, 0, width, 60);
  
  // 导航栏标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui';
  ctx.fillText(`${page.icon} ${page.title}`, 20, 40);
  
  // 主内容区域
  const contentY = 80;
  const contentHeight = height - 100;
  
  // 左侧边栏
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, contentY, 200, contentHeight);
  ctx.strokeStyle = '#e5e7eb';
  ctx.strokeRect(0, contentY, 200, contentHeight);
  
  // 侧边栏项目
  const sidebarItems = ['首页', '列表', '详情', '设置', '帮助'];
  sidebarItems.forEach((item, i) => {
    ctx.fillStyle = i === pageIndex % 5 ? theme.primary : '#6b7280';
    ctx.fillRect(10, contentY + 20 + i * 40, 180, 30);
    ctx.fillStyle = i === pageIndex % 5 ? '#ffffff' : '#374151';
    ctx.font = '14px system-ui';
    ctx.fillText(item, 20, contentY + 40 + i * 40);
  });
  
  // 主内容区
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(220, contentY, width - 240, contentHeight);
  ctx.strokeStyle = '#e5e7eb';
  ctx.strokeRect(220, contentY, width - 240, contentHeight);
  
  // 内容卡片
  page.elements.forEach((element, i) => {
    const cardX = 240 + (i % 2) * 260;
    const cardY = contentY + 20 + Math.floor(i / 2) * 180;
    const cardWidth = 240;
    const cardHeight = 160;
    
    // 卡片背景
    ctx.fillStyle = theme.bg;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
    
    // 卡片标题
    ctx.fillStyle = theme.primary;
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(element.toUpperCase(), cardX + 15, cardY + 30);
    
    // 卡片内容占位
    ctx.fillStyle = '#e5e7eb';
    for (let j = 0; j < 4; j++) {
      ctx.fillRect(cardX + 15, cardY + 50 + j * 25, cardWidth - 30, 15);
    }
  });
  
  // 底部状态栏
  ctx.fillStyle = theme.secondary;
  ctx.fillRect(0, height - 40, width, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui';
  ctx.fillText(`${templateId.toUpperCase()} · Page ${pageIndex + 1} · DesignBuddy Template System`, 20, height - 15);
  
  return canvas.toDataURL('image/png', 0.9);
}

/**
 * 为模版生成完整的预览图集合
 */
export function generateTemplatePhotos(templateId: string): Photo[] {
  const pages = templatePages[templateId as keyof typeof templatePages];
  const theme = templateThemes[templateId as keyof typeof templateThemes];
  
  return pages.map((page, index) => ({
    url: generatePreviewCanvas(templateId, index),
    label: page.title,
    credit: 'DesignBuddy Template Generator',
    license: 'DesignBuddy Template License',
    source: 'https://designbuddy.app',
  }));
}

/**
 * 批量生成所有模版的预览图
 */
export function generateAllTemplatePhotos(): Record<string, Photo[]> {
  const result: Record<string, Photo[]> = {};
  
  Object.keys(templatePages).forEach((templateId) => {
    result[templateId] = generateTemplatePhotos(templateId);
  });
  
  return result;
}
