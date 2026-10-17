# 验收证据包：项目版本历史 / 并发冲突恢复 / 权限审计（P15）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-16（第五轮）
- 证据包目录：`docs/verification/project-versions-2026-10-16/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**22 项全部通过**（desktop 1440×900 与 mobile 390×844 各 11 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/project-versions.spec.ts`（Playwright，3 项）
- 服务端用例：`server/api/project-versions.test.cjs`（node:test，12 项）

## 这次验收证明什么

1. **每次保存都留下版本**：项目首次同步后，服务器按文件记录版本（v1 起），历史面板能看到版本条目，
   审计轨迹里能看到 `project.save`（谁、何时、改了哪些文件）。
2. **并发保存被拒绝而不是覆盖**：同一账号的两台设备先后保存同一个文件时，先保存的一台如果基于旧版本再保存，
   服务器返回 409 与冲突明细（文件、基线版本、服务器版本内容/作者/时间），编辑器在主区显示冲突横幅，
   人可以选择"载入服务器版本"或"用我的版本覆盖"（覆盖本身也被记录）。
3. **基线版本跨刷新成立**：刷新页面后，编辑器仍然知道"我的编辑是从服务器哪一版改出来的"，
   因此普通编辑不会被误判成冲突，而真正的并发修改仍会被拒绝。
4. **旧版本可恢复**：历史面板可以预览任一版本内容并恢复，恢复动作本身记为一个新版本。
5. **手机上也能用**：≤760px 时头部操作行会换行，本轮修掉了"换行后的按钮被文件列表盖住、点不到"这个真实布局 bug
   （`.db-editor-header` 在移动端改为 `flex: 0 0 auto`），并补了回归用例。

## 明确不成立的结论

- 这**不是**实时协同编辑：冲突在"保存"那一刻才暴露，没有字符级共编，也没有自动三方合并。
- 冲突粒度是**逐文件**，不是逐行。
- 审计是**项目内**的，不是组织/管理员视角的全局审计，也没有留存期与导出策略。
- 版本库只记项目源码文件的正文，不记 AI 生成过程、预览态与素材二进制；每文件最多保留 100 版。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node apps/web/scripts/run-playwright.mjs test tests/project-versions.spec.ts
node --test server/api/project-versions.test.cjs
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-project-versions.suite.json \
  --out docs/verification/project-versions-2026-10-16
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
