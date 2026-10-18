# 验收证据包：工作流（点几下完成一件事，P17）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-17（第十三轮）
- 证据包目录：`docs/verification/workflows-2026-10-17/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**56 项全部通过**（desktop 1440×900 与 mobile 390×844 各 28 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/workflows.spec.ts`（Playwright，5 项：跑通信息图工作流、文件型工作流、缺答案不启动、产物继续编辑/存为素材、首页场景跳转）
- 服务端用例：`server/api/workflows.test.cjs`（node:test，12 项，全部为新增）

## 这次验收证明什么

1. **工作流真的执行了技能**：向导里填的答案被装配成技能要求的 JSON（信息图）或直接取服务器素材库里的
   真实文件（表格），服务端合成 multipart 调 `SkillService.handle()`，跑完后页面列出**真实产物**
   （`infographic.svg` / `infographic.png`），产物可下载。
2. **缺答案不会开跑**：必填项没填时，点「下一步：确认」只得到"请先填写：…"的提示，
   运行记录里没有多出一次运行。
3. **不可用的步骤写明缺什么**：「文档要点与成品」的第 2 步要 `AI_API_KEY`/`OPENAI_API_KEY`，
   本机没有配置时该步状态是 `unavailable`，卡片与结果页都写明"服务端 AI_API_KEY/OPENAI_API_KEY 未配置；
   不会生成伪摘要；这一步没有执行，也没有生成结果"，整条运行是 `partial`，**不会报成功**。
4. **产物有两条真实去处**：文本类产物可以「继续编辑」（新建项目 → 进编辑器 → 同步一份到服务器版本库），
   任意产物可以「存为素材」（进服务器素材库，素材页可见）。
5. **运行记录在服务器上**：换一个入口（历史列表）能重新打开同一次运行；`GET /api/workflow-runs` 返回本人记录。
6. **两步以上的链路真的传产物**：`document.format` 产出的 `organized.docx` 直接作为下一步
   `document.summarize` 的输入，不是各跑各的。

## 明确不成立的结论

- **不是通用自动化**：工作流是固定配方的固定顺序，不能自己写步骤、不能加分支、不能定时跑。
- **不能替用户确认第三方账号**：`document.summarize` 这一步即使配了 AI 密钥，也必须单次勾选授权，
  没勾就跳过并写明原因。
- **没有「存为社区模板」**：社区模板存的是"模板族"的状态结构，工作流产物是文件；
  强行发布会生成打不开的副本，所以这一条**没有做**，见 `docs/plans/workflow-plan.md` 第 6.4 节。
- **没有用户自建与分享配方**（本轮按方案默认值不做）。
- 首页 15 个场景里只有 5 个接了真配方，其余 10 个仍走原来的对话链路——没有放假按钮。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json
node --test server/api/workflows.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/workflows.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-workflows.suite.json \
  --out docs/verification/workflows-2026-10-17
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
