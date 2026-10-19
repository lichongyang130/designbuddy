import PptxGenJS from "pptxgenjs";
import {
  initialBenchmark,
  projectSpec,
  reviewMetrics,
  reviewPages,
  type BenchmarkState,
} from "./commercialTemplates";

/** Native editable objects; fixed geometry with generous bounds, no external images. */
export async function reviewPptx(
  state: BenchmarkState = initialBenchmark("pro-review"),
): Promise<Uint8Array> {
  if (!state.title.trim() || state.edits.some((t) => !t.trim()))
    throw Error("请先填写品牌名称和全部页标题。");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "DesignBuddy";
  pptx.subject = "原创合成经营样例；不是实际公司业绩";
  pptx.title = state.title;
  const ink = "263D42",
    accent = state.accent.slice(1),
    muted = "647477",
    font = "Noto Sans SC";
  reviewPages.forEach((page, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: i === 0 ? ink : "F4F3EB" };
    const color = i === 0 ? "F4F3EB" : ink;
    slide.addText(`${state.title} / QUARTERLY REVIEW`, {
      x: 0.65,
      y: 0.35,
      w: 10,
      h: 0.35,
      fontFace: font,
      fontSize: 11,
      color: i === 0 ? "B8CDCD" : ink,
      margin: 0,
      charSpacing: 2,
    });
    slide.addText(state.edits[i], {
      x: 0.65,
      y: 1,
      w: 11.8,
      h: 0.95,
      fontFace: font,
      fontSize: i === 0 ? 32 : 27,
      bold: true,
      color,
      margin: 0,
      breakLine: false,
    });
    slide.addText(i === 0 ? state.subtitle : page.lead, {
      x: 0.65,
      y: 2.05,
      w: 11.8,
      h: 0.6,
      fontFace: font,
      fontSize: 16,
      color: i === 0 ? "B8CDCD" : muted,
      margin: 0,
    });
    const text = (
      value: string,
      x: number,
      y: number,
      w: number,
      h: number,
      size = 16,
      color = ink,
    ) =>
      slide.addText(value, {
        x,
        y,
        w,
        h,
        fontFace: font,
        fontSize: size,
        color,
        margin: 0,
        breakLine: false,
      });
    const panel = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill = "FFFFFF",
    ) =>
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w,
        h,
        line: { color: fill },
        fill: { color: fill },
      });
    if (i === 0) {
      panel(0.65, 2.95, 11.8, 0.02, "5F7C76");
      page.points.forEach((p, j) =>
        text(p, 1.1, 3.3 + j * 0.76, 10.5, 0.58, 17, "E0E8E1"),
      );
      text("OBSERVE / EXPLAIN / DECIDE", 0.65, 6.1, 11.8, 0.3, 13, "B8CDCD");
    } else if (i === 2) {
      reviewMetrics.forEach((m, j) => {
        const x = 0.65 + j * 4.03;
        panel(x, 2.85, 3.73, 1.45);
        text(m.label + " / " + m.unit, x + 0.2, 3, 3.3, 0.25, 12, muted);
        text(String(m.actual), x + 0.2, 3.4, 2, 0.65, 34);
        text("目标 " + m.target, x + 2.2, 3.65, 1.3, 0.3, 12, muted);
      });
      slide.addTable(
        [
          ["指标 / 单位", "目标", "实际", "差异"],
          ...reviewMetrics.map((m) => [
            m.label + " / " + m.unit,
            String(m.target),
            String(m.actual),
            `${m.actual - m.target}${m.unit === "%" ? " 个百分点" : " " + m.unit}`,
          ]),
        ].map((row) => row.map((text) => ({ text }))),
        {
          x: 0.65,
          y: 4.55,
          w: 11.8,
          h: 1.45,
          fontFace: font,
          fontSize: 13,
          border: { type: "solid", pt: 0.5, color: "B7C9C8" },
          fill: { color: "FFFFFF" },
          color: ink,
          margin: 0.08,
          rowH: 0.36,
          colW: [4.1, 2.2, 2.2, 3.3],
        },
      );
      text(
        "合成数据 / 完成率 = 实际 ÷ 目标；不同单位不可相加",
        0.65,
        6.3,
        11.8,
        0.35,
        11,
        muted,
      );
    } else if ([1, 3, 5].includes(i)) {
      const labels =
        i === 1
          ? ["净收入", "新增客户", "续约率"]
          : i === 3
            ? ["已知观察", "待补证据", "核查行动"]
            : ["观察", "需补明细", "下一步"];
      page.points.forEach((p, j) => {
        const x = 0.65 + j * 4.03;
        panel(x, 2.95, 3.73, 3.15, j === 0 ? "E1E9E5" : "FFFFFF");
        text(String(j + 1).padStart(2, "0"), x + 0.25, 3.2, 1, 0.4, 24);
        text(labels[j], x + 0.25, 3.8, 3.2, 0.4, 18);
        text(p, x + 0.25, 4.45, 3.2, 1.4, 15);
      });
    } else if (i === 4) {
      page.points.forEach((p, j) => {
        const x = 0.65 + j * 4.03;
        panel(x, 3.1, 3.73, 2.7);
        text(
          ["01 / 入口", "02 / 过程", "03 / 结果"][j],
          x + 0.25,
          3.4,
          3.2,
          0.4,
          20,
        );
        text(p, x + 0.25, 4.2, 3.2, 1.2, 15);
        if (j < 2) text("→", x + 3.7, 3.7, 0.3, 0.4, 18);
      });
      text(
        "阶段数据未提供，不绘制虚构的漏斗比例。",
        0.65,
        6.2,
        11.8,
        0.35,
        12,
        muted,
      );
    } else if (i === 6) {
      slide.addTable(
        [
          ["风险领域", "观察信号与处理动作"],
          ...page.points.map((p) => {
            const at = p.indexOf("：");
            return [p.slice(0, at), p.slice(at + 1)];
          }),
        ].map((row) => row.map((text) => ({ text }))),
        {
          x: 0.65,
          y: 3,
          w: 11.8,
          h: 2.7,
          fontFace: font,
          fontSize: 16,
          border: { type: "solid", pt: 0.5, color: "B7C9C8" },
          fill: { color: "FFFFFF" },
          color: ink,
          margin: 0.17,
          rowH: 0.65,
          colW: [2.5, 9.3],
        },
      );
      text(
        "建议规则，需实际团队确认；不是已发生的事故。",
        0.65,
        6.1,
        11.8,
        0.35,
        12,
        muted,
      );
    } else if (i === 8) {
      panel(0.65, 2.95, 4, 3.25, ink);
      text("DECISION\nREQUEST", 0.95, 3.3, 3.4, 1.1, 28, "F4F3EB");
      text("本页是请求，不是批准记录。", 0.95, 5.3, 3.3, 0.5, 13, "D6E4DE");
      page.points.forEach((p, j) => text(p, 5.1, 3 + j * 0.95, 7.2, 0.8, 16));
    } else {
      page.points.forEach((p, j) => {
        panel(0.65, 2.95 + j * 1.02, 11.8, 0.85, j % 2 ? "E1E9E5" : "FFFFFF");
        text(
          String(j + 1).padStart(2, "0"),
          0.9,
          3.12 + j * 1.02,
          0.5,
          0.35,
          15,
        );
        text(p, 1.6, 3.08 + j * 1.02, 10.4, 0.58, 16);
      });
    }
    slide.addText("原创合成教学样例 · 口径/讲稿见备注 · 不代表真实业绩", {
      x: 0.65,
      y: 6.95,
      w: 11.2,
      h: 0.22,
      fontFace: font,
      fontSize: 9,
      color: i === 0 ? "B8CDCD" : muted,
      margin: 0,
    });
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: 12,
      y: 6.88,
      w: 0.6,
      h: 0.3,
      fontFace: font,
      fontSize: 13,
      color: i === 0 ? "B8CDCD" : ink,
      margin: 0,
    });
    slide.addNotes(
      `${page.note}\n来源：shared/commercialTemplates.ts，原创合成样例。\n当前页标题：${state.edits[i]}`,
    );
  });
  const bytes = await pptx.write({ outputType: "arraybuffer" });
  return new Uint8Array(bytes as ArrayBuffer);
}

