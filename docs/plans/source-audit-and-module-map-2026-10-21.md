# 全仓源码审计结论、主运行链与模块所有权映射（2026-10-21）

本文档固化本轮源码级全面审计的架构边界结论，用于消除“多套同名目录并存导致误改死代码”与“口头完成度口径冲突”两类核心风险。实时完成度数字统一以 [`feature-status-registry.json`](./feature-status-registry.json) 为唯一权威真源。

---

## 一、唯一权威主运行链（Canonical Runtime Chain）

当前生产/本地预览实际执行的链路只有以下四层，所有功能开发、缺陷修复与回归验证**必须且只能**作用在该主链上：

1. **Web 前端主入口（端口 `0.0.0.0:5173`，Vite 反代 `/api` → `http://127.0.0.1:8787`）**
   - 根组件与路由切换：`apps/web/src/main.tsx` → `apps/web/src/App.tsx`（约 190 行壳层）→ `apps/web/src/routes/WorkspaceRouteSwitch.tsx`（20 条路由 `React.lazy` 分发）+ `apps/web/src/features/home/HomeComposerSection.tsx` + `apps/web/src/features/shell/useAppDocumentPreferences.ts`
   - 工作区与业务页面：`frontend/workspace/pages/*`（首页附件技能、任务执行、技能市场 `SkillsPage.tsx`、插件 `PluginsPage.tsx`、连接器 `ConnectorsPage.tsx`、自定义工作流 `WorkflowsPage.tsx`、模型注册表 `ModelsPage.tsx`、管理台 `AdminPage.tsx`、**Agent 工程工作台 `AgentWorkbenchPage.tsx` 含 HITL 人工审批闸门** 等）
   - 共享导航、编辑器与场景预览：`apps/web/src/components/*`（`WorkBuddySidebar.tsx`、`ScenePreview.tsx`、`SettingsModal.tsx` 等）
   - 社区灵感与 33 套离线可运行模板：`apps/web/src/inspiration/*`（含 6 套 24 页 kit 数据驱动模板共 144 页 / 48 张原创 SVG）
2. **前后端共享契约层（`shared/*`）**
   - `shared/skillRuntime.ts`（含 `SkillCapabilityState` 5 态：`ready` / `needs_config` / `needs_auth` / `unavailable` / `failed`）
   - `shared/skillPlanning.ts`、`shared/expertRouting.ts`、`shared/sceneCatalog.ts`
3. **本地/服务端统一守护进程（端口 `0.0.0.0:8787`）**
   - 进程入口：`server/local-daemon.ts`（编译产物 `dist/local/server/local-daemon.js`，SQLite 持久化 `data/designbuddy.sqlite`）
   - HTTP API 路由层：`server/api/*`
     - `http-handler.ts`（会话鉴权、项目 CRUD、FFmpeg 转码）
     - `workspace-backend.ts`（统一任务、对话云同步、用户自定义专家/技能）
     - `agent-hub.ts`（`/api/agent-core/{architecture,analyze,plan,qa,runs,memories}`）
     - `chat.ts`、`ai.ts`、`ai-models.ts`、`expert-match.ts`
     - `workspaces.ts`、`project-versions.ts`、`project-shares.ts`、`scheduler.ts`、`task-backend.ts`、`workflows.ts`、`plugin-registry.ts`、`plugins.ts`、`assets.ts`、`community-templates.ts`、`admin.ts`
   - **Agent Core 工程内核（`server/agent/*` + `packages/ai-core/runtime/AgentRuntime.ts`）**
     - `packages/ai-core/runtime/AgentRuntime.ts` + `server/agent/cli-runtime.ts`：SQLite 持久化状态机（`runId`、状态流转、重试计数、幂等键、取消信号、步骤级超时、结构化日志与产物快照）
     - `server/agent/analyzer.ts`：基于 `parse5` / `postcss` / `acorn` 的真实静态项目分析器（入口、依赖图、循环依赖、断链与语法风险）
     - `server/agent/planner-engine.ts`：有向无环图（DAG）执行计划器（支持模型规划与无密钥确定性本地降级 `deterministic-fallback`）
     - `server/agent/memory-engine.ts`：严格按 `(ownerId, projectId)` 隔离的项目长期记忆 CRUD 与计划注入引擎
     - `server/agent/project-runner.ts`：按 `runId` 隔离的临时工作目录、项目级并发互斥锁、原子写回与一键回滚
     - `server/agent/qa-agent.ts` + `server/agent/orchestrator.ts`：自动语法/引用/无障碍检查、Unified Diff 生成与端到端编排器
   - **确定性技能执行引擎（`server/skills/*`）**
     - `executors.ts`、`runtime-catalog.ts`、`service.ts`、`worker.ts`、`planner.ts` 及各专项执行器模块（47 项注册技能 = 44 项本机 ready + 3 项外部凭据受阻，0 无执行器空壳）
