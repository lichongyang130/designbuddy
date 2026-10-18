# 第四批高级能力：按明确目的生成真实信息图

更新：2026-10-16。新增 `infographic.compose@1.0.0`，绑定信息可视化专家；现在12位专家共有 **18项可执行工具**。这是V2信息图设计的受限子集，**V1 AI业务语义理解和完整高级能力仍未完成**。不把规则、测试数量或固定布局包装为业务理解、自由设计或36个真实案例验收。

## 如何使用

进入“专家 → 信息可视化 → 真实技能执行台”，选择“业务目的选图与信息图导出”。下载输入格式示例，按真实材料填写JSON，选择文件并明确同意上传后执行。手动执行不调用模型；下载示例不创建任务，也不会自动上传。

JSON要求 `title`、`purpose`、`metric`、`unit`、`scope`、`source`、`data`；`data`只含 `label` / `value`。可选布尔字段 `compositionConfirmed` 仅用于构成声明。拒绝未知字段，不接收额外执行参数或自动去重。

三份可复用演示输入及其**实际执行结果**：

- [比较输入](../verification/infographic-2026-10-16/comparison/input.json) / [PNG](../verification/infographic-2026-10-16/comparison/infographic.png) / [SVG](../verification/infographic-2026-10-16/comparison/infographic.svg)
- [趋势输入](../verification/infographic-2026-10-16/trend/input.json) / [PNG](../verification/infographic-2026-10-16/trend/infographic.png) / [SVG](../verification/infographic-2026-10-16/trend/infographic.svg)
- [构成输入](../verification/infographic-2026-10-16/composition/input.json) / [PNG](../verification/infographic-2026-10-16/composition/infographic.png) / [SVG](../verification/infographic-2026-10-16/composition/infographic.svg)

示例数据为演示，不是已核实的业务事实。各目录同时保存输入、计算报告及字体许可。浏览器比较截图来自界面可下载示例；趋势截图使用累计收入样例；构成截图特意使用0.1、0.1、0.1、0，检验99.99%的独立舍入之和，与四渠道构成演示图不同。

## 三种实际规则

|明确目的|实际图形及计算|不做什么|
|---|---|---|
|`comparison` 比较|保留类别输入顺序，共享零基线的水平条形图；负数向左；实际最低/最高值及类别数|不暗中排名、聚合、取绝对值或自动选业务口径|
|`trend` 趋势|验证日期后按UTC日期排序，保留原记录序号；横坐标按实际天数间隔；实际首值、末值、净变化；仅当首值>0时计算首末变化率|不补缺失日期、不预测或推断因果；基期≤0时变化率为空并解释|
|`composition` 构成|要求 `compositionConfirmed:true`，由用户确认互斥、完整、同口径和单位；实际十进制合计及100%堆叠条形图；保留零值类别|不验证该业务声明是否属实；负数、全零失败，不将独立舍入份额强行调成100%|

图面实际排版标题、指标/单位、三个KPI、图形、完整数值明细、来源序号、统计口径、来源声明和限制。比较/趋势值域包含零；全零数据仅为绘图采用0–1刻度，明确说明1并非观测值。

## 数据完整性、精度与边界

- JSON≤2MB；比较/趋势2–24条，构成2–12条；标签非空、唯一、≤24字。标题≤36字、指标≤20字、单位≤12字、来源/口径各≤120字；字符串不允许首尾空格或控制字符。
- 数值绝对值≤1e12，最多6位小数。推荐十进制字符串；字符串不接受科学计数法、千分位、单位或前导零编号。JSON数字从解析器原始词法读取，不使用已被IEEE754舍入的解析值；数字词法最长64字符。这样 `999999999999.999999` 不会静默变成 `1000000000000`，超出精度和下溢值拒绝。运行时若不能提供原始词法，会明确失败并要求十进制字符串。
- Decimal使用40位有效数字。原始规范数值在表格/JSON完整保留；除法等可能舍入，PNG坐标是双精度近似。过长KPI/刻度用带“约”的科学计数显示，不替换完整明细。
- 趋势日期必须为1900–2199年真实 `YYYY-MM-DD` 日历日期，拒绝重复日期；不是任意日期格式推断。
- `sourceRow` 是输入 `data` 数组从1开始的**记录序号**，不是JSON文件物理行或外部Excel/数据库行号。趋势排序后仍保留该序号。
- 来源/单位/口径均为用户声明，报告固定 `sourceIndependentlyVerified:false`。不自动读取CSV/XLSX、不推断字段、不做多序列或混合单位分析，不访问声明的来源URL。
- SVG宽1200像素、动态高度，文字用仓库授权字体转为路径；无平台字体依赖。缺字/文字超版式失败，不偷偷替换或截断。文字不是可编辑文本层，须修改原JSON重新执行。
- SVG≤6MB，PNG由sharp实际渲染并核对尺寸，≤600万像素。沿用45秒worker期限、10MB交付总量和所有者存储配额。各上限不保证任意边界组合均能成功；超限整次失败，无部分成果。
- 图片预览在窄屏按容器缩放，320/390px不撑开页面。细字请下载1200像素原PNG或矢量SVG查看；不把手机缩略图称作原尺寸阅读体验。

