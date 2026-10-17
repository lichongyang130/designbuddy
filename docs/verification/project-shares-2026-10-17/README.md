# 验收证据包：服务端受控项目分享（P14 / P15 的受控云端分享部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-17（第十轮）
- 证据包目录：`docs/verification/project-shares-2026-10-17/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**30 项全部通过**（desktop 1440×900 与 mobile 390×844 各 15 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/project-shares.spec.ts`（Playwright，新增 1 项：创建 → 访客只读 → 撤销即失效）
- 服务端用例：`server/api/project-shares.test.cjs`（node:test，4 项，其中 4 项为新增）

## 这次验收证明什么

1. **分享链接由服务器托管**：编辑器的「受控分享」对话框创建链接时，服务端生成 24 字节 base64url
   token（不可猜），链接里**不含项目源文件**；面板明确写"链接由服务器托管……撤销后立刻失效"。
2. **访客不需要账号就能只读预览**：`/share/:token` 是公开路由（认证之前），返回的是只读快照
   （项目名、需求、文件、设计系统），不返回 ownerId 与项目内部 id。
3. **有效期由服务端裁定**：默认 7 天、最多 30 天；过期链接返回 410"分享链接已过期"。
4. **撤销立即生效**：所有者撤销后，同一个链接再打开返回 410"分享链接已被作者撤销"，
   页面显示"分享链接无效或已损坏 / 分享链接已被作者撤销"。
5. **只有所有者能创建与撤销**：编辑者可以创建分享链接，但不能列出或撤销所有者的链接；
   非成员连项目是否存在都看不到（404，避免泄露）。
6. **每次操作都留审计**：创建与撤销分别写入 `project.share.create` / `project.share.revoke`，
   访问次数记录在服务端（面板显示"访问 N 次"）。
7. **未知 token 不泄露信息**：`GET /api/shares/<未知 token>` 返回 404"分享链接不存在"（验收里的 http 检查项）。

## 明确不成立的结论

- 这**不是**"任何人可转发的公开作品发布"：链接仍然是一次性的受控访问，没有公开列表、
  没有分享统计看板、没有对外的内容审核或举报流程。
- 访客页面是**只读快照**，不能在线协作、不能评论、不能回写；访客点"保存到本机并编辑"
  会在自己浏览器里生成独立副本，不会写回原项目。
- 没有"分享权限分级"（只读/可评论/可编辑），没有密码保护、没有访问者白名单、
  没有下载水印、没有域级禁用（企业管控语义尚未实现）。
- 实时协同编辑（字符级共编）仍未实现；冲突处理仍是"保存即检测 + 人工二选一"。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node --test server/api/project-shares.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/project-shares.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-project-shares.suite.json \
  --out docs/verification/project-shares-2026-10-17
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
