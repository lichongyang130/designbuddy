# 验收证据包：技能工具权限与版本治理（P07 可独立完成部分）

- 验收对象：本机 `http://127.0.0.1:5173`（`pnpm dev:full`，5173 前端 + 8787 API + 本机 SQLite）
- 验收日期：2026-10-16（第七轮）
- 证据包目录：`docs/verification/skill-permissions-2026-10-16/`
  - `manifest.json` / `console.log` / `network.log` / `screenshots/`：浏览器验收工具 `scripts/acceptance/run-acceptance.mjs` 的真实输出
  - 验收结果：**18 项全部通过**（desktop 1440×900 与 mobile 390×844 各 9 项，0 失败 / 0 未验证）
- 专项用例：`apps/web/tests/skills.spec.ts`（Playwright，新增 1 项：每个技能都写明它真正用到的权限）
- 服务端用例：`server/skills/skill-permissions.test.cjs`（node:test，4 项）

## 这次验收证明什么

1. **权限是按执行器真实行为登记的**：会开浏览器跑验证的技能列出"访问网络地址 + 启动本机子进程"；
   只在本机处理文件的技能只列"读取本机上传文件 + 在本机写出成果文件"，**不会虚报**网络或进程权限。
2. **运行前看得见**：技能详情页有独立的「所需权限」区，第三方权限单独标色说明"需要单次授权"。
3. **第三方权限必须单次授权**：`document.summarize` / `image.generate` / `collaboration.sync`
   在没有 `externalConsent=yes` 时被服务端直接拒绝（400/403），不会把内容发出去。
4. **版本与权限进入治理记录**：每次运行记录里都写明技能版本号与本次授予的权限集合，
   按账号隔离，跨账号读不到（服务端用例断言 404）。

## 明确不成立的结论

- 权限是**声明**，不是操作系统级沙箱：真正隔离执行仍未实现，`code.build` 等技能仍在受限子进程里跑。
- 权限清单由**服务端代码固定**，没有可配置的白名单策略，也没有按用户/工作空间差异化授权。
- 技能包**没有版本升级、回滚与兼容矩阵**：目录里的版本号是人工维护的声明值。
- 没有第三方权限的**批量授权或长期授权**，每一次外发都必须逐次确认。
- 证据包只证明"声明的检查项在声明的视口下实际执行过"，不代表真实业务验收通过。

## 复现方式

```bash
export PATH="/usr/local/lib/node_modules/corepack/shims:$PATH"
pnpm dev:full                                   # 另开一个终端保持运行
node node_modules/typescript/bin/tsc -p server/tsconfig.local.json && node --test server/skills/skill-permissions.test.cjs
node apps/web/scripts/run-playwright.mjs test tests/skills.spec.ts
node scripts/acceptance/run-acceptance.mjs --suite scripts/acceptance/suites/designbuddy-skill-permissions.suite.json \
  --out docs/verification/skill-permissions-2026-10-16
```

> 注意：验收工具会先清空输出目录再写证据，所以 `README.md` 要在验收跑完之后再写（或放在别的目录）。
