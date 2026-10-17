# 入口审计：预览 / 执行 / 发布 / 管理（P16）

更新：2026-10-16（第三轮）。本文件逐个入口核对**真实调用链**，只写实际发生的事：
界面元素 → 前端处理 → 服务端接口 → 实际效果。凡是没有落地的，明确写"未接通"，
不用适配器、mock 或本地清单冒充已完成能力。

审计方法：读代码路径（`apps/web/src`、`frontend/workspace`、`server/api`、`server/skills`），
并用浏览器用例验证关键链路（`apps/web/tests/*.spec.ts`）。

---

## 1. 预览入口

| 入口 | 位置 | 真实调用链 | 结论 |
|---|---|---|---|
| 任务对话「右侧预览」 | `frontend/workspace/pages/TaskConversationPage.tsx` | 按钮 → `PreviewSidePanel` → `buildPreviewDocument()` 生成沙盒 HTML → `<iframe sandbox>` 渲染本机项目文件 | ✔ 真实预览（本机）。窄屏为浮层，已按输入区实测高度让位，**不再遮挡"发送"按钮** |
| 编辑器「右侧预览」 | `frontend/workspace/pages/ProjectEditorPage.tsx` | 同上，split 布局 `minmax(260px,42%) / minmax(320px,1fr)` | ✔ 真实预览（本机） |
| 技能产物预览 | `frontend/workspace/SkillWorkbench.tsx` | 运行记录里的图片/HTML → 后端返回的产物字节 → `URL.createObjectURL` | ✔ 真实产物预览 |
| 灵感库模板封面 | `apps/web/src/inspiration/InspirationPage.tsx` | 20 个手写原型 + 3 个数据驱动套件（`samples/kit`）各自渲染真实页面 | ✔ 真实可交互页面；**不是运行结果截图** |
| 分享链接预览 | `frontend/workspace/pages/ShareProjectPage.tsx` | URL hash 携带源文件 → 只读 `iframe sandbox=""` + CSP 剥离脚本 | ✔ 只读预览；导入后在本机创建独立副本 |

**未接通**：没有"发布到公网后回看线上地址"的预览（需要部署目标，见 P16 第 4 节）。

---

## 2. 执行入口

| 入口 | 真实调用链 | 结论 |
|---|---|---|
| 技能执行台「上传并执行技能」 | 前端取文件 + 勾选同意 → `POST /api/skill-runs` → `server/skills/executors.ts` 真实执行器 → 产物下载 | ✔ 真实执行；失败整次失败、不产出半成品 |
| 模型方案「确认方案并执行一次」 | `POST /api/skill-plans`（只生成方案，不执行）→ 人工核对勾选 → `POST /api/skill-runs` | ✔ 两段式，执行需单独确认 |
| 首页「用实际文件执行技能」 | 选文件 → 任务页技能工作台 → 同上 | ✔ 真实执行；不自动发聊天 |
| 定时任务 | `server/api/scheduler.ts` 定时扫描 `schedules` → 白名单主机内真实 HTTP 请求 → 写 `schedule_runs` → 失败发通知 | ✔ 真实调度（本轮新增） |
| `code.build` | 临时目录展开 → 子进程跑白名单命令 → 产物打包 | ◐ 本机受限执行；**不是容器隔离** |
| `web.verify` / `test.browser` | 真实 Chromium 打开目标 → 断言/点击 → 截图 + 控制台 + 网络证据 | ✔ 真实浏览器执行（需授权目标） |
| `image.generate` | OpenAI 兼容端点真实调用 | ⛔ 缺 `IMAGE_API_KEY/BASE_URL/MODEL` 时保持不可用 |
| `collaboration.sync` | 日历/邮件接口真实调用，逐次确认 + 幂等键 + 审计 | ⛔ 缺通道凭据时保持不可用 |
| `document.summarize` | 服务端模型真实调用 | ⛔ 缺 `AI_API_KEY` 时自动不可用，不产出伪摘要 |

