# 验收证据包：管理后台 / 运营控制台（台账第 6 项，P16「管理后台缺失」）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
  - 启动时带 `DESIGNBUDDY_ADMIN_ACCOUNTS=acceptance_admin`：**不配这个变量，所有账号一律 403**
- 验收日期：2026-10-17（第十四轮）
- 证据包目录：`docs/verification/admin-2026-10-17/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**38 项全部通过**（desktop 1440×900 与 mobile 390×844 各 19 项，0 失败 / 0 未验证）
- 验收套件：`scripts/acceptance/suites/designbuddy-admin.suite.json`
- 专项用例：`apps/web/tests/admin-console.spec.ts`（Playwright，2 项：管理员能看到控制台而普通账号被明确拒绝；停用账号后会话立即失效且审计留痕）
- 服务端用例：`server/api/admin.test.cjs`（node:test，3 项：门禁与不泄露口令材料、停用账号踢下线并拒绝再登录、重试失败任务与启停定时任务）
- 全站回归：服务端 **313/313** 通过；浏览器全站 **542 通过 / 0 失败 / 1 跳过**（27.3 分钟，543 项，含本轮新增的 2 项管理后台用例）

## 这次验收证明什么

1. **门禁是真的**：未登录（访客会话）请求 `GET /api/admin/overview` 得到 **403 + 「只有本机配置的管理员账号可以打开管理后台。」**，
   页面上没有任何总览数字（`admin-stats` 只在管理员会话下出现）。管理员名单来自服务端环境变量
   `DESIGNBUDDY_ADMIN_ACCOUNTS`，浏览器端无法伪造。
2. **管理员能看到这台服务器的真实账本**：账号清单（可停用/恢复）、模型用量（调用/输入/输出/失败/平均延迟/按模型）、
   任务总量与最近失败（含真实失败原因）、定时任务清单与上次运行结果、技能 ready/unavailable 原因、最近审计。
3. **停用是真动作**：点「停用」后该账号的行变成「已停用」，**它的服务端会话被立即删除**（`browser_sessions` 清理），
   再次登录会被拒（403「该账号已被管理员停用，请联系管理员。」），审计里出现 `account.disable`；点「恢复」后账号可正常登录。
4. **失败可重试、定时可启停**：这两项走的是任务后端与定时后端自己的重试/启停逻辑，不是在页面上改一个前端状态。
5. **页面诚实**：不可用技能写明缺什么（例如缺 `AI_API_KEY`），没有占位结果；总览里不出现任何口令或盐值。

## 明确不成立的结论

- **不是多租户运营平台**：没有计费、没有配额、没有封禁申诉流程、没有邮件通知、没有组织架构；
  账号停用是本机运维动作，不做对外客服流程。
- **没有细粒度权限**：管理员就是管理员（读全部 + 三个写动作），没有「只读管理员」「只管某个账号」这类角色。
- **没有跨实例管理**：只能管本机这台服务器，没有中心化控制台。
- **没有审计导出/留存策略**：审计按账号写进 SQLite，只保留最近 80 条展示，没有做归档、签名或防篡改。
- **普通账号看不到任何后台数据**：这是设计目标，不是「功能待开」。
- 证据包只证明「声明的检查项在声明的视口下实际执行过」，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
# 若要验收管理后台，开发服务器需要带上管理员名单：
export DESIGNBUDDY_ADMIN_ACCOUNTS=acceptance_admin
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json
node --test server/api/admin.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/admin-console.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-admin.suite.json \
  --out docs/verification/admin-2026-10-17
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
> 验收套件会自己在服务器上准备 `acceptance_admin` / `acceptance_guest` 两个账号（不存在就注册，已存在就登录），
> 并在结束前把被停用的账号恢复，避免把测试状态留在服务器上。
