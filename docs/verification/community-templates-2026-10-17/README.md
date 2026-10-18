# 验收证据包：社区模板发布与下架（P14 可独立完成部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-17（第十二轮）
- 证据包目录：`docs/verification/community-templates-2026-10-17/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**18 项全部通过**（desktop 1440×900 与 mobile 390×844 各 9 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/community-templates.spec.ts`（Playwright，新增 1 项：发布 → 社区可见 → 复制副本 → 操作记录 → 下架）
- 服务端用例：`server/api/community-templates.test.cjs`（node:test，4 项，全部为新增）

## 这次验收证明什么

1. **发布是服务端真实状态**：模板作者把当前内容发布到社区，服务端写入 `community_templates`
   （作者、模板族、标题、可见范围、版本号、发布时间、内容快照），同一模板族再次发布会更新同一条
   记录并让版本号 +1。
2. **可见范围由服务端裁定**：`private`（仅自己）/ `workspace`（同工作空间成员）/ `public`（已登录账号）；
   非成员的列表里看不到别人的私密模板，直接访问会被 403 拒绝。
3. **下架是真的下架**：下架后条目对作者仍然可见（变成"仅自己可见"并记录下架时间），
   别的账号在社区列表里再也看不到它。
4. **复制不会污染原模板**：复制会把服务端发布的���容写进复制者浏览器的独立副本并跳转到该副本，
   原模板与发布者账号不受影响。
5. **每一步都有操作记录**：`community.publish` / `community.visibility` / `community.unpublish`
   逐条入库，作者可查；下架之后记录仍然保留。
6. **服务端会拒绝坏数据**：没有标题、模板族标识非法、没有内容都会被 400 拒绝，
   内容超过 200 KB 返回 413 而不是悄悄截断。

## 明确不成立的结论

- 这**不是**公开的模板市场：没有审核、没有推荐位、没有下载量统计、没有付费与授权，
  也没有防止抄袭的机制。
- 社区列表里的模板**只有状态快照**，没有协同编辑；别人复制后各自独立。
- 模板族（sample）由客户端目录决定，服务端只校验标识格式；当前版本没有这一套模板时，
  复制会明确提示"当前版本没有这一套模板，无法复制"，而不是复制出一个打不开的东西。
- "发布"的是**当前浏览器里的模板状态**，不含本机文件、上传的素材或账号数据。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json
node --test server/api/community-templates.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/community-templates.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-community.suite.json \
  --out docs/verification/community-templates-2026-10-17
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
