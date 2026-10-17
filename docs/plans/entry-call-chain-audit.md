# 入口真实调用链审计（P16：预览 / 执行 / 发布 / 管理）

审计日期：2026-10-17（第十一轮后）。范围：前端每一个「预览」「执行」「发布/导出」「管理」入口，
逐个核对它到底调用了哪条真实链路、结果落在哪里、失败时怎么说。

判定口径：

- **真实接通**：点击后确实走到服务端或本机执行，落点可复查（数据库、磁盘、下载文件、截图证据）。
- **受凭据阻塞**：代码链路完整，但缺密钥/账号时**明确拒绝并说明缺什么**，不会伪造结果。
- **未接入且已说明**：没有实现，界面上如实写明「尚未接入」，不提供假按钮。
- **未接入但没说清**：需要修（本轮审计没有发现新增的这一类）。

---

## 1. 预览入口

| 入口 | 真实调用链 | 落点 | 判定 |
|---|---|---|---|
| 编辑器右侧预览抽屉 | `PreviewSidePanel` → `buildPreviewDocument(files)` → `LivePreview` 的 `iframe srcDoc`（`sandbox="allow-scripts"`） | 浏览器沙箱内渲染当前项目文件 | 真实接通 |
| 项目分享页（本地 hash 链接） | `ShareProjectPage` 读 URL hash → 本地校验（大小/路径/文件数）→ `makeReadOnlyPreview` 加 CSP → iframe | 浏览器沙箱 | 真实接通 |
| 项目分享页（`/share/:token`） | `fetchPublicShare(token)` → `GET /api/shares/:token`（**认证之前**的公开路由）→ 服务端只读快照 → iframe | 服务端快照 + 浏览器沙箱 | 真实接通（第十轮） |
| Studio 原型预览 | `POST /api/studio/generation` 生成 → iframe `srcDoc` | 服务端生成 + 浏览器沙箱 | 真实接通 |
| 灵感模板预览 | 模板内容数据 → `KitTemplate` 渲染器（结构化数据 + 校验器） | 浏览器 | 真实接通 |
| 预览内容的"已保存/未保存"提示 | 本地 `updatedAt` 与 `cloudSaved` 比较 | 浏览器状态 | 真实接通 |

> 预览一律在浏览器沙箱里渲染，**不执行服务器上的用户代码**；隔离构建仍是 W1/F1 的未完成项（缺容器 runner）。

## 2. 执行入口

| 入口 | 真实调用链 | 落点 | 判定 |
|---|---|---|---|
| 技能执行台「运行」 | `POST /api/skill-runs` → `SkillService` → 对应执行器（`web.verify`/`test.browser` 真实 Chromium、`code.build` 受限子进程、`pdf.ocr` 真实 OCR、`data.connect` 只读连接器等） | 运行记录落库（含技能版本 + 本次授予的权限集合） | 真实接通（已接入执行器的技能） |
| 需要第三方能力的技能（`document.summarize`/`image.generate`/`collaboration.sync`） | 执行器已接真实端点，但凭据缺失时目录标 `unavailable` | — | 受凭据阻塞（缺 `AI_API_KEY`/`IMAGE_API_KEY`/日历邮箱凭据） |
| 首页「开始任务」 | `POST /api/chat`（SSE）→ 服务端按账号的模型配置转发 → 流式返回 | 对话与任务历史落库 | 真实接通（无密钥时明确报错，不编造回复） |
| 首页「AI 生成」 | `POST /api/generation` → 服务端模型 → 生成文件 → 先存本机再预览 | 本机项目 + 服务器项目（同步时） | 真实接通 |
| 编辑器「交给本机 agent 修改」 | `POST /api/projects/:id/agent` → `runAgentOnProject` → 本机 coding agent（codex/claude/opencode/gemini/cursor-agent） | 本机项目文件 | 未接入且已说明（服务端默认 `DESIGNBUDDY_ENABLE_LOCAL_AGENT=false`，返回 501 并写明未配置） |
| 视频「录制并导出 MP4」 | `POST /api/video/transcode` → ffmpeg | 下载的 MP4（无 ffmpeg 时如实下载 WebM） | 真实接通 |
| 公式重算 / OCR / 表格关联等技能 | 各自执行器在服务端跑真实计算，产出文件与来源证据 | 下载文件 + 运行记录 | 真实接通（准确率类结论仍需人工金标准） |

## 3. 发布与导出入口

