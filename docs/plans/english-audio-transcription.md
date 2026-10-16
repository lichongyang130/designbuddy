# 第五批高级能力：短英语WAV离线转写

更新：2026-10-16。新增 `audio.transcribe-en@1.0.0`，绑定文档整理专家。**这是D4音频转写的英语短音频子集，不是中文、多语种或长会议转写已完成。** 已实现工具共19项；当前机器完成模型安装和真实识别验证后19项可执行，缺少这一可选安装时仍只有18项可执行，音频项显示未支持/配置说明。

## 实际交付

用户上传真实WAV，经PCM格式校验后，用固定版本PocketSphinx 5.1.1及其美式英语声学/语言模型实际解码。不用语言模型猜录音内容，不把TTS朗读当转写，也不把正确答案作为识别提示。

- `transcript.txt`：实际识别文本，不自动补标点或改写。
- `transcript.srt`：基于实际识别词区间的分段字幕。
- `transcript-report.json`：输入及PCM哈希、格式/音量信息、模型哈希、原始解码片段、逐词时间/分数、低分标记和能力边界。
- `review-audio.wav`：上传文件原字节，用于听音核对，不转码或修改采样。
- `transcript-review.html`：可离线打开的原音频播放器、段落文本、逐词时间/分数及低分高亮；实际音频内嵌于页面，不需要联网。
- `recognizer-license.txt`：软件及声学模型许可，HTML内也保留。
- 服务层的 `execution-receipt.json`：共7项交付。

页面可下载有明确来源的真实录音示例及许可。示例来自PocketSphinx公开测试集，仅为原PCM添加WAV头，**本应用未合成这段音频，样例也不充抵36个真实业务案例**。不同录音的内容确实由解码器识别，而非按文件名或固定句子输出。

## 输入与语言确认

进入“专家 → 文档整理 → 真实技能执行台”，选择“短英语WAV离线转写与时间戳”。

1. 选择0.5–15秒、16000Hz、单声道、16位有符号小端PCM WAV，文件≤2MB。
2. 明确选择“确认：音频主要为英语（美式模型）”。这只是用户声明，**程序没有自动判断语言**。
3. 单独同意上传材料到应用后台，然后执行。文件及产物按原有所有者规则保存在后台，直到用户删除运行。
4. 对照原音频检查文字、金额、姓名、数字及时间。英文模型遇到中文、音乐、噪声和口音可能输出错词，不能按高分自动通过。

更换文件会清除语言声明和上传同意，不能沿用上一段录音的确认。该技能当前**仅手动执行**，从模型规划候选中排除，不让模型替用户确认音频语言。手动执行不调用聊天模型，但确实调用所列本地声学/语言识别模型。

只接收完整RIFF/WAVE及单一fmt/data块，支持JUNK、LIST/INFO辅助元数据并报告其存在。拒绝压缩WAV、MP3/M4A、立体声、其他采样率、RF64、重复音频块、未知扩展、截断/拼接或超长文件；不悄悄重采样、混音或截取前15秒。极低音量/静音、无可识别语音、任一检测段没有可用词、异常时间或超过300词时失败，无部分产物。

## 时间与分数不作过度承诺

- 使用实际VAD检测语音段，再进行开放词汇英语模型解码；不是预设指令语法或给定文本强制对齐。
- 原音频时间 = VAD起点 + 100Hz解码帧时间。原生帧末包含端点，导出末端取下一帧边界，按毫秒舍入，必要时限于录音末尾。原始帧及VAD时间仍保留在报告中。
- 前导静音、段间静音没有被删除后冒充原始时间；真实拼接样例验证第二段时间保留在原录音位置。
- VAD可能漏语音，词边界为近似估计，不保证完整逐字稿或精准人工字幕。
- 原始近似后验分数可能略大于1；报告保存原值，显示值限于0–1。低于0.8只作为优先复核提示，**不是校准准确率，也不是正确/错误判定器**。全部词均标记需要人工复核。
- 未进行摘要、翻译、标点恢复、说话人识别/分离、背景噪声清除或长会议处理。

## 部署、模型与动态可用状态

当前固定运行包限定 **Linux x86_64 + Python 3.11**。模型/原生库由受哈希校验的PyPI wheel取得，软件包及模型在 `data/skill-models/asr-en-v1/`，被Git忽略，不随源码提交或旧云盘快照保存。

```sh
python3 scripts/setup-asr.py
# 或 pnpm setup:asr
pnpm dev:full
```

安装脚本只在管理员主动运行时下载固定wheel，校验完整SHA256、条目及逐文件哈希，原子安装；不会覆盖已有损坏/修改过的安装目录。用真实录音完成实际识别自检后才写就绪标记。再次执行会检查已有安装并重新自检，不重新下载。

