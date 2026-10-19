/** Word Pro 1: deterministic, source-bound document layout; no AI writing or old-file editing. */
export const wordEngineVersion = "word-pro-1.0.0";
export const wordSections = {
  "business-report": [
    { role: "summary", title: "执行摘要" },
    { role: "analysis", title: "分析与依据" },
    { role: "recommendations", title: "建议与行动" },
  ],
  "project-plan": [
    { role: "objectives", title: "目标与背景" },
    { role: "scope", title: "范围与非范围" },
    { role: "deliverables", title: "交付物与建议关卡" },
    { role: "risks", title: "风险与应对" },
    { role: "acceptance", title: "验收条件" },
  ],
} as const;
export type WordType = keyof typeof wordSections;
type Base = { id: string; refs: string[] };
export type WordBlock = Base &
  (
    | {
        type: "heading";
        text: string;
        level: 1 | 2 | 3;
        role?: string;
        keepNext?: boolean;
      }
    | { type: "paragraph"; text: string }
    | {
        type: "table";
        caption: string;
        headers: string[];
        rows: string[][];
        scope: string;
        calculation: string;
        widthsMm?: number[];
        repeatHeader?: boolean;
      }
    | {
        type: "image";
        caption: string;
        alt: string;
        base64: string;
        filename: string;
        license: string;
        permissionConfirmed: true;
        usage: "evidence" | "decorative";
        widthMm?: number;
      }
  );
