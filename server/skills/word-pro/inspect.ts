import type { WordDocument } from "../../../shared/wordDocument";
import { contentHash, contentTexts, norm } from "./schema";
import type { WordPage } from "./render";
import type { WordImage } from "./generate";
export type WordIssue = {
  id: string;
  type: string;
  severity: "critical" | "warning";
  nodeId: string | null;
  page: number | null;
  method: string;
  autoRepair: boolean;
  message: string;
};
export function inspectWord(
  d: WordDocument,
  pages: WordPage[],
  images: Record<string, WordImage>,
  missingFonts: unknown[] = [],
) {
  const issues: WordIssue[] = [];
  const add = (
    type: string,
    nodeId: string | null,
    message: string,
    autoRepair = false,
    page: number | null = null,
    severity: "critical" | "warning" = "warning",
    method = "DOCX-spec-rule",
  ) =>
    issues.push({
      id: `${type}:${nodeId || page || "document"}`,
      type,
      severity,
      nodeId,
      page,
      method,
      autoRepair,
      message,
    });
  for (const b of d.blocks) {
    if (b.type === "heading" && b.keepNext === false)
      add(
        "heading-protection-disabled",
        b.id,
        "标题未设置与后文保持；这是结构风险，不代表已证实孤立标题。",
        true,
      );
    if (b.type === "table") {
      const widths = b.widthsMm || b.headers.map(() => 170 / b.headers.length);
      if (widths.reduce((a, v) => a + v, 0) > 170.15)
        add(
          "table-width",
          b.id,
          "声明列宽超出170mm版心；可在最小12mm约束内重分配。",
          true,
          null,
          "critical",
        );
      if (b.repeatHeader === false)
        add("table-header", b.id, "表格重复表头未启用。", true);
    }
    if (b.type === "image") {
      const a = images[b.id],
        w = b.widthMm || 150;
      if (a && (w > 170 || (w * a.height) / a.width > 210))
        add(
          "image-frame",
          b.id,
          "完整图片框超出170×210mm安全范围，可等比例缩小、不裁切。",
          true,
          null,
          "critical",
        );
    }
  }
  const bodyItems = (p: WordPage) =>
    p.items.filter((i) => i.y > 45 && i.y < p.height - 45);
  const full = norm(
    pages
      .map((p) =>
        bodyItems(p)
          .map((i) => i.text)
          .join(""),
      )
      .join(""),
  );
  const marker = norm("资料原文附录 / WORD PRO SOURCES"),
    pos = full.indexOf(marker);
  const bounded = pos >= 0 && full.indexOf(marker, pos + marker.length) < 0;
  const all = bounded ? full.slice(0, pos) : "";
  const coverage = contentTexts(d).map((t) => ({
    nodeId: t.id,
    status: all.includes(norm(t.text)) ? "matched" : "unresolved",
  }));
  for (const c of coverage)
    if (c.status !== "matched")
      add(
        "pdf-text-unresolved",
        c.nodeId,
        "PDF文本未完整匹配此项；可能是提取顺序/换行/跨页表头，不能据此自动断定内容丢失。",
        false,
        null,
        "warning",
        "PDF-text-match-whitespace-only",
      );
  const headings = d.blocks.filter((b) => b.type === "heading");
  for (const page of pages) {
    const items = bodyItems(page).filter((i) => norm(i.text));
    if (!items.length)
      add(
        "blank-page-candidate",
        null,
        "无正文可提取文本；可能为合法留白或图片页，须人工检查。",
        false,
        page.page,
        "warning",
        "PDF-body-text",
      );
    for (const item of items)
      if (
        item.x < 48 ||
        item.x + item.width > page.width - 48 ||
        item.y < 42 ||
        item.y + item.height > page.height - 42
      ) {
        add(
          "text-boundary-candidate",
          null,
          "PDF文字边界接近版心外侧；未执行像素级遮挡判断。",
          false,
          page.page,
          "warning",
          "PDF-text-geometry",
        );
        break;
      }
    const text = norm(items.map((i) => i.text).join(""));
    for (const h of headings) {
      if (h.type !== "heading") continue;
      const matches = pages.filter((p) =>
        norm(
          bodyItems(p)
            .map((i) => i.text)
            .join(""),
        ).includes(norm(h.text)),
      );
      // Repeated navigation/source text makes mapping ambiguous: never auto-move such headings.
      if (
        matches.length === 1 &&
        text.endsWith(norm(h.text)) &&
        items.at(-1)!.y < 145
      )
        add(
          "orphan-heading-candidate",
          h.id,
          "唯一文本匹配的标题出现在页尾；仅给候选，不擅自更改分页。",
          false,
          page.page,
          "warning",
          "PDF-unique-text-and-y",
        );
    }
  }
  if (missingFonts.length)
    add(
      "font-substitution",
      null,
      "LibreOffice报告缺失字体，目标外观未通过。",
      false,
      null,
      "critical",
      "LibreOffice-missingFonts",
    );
  return {
    issues,
    coverage,
    checks: {
      headingHierarchy: {
        status: "passed",
        method: "strict WordSpec validation",
      },
      nativeContent: {
        status: "passed",
        method: "generated DOCX text inventory verified before render",
      },
      pdfTextCoverage: {
        status: coverage.every((c) => c.status === "matched")
          ? "passed"
          : "unresolved",
        method: "PDF text match; not semantic verification",
      },
      tableWidths: {
        status: issues.some((i) => i.type === "table-width")
          ? "failed"
          : "passed",
        method:
          "declared DOCX widths against page margins; not pixel inspection",
      },
      tocPageNumbers: {
        status: "not-applicable",
        method: "native internal chapter links without page numbers",
      },
      pageNumberFields: {
        status: "required",
        method:
          "PAGE/NUMPAGES emitted; manual rendered and target-client check required",
      },
      renderedVisualReview: { status: "required", method: null },
      targetWordCompatibility: { status: "not-evaluated", method: null },
    },
    score: {
      weights: {
        visual: 30,
        content: 25,
        structure: 20,
        pagination: 15,
        compatibility: 10,
      },
      calibrated: false,
      weightedScore: null,
    },
    releaseStatus: issues.some((i) => i.severity === "critical")
      ? "blocked"
      : "needs-human-review",
    commercialApproval: false,
  };
}
export function repairWord(
  d: WordDocument,
  issues: WordIssue[],
  images: Record<string, WordImage>,
) {
  const beforeHash = contentHash(d),
    next = structuredClone(d),
    actions: {
      issueId: string;
      nodeId: string;
      action: string;
      before: unknown;
      after: unknown;
    }[] = [];
  for (const issue of issues) {
    if (!issue.autoRepair || !issue.nodeId) continue;
    const b = next.blocks.find((b) => b.id === issue.nodeId);
    if (!b) continue;
    if (issue.type === "table-width" && b.type === "table") {
      const before = b.widthsMm!;
      const remaining = 170 - 12 * before.length,
        total = before.reduce((n, v) => n + Math.max(0, v - 12), 0);
      b.widthsMm = before.map(
        (w) =>
          12 +
          remaining * (total ? Math.max(0, w - 12) / total : 1 / before.length),
      );
      actions.push({
        issueId: issue.id,
        nodeId: b.id,
        action: "redistribute-column-widths",
        before,
        after: b.widthsMm,
      });
    } else if (issue.type === "table-header" && b.type === "table") {
      actions.push({
        issueId: issue.id,
        nodeId: b.id,
        action: "repeat-table-header",
        before: b.repeatHeader,
        after: true,
      });
      b.repeatHeader = true;
    } else if (
      issue.type === "heading-protection-disabled" &&
      b.type === "heading"
    ) {
      actions.push({
        issueId: issue.id,
        nodeId: b.id,
        action: "keep-heading-with-next",
        before: b.keepNext,
        after: true,
      });
      b.keepNext = true;
    } else if (issue.type === "image-frame" && b.type === "image") {
      const a = images[b.id],
        before = b.widthMm || 150;
      b.widthMm = Math.min(before, 170, (210 * a.width) / a.height);
      actions.push({
        issueId: issue.id,
        nodeId: b.id,
        action: "scale-complete-image-proportionally",
        before,
        after: b.widthMm,
      });
    }
  }
  if (contentHash(next) !== beforeHash)
    throw Error("修复改变了内容/数据/来源清单，已中止。");
  return { spec: next, actions, contentHash: beforeHash };
}