/** Browser-editable native DOCX. PDF download in the UI is explicitly a fixed original sample. */
export async function projectDocx(state: BenchmarkState): Promise<Uint8Array> {
  if (!state.title.trim() || state.edits.some((t) => !t.trim()))
    throw Error("请先填写项目名称和全部章节标题。");
  const d = await import("docx");
  const spec = projectSpec(state);
  const children: InstanceType<typeof d.Paragraph | typeof d.Table>[] = [];
  children.push(
    new d.Paragraph({ text: spec.title, heading: d.HeadingLevel.TITLE }),
    new d.Paragraph({ text: spec.subtitle }),
    new d.Paragraph({
      text: "原创方法样例 · 非合同 · 未批准项目承诺",
      spacing: { after: 280 },
    }),
  );
  for (const b of spec.blocks) {
    if (b.type === "heading")
      children.push(
        new d.Paragraph({
          text: b.text,
          heading: d.HeadingLevel.HEADING_1,
          keepNext: true,
        }),
      );
    if (b.type === "paragraph")
      children.push(
        new d.Paragraph({ text: b.text, spacing: { after: 160, line: 320 } }),
      );
    if (b.type === "table") {
      children.push(new d.Paragraph({ text: b.caption, keepNext: true }));
      children.push(
        new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          rows: [b.headers, ...b.rows].map(
            (r, i) =>
              new d.TableRow({
                tableHeader: i === 0,
                children: r.map(
                  (t) =>
                    new d.TableCell({
                      children: [
                        new d.Paragraph({
                          children: [new d.TextRun({ text: t, bold: i === 0 })],
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
      );
      children.push(new d.Paragraph({ text: b.scope + " " + b.calculation }));
    }
  }
  children.push(
    new d.Paragraph({
      text: "来源：shared/commercialTemplates.ts / projectPages，项目原创方法样例。",
    }),
  );
  const document = new d.Document({
    styles: {
      default: { document: { run: { font: "Noto Sans SC", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children,
      },
    ],
  });
  return new Uint8Array(await d.Packer.toArrayBuffer(document));
}
