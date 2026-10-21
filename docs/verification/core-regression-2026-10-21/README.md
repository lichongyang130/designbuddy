# 核心回归与全仓审计整改验证报告（2026-10-21）

- **验证分支**：`arena/a684095c-designbuddy`
- **验证日期**：`2026-10-21`
- **唯一状态真源**：[`docs/plans/feature-status-registry.json`](../../plans/feature-status-registry.json) / [`docs/plans/feature-status-registry.md`](../../plans/feature-status-registry.md)

## 1. 自动化命令与实测结果汇总（全部零失败）

| 门禁层级 | 执行命令 | 实测通过数 | 失败数 | 关键覆盖内容 |
|---|---|---:|---:|---|
| 全仓类型检查 + 注册表一致性门禁 | `pnpm check` | **4 / 4 子门禁全绿** | **0** | `server/tsconfig.local.json`、`apps/web` (`tsc --noEmit`)、`apps/desktop` (`tsc -p tsconfig.json --noEmit`)、`verify-status-registry.mjs` |
| 前端/脚本纯单元与一致性门禁 | `pnpm test:unit` | **72 / 72** | **0** | 技能映射、澄清协议解析、i18n 多语种词表、公式差分校验、模板 kit 校验、注册表与锁版校验 |
| 服务端 HTTP API 与诚实性回归 | `pnpm test:api` | **103 / 103** | **0** | 会话鉴权、BYOK 凭据诚实报错、模型注册表与用量不编造、工作空间 RBAC、版本冲突、受控分享、定时任务、通知、管理后台 |
| 技能运行时全量执行器回归 | `FFMPEG_PATH=$PWD/node_modules/.cache/ffmpeg/ffmpeg pnpm test:skills` | **214 / 214** | **0** | 扫描 PDF OCR、多表 JOIN、白名单公式引擎、DOCX/PPTX 原生结构、离线 Whisper 英语 ASR、品牌/海报/信息图、权限与审批幂等 |
| Agent Core 工程内核回归 | `pnpm test:agent` | **3 / 3** | **0** | SQLite 重启持久化、幂等键与取消信号、Analyzer 语法/循环依赖扫描、项目隔离 Memory CRUD、隔离目录修改、Unified Diff、QA 评分与一键回滚 |
| 桌面端解包构建与哈希清单 | `pnpm stage:desktop` | **1 / 1** | **0** | 生成 `apps/desktop/dist/{main.js,preload.cjs,renderer/,stage-manifest.json}`（含 SHA-256 摘要） |
| 真实 Headless Chromium 端到端回归（29 个完整 `.spec.ts` 套件） | `pnpm --filter designbuddy-web exec playwright test ...` | **250 / 250**（另 2 项外部凭据门控自动 skip） | **0** | `/agent` 端到端工作台（建项→记忆→DAG 计划→Diff→QA→沙箱预览→刷新恢复→一键回滚）、`backend`、`sidebar`（320px–1440px）、`skills`（5 态筛选）、`workflows`、`clarification`、`auth`、`account`、`connectors`、`conversation`、`home`、`expert-match`、`model-registry`、`workspace`、`workspaces`、`plugin-lifecycle`、`admin-console`、`audio-transcribe`（离线 Whisper ONNX）、`skill-planning`、`skill-runtime`（CSV / DOCX / PPTX）、`task-skills`、`advanced-office`（扫描 PDF OCR / XLSX 关联）、`skill-phase-two`、`inspiration*`（9 类 30 套作品 + WebGL SwiftShader 实像素） |

## 2. 严格诚实边界声明（未伪装为已完成的部分）

1. **真实第三方商用 AI 模型联调（`external_blocked`）**：当前沙箱未注入外部 `AI_API_KEY` 且出网仅限 `github.com` / `npmjs` / `pypi`，因此 `document.summarize`、`image.generate` 及在线 LLM 流式推理均诚实报告 `needs_config` / HTTP 503，绝不返回伪造 AI 文本或图像。
2. **第三方 OAuth 与外部日历/邮件写入（`external_blocked`）**：`collaboration.sync` 与连接器市场未配置真实 OAuth Client Secret / 外部 API 端点，界面与服务端均诚实拒绝伪造连接成功。
3. **跨平台代码签名安装包（需 macOS / Windows 签名证书）**：本轮已完成 `apps/desktop` TypeScript 编译与 `stage-manifest.json` 解包构建校验；macOS 公证 `.dmg` 与 Windows `.exe` 数字签名安装包需在具备证书的对应系统 Runner 上产出。
4. **180 套模板扩充计划剩余量**：当前已交付 **30 套**离线可运行模板（扩充计划已完成 **17 / 180**，剩余 **163 套**列为后续分批计划）。
