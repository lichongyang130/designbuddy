import type { PresentationSpec } from "./spec";
import type { PresentationSources } from "../../../shared/presentation";
import { resolveContentDirection } from './direction';
import { sha256 } from "./sources";
/** Reproducible engineering signals, not an independent semantic/visual/commercial verdict. */
export function reviewPresentationPlan(
  spec: PresentationSpec,
  sources: PresentationSources,
) {
  const flags: { slideId: string; code: string; message: string }[] = [],
    seen = new Set<string>();
  for (const s of spec.slides) {
    const flag = (code: string, message: string) =>
      flags.push({ slideId: s.id, code, message });
    if (seen.has(s.content.title))
      flag("REPEATED_TITLE", "页标题重复，需人工确认是否在凑页数。");
    seen.add(s.content.title);
    if ((s.content.speakerNotes || "").split("来源位置：")[0].length < 80)
      flag("THIN_NOTES", "讲稿较短，需核对是否补充了证据、口径和限制。");
    if (s.design?.nature === "pending" || !s.design)
      flag("UNCLASSIFIED_OR_PENDING", "性质待确认；不能默认视为已核实事实。");
    const refs = s.sourceRefs.map((r) =>
      sources.blocks.find((b) => b.id === r),
    );
    if (refs.some((r) => !r))
      flag("UNKNOWN_SOURCE", "来源位置未解析，不能作为可信交付。");
    if (s.content.type === "cover" && s.id !== "slide-01")
      flag("ADDITIONAL_COVER", "重复封面需人工确认叙事用途。");
  }
  return {
    schemaVersion: 1,
    ...(spec.direction ? { contentDirection: resolveContentDirection(spec, sources) } : {}),
    scope:
      "Engineering review of supplied plan; not independent semantic verification",
    humanReviewRequired: true,
    commercialApproval: false,
    contentHash: sha256(
      JSON.stringify(
        spec.slides.map((s) => ({
          content: s.content,
          takeaway: s.design?.takeaway || null,
        })),
      ),
    ),
    checks: {
      pageCount: spec.slides.length,
      sourceReferencesResolved: spec.slides.every((s) =>
        s.sourceRefs.every((id) => sources.blocks.some((b) => b.id === id)),
      ),
      boundObjects: spec.slides.filter((s) => s.bindings.length > 0).length,
      semanticSourceSupport: "NOT verified",
      narrativeQuality: "requires human review",
      visualQuality: "requires rendered review",
    },
    flags,
    humanChecklist: [
      "是否围绕明确决策，结论先行且不是无证据标题？",
      "每页是否有实质正文而非目录/占位？",
      "事实与材料是否相符，有无矛盾、遗漏、错分母？",
      "分析、建议和待确认项是否与既成事实分开？",
      "是否虚构预算、人员、日期、收益或已批准决定？",
      "数值、表格和图表是否能回溯原始单元格与口径？",
      "实际PDF与目标Office编辑效果是否逐页复核？",
    ],
  };
}