## 产物与安全

交付 `infographic.svg`、`infographic.png`、`infographic-report.json`、`font-license.txt`，服务层另加 `execution-receipt.json`，共5项。

报告含输入SHA256、明确目的及规则说明、未核实声明、计算策略、KPI/完整数据/原记录序号、图形坐标和值域、趋势变化或构成份额、SVG/PNG哈希和复核提醒。记录的是实际计算和绘图，不是模型给出的虚构分析。

SVG标题/描述转义，图面文字为字体路径，不包含用户脚本、远程资源、链接或foreignObject。字体许可同时放在SVG元数据和独立文件。所有者隔离、队列、取消及失败原子性沿用服务层；`worker_threads`仍不是操作系统隔离沙箱。

规划候选只对JSON和信息可视化专家开放；规划提示明确“不做语义推断”。不读取原始文件正文来冒充模型理解，不将CSV或其他专家静默改成这一流程。

## 实际验证与测试顺序

新增 **12项服务端测试、6项浏览器测试**。覆盖真实PNG像素/尺寸与哈希、负数零基线、日期排序和比例间隔、非正基期、十进制构成与零份额、模式/单位/日期/资源拒绝、JSON数字原始精度、惰性恶意文本、实际worker、所有者隔离及无部分产物、上传授权、真实下载/预览/刷新与320/390px。

1. 首轮服务端合并回归112/112通过。随后发现原生JSON数字可能在解析时舍入，增加原词法读取和一项测试，**最终113/113通过**，无失败/跳过。
2. 本次扩大到全站浏览器，而非沿用前批155项相关范围：**479项首轮中475通过、3失败、1跳过**，约24.5分钟。3个失败是旧测试失配：插件页分类实际为“设计创意”，两项仍寻找首页名称“设计制作”；侧栏测试全局查找status，与新增推荐播报status歧义。仅修正测试定位，没有修改这些已批准界面。
3. 最后在数字精度修复及重启后，重跑信息图、插件、侧栏三组：**28/28通过，无失败/跳过**，包含上述3项修复和新增精确数字上传校验。中间新增上传校验曾在刷新后未重新选择信息图技能，按表格技能提交JSON被正确拒绝；已修正测试操作并完整重跑28项。
4. 全站首轮唯一跳过是 `backend.spec.ts` 的真实FFmpeg导出测试：当前未安装/配置FFmpeg，未验收这一项。**不声称479/479全站一次性通过，也不把复测28项重复相加。**
5. 目录/任务库9/9通过；后端TypeScript、前端TypeScript及生产构建、diff检查通过。既有大主包和fflate混合导入告警保留。
6. 实际检查三类图、24条边界样例及浏览器/移动截图。三套保存的演示产物已用最终执行器重新生成并逐字节比对一致。边界测试只断言数据/尺寸，不声称普遍视觉无裁切保证。

[持久证据目录](../verification/infographic-2026-10-16/)保存产物、截图、完整测试日志、源码/产物哈希及上述顺序。首轮全站与最后复测分别记录，不覆盖首轮失败事实。

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/*.test.cjs server/api/*.test.cjs
node --test scripts/expert-catalog.test.mjs scripts/prompt-library.test.mjs
npx --yes pnpm@9.0.0 --filter designbuddy-web build
# 本环境浏览器与系统库需先准备，其他环境使用已安装的Playwright浏览器
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test infographic.spec.ts plugins.spec.ts sidebar.spec.ts
```

本批没有接入业务语义模型、生成式设计、自由编辑、多步骤执行或真实外部服务；没有验收全部专家/36个业务案例。未推送、部署或更新旧云盘快照；其他未完成事项完整保留在主台账。
