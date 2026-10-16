# DesignBuddy 与 OpenDesign 当前差距

对比对象：本地 `Projects/new`（DesignBuddy AI）与 [nexu-io/open-design](https://github.com/nexu-io/open-design)。按当前工作区源码和 OpenDesign 官方 README 核对，更新时间：2026-10-14。表中的“源码已实现”表示能在本仓库找到相应实现；依赖外部服务或尚未实际运行验证的能力会单独标明。

| 领域 | 你的源码当前情况 | OpenDesign 当前情况 | 仍存在的差距 |
| --- | --- | --- | --- |
| 前端/桌面架构 | React + Vite；`apps/web` 是 Web 主应用；`frontend/workspace` 放工作区页面、状态和 API；Electron 桌面入口复用 Web renderer | Web 工作区与 Electron 桌面应用 | 目标目录划分已对齐。OpenDesign 另提供 macOS/Windows 发布安装包；本仓库已有桌面入口，但发布/自动更新流程仍需实际构建和发布配置。 |
| 本地优先与启动 | 有 loopback 本地 daemon、SQLite 项目/成员/协作事件存储；启动需先构建 Web，再运行 `pnpm local:daemon` | 本地优先桌面应用，官方提供预构建安装包，也可从源码运行 | 你的本地服务路径已存在，但安装后的免配置体验、打包数据目录迁移/备份等完整桌面交付能力仍需完善。 |
| 项目与设计工作流 | 有项目编辑器、设计系统选择、`DESIGN.md` 品牌契约、AI 首稿、预览与导出 | brief → 设计规范 → agent 创作/迭代 → 团队反馈的统一项目流程；支持把现有代码仓库交给 agent 按品牌规范改造 | 主流程方向一致；本仓库缺少 OpenDesign 那种丰富的示例项目、现有仓库导入/改造专门流程及成熟的一体化交付闭环。 |
| 设计系统 | 可从本地 catalog 选择 token，并写入项目 `DESIGN.md`、传入生成请求 | README 列出 151 套设计系统，支持通过可移植目录管理和扩展 | 已有应用链路，但内置设计系统数量、导入/发布/版本管理和社区共享能力不足。 |
| 模板、技能、插件 | 仓库有 skills/plugins/experts/marketplace 相关模块；生成链路能带入所选 skill/expert | 设计模板、功能技能、插件、设计系统分层；官方 README 列出 100+ skills、261 个官方插件和独立设计模板目录 | 本仓库尚未形成同等规模、统一 manifest/版本规范和可直接运行的设计模板/插件生态；当前目录和 UI 不能等同于完整可安装目录。 |
| AI provider / BYOK | 有浏览器会话级 BYOK；后端支持固定 provider endpoint，另有 SSE 代理；服务端密钥可配置 | 支持更多 provider、任意兼容 endpoint（含本地 Ollama/LM Studio/vLLM 等）与本机 OpenDesign Cloud 登录体验，并在代理层提供目标地址 SSRF 防护 | 本仓库 provider/endpoint 可配置范围更窄；还缺任意自定义 base URL、本地模型预设、云账号免配置路径及同等级 SSRF 防护。 |
| Coding agent 接入 | 有 MCP HTTP/stdio 和配置脚本；提供 Codex、Claude Code、OpenCode、Gemini、Cursor Agent 五种本机 CLI 执行入口 | 官方 README 列出更多 MCP/skill/CLI 集成，支持自动发现 CLI；部分 native runtime 提供结构化流、模型发现、取消和会话恢复 | 当前适配器集合较小，执行主要是一次性 prompt→进程输出；缺少广泛自动发现、统一实时事件/结构化输出、取消、续跑和会话管理。 |
| 多媒介生成 | AI 生成网页 HTML、slides 内容、矢量海报图形、视频分镜；支持 HTML/PPTX/PDF/Markdown、SVG/PNG、WebM/MP4 导出 | 原型、slides、真实图片生成与 HyperFrames 视频；有图片提示词目录、视频模板/素材工作流 | 图片目前是 AI 返回形状后绘制的矢量海报，不是图片模型生成的位图；视频目前是简单场景/Canvas 动画与 FFmpeg 转码，没有 HyperFrames、复杂时间轴、音轨和视频生成模型链路。 |
| 原型/成果编辑 | 可编辑项目源码并预览网页；Studio 的 slides、矢量图和视频分镜可编辑 | 工作区内创建/预览原型、slides、图像和视频，并让 agent 在同一项目继续迭代；包括 live dashboard 类交互成果 | 本仓库成果类型都有首稿路径，但面向 dashboard/应用的交互 artifact、原位参数编辑、统一版本迭代体验还不够完整。 |
| 协作 | 本地 daemon 支持 viewer/editor、项目评论、presence/cursor 事件和 SQLite 事件历史；跨主机需共享 DB/broker 和真实身份认证 | 产品工作流内团队分享、反馈与 agent 迭代；支持本地运行或自部署 | 单机/共享 SQLite 部署有基础协作；缺少完整邀请/用户目录、跨部署实时协作服务和成熟团队管理流程。 |
| 部署与发布 | 项目 README 明确指出认证、持久化、AI、preview/runtime/deployer 等需接入真实服务；GitHub Pages 仅静态预览 | 官方提供桌面发行版和从源码启动路径，产品能力集成在应用内 | 本项目仍需完成端到端部署配置、桌面发布流程及真实环境验证；代码模块存在不代表生产环境已可用。 |
| 许可与资产来源 | 仓库根目录未发现 LICENSE | 官方仓库声明 Apache-2.0，并对部分内置资源保留各自许可证 | 如准备公开分发，需要先确定本项目许可证，并梳理第三方模板、图标、字体和素材的授权。 |

## 优先补齐建议

1. **先验证可交付主路径**：从干净安装开始构建 Web/Electron，验证本地 daemon、AI 生成、项目保存和预览；补齐桌面打包与发布配置。
2. **再补设计资产体系**：统一 design system、template、skill、plugin 的 manifest、导入/安装、版本和来源许可；扩充可直接使用的设计模板。
3. **提升 agent runtime**：先做 CLI 自动发现与运行状态/取消，再补流式结构化事件、会话恢复和更多 agent 适配。
4. **补媒介能力**：接入真正的图像生成 provider；把视频从静态分镜/简单动画扩展到时间轴、音频/素材及稳定 MP4 渲染。
5. **需要多人部署时再扩展协作**：接入身份提供方、邀请/用户目录和共享实时事件服务；目前本地 SQLite 协作不等于完整云协作。

## 对比范围说明

OpenDesign 功能及数量按其官方 README 描述；本文件不代表对 OpenDesign 每个功能逐项运行验证。DesignBuddy 的判断以当前源码和 README 为准，未执行构建或端到端验收，因此不把“接口/组件存在”视为“生产环境已验证”。OpenDesign 官方说明其产品覆盖原型、slides、图像、HyperFrames 视频及多种 agent 接入：[官方 README](https://github.com/nexu-io/open-design)。
