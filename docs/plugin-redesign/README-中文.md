# 插件市场（/plugins）功能检查 + 15图重设计方案

## 1. 现有功能盘点（基于 `frontend/workspace/pages/PluginsPage.tsx` + `plugins/_official/catalog.json` + `server/api/plugin-registry.ts`）

### 1.1 前端界面结构
- **路由**：`/plugins` 由 `PluginsPage` 承载，侧边栏 `WorkBuddySidebar(active="plugins")`
- **顶部**：标题 `插件 / 让创作，多一点可能。` + 搜索框（⌘K 聚焦，关键词匹配名称/描述/分类/权限）
- **视图切换**：`精选发现 / 全部插件 / 我的清单`（`saved` 计数来自本地 `assets` 中 `type="plugins"`）
- **精选区**：大卡片“好用的工具，让灵感更进一步” + 侧边“BUILD YOUR TOOLBOX” + `PluginLifecyclePanel`
- **分类**：12类 `全部/设计创意/开发工具/效率办公/多媒体/数据分析/工作流/测试与质量/部署交付/营销增长/产品管理/研究采集/客户支持/…`，支持“更多分类”展开
- **列表**：分页 24/页，排序 `目录顺序 / 名称`，卡片显示：logo（按分类配色）、收藏按钮（+ / ✓）、名称、描述、分类标签、查看详情
- **详情弹窗**：版本/risk/接入状态、权限声明（最多展示）、范围提示“保存规格，不等于授权执行”、按钮“查看连接器”“加入我的清单/移除”
- **生命周期面板**：服务端真实安装态 `installed/enabled/disabled`、技能列表、权限、兼容性提示、操作日志（独立于前端收藏）

### 1.2 数据与后端
- **目录**：`plugins/_official/catalog.json` 共 **480 项**，前 48 项为手工精品（Figma桥接、截图转界面、Token同步、网页采集、GitHub仓库…），49-480 为批量生成的模板化条目（10大分类 × 48 能力模板，名称如“设计协作 · 审计记录 6”）
- **Bundle**：`server/plugins/bundles.json` 4个真实可安装 bundle（文档与数据基础包、品牌与视觉产出包、网页与质量检查包、多文件关联包），对应真实 `skills`
- **权限模型**：`workspace:read / workspace:write:approval / network:allowlisted` 三档，详情页文案已说明“加入清单不会安装/授权/联网”
- **存储**：收藏在浏览器 `workspaceStore.assets`（localStorage），生命周期在 `data/plugins.sqlite` + `skill-runs.sqlite`

### 1.3 为什么“很不喜欢”——已确认痛点
1. **信息噪音大**：480项中后432项高度重复，搜索和分页压力大，精选 12 项被淹没
2. **价值感弱**：卡片只有“加入清单”，无真实“一键启用/配置向导”，用户预期落差
3. **权限恐惧**：每个详情都列权限但无“现在能做什么/还缺什么”，风险标注（低风险/需确认）不等于安全认证，易误解
4. **视觉单调**：三列等高白卡 + 淡绿/米黄 Hero，缺乏层级、空状态和已安装态的强反馈
5. **已安装与发现割裂**：生命周期面板在精选区下方，易被忽略；“我的清单”只是本地收藏，不是服务端已启用

---

## 2. 15图重设计方向（中文版）

> 已生成 10/15 张，余下 5 张（11-15）下一轮补齐。所有图为 16:9 高保真 Web 截图，中文文案。

