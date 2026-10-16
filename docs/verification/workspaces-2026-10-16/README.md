# 验收证据包：工作空间与组织成员（P04）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-16（第六轮）
- 证据包目录：`docs/verification/workspaces-2026-10-16/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**16 项全部通过**（desktop 1440×900 与 mobile 390×844 各 8 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/workspaces.spec.ts`（Playwright，1 项：创建 → 加入码加入 → 项目进工作空间 → 降级只读 → 保存被拒）
- 服务端用例：`server/api/workspaces.test.cjs`（node:test，8 项）

## 这次验收证明什么

1. **工作空间是真的**：在「工作空间」页创建后，服务器返回工作空间与 6 位加入码，成员名单里有所有者。
2. **加入码真的能用**：另一个账号用加入码加入后，立刻出现在同一个工作空间的成员名单里。
3. **角色真的限制权限**：只读成员能在项目列表里看到工作空间的项目、能打开编辑器，但同步云端被服务器拒绝
   （403，界面提示"没有编辑权限"），而所有者照常可以保存。
4. **非成员看不到**：不是工作空间成员的账号既看不到工作空间，也读不到其中的项目（服务端 404）。

## 明确不成立的结论

- 工作空间目前**只管项目**：任务库、通知、定时任务、模板还没有归属到工作空间。
- 角色只有四种，没有按项目细分（例如"只允许评论"）。
- 加入码是**口令**而不是邀请：可以转发，没有一次性失效与审批；加入码只对所有者与管理员可见。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node apps/web/scripts/run-playwright.mjs test tests/workspaces.spec.ts
node --test server/api/workspaces.test.cjs
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-workspaces.suite.json \
  --out docs/verification/workspaces-2026-10-16
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