export type WordDocument = {
  schemaVersion: 1;
  documentType: WordType;
  title: string;
  subtitle: string;
  sources: { id: string; name: string; locator: string; text: string }[];
  blocks: WordBlock[];
};
export function wordExample(type: WordType = "business-report"): WordDocument {
  const source = {
    id: "source-1",
    name: "原创排版教学案例",
    locator: "本请求内嵌全文；不是业务原件",
    text: "",
  };
  const refs = [source.id];
  const paragraphs: Record<string, string[]> = {
    summary: [
      "本报告讨论如何把文档交付从“文件能够下载”推进到“内容可核对、排版可解释、问题可追踪”。它是一份原创方法示例，不代表任何客户项目、审批决定或实测效果。",
      "建议先验证原生结构与真实分页，再扩展自动写作。生成成功仅表示执行完成；事实、视觉效果与目标办公软件的表现仍需分别核验。缺失证据应保留为待确认项，不以流畅文案掩盖。",
    ],
    analysis: [
      "同一段文字可以被不同引擎排成不同页面。独立生成的PDF不能证明DOCX的实际分页；应以最终DOCX为输入导出PDF，并将文件哈希、页数、字体与渲染引擎写入记录。",
      "结构检查能够核对标题层级、表格列宽与来源引用，却不能单独证明文字没有遮挡。真实页图能提供视觉证据，但也不能自动证明事实正确或在Microsoft Word中完全一致。",
      "正文应使用统一的段落样式，而不是逐段复制直接格式。标题需要与后文保持，长段落应允许合理跨页。对所有内容设置“不拆分”可能引发大块留白，不能把这种留白一律判定为引擎错误。",
      "表格应先明确字段含义、单位、范围与计算规则，再处理列宽和重复表头。数字以原字符串保留，不为排版而转成百分数、合并不同统计范围或隐藏行列。跨页后的可读性需要查看全部页图。",
      "目录有两种不同承诺：章节导航只说明结构；带页码的自动目录还要求域刷新与缓存一致。本例提供无页码章节导航，不把它冒充已经刷新正确的自动页码目录。",
      "来源编号只证明位置存在，不证明句意被来源支持。审阅者应分别核查原始事实、合理推断和行动建议；建议关卡不是已完成的进度，空白的验收框也不等于通过。",
    ],
    recommendations: [
      "先用固定、可追踪的材料建立排版基线，同时保存正文和单元格清单。修复只能更改受支持的版式参数，不能删除正文、隐藏数据或擅自改写结论来消除溢出。",
      "允许自动执行的动作应保持有限：按版心重分列宽、恢复重复表头、保护标题以及等比例缩放超框图片。无法可靠定位的问题应转人工，不通过不断重试制造虚假的成功。",
      "每一轮修复都要重新渲染整份文件。前文表格宽度变化会影响后文分页，因此只查看原来出错的一页是不充分的。达到次数或时间预算后停止，并保留未解决问题。",
      "交付前请逐页检查封面、章节导航、正文、表格、页眉页脚和来源附录。随后在目标Word或WPS版本中打开，记录字体环境与分页差异。只有完成相应验证，才能作出对应范围的结论。",
    ],
    objectives: [
      "本项目方案以“保全输入内容、生成可编辑正文、提供同源预览”为目标。此处描述的是建议实施方法，不代表立项已批准、人员已到位或资源已经承诺。",
      "先区分生成新文档与编辑原稿：读取原稿作为来源不等于无损往返。对不支持的修订、复杂域或嵌入对象，应明确告知边界，不把部分提取的结果称作完整还原。",
    ],
    scope: [
      "本期范围为商业报告与项目方案的结构化排版、原生表格和有限图片布局。未列入范围的内容包括任意旧稿无损编辑、法律有效性审查和复杂图表的逐节点编辑。",
      "外部模型、图像生成和在线检索属于不同的授权范围。没有单次授权，不应把材料发送给这些服务；没有通道配置，也不能用固定范文或占位图片冒充生成结果。",
    ],
    deliverables: [
      "交付物应包括最终DOCX、从该文件导出的PDF、逐页图像，以及来源和质量记录。每个产物应能追溯到同一个最终版本，而不是混用修复前的Word与修复后的预览。",
      "建议按“内容清单确认—原生生成—真实渲染—有限修复—人工复核”推进。这里的关卡表示建议顺序，不构成未经评估的日期安排、预算或已完成状态。",
    ],
    risks: [
      "字体替换会影响行宽和分页。部署时应保留实际授权字体及许可，并在报告中记录缺字和替换信号。未报告缺字体也不等于目标客户端已安装了同一套字体。",
      "自动修复可能把问题移动到后续页面。每轮应比较全篇问题清单和内容哈希；发生内容变化或更严重问题时停止或回退，而不是以页数变少作为质量提高的证据。",
    ],
    acceptance: [
      "自动验收核对文件结构、内容覆盖、来源绑定和实际渲染结果；人工验收核查语义、阅读体验、版权与目标软件兼容性。两者分别记录，不能相互替代。",
      "关键内容缺失、文件打不开或严重可证实溢出不能被综合评分抵消。无法可靠确认的目录页码、文本定位或复杂遮挡应保持待审，不自动授予商业批准。",
    ],
  };
  const blocks: WordBlock[] = [];
  for (const section of wordSections[type]) {
    blocks.push({
      id: section.role,
      type: "heading",
      level: 1,
      role: section.role,
      text: section.title,
      refs,
    });
    for (const [i, text] of paragraphs[section.role].entries())
      blocks.push({
        id: `${section.role}-${i}`,
        type: "paragraph",
        text,
        refs,
      });
    if (section.role === "analysis" || section.role === "deliverables")
      blocks.push({
        id: "verification-table",
        type: "table",
        caption: "交付检查矩阵",
        headers: ["检查对象", "自动检查依据", "仍需人工确认"],
        rows: [
          ["正文", "DOCX文字与输入清单比对", "事实与推断是否成立"],
          ["标题", "层级、保护属性与PDF位置候选", "章节节奏是否合理"],
          ["表格", "列宽、表头、逐单元格内容", "跨页观感与业务口径"],
          ["图片", "尺寸、比例与规范化素材哈希", "内容、版权与证据范围"],
          ["目录", "原生章节导航链接", "本例不提供自动目录页码"],
          ["页码", "实际PDF页数与字段配置", "目标软件字段刷新"],
          ["字体", "部署字体哈希与渲染报告", "目标客户端字体环境"],
          ["修复", "动作、轮次与内容清单比对", "复杂遮挡与阅读体验"],
          ["兼容性", "本地LibreOffice渲染记录", "Microsoft Word/WPS实际打开"],
        ],
        scope: "原创方法示例；不是任何项目的实际验收结果",
        calculation: "文本检查矩阵，无数值计算",
        refs,
      });
  }
  source.text = blocks
    .map((b) =>
      b.type === "heading" || b.type === "paragraph"
        ? b.text
        : b.type === "table"
          ? [
              b.caption,
              ...b.headers,
              ...b.rows.flat(),
              b.scope,
              b.calculation,
            ].join("\n")
          : b.caption,
    )
    .join("\n\n");
  return {
    schemaVersion: 1,
    documentType: type,
    title:
      type === "business-report"
        ? "从文件生成到可核对交付"
        : "文档交付质量提升项目方案",
    subtitle: "原创方法示例 · 未经商业验收 · 不代表真实业务数据",
    sources: [source],
    blocks,
  };
}