| # | 文件 | 方向名 | 一句话理念 | 适合谁 |
|---|---|---|---|---|
| 01 | `cn-01-minimal-command.png` | 极简指令中心 | 顶部全局搜索 + 开关列表，像设置页一样直接开关插件 | 追求效率的老用户 |
| 02 | `cn-02-appstore-vibrant.png` | 应用商店活力版 | 大轮播 + 圆角图标 + 星级/“获取”，强化发现感 | 新手/灵感浏览 |
| 03 | `cn-03-linear-dense.png` | Linear高效列表 | 窄侧栏 + 密集行 + 键盘 J/K 导航，信息密度最高 | 开发者/重度用户 |
| 04 | `cn-04-notion-database.png` | Notion数据库视图 | 表格/画廊/看板多视图 + 筛选器芯片 | 数据/运营 |
| 05 | `cn-05-bento-grid.png` | 便当盒Bento网格 | 大小不一的圆角块，突出精选套装 | 视觉/品牌 |
| 06 | `cn-06-terminal-geek.png` | 终端极客版 | 深色编辑器 + `pnpm add` 命令 + 权限标签 | 工程师 |
| 07 | `cn-07-drawer-detail.png` | 抽屉详情 | 左网格右抽屉，权限/版本/日志分Tab | 需要审计的团队 |
| 08 | `cn-08-editorial-hero.png` | 编辑部精选 | 生活化 Hero + 策展合集“设计师入门套装” | 内容运营 |
| 09 | `cn-09-kanban-board.png` | 看板管理 | 发现/已收藏/已启用/待配置 四列拖拽 | 项目管理 |
| 10 | `cn-10-dashboard-stats.png` | 仪表盘数据化 | KPI 卡片 + 权限健康度 + 用量图 | 管理员 |
| 11 | `cn-11-chat-assistant.png` | AI对话助手 | 左对话右预览，AI 推荐插件卡片内联 | AI 原生用户 |
| 12 | `cn-12-mobile-first.png` | 移动端优先 | 单列大卡 + 底部 Tab + 左右滑动手势 | 手机/平板 |
| 13 | `cn-13-permission-focus.png` | 权限透明优先 | 盾牌 + 红黄绿灯 + 权限可展开审计 | 安全敏感 |
| 14 | `cn-14-marketplace-pro.png` | 专业市场（定价/评价） | 价格、评分、更新时间、作者头像 | 商业化市场 |
| 15 | `cn-15-zero-state.png` | 零状态引导 | 空清单插画 + 三步引导“浏览-收藏-启用” | 新用户激活 |

### 设计建议（给你的决策）
- **短期最稳**：选 **01 极简 + 07 抽屉 + 09 看板** 三件套，改动最小但解决“已安装割裂”和“权限恐惧”
- **最能提升转化**：**02 商店 + 08 策展 + 05 Bento**，适合对外宣传和新用户
- **最适合团队/企业**：**04 数据库 + 10 仪表盘 + 13 权限透明**，审计和合规最强

---

## 3. 下一步可落地
1. 将 `catalog.json` 的 49-480 模板项折叠为“能力模板”分组，默认只展示前 48 精品
2. 把 `PluginLifecyclePanel` 提升为常驻右侧或顶部“已启用”胶囊，避免被首屏 Hero 挤掉
3. 卡片主按钮改为 **“加入清单 → 去配置”** 两段式，明确告知是否需要适配器/授权
4. 用以上 15 图中的 1-2 个方向做交互原型（建议先做 01+07），我可直接基于 `PluginsPage.tsx` + `plugins.css` 出代码

> 图片路径：`docs/plugin-redesign/cn-01~10*.png`（已生成），`cn-11~15` 待补。预览时直接打开对应 PNG 即可。

---

## 4. 已落地：插件在首页直接运行（2026-10）

方案与实现细节见 **`docs/plugin-redesign/首页运行方案.md`**。摘要：

| 改动 | 文件 |
|---|---|
| 首页「我的插件」轨道（已启用包 → 一键填入 composer） | `apps/web/src/components/HomePluginsRail.tsx` |
| 输入框下技能要求条（接受类型/缺文件/缺凭据/权限） | `apps/web/src/components/HomeSkillHint.tsx` |
| 样式（极简白底，对齐 01 方向） | `apps/web/src/home-plugins.css` |
| 轻量接口 `GET /api/plugins?scope=home` | `server/api/plugin-registry.ts` |
| 首页数据 + 缓存失效 | `frontend/workspace/api/plugins.ts` |
| `/plugins`、`/library`、技能目录按需加载 | `apps/web/src/App.tsx`、`frontend/workspace/WorkspaceHub.tsx` |
| ⌘K 联合搜索（场景/技能/插件/页面） | `apps/web/src/components/HomeCommandPalette.tsx` + `apps/web/src/command-palette.css` |
| 发送前校验（缺文件/技能不可用直接拦住） | `apps/web/src/components/useRuntimeSkill.ts` |
| 按模式的插件推荐位（只推有执行器的技能） | `apps/web/src/components/HomePluginPicks.tsx` |
| 待配置 → 配置向导（密钥/连接器/输入框/服务端环境） | `apps/web/src/components/pluginRequirements.ts` |
| 首页插件数据统一缓存与失效事件 | `apps/web/src/components/useHomePlugins.ts` |
| 推荐位候选与排序（可单测） | `apps/web/src/components/pluginPicks.ts` |

实测：首页新增请求 1.0 KB（无包时 90 B，且轨道与推荐位共用一次请求）；主包 3 426 → 2 410 kB（gzip 780 → 703 kB），480 项目录与技能声明都不再随首页加载。

测试：`node --test server/api/plugin-registry.test.cjs`（10/10）、`pnpm test:home-plugins`（14/14：发送前校验、配置向导去向、推荐位技能真实性，无需浏览器）。
