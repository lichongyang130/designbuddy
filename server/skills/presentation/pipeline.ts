import {
  compileContentDirection,
  resolveContentDirection,
  contentDirectorInstructions,
} from "./direction";
import type { ContentDirection } from "../../../shared/presentationDirection";
import { presentationDirectionEngineVersion } from "../../../shared/presentationDirection";
import { planPresentationVisuals, visualPalettes } from "./visuals";
import { publicPresentationSources } from "./assets";
import { validatePresentationUsage } from "./usage";
import type { UsageRecord } from "../../api/model-registry";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { requestAI } from "../../api/ai";
import type { SkillInput, Output } from "../executors";
import { buildStructuredPresentation } from "../pptx-deck";
import { renderPresentation } from "../pptx-render";
import { out, json } from "../io";
import type { PresentationCheckpoint } from "../../../shared/presentation";
import {
  object,
  parsePresentationRequest,
  readPresentationSources,
  sha256,
  safeText,
} from "./sources";
import { compilePresentationSpec, planningInstructionsFor } from "./spec";
import { presentationFonts } from "./fonts";
import { presentationQuality } from "./quality";
import { reviewPresentationPlan } from "./planning-review";

/** Small hash-bound, declarative checkpoint, in its own table (not OCR's page/PNG protocol). */
export function validatePresentationCheckpoint(
  value: unknown,
  inputHash: string,
): PresentationCheckpoint {
  const cp = object(
    value,
    [
      "kind",
      "schemaVersion",
      "inputHash",
      "stage",
      "spec",
      "direction",
      "plannerModel",
      "usage",
      "writerAttempts",
    ],
    "演示检查点",
  );
  if (
    cp.kind !== "presentation" ||
    cp.schemaVersion !== 1 ||
    !["planned", "directed"].includes(cp.stage) ||
    cp.inputHash !== inputHash ||
    !/^[a-f0-9]{64}$/.test(inputHash) ||
    Buffer.byteLength(JSON.stringify(cp)) > 400_000
  )
    throw Error("演示检查点版本、输入哈希或体积校验失败。");
  if (cp.stage === "planned") {
    if (cp.direction !== undefined || cp.writerAttempts !== undefined)
      throw Error("已规划检查点不可夹带独立导演状态。");
    object(
      cp.spec,
      [
        "schemaVersion",
        "title",
        "storyline",
        "missingInformation",
        "slides",
        "direction",
      ],
      "规划检查点",
    );
  } else {
    if (cp.spec !== undefined) throw Error("导演检查点不可冒充已写稿状态。");
    if (
      cp.writerAttempts !== undefined &&
      (!Number.isInteger(cp.writerAttempts) ||
        cp.writerAttempts < 0 ||
        cp.writerAttempts > 2)
    )
      throw Error("写稿调用预算非法。");
    const d = object(
      cp.direction,
      ["schemaVersion", "decision", "argument", "pages"],
      "导演检查点",
    );
    if (
      d.schemaVersion !== 1 ||
      !Array.isArray(d.pages) ||
      d.pages.length > 25 ||
      JSON.stringify(d).length > 30_000
    )
      throw Error("导演检查点格式或预算超限。");
  }
  if (cp.plannerModel !== undefined) safeText(cp.plannerModel, 200, "模型标识");
  if (cp.usage !== undefined) {
    const max =
      cp.stage === "planned" && cp.spec?.direction
        ? 4
        : cp.stage === "directed"
          ? 2 + (cp.writerAttempts || 0)
          : 2;
    if (!Array.isArray(cp.usage) || cp.usage.length > max)
      throw Error("检查点用量记录超限。");
    cp.usage.forEach(validatePresentationUsage);
  }
  return cp as PresentationCheckpoint;
}
function parseModelJSON(value: string): unknown {
  if (value.length > 80_000) throw Error("模型规划超过 80000 字。");
  const raw = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(raw);
  } catch {
    throw Error("模型没有返回有效的单个JSON规划对象。");
  }
}
export async function createPresentation(
  input: SkillInput,
  event: (s: string) => void,
) {
  if (!input.owner || input.parameters?.externalConsent !== "yes")
    throw Error("需要已认证的所有者和本次正文处理授权；未发送材料。");
  const request = parsePresentationRequest(input.bytes),
    hash = sha256(input.bytes);
  event("阶段 1/5：校验需求与所有材料；不截断、不执行公式或材料中的指令。");
  const sources = await readPresentationSources(request, hash);
  const fonts = presentationFonts();
  let proposal: unknown,
    model = "",
    planningCalls = 0,
    directorCalls = 0,
    writerCalls = 0;
  let usage: UsageRecord[] = [],
    lockedDirection: ContentDirection | undefined,
    resumedStage: string | undefined;
  let writerAttempts = 0;
  if (input.resumePresentation) {
    const cp = validatePresentationCheckpoint(input.resumePresentation, hash);
    resumedStage = cp.stage;
    model = cp.plannerModel || "checkpoint";
    usage = (cp.usage || []).map(validatePresentationUsage);
    if (cp.stage === "planned") {
      proposal = cp.spec;
      const compiled = compilePresentationSpec(
        proposal,
        request.brief,
        sources,
      );
      resolveContentDirection(compiled, sources);
      planPresentationVisuals(compiled, request.brief, sources);
      event(
        "阶段 2/5：已校验并复用持久化规划检查点；不重复发送正文、不重复调用模型。",
      );
    } else {
      writerAttempts = cp.writerAttempts || 0;
      if (writerAttempts >= 2)
        throw Error(
          "写稿两次调用预算已用完；不重复发送正文，请重新准备并明确授权新任务。",
        );
      lockedDirection = compileContentDirection(
        cp.direction,
        request.brief,
        sources,
      );
      event(
        "阶段 2/5：已恢复内容导演；不重复导演调用，仍将执行本次已授权的逐页写稿。",
      );
    }
  }
  if (proposal === undefined) {
    if (!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY)
      throw Error("服务端AI模型未配置；不会用模板冒充AI规划。");
    const bundle = {
      brief: request.brief,
      assets: publicPresentationSources(sources).assets || [],
      files: sources.files,
      blocks: sources.blocks,
      datasets: sources.datasets.map(({ rows: _rows, ...d }) => d),
      warnings: sources.warnings,
    };
    async function saveDirectorCheckpoint() {
      if (!lockedDirection) return;
      const checkpoint: PresentationCheckpoint = {
        kind: "presentation",
        schemaVersion: 1,
        inputHash: hash,
        stage: "directed",
        direction: lockedDirection,
        writerAttempts,
        plannerModel: model,
        usage: [...usage],
      };
      validatePresentationCheckpoint(checkpoint, hash);
      await input.onPresentationCheckpoint?.(checkpoint);
    }
    async function plan(
      systemPrompt: string,
      payload: unknown,
      label: string,
      validate: (v: unknown) => void,
    ) {
      let validationError = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const writing = !!lockedDirection && label !== "内容导演";
        if (writing) {
          if (writerAttempts >= 2)
            throw Error("写稿两次调用预算已用完；请重新准备并明确授权新任务。");
          writerAttempts++;
          await saveDirectorCheckpoint();
        }
        const response = await requestAI({
          serverConfigurationOnly: true,
          onUsage: (record) => {
            usage.push(validatePresentationUsage(record));
            input.onAIUsage?.(record);
          },
          userId: input.owner!,
          systemPrompt,
          prompt:
            JSON.stringify(payload) +
            (validationError
              ? `\nThe previous proposal failed deterministic validation: ${validationError}. Return a corrected COMPLETE JSON object; preserve the supported facts, do not invent substitutes.`
              : ""),
          options: {
            temperature: 0.2,
            maxTokens: label === "内容导演" ? 9000 : 14000,
          },
        }).finally(async () => {
          if (writing) await saveDirectorCheckpoint();
        });
        planningCalls++;
        if (label === "内容导演") directorCalls++;
        else writerCalls++;
        model = response.model.slice(0, 200);
        try {
          const value = parseModelJSON(response.content);
          validate(value);
          return value;
        } catch (error) {
          validationError =
            error instanceof Error
              ? error.message.slice(0, 400)
              : "规划格式不合法。";
          if (attempt === 1 || (writing && writerAttempts >= 2))
            throw Error(
              `${label}两次均未通过校验，未生成误导性文件：${validationError}`,
            );
          event(
            `模型${label}未通过来源/数据/结构校验；仅进行一次受限的规划重试。`,
          );
        }
      }
      throw Error("规划未返回内容。");
    }
    if (request.brief.narrativeMode === "directed" && !lockedDirection) {
      event(
        "阶段 2/5 · 内容导演：先规划受众决策、论证顺序、逐页任务、证据、视觉表达与节奏；不生成绘图代码。",
      );
      lockedDirection = compileContentDirection(
        await plan(contentDirectorInstructions, bundle, "内容导演", (v) => {
          compileContentDirection(v, request.brief, sources);
        }),
        request.brief,
        sources,
      );
      await saveDirectorCheckpoint();
    }
    event(
      lockedDirection
        ? "阶段 2/5 · 逐页写稿：依据已锁定的任务、结论和证据展开原生正文与讲稿；不得自行改变导演计划。"
        : "阶段 2/5：将已授权的需求、提取正文与数据位置发送给服务端模型，规划叙事、页型与讲稿。",
    );
    proposal = await plan(
      planningInstructionsFor(request.brief),
      { ...bundle, ...(lockedDirection ? { lockedDirection } : {}) },
      "规划",
      (v) => {
        const compiled = compilePresentationSpec(v, request.brief, sources);
        if (
          lockedDirection &&
          JSON.stringify(compiled.direction) !== JSON.stringify(lockedDirection)
        )
          throw Error("逐页写稿不得改写已锁定的内容导演计划。");
        const directed = resolveContentDirection(compiled, sources);
        planPresentationVisuals(
          directed
            ? {
                ...compiled,
                slides: compiled.slides.map((s, i) => ({
                  ...s,
                  design: directed.designs[i],
                })),
              }
            : compiled,
          request.brief,
          sources,
        );
      },
    );
    const cp: PresentationCheckpoint = {
      kind: "presentation",
      schemaVersion: 1,
      inputHash: hash,
      stage: "planned",
      spec: proposal,
      plannerModel: model,
      usage: [...usage],
    };
    validatePresentationCheckpoint(cp, hash);
    await input.onPresentationCheckpoint?.(cp);
  }
  const spec = compilePresentationSpec(proposal, request.brief, sources);
  const directionPlan = resolveContentDirection(spec, sources);
  const visualSpec = directionPlan
    ? {
        ...spec,
        slides: spec.slides.map((s, i) => ({
          ...s,
          design: directionPlan.designs[i],
        })),
      }
    : spec;
  const visualPlan = planPresentationVisuals(
    visualSpec,
    request.brief,
    sources,
  );
  const versionId = sha256(
    JSON.stringify({
      brief: request.brief,
      inputHash: hash,
      spec,
      ...(spec.schemaVersion === 2
        ? {
            layoutEngine: "adaptive-2.0.0",
            ...(directionPlan
              ? { directionEngine: presentationDirectionEngineVersion }
              : {}),
            ...(visualPlan ? { visualEngine: visualPlan.engineVersion } : {}),
          }
        : {}),
    }),
  );
  event(
    "阶段 3/5：用固定主题和真实单元格编译原生文字、形状、图表、表格及讲稿；不执行AI生成代码。",
  );
  const built = await buildStructuredPresentation(
    Buffer.from(
      JSON.stringify({
        title: spec.title,
        theme: {
          ...spec.theme,
          ...(visualPlan ? visualPalettes[visualPlan.style] : {}),
          headingFont: "Noto Sans SC",
          bodyFont: "Noto Sans SC",
        },
        slides: spec.slides.map((s) => s.content),
      }),
    ),
    {
      strictLayout: true,
      contentOrigin: "ai-planned",
      ...(spec.schemaVersion === 2
        ? {
            adaptiveDesigns:
              visualPlan?.designs ||
              directionPlan?.designs ||
              spec.slides.map((s) => s.design!),
            ...(visualPlan
              ? {
                  visual: {
                    style: visualPlan.style,
                    assets: sources.assets || [],
                    logoAssetId: visualPlan.logoAssetId,
                  },
                }
              : {}),
          }
        : {}),
    },
  );
  event(
    "阶段 4/5：本机LibreOffice输出PDF与全页渲染证据；字体缺失/渲染失败将阻止发布通过。",
  );
  let rendered: Awaited<ReturnType<typeof renderPresentation>> | undefined,
    renderError: string | undefined;
  try {
    rendered = await renderPresentation(
      built.pptxBytes,
      spec.slides.length,
      event,
      {
        fontDirectory: fonts.directory,
        pdf: true,
        workDirectory: input.workDirectory,
      },
    );
  } catch {
    renderError =
      "LibreOffice全页渲染未完成或输出校验失败；仅交付阻止发布的草稿与诊断，不冒充成功渲染。";
    event(renderError);
  }
  event(
    "阶段 5/5：校验来源绑定、数值、文字边界/密度/交叠、对比度、字体、PDF及渲染证据。",
  );
  const pdf = rendered?.report.pdf as
    | { pageCount?: number; missingFonts?: string[]; error?: string }
    | undefined;
  const quality = presentationQuality(
    spec,
    sources,
    built.layout,
    { report: rendered?.report, error: renderError },
    pdf || { error: "没有可校验的PDF。" },
    built.resolvedObjects,
  );
  const outputs: Output[] = [
    out(
      "draft-presentation.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      built.pptxBytes,
    ),
    ...(rendered?.outputs.filter((o) => o.name !== "slide-01-preview.jpg") || [
      json("render-report.json", {
        schemaVersion: 1,
        status: "failed",
        sourceSHA256: sha256(built.pptxBytes),
        expectedSlides: spec.slides.length,
        error: renderError,
        review: {
          automaticVisualPass: false,
          visualReviewRequired: true,
          formalReleaseBlocked: true,
        },
      }),
    ]),
    json("presentation-spec.json", {
      schemaVersion: 1,
      versionId,
      parentVersionId: null,
      inputHash: hash,
      brief: request.brief,
      planner: {
        model,
        usage,
        callsThisExecution: planningCalls,
        resumedFromCheckpoint: !!input.resumePresentation,
        externallyResearched: false,
        ...(directionPlan
          ? {
              directorCalls,
              writerCalls,
              resumedStage: resumedStage || null,
              directorAndWriterMaxCalls: 4,
            }
          : {}),
      },
      spec,
      planningReview: reviewPresentationPlan(spec, sources),
      editing: { nativePPTX: true, conversationalRevisionImplemented: false },
    }),
    ...(directionPlan
      ? [
          json("direction-plan.json", {
            schemaVersion: 1,
            versionId,
            ...directionPlan,
            planner: {
              model,
              callsThisExecution: planningCalls,
              directorCalls,
              writerCalls,
              resumedStage: resumedStage || null,
            },
            automaticFactRewriting: false,
          }),
        ]
      : []),
    ...(visualPlan
      ? [
          json("visual-plan.json", {
            schemaVersion: 1,
            versionId,
            ...visualPlan,
            imageUnderstanding: "not-performed; metadata-only planning; no OCR",
            automaticImageGeneration: false,
            assetsRights: "user-declared, not independently verified",
            editable:
              "text, chart, table and captions are native; raster image pixels are not editable vectors",
          }),
        ]
      : []),
    json("sources-and-notes.json", {
      schemaVersion: 1,
      versionId,
      ...publicPresentationSources(sources),
      slides: spec.slides.map((s) => ({
        id: s.id,
        title: s.content.title,
        sourceRefs: s.sourceRefs,
        bindings: s.bindings,
        speakerNotes: s.content.speakerNotes,
      })),
      numericPolicy:
        "Charts read only named, explicit source rows/cells. No inferred units, filtering, aggregation, currency conversion or model-supplied values. Row selections are visible in bindings. Metric display trims outer whitespace (original cells remain in bindings). Native chart numbers use IEEE-754/Excel storage; only values with <=15 significant decimal digits and a stable decimal round-trip are accepted. Display format retains up to 12 decimal places, without integer rounding.",
    }),
    json("resolved-layout.json", {
      schemaVersion: 1,
      versionId,
      canvas: { width: 13.333, height: 7.5, unit: "inch" },
      textElements: built.layout,
      ...(built.adaptiveLayout
        ? {
            adaptiveLayout: built.adaptiveLayout,
            objects: built.resolvedObjects,
          }
        : {}),
      scope: built.adaptiveLayout
        ? "V2: text, shape, image frame, table and chart outer geometry; decorative shapes and parent/child table cells are explicit. Chart-internal labels and Office reflow remain unchecked."
        : "Text and table-cell geometry; native chart-internal labels and decorative shapes are not individually resolved by this P1 record.",
    }),
    json("quality-report.json", {
      ...quality,
      versionId,
      inputHash: hash,
      pptxSHA256: sha256(built.pptxBytes),
    }),
  ];
  const archive = outputs.find((o) => o.name === "rendered-slides.zip");
  if (archive) {
    const entries = unzipSync(archive.bytes);
    entries["font-OFL.txt"] = new Uint8Array(
      readFileSync(join(fonts.directory, "OFL.txt")),
    );
    entries["REVIEW.txt"] = strToU8(
      `DRAFT / 待人工验收\nRelease status: ${quality.releaseStatus}\nVersion: ${versionId}\n逐页图片由LibreOffice真实渲染，不代表PowerPoint编辑验收或商业视觉通过。对照quality-report.json与sources-and-notes.json核对。PPTX未嵌入字体，接收方需安装Noto Sans SC。\n`,
    );
    archive.bytes = zipSync(entries, { level: 1 });
  }
  return {
    summary: `已生成 ${built.slideCount} 页可编辑PPTX草稿。${pdf?.pageCount ? `PDF ${pdf.pageCount} 页。` : "PDF未通过。"}质量状态：${quality.releaseStatus === "blocked" ? "阻止正式发布" : "待人工验收"}；执行完成不等于商业验收通过。${quality.issues.length} 项问题/待确认。`,
    outputs,
  };
}
