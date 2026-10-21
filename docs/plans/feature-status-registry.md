# 权威功能状态注册表（Authoritative Feature Status Registry）

> **唯一数字真源声明**：本仓库所有工程台账、缺口审计与回归报告均以同目录下的机器可读文件 [`docs/plans/feature-status-registry.json`](./feature-status-registry.json) 为唯一权威口径，并由 `pnpm test:registry`（`scripts/verify-status-registry.mjs`）在本地与 CI 中自动核对实时源码计数与磁盘证据路径。任何数字漂移、幽灵引用路径、孤立骨架回退、`"latest"` 浮动依赖或把外部凭据阻塞项标成 `verified_local` 的修改都会使门禁直接失败。

## 1. 实时核验核心基线（核验日期：2026-10-21）

| 口径项 | 机器实测精确值 | 代码真源 | 说明 |
|---|---:|---|---|
| 注册技能总数 | **47** | `server/skills/executors.ts` / `runtimeCatalog()` | 全部 47 项均绑定真实后端执行器（**无执行器占位 = 0**） |
| 本机已就绪技能（`ready`） | **44** | `server/skills/runtime-catalog.ts` | 本机已安装 FFmpeg、离线英语 ASR 模型、LibreOffice 与离线 Chromium 实测值 |
| 外部凭据受阻技能 | **3** | `server/skills/runtime-catalog.ts` | `document.summarize`（`needs_config`：缺 `AI_API_KEY`）、`image.generate`（`needs_config`：缺图像 API 凭据）、`collaboration.sync`（`needs_auth`：缺日历/邮件外部授权端点） |
| 12 位专家端到端真实业务案例 | **36 / 36（100%）** | `server/skills/expert-business-cases.test.cjs` | 12 位专家 × 3 个独立真实业务输入→Worker 执行→产物 SHA-256 核验（共 34 项 `ready` 技能、166 个落盘产物，见 [`docs/verification/expert-36-cases-2026-10-21.md`](../verification/expert-36-cases-2026-10-21.md)） |
| 社区灵感可运行模板总数 | **33** | `apps/web/src/inspiration/samples/shared.tsx` | 覆盖全部 **9** 个分类（原型 14、幻灯片 2、文档 2、图片 2、HyperFrames 5、视频 1、音频 1、实时产物 5、WebGL 1） |
| 180 套模板扩充进度 | **20 / 180（剩余 160）** | `apps/web/src/inspiration/samples/` | 除早期 13 套基线作品外，已交付 6 套 24 页独立原型 + 6 套 kit 24 页原型（`studio-nine`/`wellspring`/`circuit`/`paperhouse`/`campus`/`paws` 共 144 页 + 48 张原创 SVG）+ 4 套 HyperFrames + 4 套实时工具 |
| Web 主入口包体积与孤立骨架 | **258.49 kB（0 警告）/ 0 孤立包** | `apps/web/src/App.tsx` + `apps/web/vite.config.ts` | `App.tsx` 由 815 行拆分为约 190 行壳层 + 20 路由按需懒加载，主入口 JS 由 `2,228.46 kB` 降至 `258.49 kB`（`-88.4%`）；零引用骨架目录已清理归零 |
| `"latest"` 浮动版本依赖数 | **0** | `package.json`、`apps/web/package.json`、`apps/desktop/package.json` | 已全部锁定到 `pnpm-lock.yaml` 实装精确版本 |

## 2. 状态枚举定义（严禁把骨架或外部阻塞项标为完成）

- `verified_local`：前后端/运行时链路已在当前分支真实跑通，具备自动化单元/API/Chromium E2E 证据，不依赖未配置的第三方商用密钥。
- `partial_subset`：受限子集已在本地真实跑通并有自动化证据，但完整生产闭环仍余明确工程增量或预发联调项。
- `external_blocked`：代码契约、参数校验与失败保护已就绪，但真实线上执行受外部商用 API Key、OAuth 应用凭据或生产支付/签名环境阻塞，**绝不伪造通过**。
- `skeleton_unmounted`：历史遗留独立目录或脚手架代码（现已全部清理并通过 `verify-status-registry.mjs` 防止回退）。

## 3. 全量模块状态与证据总表