**未接通**：容器/云端隔离 runner（F1、W1 的前置）、PowerPoint 原生渲染验收（P3）。

---

## 3. 发布入口

| 入口 | 现状 | 结论 |
|---|---|---|
| 项目分享链接 | 源文件编码进 URL hash，接收方只读预览并可导入本机 | ✔ 可用，但不是"发布到服务"；链接长度受限（≤1MB） |
| 复制分享文本 / 下载对话 | 本地剪贴板 / 本地文件下载 | ✔ 明确是本地动作 |
| 模板「做同款」 | 在本机创建草稿副本 | ✔ 本机副本 |
| 邮件 / 日历 / 平台发布 | `collaboration.sync` 适配器已就位，缺凭据与测试账号 | ⛔ 未接通，不会用模拟发送代替 |
| 社区作品发布 / 下架 / 分享权限 | 无服务端发布记录 | ⛔ 未接通（P14） |

---

## 4. 管理入口

| 入口 | 现状 | 结论 |
|---|---|---|
| 技能目录 | 服务端注册表（46 项）→ 前端按状态/分类/收藏筛选；缺凭据的能力显示"执行器已接入 · 缺服务端凭据"且不给运行入口 | ✔ 目录真实；"添加技能"明确说明当前没有客户端安装外部技能包 |
| 插件市场 | 条目规格 + 风险标注 + "加入本地清单"；文案明确"不代表安装、授权或已可执行" | ⛔ 无真实插件生命周期（P08） |
| 连接器 | 凭据只从服务端环境变量读取，来源白名单；目录页展示规格 | ◐ 真实读取已具备；授权回调、凭据刷新、断开撤销未做（P09） |
| 自建专家 | 本机创建 + 目录 + 详情 + 手动指派 | ✔ 本机真实；不能替代内置专家的执行器 |
| 通知中心 | 服务端收件箱（未读/已读/删除）+ 本机镜像 | ✔ 真实同步 |
| 定时任务 | 服务端调度 + 运行历史 + 启停 | ✔ 真实 |
| 账号 / 套餐 / 设置 / 设备 | 只有本地偏好与服务状态面板 | ⛔ 生产身份、支付、跨设备记忆未做（P04/P12/P13） |

---

## 5. 本轮修掉的真实缺陷

1. **右侧预览抽屉遮挡"发送"按钮**：≤1100px 时预览面板是 `position:fixed` 浮层，盖住输入框右下角的发送按钮，
   导致对话的追问无法发出（`tests/expert-match.spec.ts` 30 秒超时暴露）。
   修法：输入区用 `ResizeObserver` 实测高度写入 `--task-composer-h`，抽屉底边停在该高度之上
   （`frontend/workspace/pages/TaskConversationPage.tsx` + `pages/task-conversation.css`）。
2. **通知与服务器的竞态**：本地通知先于服务端创建成功时，"已读/删除"请求会先于创建到达服务端而 404，
   刷新后通知复活。修法：记录在途的服务端推送，删除/已读在推送完成后再发出；
   合并时以本地已读状态为准并重试服务端置读
   （`frontend/workspace/notifications.ts`）。
3. **通知 id 不能进 URL**：旧 id 含 `:`，`encodeURIComponent` 后服务端路由匹配不到；
   改为只使用 URL 安全字符，并在服务端解码路径后再匹配
   （`frontend/workspace/notifications.ts`、`server/api/task-backend.ts`）。

---

## 6. 仍未接通的清单（不因本审计而勾选完成）

- 插件真实生命周期：获取 / 安装 / 启用 / 卸载 / 兼容版本检查 / 权限确认 / 运行日志（P08）
- 社区发布与分享权限（P14）
- 生产身份、套餐与权益账本（P04/P12）
- 跨设备偏好与用户授权的长期记忆（P13）
- 隔离构建与部署 runner（F1/F5）
- 真实供应商模型、邮件日历送达、PowerPoint 原生渲染、36 个真实业务案例
