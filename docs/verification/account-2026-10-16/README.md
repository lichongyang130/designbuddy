# 验收证据包：账号资料编辑、密码轮换、账号审计与注销（P12 可独立完成部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-16（第七轮）
- 证据包目录：`docs/verification/account-2026-10-16/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**40 项全部通过**（desktop 1440×900 与 mobile 390×844 各 20 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/account-profile.spec.ts`（Playwright，1 项：注册 → 改资料 → 改密码 → 注销 → 会话失效）
- 服务端用例：`server/api/account-profile.test.cjs`（node:test，1 组 20 个断言，真实 HTTP 打到 `dist/local/server/local-daemon.js`）

## 这次验收证明什么

1. **账号资料是真的**：改显示名与邮箱后，服务端 `workspace_accounts` 行随之变化，重新登录仍然读得到，
   账号菜单的昵称也换成新显示名（不再只是游客占位）。
2. **密码轮换是真的**：用当前密码换新密码后，旧密码立刻登录失败（401），新密码可以登录；
   同一账号的其它设备会话被清掉，当前会话保留。
3. **账号审计是真的**：`workspace_account_audit` 表逐条记录 `account.register` / `account.profile.update` /
   `account.password.change` / `account.delete`，页面可直接看到；审计内容里**不写资料正文**（服务端用例对此有断言）。
4. **注销是真的**：注销需要显式勾选确认并输入当前密码；服务端先清掉本账号的长期记忆与已同步偏好，
   再删除账号行与全部会话，浏览器随后访问 `/api/auth/me` 返回 401。
5. **边界守得住**：游客会话改资料/改密码/注销一律 403（`ACCOUNT_REQUIRED`）；跨站写入 403；
   邮箱格式非法 400；新密码少于 10 位 400；删除账号缺少 `confirm` 一律 400。

## 明确不成立的结论

- 这**不是**生产级身份系统：没有邮箱/手机号验证、没有找回密码、没有二次身份核验（只有当前密码）、
  没有设备级会话管理页面（改密码会踢掉其它会话，但看不见也管不了单个设备）。
- 账号审计只记在本机 SQLite（`data/designbuddy.sqlite`），**没有**组织级留存策略，也没有异地备份。
- 订阅、支付、积分账本**仍未接入**：账号菜单里的"套餐/积分"依然显示"未接入"，
  本轮没有伪造余额、没有产生任何扣费记录。
- 注销账号不会删除工作空间里的项目数据，也不会把账号加入过的团队/组织成员关系清理干净
  （工作空间成员表按用户 id 保留历史行）。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node apps/web/scripts/run-playwright.mjs test tests/account-profile.spec.ts
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json && node --test server/api/account-profile.test.cjs
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-account.suite.json \
  --out docs/verification/account-2026-10-16
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
> 验收脚本每次运行都会新建一个随机用户名的账号（`acceptance_acct_<时间戳>`），因此可以重复执行。
