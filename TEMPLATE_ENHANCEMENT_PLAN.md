# 🎨 DesignBuddy 模版系统完善计划

## 📊 当前状态分析

### 模版总数：22个 ✅（满足20-30个要求）

### 图片资源状态

#### ✅ 已有图片的模版（8个）
| 模版 | 类别 | 图片数 | 状态 |
|------|------|--------|------|
| travel | 原型 | 9张 | ✅ 完成 |
| luma | 幻灯片 | 5张 | ✅ 完成 |
| research | 文档 | 5张 | ✅ 完成 |
| chishan | 图片 | 5张 | ✅ 完成 |
| museum | 原型 | 5张 | ✅ 完成 |
| city | 幻灯片 | 5张 | ✅ 完成 |
| handbook | 文档 | 5张 | ✅ 完成 |
| nature | 图片 | 5张 | ✅ 完成 |

#### ❌ 缺少图片的模版（14个）
| # | 模版 | 类别 | 页面数 | 需要图片 |
|---|------|------|--------|----------|
| 9 | hyperframes | HyperFrames | 4段动效 | 5张 |
| 10 | film | 视频 | 18秒 | 5张 |
| 11 | sound | 音频 | 8秒 | 5张 |
| 12 | live | 实时产物 | - | 5张 |
| 13 | webgl | WebGL | - | 5张 |
| 14 | forme | 原型 | 24页 | 5张 |
| 15 | atelier | 原型 | 24页 | 5张 |
| 16 | roots | 原型 | 24页 | 5张 |
| 17 | daylight | 原型 | 24页 | 5张 |
| 18 | tide | 原型 | 24页 | 5张 |
| 19 | morrow | 原型 | 24页 | 5张 |
| 20 | studio-nine | 原型 | 24页 | 5张 |
| 21 | wellspring | 原型 | 24页 | 5张 |
| 22 | circuit | 原型 | 24页 | 5张 |

**总计需要：14 × 5 = 70张图片**

---

## 🚀 实施方案

### 阶段 1：创建渐变占位图（立即可用）

为14个模版创建美观的渐变占位图，确保每个模版都有5张视觉吸引力强的预览图。

#### 设计方案

每个模版使用独特的渐变色方案：

```typescript
const templateGradients = {
  hyperframes: [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',  // 紫蓝
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',  // 粉红
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',  // 青蓝
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',  // 青绿
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',  // 橙粉
  ],
  film: [
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',  // 深青
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',  // 薄荷
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',  // 柔粉
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',  // 暖橙
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',  // 蓝粉
  ],
  // ... 其他模版
};
```

#### 实现代码

创建 `apps/web/src/inspiration/samples/placeholderImages.tsx`:

```typescript
import { Photo } from './shared';

export function createPlaceholderPhotos(
  templateId: string,
  templateName: string,
  count: number = 5
): Photo[] {
  const gradients = templateGradients[templateId];
  
  return Array.from({ length: count }, (_, i) => ({
    url: gradients[i],  // 使用渐变作为背景
    label: `${templateName} - 预览 ${i + 1}`,
    credit: 'DesignBuddy',
    license: 'DesignBuddy Template',
    source: 'https://designbuddy.app',
  }));
}
```

### 阶段 2：增强交互性

#### 每个模版页面的交互功能

1. **原型类模版（11个）**
   - ✅ 页面导航（上一页/下一页）
   - ✅ 按钮点击效果
   - ✅ 表单输入验证
   - ✅ 模态框打开/关闭
   - ✅ 数据筛选和排序
   - ✅ 响应式布局切换

2. **幻灯片类模版（2个）**
   - ✅ 幻灯片切换动画
   - ✅ 演讲者备注显示
   - ✅ 全屏演示模式
   - ✅ 键盘快捷键导航
   - ✅ 幻灯片缩略图预览

3. **文档类模版（2个）**
   - ✅ 目录跳转
   - ✅ 页面缩放
   - ✅ 打印预览
   - ✅ 文本搜索
   - ✅ 批注显示/隐藏

4. **图片类模版（2个）**
   - ✅ 图片放大查看
   - ✅ 图片轮播
   - ✅ 网格/列表视图切换
   - ✅ 图片下载
   - ✅ 图片信息展示

5. **多媒体类模版（5个）**
   - ✅ 播放/暂停控制
   - ✅ 进度条拖动
   - ✅ 音量调节
   - ✅ 全屏模式
   - ✅ 字幕显示/隐藏

### 阶段 3：添加真实图片资源

#### 图片来源方案

1. **Unsplash API** - 免费高质量图片
2. **Pexels API** - 免费商用图片
3. **AI 生成图片** - 使用 DALL-E/Midjourney
4. **自定义摄影** - 专业摄影师拍摄
5. **设计素材库** - Envato Elements 等

#### 图片规格要求