自定义路径须在安装命令和服务端使用相同的 `DESIGNBUDDY_ASR_ROOT`；Python安装脚本不会自动读取`.env`。默认目录无需额外配置。服务端依赖定位也支持已有 `DESIGNBUDDY_ASSET_ROOT`。

注册表验证安装标记、可执行解释器及固定资产哈希；文件发生变化后重新核验。每次识别子进程还会再次校验资产，然后才导入原生模块。缺失/损坏时GET注册表返回未支持，新执行请求409，其他18项工具不受影响。**请求上传音频时不下载模型，不访问外部识别服务。**

固定包、平台、文件大小与哈希见 `server/skills/asr-assets.json`。软件/声学模型许可见 `docs/licenses/pocketsphinx-5.1.1.txt`；录音源归档、原PCM/WAV哈希及变换见 `server/skills/testing/audio/sources.json`。

## 受控进程与安全边界

音频解析/产物构建仍在原有受限worker里，原生Python识别子进程由**API主进程管理**，不是让worker创建无人管理的子进程。每个音频worker只能请求一次受控解码；不接受用户命令、脚本路径、模型路径或识别提示。

- PCM通过标准输入管道传递，不写临时上传音频文件；Python使用isolated模式，继承的环境不含服务端密钥。
- 子进程独立进程组，Node侧24秒期限；Python侧25秒墙钟、15秒CPU及512MiB虚拟地址空间硬限制，禁用core dump。
- API取消、worker异常/退出、总任务超时及服务关闭会杀死识别进程组并回收进程。API进程死亡还有Linux父进程死亡信号保护；启动后核对父PID避免设置窗口内的孤儿进程。
- 延续现有2任务并发、45秒任务期限、所有者隔离、执行授权、10MB成果总量及原子保存。所有失败/取消均没有部分下载成果，重新上传并确认才是新任务。
- 这不是容器、网络沙箱或独立用户权限隔离，**不作为已完成全栈/测试专家隔离基础设施的证明**。

核对HTML只包含转义文本与data音频，CSP禁用脚本、外部资源、表单等；应用内继续使用 `iframe sandbox=""`。实际浏览器验证原音频可解码播放、文字/分数显示和父页面访问受阻。320/390px页面不横向溢出。原音频保留原文件元数据，分享前必须复核权限和隐私。

## 验收记录

[持久验收目录](../verification/english-asr-2026-10-16/)保存通过真实服务队列/worker生成并核验下载哈希的两套7项产物、浏览器截图、测试日志及源码哈希。

新增10项服务端测试，覆盖真实双录音识别、前导静音/双语音段时间、PCM/RIFF边界、静音、参数声明、缺失/同大小损坏资产禁用、真实worker/7项产物/所有者隔离、取消与明确重试、worker异常/服务关闭/期限对子进程的回收、非法识别输出拒绝。

新增6项浏览器测试，覆盖真实录音示例、两项确认、TXT/SRT/哈希、实际可播放核对HTML与sandbox、换材料重置确认、错误无产物、刷新和320/390px。

- 后端合并回归：123/123通过，无失败/跳过。
- 新增浏览器专项：6/6通过；相关17组 **167/167** 合并回归通过（8.8分钟），无失败/跳过。其后补充“音频仅手动执行”的规划提示/断言，服务端123项再次通过。最后收窄示例来源措辞后，音频专项10项服务端及6项浏览器再次通过，不重复累计，也不称为全站浏览器通过。
- 目录/任务库：9/9通过。
- 后端TypeScript、前端TypeScript及生产构建、diff检查通过；原有大主包/fflate混合导入告警仍存在。
- 已查看实际播放器、词级时间表、低分高亮及390px截图。两条公开测试录音分别识别为 `go forward ten meters` 和 `go somewhere and do something`；只证明这两个受控样例结果，不代表通用准确率或业务验收。

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/*.test.cjs server/api/*.test.cjs
node --test scripts/expert-catalog.test.mjs scripts/prompt-library.test.mjs
npx --yes pnpm@9.0.0 --filter designbuddy-web build
# 本环境需已有Chromium与系统库；常规环境可使用安装好的Playwright浏览器
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test audio-transcribe.spec.ts infographic.spec.ts docx-structure.spec.ts formula-batch.spec.ts advanced-office.spec.ts task-skills.spec.ts skill-planning.spec.ts skill-phase-two.spec.ts skill-runtime.spec.ts expert-avatars.spec.ts experts.spec.ts skills.spec.ts expert-match.spec.ts conversation.spec.ts clarification.spec.ts attach-menu.spec.ts home-reference.spec.ts
```

本轮不重跑前批479项全站范围，不将相关范围叫全站通过；前批FFmpeg未配置导致的视频验收缺口仍保留。没有接入中文/多语种模型、供应商模型选型、外部业务操作或36个业务案例。未推送、部署或更新云盘备份，其余高级任务不整体打勾。