4. **桌面端宿主（Electron 44.7.0）**
   - `apps/desktop/src/{main.ts,preload.cjs}` → 编译输出 `apps/desktop/dist/{main.js,preload.cjs}`，通过 `apps/desktop/scripts/stage.mjs` 打包校验 `dist/renderer/` 与 SHA-256 清单 `dist/stage-manifest.json`。

---

## 二、已清理的伪 UI 补丁脚本与未挂载骨架目录清单

### 2.1 本轮已彻底清除的污染文件（由 `verify-status-registry.mjs` 防止回流）

- 根目录历史 monkeypatch 注入脚本：`scripts/add_*.mjs`、`scripts/fix_*.mjs`、`scripts/patch_*.mjs`、`scripts/inject_*.mjs`（已全部删除；测试文件 `scripts/add-3-templates.test.mjs` 等正规单元测试完整保留）。
- 未挂载的伪演示组件：`apps/web/src/components/{CanvasEngine,DesignLibraryModal,PreviewToolbar,ProjectWorkspace,TaskMonitor,VersionHistory}.tsx` 及 `apps/web/src/utils/exportProject.ts`（其中包含 `setTimeout` 假进度、假 `0x9f8c...` 哈希与 `alert()` 占位，已全部清除；真实能力由 `/agent` 工作台、`project-versions.ts` 与 `ScenePreview.tsx` 承载）。
- 模板组件中破坏无障碍语义与测试契约的残留字符补丁（`InspirationPage.tsx` 中覆盖 `<BrandArtwork />` 的内联背景块、`AtelierPrototype.tsx` 动态篡改禁用按钮名、`HyperFramesPlay.tsx` 按钮 emoji 前缀）已全部修复还原。

### 2.2 明确标记为 `skeleton_unmounted`（未接入主运行链）的历史独立目录

以下目录在早期多方案探索中创建，当前**不在** `apps/web/src/App.tsx` 或 `server/local-daemon.ts` 主调用链上（除 `packages/ai-core/runtime/AgentRuntime.ts` 已被主链 `server/agent/cli-runtime.ts` 正式引用外）：

| 目录路径 | 当前角色状态 | 说明与后续治理约定 |
|---|---|---|
| `apps/api/` | `skeleton_unmounted` | 早期独立 API 草稿目录；**严禁**在此添加新接口，所有服务端路由统一写在 `server/api/` |
| `apps/web/components/` | `skeleton_unmounted` | 注意区分 `apps/web/src/components/`（主链正在使用）与 `apps/web/components/`（未接入主链的历史组件草稿） |
| `packages/agent-core/`、`packages/code-engine/`、`packages/design-system/`、`packages/export-engine/`、`packages/inspiration-hub/`、`packages/plugin-system/`、`packages/project-engine/`、`packages/skills-hub/`、`packages/studio-core/`、`packages/workspace/` | `skeleton_unmounted` | 早期 workspace 子包脚手架；真实运行逻辑位于 `server/agent/`、`server/skills/`、`server/api/` 与 `frontend/workspace/` |

---

## 三、`apps/web/src/App.tsx` 后续模块化拆分路线（先立边界再拆分）

在 29 个 Playwright 套件（250 项浏览器端到端断言）与 `pnpm check` / `pnpm test` 全部建立 automated 门禁后，后续拆分 `apps/web/src/App.tsx` 按以下 4 个零耦合子域逐步抽离：

1. `apps/web/src/routes/WorkspaceRouteSwitch.tsx`：纯路由分发（`/plugins`、`/skills`、`/connectors`、`/workflows`、`/schedules`、`/models`、`/workspaces`、`/admin`、`/agent`、`/share/:token`、`/inspiration/*`）。
2. `apps/web/src/features/home/HomeComposerView.tsx`：首页输入框、模式/模型菜单、专家推荐与附件上传状态。
3. `apps/web/src/features/conversation/TaskConversationView.tsx`：SSE 流式对话、澄清卡片（`taskClarification.ts`）与右侧 `ScenePreview` 联动。
4. `apps/web/src/features/shell/AppShellChrome.tsx`：全局侧边栏（`WorkBuddySidebar`）、顶栏通知、账号菜单与 `SettingsModal`。
