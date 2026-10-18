# 专家高级能力第十批：不需要外部材料的增量

日期：2026-10-16
对应清单：[需要你提供的材料清单](../../plans/expert-advanced-user-input-checklist.md)
台账：[未完成任务执行台账](../../plans/remaining-work-ledger.md) 第 4 项、[高级能力实施台账](../../plans/advanced-experts-execution.md)

本轮只做**不依赖用户凭据、样本与部署环境**的增量；凡是需要外部材料的部分一律没有伪造、没有用模拟结果代替。

---

## 1. 代码检查结论

| 增量 | 落点 | 真实做了什么 | 明确没做什么 |
|---|---|---|---|
| A3 公式引擎扩展 | `server/skills/formula-engine.ts`、`server/skills/table-calculate.ts` | 真实解析并重算：比较运算、文本常量、布尔值、`&` 拼接、`IF/IFERROR/AND/OR/NOT`、精确匹配 `VLOOKUP/INDEX/MATCH`、`SUMIF/COUNTIF`、文本/数值函数白名单；文本与布尔结果按原类型导出 | 不支持名称/数组/外链/合并/数据表/条件格式/Excel 日期序列；未知函数仍整次失败 |
| A3 差分校验器 | `scripts/verify-formula-compat.mjs` | 对黄金语料逐格比对人工期望值，输出差异报告 | 缺失期望记为「未覆盖」、引擎不支持的工作簿记为「错误」，两者都让命令非零退出 |
| A4 连接器框架 | `server/skills/data-connector.ts`、`server/skills/data-connect.ts` | CSV/JSON/SQLite(只读)/远程 JSON 四种来源实际读取、字段映射、类型转换、游标增量、逐行来源标记、审计记录 | 不写回数据源、不执行用户 SQL、不推断业务口径；远程来源需白名单、凭据只从服务端环境变量读取 |
| D3 批量 OCR 扩展 | `server/skills/pdf-batch.ts`、`server/skills/pdf-ocr.ts`、`server/skills/ocr-accuracy.ts` | 上限改为服务端环境变量可配（默认与已发布说明完全一致）、有界并发、`gold-standard/` 人工参考文本的真实字错率 | 上传文件无法放大限制；没有参考文本的文件记为未评分而不是通过 |
| 占位技能契约 | `shared/skillRuntime.ts`、`server/skills/runtime-catalog.ts` | 5 个 `unavailable` 技能 + 2 个条件可用技能补上结构化「需要你提供」元数据（凭据/环境/素材/账号/决策） | 技能本身仍未接入执行器，状态仍是 `unavailable` |
| 产品内展示 | `frontend/workspace/pages/SkillsPage.tsx`、`frontend/workspace/SkillWorkbench.tsx`、`frontend/workspace/pages/skills.css` | 技能卡片标注「需提供 N 项」，详情弹窗与执行工作台逐条列出材料 | 不因为列了清单就显示为可执行 |
| 验收工具 | `scripts/acceptance/run-acceptance.mjs` | 真实浏览器多视口执行、截图/控制台/网络/逐项清单证据包 | 只访问声明的目标与来源；选择器缺失记 `not_verified`，不算通过 |

## 2. 自动验证结果

| 验证 | 命令 | 结果 |
|---|---|---|
| 服务端技能全套回归 | `node --test server/skills/*.test.cjs` | **203 项 / 193 通过 / 10 失败**（基线 191/181/10，失败项完全相同：8 项 ASR 需离线模型未安装 + 2 项 `service.test.cjs` 断言过期）。新增 12 项全部通过，**无新增失败** |
| 基线对照 | `git stash push -u` 后重跑同一套 | 基线 191/181/10，失败项与本次一致 → 10 项失败均为既有失败 |
| 公式/验收/基准脚本 | `node --test scripts/verify-formula-compat.test.mjs scripts/acceptance/run-acceptance.test.mjs scripts/ocr-accuracy-benchmark.test.mjs` | 5/5 通过 |
| 前端构建 | `pnpm --filter designbuddy-web build` | 通过 |
| 右侧预览回归 | `node apps/web/scripts/run-playwright.mjs test tests/right-preview.spec.ts` | 4/4 通过 |
| 专家目录用例（既有失败） | `node apps/web/scripts/run-playwright.mjs test tests/experts.spec.ts` | 3 项失败（用例期望 12 位专家、实际 16 位），基线同样失败，与本次改动无关 |

## 3. 真实浏览器证据

`scripts/acceptance/run-acceptance.mjs` 对本地运行中的应用（web 5173 / api 8787）执行，桌面 1440×900 与移动 390×844 两个视口共 **14 项检查，14 项通过，0 失败，0 未验证**（`manifest.json.counts`）：

- 首页 HTTP 200
- 技能页标题、未接入卡片可见
- 点击「查看接入状态」→ 弹窗出现「需要你提供」区块（`.skill-detail-requires`）
- 该区块文本包含实际材料条目（192 字符）
- 桌面与移动各两张截图（技能页全页 + 「需要你提供」区块特写）

证据包：`docs/verification/expert-advanced-2026-10-16/`
（`manifest.json` 逐项清单、`console.log`、`network.log`、`screenshots/{desktop,mobile}/*.png`）

> 说明：若修改了前端源码后验收结果出现 `not_verified`，先重启 dev server —— vite 的模块缓存可能仍持有旧版本组件（本次遇到过一次，代码本身无问题）。

## 4. 边界声明

- 5 个 `unavailable` 技能仍然是 `unavailable`；本轮只补契约与「需要你提供」的可见性，**没有**新增任何外部通道的假实现。
- 公式引擎的扩展档位是白名单，不是 Excel 兼容；`scripts/verify-formula-compat.mjs` 需要真实语料与人工期望值才能给出兼容性结论。
- 验收工具证明的是「声明的检查项在声明的视口下实际执行过」，不等于被测目标通过业务验收。
- 批量 OCR 的上限档位仍待用户拍板；当前默认与既有说明完全一致。