| 入口 | 真实调用链 | 落点 | 判定 |
|---|---|---|---|
| 项目导出（JSON） | 本地 `projectStore` 导出 | 下载文件 | 真实接通 |
| Studio 导出 HTML / PDF / PPTX / Markdown / SVG / PNG | 浏览器端渲染 + `pptxBlob` 生成可编辑 PPTX | 下载文件 | 真实接通（**PPTX 仍需 PowerPoint 原生环境做最终验收**） |
| 模板「保存到服务器 / 恢复服务器版本 / 检查服务器版本」 | `PUT/GET /api/templates/:sample/:draft` → `template_snapshots` 表（带 revision 冲突保护） | 服务器快照 | 真实接通（**只是个人备份，不是公开发布**） |
| 项目只读分享链接 | `POST /api/projects/:id/shares` → 服务端生成不可猜 token | `/share/:token` 页面 | 真实接通（第十轮） |
| 社区作品公开发布 / 模板上架下架 | **没有实现**：没有公开发布入口，页面不提供假按钮 | — | 未接入（属于 P14，仍需发布/下架/审核流程） |
| 平台发布（微信/小红书等外部平台） | **没有实现**：需要平台账号与开放接口 | — | 未接入（属于 M4，需要用户给平台账号与 API 情况） |

## 4. 管理入口

| 入口 | 真实调用链 | 落点 | 判定 |
|---|---|---|---|
| 插件生命周期（安装/启停/卸载） | `POST /api/plugins/:id/install` 等 → `PluginRegistry` 写库 + 生命周期日志 | `installed_plugins` 表 + 日志 | 真实接通（插件只组合已登记技能，不执行第三方代码） |
| 模型与用量 | `GET /api/ai/models`（服务端实时核验）、`/api/ai/usage`（服务商回报的 token）、`/api/ai/quota`（额度探测） | 用量按账号归属 | 真实接通（无密钥时如实说未配置） |
| 定时任务 | `POST /api/schedules` → `ScheduleRunner`（cron + IANA 时区） | 运行历史落库 | 真实接通 |
| 工作空间与成员 | `/api/workspaces/**` → `WorkspaceStore`（四种角色、加入码） | SQLite | 真实接通 |
| 账号与数据（资料/密码/审计/注销/偏好/记忆/设备/导出/清除） | `/api/auth/**`、`/api/profile/**` → `WorkspaceBackend` | SQLite + 审计表 | 真实接通 |
| 素材库（本轮） | `/api/assets/**` → `AssetStore` | 磁盘 + SQLite + 事件表 | 真实接通（第十一轮） |
| 项目版本与审计 | `/api/projects/:id/versions|restore|audit` → `ProjectVersionStore` | SQLite | 真实接通 |
| 协作评论与在线状态 | `POST /api/projects/:id/collaboration` → 实时协作中枢 | 事件存储 | 真实接通（**不是字符级共编**） |
| 连接器授权 | `/api/connectors/**` → 固定返回 503「连接器授权服务尚未部署」 | — | 未接入且已说明（需要 OAuth 应用与沙箱账号） |
| 套餐/积分/支付 | 账号菜单显示「未接入」，不显示虚构余额 | — | 未接入且已说明（需要支付与权益台账） |
| 管理后台（跨账号用量汇总、账号处置、失败重试、审计） | `GET /api/admin/overview`、`POST /api/admin/accounts/:id/status`、`POST /api/admin/tasks/:ownerId/:taskId/retry`、`POST /api/admin/schedules/:ownerId/:id/status` → `AdminService` → `WorkspaceBackend` / `TaskBackend` | SQLite（`workspace_accounts.disabled`、审计表、任务/定时状态） | 真实接通（第十四轮）：管理员名单由服务端 `DESIGNBUDDY_ADMIN_ACCOUNTS` 决定，**未配置时任何账号一律 403**；停用账号立即删除其全部会话并拒绝再登录；成本账单仍未接入（只有服务商回报的 token 与调用次数） |

---

## 5. 结论

- 本轮审计**没有发现"点了没反应但界面上假装成功"的入口**：所有未接通的入口要么禁用按钮并写明原因，
  要么返回明确的错误码与说明文字。
- 仍然存在的结构性缺口（按优先级）：
  1. **隔离运行环境**（容器/云端 runner）缺失：预览与构建都还在本机/浏览器沙箱里跑。
  2. **公开发布链路**缺失：模板与社区作品没有上架/下架/审核/分享权限分级。
  3. **外部业务系统**（邮件、日历、图像模型、发布平台）缺凭据，适配器已在但没有真实调用。
  4. ~~**管理后台**缺失~~ → **第十四轮已补**：跨账号运营控制台（账号停用/恢复、AI 用量汇总、失败任务重试、定时任务启停、技能健康、审计）已落地并有证据；**仍缺**成本账单（价格/折算）、配额与限流策略、跨实例集中管理。
  5. **实时协同**仍是"保存即冲突检测 + 人工二选一"，不是字符级共编。
- 这些缺口都不是靠写一个入口就能关闭的：它们需要用户材料（凭据、账号、平台、判据）或真实环境。
