# 第六批高级能力：图层自由排版与真实PNG/SVG导出

更新：2026-10-16。新增 `image.layout@1.0.0`，绑定营销物料专家（visual）。**这是M3自由排版的受限文字/色块/位图子集，不代表全部M3或全部12位专家高级能力完成。** 当前20项工具已实现；安装此前的可选英语ASR后20项可执行，否则19项可执行、音频项禁用。

## 实际使用

进入“专家 → 营销物料专家 → 真实技能执行台”，选择“图层自由排版与真实导出”（技能ID `image.layout`）。

1. 编辑初始示例或导入本工具的JSON。可添加文字、色块和带来源声明的PNG/JPEG/WebP。
2. 选择图层后实际拖动或拖右下角改变尺寸；也可通过坐标、宽高、字号等字段精确调整。支持方向键1像素、Shift+方向键10像素；锁定、显示、透明度、上/下移一层、复制、删除；最近20步撤销/重做。
3. 文字需要手动换行；可选960×1200、960×960、1280×720画幅。切换尺寸会等比缩放并居中全部图层（含锁定层），缩小后的字号最小8，需要复核文字框。
4. “下载可编辑JSON”仅本地下载；“将当前画布准备为输入”仍不上传。随后必须单独勾选上传同意并执行，才创建后台任务。
5. 改动图层/画布、撤销或导入都会作废旧准备文件和同意；身份变化清除旧编辑状态，未完成的本地异步读图也不能写回新身份。
6. 成功后下载实际PNG、转曲SVG和可编辑JSON；字形缺失、溢出、解码或资源校验失败会显示真实错误，没有部分成果。

**草稿仅存本页内存，不自动保存。** 离开、切换技能或刷新会丢失未下载草稿；下载/导入JSON恢复编辑。已执行成功的运行和产物仍按原有后台身份规则保存、可刷新恢复，直到用户删除运行。锁定图层只是防误操作，不是安全权限。

浏览器预览使用本地Noto字体及SVG，最终后台逐字使用实际字体轮廓测量并渲染。浏览器预览不保证与后台逐像素相同；预览可能裁住字框外文本，而后台明确拒绝可见文字越界，不会把截断当作完整导出。

## 后台实际处理与交付

- 验证严格闭合JSON结构和整型画布/图层几何，不执行脚本，不读取素材远程地址，不接受任意SVG/HTML/PSD。
- 对每张位图进行头部边界检查，再由Sharp实际解码；纠正EXIF方向、转sRGB、剥离元数据为规范PNG。头部合法但压缩流损坏仍失败。
- 按图层数组由底到顶真实合成，应用隐藏、透明度及圆角；图片居中contain或cover，裁剪几何记录在报告。重复使用同一素材只在SVG中内嵌一次。
- 文字按显式换行、8px内边距、1.4倍行高以及实际Noto字形宽度/边界计算，导出轮廓路径，不依赖打开SVG机器的字体。没有自动排版、自动改写、自动换行或缩字。
- 实际渲染PNG后再次检查尺寸；记录输入、原始/规范素材、字体、SVG/PNG的SHA-256。
- `poster.png`、`poster.svg`、`poster-project.json`、`poster-report.json`、`font-license.txt`，加服务层 `execution-receipt.json`，共6份。
- 报告明确 `generatedImagery:false`、`published:false`、`requiresReview:true`；素材来源只是用户声明，`rightsIndependentlyVerified:false`，不是版权认证。
- 接入原有受限队列/worker、所有者隔离、明确同意、版本注册、任务分组及原子产物保存；越权下载404，失败无可下载部分文件。没有新增自动重试接口。

规划器可在原有审批链路中建议“渲染已有本格式JSON”，不为用户生成新的图层数据，不把一张原图当排版工程，不代替执行确认，也不宣称具备AI布局设计。

## 资源和隐私边界