| 功能 ID | 模块 | 当前状态 | 核心代码入口 | 自动化测试证据 | 外部依赖 | 核验日期 | 下一步计划 |
|---|---|---|---|---|---|---|---|
| `F01-AGENT-STATE-MACHINE` | Agent Core 状态机、持久化运行器与人工审批闸门（HITL） | `verified_local` | `packages/ai-core/runtime/AgentRuntime.ts`, `server/agent/{cli-runtime,project-runner,orchestrator}.ts`, `server/api/agent-hub.ts` | `server/agent/agent-core.test.cjs`, `apps/web/tests/agent-workbench.spec.ts` | 无 | 2026-10-21 | 多节点生产部署时补充跨实例分布式 worker 锁 |
| `F02-AGENT-ANALYZER-PLANNER-MEMORY-QA` | Analyzer / DAG Planner / Memory / QA Gate & Diff | `verified_local` | `server/agent/{analyzer,planner-engine,memory-engine,qa-agent}.ts`, `frontend/workspace/pages/AgentWorkbenchPage.tsx` | `server/agent/agent-core.test.cjs`, `apps/web/tests/agent-workbench.spec.ts` | 可选 `AI_API_KEY`（缺省显式走 deterministic-fallback） | 2026-10-21 | 有真实模型密钥时补跑 model 对比回归 |
| `F03-SKILL-RUNTIME-47` | 技能运行时、执行时间线与 36 个专家真实业务案例（47 = 44 ready + 3 受阻） | `verified_local` | `shared/skillRuntime.ts`, `server/skills/{executors,runtime-catalog,service}.ts`, `frontend/workspace/{SkillWorkbench.tsx,pages/SkillsPage.tsx}` | `server/skills/expert-business-cases.test.cjs`, `docs/verification/expert-36-cases-2026-10-21.md`, `apps/web/tests/{skills,skill-runtime,skill-phase-two,advanced-office,audio-transcribe,task-skills}.spec.ts` | 无 | 2026-10-21 | 补充技能包版本兼容矩阵与容器级沙箱 |
| `F04-EXTERNAL-SKILLS-3` | 外部凭据受阻 3 技能（摘要/生图/日历邮件同步） | `external_blocked` | `server/skills/{office,image-generate,collaboration-sync}.ts` | `apps/web/tests/{skill-planning,skills}.spec.ts` | `AI_API_KEY`、图像 API Key、日历/邮件外部授权端点 | 2026-10-21 | 注入真实密钥与沙箱账号后执行线上验收 |
| `F05-CHAT-ROUTER-MODEL-HONESTY` | 对话流、技能产物继续提问交接、专家路由与模型注册表 | `partial_subset` | `server/api/{ai,ai-models,chat,expert-match}.ts`, `frontend/workspace/{pages/TaskConversationPage.tsx,taskClarification.ts}` | `server/api/chat.test.cjs`, `apps/web/tests/{agent-workbench,conversation,clarification,expert-match,model-registry}.spec.ts` | 真实云模型推理需 `AI_API_KEY` | 2026-10-21 | 预发环境接入真实供应商 API Key 对账 |
| `F06-WORKSPACE-AUTH-PROJECTS-SHARES-WORKFLOWS` | 统一任务、会话、空间 RBAC、版本、分享、定时、通知与自建工作流 | `verified_local` | `server/api/{http-handler,workspace-backend,task-backend,workspaces,project-versions,project-shares,scheduler,workflows}.ts`, `frontend/workspace/pages/WorkflowsPage.tsx` | `server/api/{workspace-backend,workflows}.test.cjs`, `apps/web/tests/{agent-workbench,backend,auth,account,workspace,workspaces,workflows}.spec.ts` | 无 | 2026-10-21 | 补找回密码、2FA 与生产支付订阅账本 |
| `F07-CONNECTORS-ADMIN-PLUGINS` | 连接器授权边界、插件生命周期与管理员后台 | `partial_subset` | `server/api/{workspace-backend,plugin-registry,plugins,admin}.ts` | `apps/web/tests/{connectors,plugin-lifecycle,admin-console}.spec.ts` | 第三方 OAuth 密钥、`DESIGNBUDDY_ADMIN_ACCOUNTS` | 2026-10-21 | 接入预发 OAuth 回调与管理员细粒度角色 |
| `F08-INSPIRATION-TEMPLATES-33` | 社区灵感与交互模板库（33 套已交付；扩充 20/180） | `partial_subset` | `apps/web/src/inspiration/{InspirationPage.tsx,samples/shared.tsx,samples/kit/kitTypes.ts,samples/kit/sets/index.ts}` | `apps/web/tests/{inspiration-categories,inspiration,inspiration-atelier,inspiration-batch1,inspiration-kit,inspiration-media}.spec.ts` | 无 | 2026-10-21 | 按 kit 校验规范分批推进剩余 160 套实质模板 |
| `F09-BUILD-PINNING-DESKTOP-CI` | 依赖锁版、Vite 零警告拆包、GitHub Actions CI 与 Electron Stage 构建 | `verified_local` | `package.json`, `apps/web/{package.json,vite.config.ts}`, `apps/desktop/{package.json,src/main.ts,scripts/stage.mjs}`, `.github/workflows/ci.yml` | `scripts/verify-status-registry.test.mjs`, `apps/web/playwright.config.ts` | macOS/Windows 代码签名证书（安装包签名阶段） | 2026-10-21 | 在 macOS/Windows Runner 接入签名安装包构建 |
| `F10-MODULAR-SHELL-CLEAN-TREE` | Web 入口模块化拆分（`App.tsx` ≤250 行）与零孤立骨架目录 | `verified_local` | `apps/web/src/{App.tsx,routes/WorkspaceRouteSwitch.tsx,features/home/HomeComposerSection.tsx,features/home/useHomeComposerController.ts,features/shell/useAppDocumentPreferences.ts,components/WorkBuddySidebar.tsx}`, `docs/plans/source-audit-and-module-map-2026-10-21.md` | `scripts/verify-status-registry.test.mjs`, `apps/web/tests/{home,sidebar}.spec.ts` | 无 | 2026-10-21 | 持续守住 `App.tsx` 轻量边界与零孤立目录门禁 |