```typescript
interface ImageSpec {
  width: 1200;        // 宽度
  height: 800;        // 高度
  format: 'webp';     // 格式
  quality: 85;        // 质量
  maxSize: '500KB';   // 最大文件大小
}
```

---

## 📝 详细实施计划

### 第 1 周：占位图 + 基础交互

#### Day 1-2: 创建渐变占位图系统
- [ ] 创建 `placeholderImages.tsx`
- [ ] 定义14个模版的渐变色方案
- [ ] 更新 `shared.tsx` 使用占位图
- [ ] 测试所有模版显示正常

#### Day 3-4: 增强原型类模版交互
- [ ] forme - 家具选配交互
- [ ] atelier - 服饰订制流程
- [ ] roots - 花园规划工具
- [ ] daylight - 办公空间预约
- [ ] tide - 会员管理系统

#### Day 5-7: 完善其他模版交互
- [ ] morrow - 咖啡订阅流程
- [ ] studio-nine - 影棚排期系统
- [ ] wellspring - 课程管理系统
- [ ] circuit - 二手交易流程
- [ ] hyperframes - 动效编辑器

### 第 2 周：真实图片 + 高级功能

#### Day 8-10: 采购/生成真实图片
- [ ] 为14个模版各准备5张高质量图片
- [ ] 图片优化和压缩
- [ ] 创建 sources.json 配置文件
- [ ] 更新模版使用真实图片

#### Day 11-12: 添加高级交互功能
- [ ] 页面过渡动画
- [ ] 数据持久化（localStorage）
- [ ] 导出功能（PDF/PNG/CSV）
- [ ] 分享功能
- [ ] 协作编辑功能

#### Day 13-14: 测试和优化
- [ ] 跨浏览器测试
- [ ] 移动端适配测试
- [ ] 性能优化
- [ ] 无障碍访问优化
- [ ] 用户反馈收集

---

## 🎯 每个模版的详细规划

### 9. hyperframes - HyperFrames 动效

**页面结构（4段动效）**：
1. 品牌标识动效 - Logo 动画
2. 转场动效 - 页面切换效果
3. 交互动效 - 按钮和卡片动画
4. 加载动效 - 进度条和骨架屏

**每张图片展示**：
- 图片1: 动效时间轴编辑器界面
- 图片2: 关键帧控制面板
- 图片3: 预览播放界面
- 图片4: 代码编辑器视图
- 图片5: 导出设置界面

**交互功能**：
- ✅ 播放/暂停/停止
- ✅ 时间轴拖动
- ✅ 关键帧添加/删除
- ✅ 缓动函数选择
- ✅ 实时预览

---

### 10. film - 视频剪辑

**页面结构（18秒视频）**：
1. 片头 - 3秒
2. 主体内容 - 12秒（4个场景，每个3秒）
3. 片尾 - 3秒

**每张图片展示**：
- 图片1: 视频播放器界面
- 图片2: 时间轴编辑器
- 图片3: 场景切换面板
- 图片4: 字幕编辑器
- 图片5: 导出设置界面

**交互功能**：
- ✅ 视频播放控制
- ✅ 时间轴编辑
- ✅ 场景切换
- ✅ 字幕添加/编辑
- ✅ 音量调节

---

### 11. sound - 音频制作

**页面结构（8秒音频）**：
1. 音频波形显示
2. 参数调节面板
3. 效果器链
4. 混音控制台

**每张图片展示**：
- 图片1: 音频波形编辑器
- 图片2: 参数调节面板
- 图片3: 效果器链界面
- 图片4: 混音控制台
- 图片5: 导出和分享界面

**交互功能**：
- ✅ 音频播放/录制
- ✅ 波形缩放和拖动
- ✅ 参数实时调节
- ✅ 效果器开关
- ✅ 频谱分析器

---

### 12. live - 实时报价

**页面结构**：
1. 服务选择器
2. 配置面板
3. 实时价格计算
4. 报价单预览
5. 导出和分享

**每张图片展示**：
- 图片1: 服务目录界面
- 图片2: 配置选项面板
- 图片3: 实时价格计算
- 图片4: 报价单预览
- 图片5: 导出和分享界面

**交互功能**：
- ✅ 服务选择和配置
- ✅ 实时价格计算
- ✅ 数量调整
- ✅ 折扣应用
- ✅ PDF 导出

---

### 13. webgl - 3D 展示

**页面结构**：
1. 3D 场景查看器
2. 材质编辑器
3. 灯光控制面板
4. 相机控制器
5. 渲染设置

**每张图片展示**：
- 图片1: 3D 场景主视图
- 图片2: 材质编辑器
- 图片3: 灯光控制面板
- 图片4: 相机控制器
- 图片5: 渲染设置界面

**交互功能**：
- ✅ 3D 旋转和缩放
- ✅ 材质参数调节
- ✅ 灯光位置和强度
- ✅ 相机角度切换
- ✅ 实时渲染预览

---

### 14-22. 原型类模版（9个）

