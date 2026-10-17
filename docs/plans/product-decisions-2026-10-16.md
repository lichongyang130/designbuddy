# 产品决策档（代码先行项已定默认值，可配置）

日期：2026-10-16。三项原本需要拍板的决策，本轮以**可配置上限 + 明确默认值**的方式落地；
默认值写在代码与技能说明里，改档位不需要改结构。

## 1. D3 批量 OCR 上限档位

**默认档（当前生效）**

| 项 | 默认值 | 环境变量 | 说明 |
|---|---|---|---|
| 单批文件数 | 4 | `SKILL_OCR_BATCH_MAX_FILES` | ZIP 顶层 PDF 数量 |
| 单批总页数 | 8 | `SKILL_OCR_BATCH_MAX_PAGES` | 全部文件合计页数 |
| 单文件页数 | 6 | `SKILL_OCR_MAX_PAGES` | 单个 PDF 页数上限 |
| 并发 | 1（最大 4） | `SKILL_OCR_BATCH_CONCURRENCY` | 有界并发，不无限排队 |
| 单次执行段 | 120 秒 | 固定 | 超时保留检查点，可继续，最多自动恢复 10 次 |
| 批量体积 | ZIP ≤2MB，展开 ≤6MB | 固定 | 校验长度与 CRC，不落盘解压 |
| 字错率 | 需要 `gold-standard/<同名>.txt` | 固定 | 未提供参考文本记为"未评分"，不是通过 |

**为什么是这个档**：单批 4 份 / 8 页可以在一次人工等待内复核完；页数与文件数都有硬上限，
不会把后台变成无限队列。**上调只改环境变量，不改产品上限默认值**；生产环境若要更大档位，
应同时给出存储配额与人工复核流程。

**仍缺的验收基准**：代表性业务扫描件 + 人工校对参考文本（客户提供），才能给出真实 CER 结论。

## 2. A3 公式兼容档位

**默认档 = 白名单档（封闭文法 + 函数白名单两层）**

- 支持：四则运算、百分号、括号、`&` 拼接、比较运算、双引号文本常量、`TRUE/FALSE`、
  A1/绝对/跨表引用；函数白名单含 `SUM/AVERAGE/MIN/MAX/COUNT/ROUND/ROUNDUP/ROUNDDOWN/
  ABS/MOD/POWER/INT/SQRT/SIGN/CEILING/FLOOR`、`IF/IFERROR/AND/OR/NOT`、
  `VLOOKUP(仅精确)/INDEX/MATCH(仅精确)/SUMIF/COUNTIF`、`LEN/LEFT/RIGHT/MID/TRIM/UPPER/
  LOWER/CONCATENATE`。
- 明确不支持：数组公式、数据表、条件格式、名称、外链、Excel 日期序列、隐式类型转换。
  数字与文本永不相等；查找只做精确匹配。
- 精度：Decimal 40 位；导出为双精度近似值，因此**不等于 Excel 兼容**。
- 失败语义：未知函数、类型不匹配、循环引用一律**整次失败**，不交付部分成功。
- 目录版本：`table.calculate` v1.1.0，能力边界写在技能说明里。

**差异验证**：`node scripts/verify-formula-compat.mjs <corpus-dir> [--report f.json]`
只认人工确认的期望值；缺失期望记为未覆盖，引擎不支持的工作簿记为错误，两者都让命令以非零码退出。

**仍缺的验收基准**：真实工作簿语料 + 人工期望值（客户提供）；档位升级需同时给出"目标软件与版本"。

## 3. C1–C4 确认与幂等粒度

**默认策略 = 每次外发逐次确认 + 必填幂等键 + 审计留存**

| 动作 | 确认要求 | 幂等 | 失败语义 |
|---|---|---|---|
| `email.send` | `externalConsent=yes`（第三方授权）+ `confirmation=yes`（本次确认），每次都要 | 8–80 位幂等键，重复键直接拒绝并提示已执行过 | 邮件服务返回非 2xx 即整次失败，不写"已发送" |
| `calendar.create` | 同上 | 同上，键同时以 `Idempotency-Key` 头发给日历服务 | 日历服务返回非 2xx 即整次失败，不写"已创建" |

- 凭据只从服务端环境变量读取（`COLLABORATION_CALENDAR_BASE_URL/TOKEN/ID`、
  `COLLABORATION_EMAIL_BASE_URL/API_KEY/FROM`），不从上传文件读取，不写进产物。
- 幂等记录落盘在 `data/collaboration-audit/`，重启后仍然生效。
- 目前只支持这两个动作；不猜测其它外部操作，不支持删除或修改既有事件。
- 仍需你确认：是否允许批量、是否需要审批人名单、回执保留期、是否要接入邮件读取回执。

## 4. 这次决策与代码的对应关系

| 决策 | 落地位置 |
|---|---|
| D3 上限 | `server/skills/pdf-batch.ts`（读环境变量，目录说明同源）、`shared/skillRuntime.ts` 的 `pdf.ocr-batch` 说明 |
| A3 档位 | `server/skills/formula-engine.ts` 白名单、`shared/skillRuntime.ts` 的 `table.calculate` v1.1.0、`scripts/verify-formula-compat.mjs` |
| C1–C4 粒度 | `server/skills/collaboration-sync.ts`（确认+幂等+审计）、`server/skills/contracts.ts`（参数校验） |

## 5. 仍未由本次决策覆盖的事项

- D2 复杂版式的"原生分页"判定标准，需要 Word/真实对照文件。
- 图像模型商用条款（`image.generate` 适配器已就位，缺通道凭据与商用结论）。
- 隔离构建/浏览器验收的生产级容器运行器（当前为本机受限子进程 + 内置 Chromium）。