- 输入JSON≤2,000,000字节；画布每边320–2000、至多400万像素；1–24层，必须有可见且非零透明度图层。
- 最多6张内嵌静态PNG、基线/渐进JPEG或WebP；每张至多400万像素/4000最长边，原始素材合计≤130万字节/800万像素，规范PNG合计≤3MB，最终SVG≤6MB。隐藏或未引用素材也计入输入预算并解码。
- 单层文字≤500、总文字≤2000，字号8–160；六位十六进制颜色、无旋转、分组或特效。动画PNG/WebP、外部URL、SVG素材、未知字段和控制字符拒绝。
- 原有执行期限45秒、2任务并发、每用户100次运行、成果总量10MB仍适用。这些边界不是操作系统隔离沙箱证明。
- **JSON保留隐藏层和原图，原图可能带元数据；SVG的裁剪保留完整规范图片，框外像素可恢复。隐藏/裁剪不能用于脱敏。** 分享前检查隐私、文本和素材权利。
- **未完成**AI生图、智能改图、精细抠图、任意矢量/PSD编辑、分组/旋转、多页、多用户协作、云端草稿自动保存或发布。也不是原180模板扩展的新增模板。

## 实测与持久证据

[验证目录](../verification/poster-layout-2026-10-16/)保留两套各6份真实产物、7张实际浏览器截图、测试/构建日志与源码和证据哈希。`default-service`通过隔离内存数据库的真实服务队列/worker生成，`edited-browser`通过真实浏览器上传/HTTP执行/下载生成，不使用执行替身。后者的红蓝色块是裁剪/叠层测试素材，遮盖文字是有意的测试排列，不是商业宣传成稿。默认示例为原创排版示例，非真实活动。

- 新增13项服务端测试：实际中文轮廓和JSON恢复；PNG像素级叠层、透明度、隐藏、透明底；contain/cover裁剪像素及素材复用；实际JPEG/WebP EXIF方向；闭合结构、未知字段、坐标和资源预算；动态PNG/格式伪装；可见文字越界/缺字；2000²画布24层真实渲染；服务6项产物和越权404/失败零产物；规划器边界；头部有效但本机解码失败；原始字节/像素合计预算；标题脚本转义。
- 新增8项浏览器测试：多行中文及真实图片导出/哈希/预览/刷新/JSON往返，真实指针拖动缩放、键盘微调和数字逐位输入，撤销/重做/锁定，层级/隐藏/复制/删除/画幅，准备与同意失效及身份变化后延迟读图不得写回，错误导入无外网请求，后台文字越界零产物，以及320/390px。
- **136/136服务端回归、9/9目录测试通过，无跳过。**
- **相关18组共175个独立浏览器测试通过，无跳过**：首轮命令误写信息图套件文件名，实际运行17组169项；随后补跑真实 `infographic.spec.ts` 6/6。不是一次175项运行，也不是全站测试。
- 其后仅增加截图和延迟读取的身份切换测试断言，排版8/8再次通过；不重复累计。前后端TypeScript、前端生产构建及diff检查通过。原有大主包及fflate混合导入提示仍在。
- 人工查看了桌面真实生成图、移动端画布及390px图层控件截图。测试样例不充抵36个真实业务案例，也不证明真实模型选型或外部服务联调完成。

复核（仓库根目录）：

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/*.test.cjs server/api/*.test.cjs
node --test scripts/expert-catalog.test.mjs scripts/prompt-library.test.mjs
npx --yes pnpm@9.0.0 exec tsc --noEmit -p apps/web/tsconfig.json
npx --yes pnpm@9.0.0 --filter designbuddy-web build
node scripts/verify-poster-layout.cjs # 默认只写.cache，不操作应用数据库
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test poster-layout.spec.ts audio-transcribe.spec.ts infographic.spec.ts docx-structure.spec.ts formula-batch.spec.ts advanced-office.spec.ts task-skills.spec.ts skill-planning.spec.ts skill-phase-two.spec.ts skill-runtime.spec.ts expert-avatars.spec.ts experts.spec.ts skills.spec.ts expert-match.spec.ts conversation.spec.ts clarification.spec.ts attach-menu.spec.ts home-reference.spec.ts
```

普通开发环境使用已安装的Playwright Chromium即可，无需沙箱路径。以上浏览器命令为修正后的完整相关18组清单；本次实际执行顺序以已保存日志为准。

未推送、未创建PR、未生产部署、未更新此前云盘备份；可选ASR安装仍不在Git中。所有既有未完成任务保留在总台账。