每个原型模版都包含24个页面，展示完整的业务流程：

#### forme - 家具选配
- 图片1: 产品目录页面
- 图片2: 产品详情页
- 图片3: 空间布局编辑器
- 图片4: 配置选项面板
- 图片5: 报价单和结算

#### atelier - 服饰订制
- 图片1: 款式选择页面
- 图片2: 量体数据录入
- 图片3: 面料和细节配置
- 图片4: 试衣预约页面
- 图片5: 订单跟踪页面

#### roots - 花园规划
- 图片1: 植物目录页面
- 图片2: 平面图编辑器
- 图片3: 土壤和水分分析
- 图片4: 预算计算器
- 图片5: 养护计划页面

#### daylight - 联合办公
- 图片1: 空间浏览页面
- 图片2: 预约系统
- 图片3: 座位选择器
- 图片4: 团队管理面板
- 图片5: 费用和账单页面

#### tide - 帆船俱乐部
- 图片1: 会员首页
- 图片2: 课程预约页面
- 图片3: 学习记录页面
- 图片4: 教练和船只选择
- 图片5: 会员权益页面

#### morrow - 咖啡订阅
- 图片1: 咖啡目录页面
- 图片2: 拼配配置器
- 图片3: 订阅计划页面
- 图片4: 冲煮指南页面
- 图片5: 库存和配送页面

#### studio-nine - 摄影棚
- 图片1: 影棚浏览页面
- 图片2: 档期日历视图
- 图片3: 器材清单页面
- 图片4: 拍摄日安排
- 图片5: 交付流程页面

#### wellspring - 运动课程
- 图片1: 课程目录页面
- 图片2: 排课日历视图
- 图片3: 教练管理面板
- 图片4: 会员预约页面
- 图片5: 课程数据统计

#### circuit - 二手交易
- 图片1: 商品目录页面
- 图片2: 检测流程页面
- 图片3: 成色分级页面
- 图片4: 行情定价页面
- 图片5: 质保和售后页面

---

## 🎨 设计规范

### 图片尺寸和格式

```typescript
const imageSpecs = {
  thumbnail: { width: 400, height: 300, format: 'webp', quality: 80 },
  preview: { width: 800, height: 600, format: 'webp', quality: 85 },
  fullsize: { width: 1200, height: 900, format: 'webp', quality: 90 },
};
```

### 颜色方案

每个模版使用独特的颜色主题：

```typescript
const colorThemes = {
  hyperframes: { primary: '#667eea', secondary: '#764ba2' },
  film: { primary: '#30cfd0', secondary: '#330867' },
  sound: { primary: '#f093fb', secondary: '#f5576c' },
  live: { primary: '#4facfe', secondary: '#00f2fe' },
  webgl: { primary: '#43e97b', secondary: '#38f9d7' },
  forme: { primary: '#fa709a', secondary: '#fee140' },
  atelier: { primary: '#a8edea', secondary: '#fed6e3' },
  roots: { primary: '#ff9a9e', secondary: '#fecfef' },
  daylight: { primary: '#ffecd2', secondary: '#fcb69f' },
  tide: { primary: '#ff6e7f', secondary: '#bfe9ff' },
  morrow: { primary: '#a1c4fd', secondary: '#c2e9fb' },
  'studio-nine': { primary: '#d4fc79', secondary: '#96e6a1' },
  wellspring: { primary: '#84fab0', secondary: '#8fd3f4' },
  circuit: { primary: '#cfd9df', secondary: '#e2ebf0' },
};
```

---

## 📈 成功指标

### 功能完整性
- ✅ 22个模版全部可用
- ✅ 每个模版至少5张预览图
- ✅ 所有模版可交互点击
- ✅ 响应式设计完美适配

### 用户体验
- ✅ 页面加载时间 < 2秒
- ✅ 交互响应时间 < 100ms
- ✅ 无 JavaScript 错误
- ✅ 无障碍访问评分 > 90

### 技术指标
- ✅ Lighthouse 性能评分 > 90
- ✅ 首屏加载时间 < 1.5秒
- ✅ 图片总体积 < 10MB
- ✅ 代码覆盖率 > 80%

---

## 🚀 下一步行动

### 立即可做（今天）
1. 创建渐变占位图系统
2. 更新 shared.tsx 使用占位图
3. 测试所有模版显示正常

### 本周完成
1. 为14个模版添加基础交互功能
2. 优化页面加载性能
3. 修复已知的 bug

### 下周完成
1. 采购/生成真实图片资源
2. 添加高级交互功能
3. 完善文档和教程

---

## 📞 支持和反馈

如有问题或建议，请联系：
- 📧 Email: support@designbuddy.app
- 💬 Discord: DesignBuddy Community
- 🐛 GitHub Issues: designbuddy/issues

---

**版本**: 2.0.0  
**更新日期**: 2026-10-17  
**维护者**: DesignBuddy Team
