import { zipSync, strToU8 } from "fflate";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillInput } from "../executors";
import { out, json } from "../io";
import { parseWord, contentHash, contentTexts, hash } from "./schema";
import { prepareImages, generateWord } from "./generate";
import { renderWord } from "./render";
import { inspectWord, repairWord } from "./inspect";
import { wordEngineVersion } from "../../../shared/wordDocument";
import { presentationFonts } from "../presentation/fonts";
export async function createWord(
  input: SkillInput,
  event: (s: string) => void = () => {},
) {
  event("Word 1/5：校验章节、来源、数据与权限；不调用模型，不自动改写正文。");
  let spec = parseWord(input.bytes);
  const original = structuredClone(spec),
    inputHash = hash(input.bytes),
    locked = contentHash(spec),
    started = Date.now();
  const images = await prepareImages(spec),
    rounds: any[] = [];
  const iterations: Record<string, Uint8Array> = {};
  let final: any;
  for (let round = 0; round <= 2; round++) {
    if (Date.now() - started > 170000)
      throw Error(
        "Word剩余预算不足以启动下一次完整渲染，已停止；没有宣布质量通过。",
      );
    event(
      `Word 2/5：${round ? "修复后" : "初始"}生成原生DOCX，校验全部正文与表格内容。`,
    );
    const generated = await generateWord(spec, images);
    event(
      `Word 3/5：本地LibreOffice真实渲染第${round + 1}轮；PDF和全部页图均使用本轮同一DOCX。`,
    );
    const rendered = await renderWord(generated.bytes, input.workDirectory);
    event("Word 4/5：检查结构与PDF文字/几何信号；未知视觉问题保留人工复核。");
    const quality = inspectWord(
      spec,
      rendered.pages,
      images,
      rendered.receipt.missingFonts,
    );
    const record: any = {
      round,
      docxSHA256: generated.sha256,
      pdfSHA256: rendered.receipt.pdfSHA256,
      pageCount: rendered.pages.length,
      contentHash: contentHash(spec),
      issues: quality.issues,
      actions: [],
    };
    rounds.push(record);
    if (contentHash(spec) !== locked) throw Error("内容锁定校验失败。");
    const previous = final;
    iterations[`iterations/${round}/document.docx`] = generated.bytes;
    iterations[`iterations/${round}/document.pdf`] = rendered.pdf;
    iterations[`iterations/${round}/render-manifest.json`] = strToU8(
      JSON.stringify(rendered.receipt, null, 2),
    );
    if (previous) {
      const oldIds = new Set<string>(
        previous.quality.issues.map((i: any) => i.id),
      );
      record.resolvedIssueIds = previous.quality.issues
        .filter((i: any) => !quality.issues.some((j) => j.id === i.id))
        .map((i: any) => i.id);
      record.newIssueIds = quality.issues
        .filter((i) => !oldIds.has(i.id))
        .map((i) => i.id);
      if (
        quality.issues.some(
          (i) => i.severity === "critical" && !oldIds.has(i.id),
        )
      ) {
        record.rolledBack = true;
        spec = previous.spec;
        event("修复产生新关键问题，回退上一版本；未解决问题保留诊断。");
        break;
      }
    }
    final = { generated, rendered, quality, spec: structuredClone(spec) };
    if (round === 2 || !quality.issues.some((i) => i.autoRepair)) break;
    const repaired = repairWord(spec, quality.issues, images);
    if (!repaired.actions.length) break;
    record.actions = repaired.actions;
    spec = repaired.spec;
    event(
      `Word 4/5：执行${repaired.actions.length}项白名单版式修复；不删内容，下一轮重检整篇。`,
    );
  }
  const { generated, rendered, quality } = final;
  const report = {
    schemaVersion: 1,
    engineVersion: wordEngineVersion,
    inputSHA256: inputHash,
    finalDocxSHA256: generated.sha256,
    finalPdfSHA256: rendered.receipt.pdfSHA256,
    contentHash: locked,
    contentPreserved: true,
    documentType: spec.documentType,
    font: generated.font,
    renderer: rendered.receipt,
    checks: quality.checks,
    issues: quality.issues,
    pdfCoverage: quality.coverage,
    score: quality.score,
    repairPolicy: {
      maxRepairRounds: 2,
      maxFullRenders: 3,
      contentChangesAllowed: false,
      automaticFactVerification: false,
    },
    repairRounds: rounds,
    releaseStatus: quality.releaseStatus,
    commercialApproval: false,
    limitations: [
      "不调用AI、不编辑任意旧Word；输入内容与引用仍需事实核验。",
      "章节导航无目录页码；PAGE/NUMPAGES字段需检查目标软件刷新。",
      "PDF文字与几何信号不等于像素级溢出/遮挡检测。",
      "LibreOffice当前平台可能为WASM；没有Microsoft Word/WPS验收。",
      "原生正文/表格/图像对象；没有原生可编辑图表或流程图编辑器。",
      "DOCX不内嵌字体；接收端需安装Noto Sans SC。",
    ],
  };
  const pages: Record<string, Uint8Array> = {};
  for (const p of rendered.pages)
    pages[`pages/${String(p.page).padStart(2, "0")}.jpg`] = p.jpg;
  const thumbWidth = 200,
    thumbHeight = 310,
    columns = Math.min(4, rendered.pages.length),
    rows = Math.ceil(rendered.pages.length / columns),
    composites: sharp.OverlayOptions[] = [];
  for (const [i, p] of rendered.pages.entries())
    composites.push({
      input: await sharp(p.jpg)
        .resize({
          width: thumbWidth,
          height: thumbHeight,
          fit: "contain",
          background: "#E9ECE8",
        })
        .jpeg()
        .toBuffer(),
      left: (i % columns) * thumbWidth,
      top: Math.floor(i / columns) * thumbHeight,
    });
  const sheet = await sharp({
    create: {
      width: columns * thumbWidth,
      height: rows * thumbHeight,
      channels: 3,
      background: "#E9ECE8",
    },
  })
    .composite(composites)
    .jpeg({ quality: 78 })
    .toBuffer();
  const manifest = {
    schemaVersion: 1,
    contentHash: locked,
    nodes: contentTexts(original),
    sourceBindings: original.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      refs: b.refs,
    })),
    sources: original.sources.map((s) => ({ ...s, textSHA256: hash(s.text) })),
    imageAssets: Object.entries(images).map(([id, a]) => ({
      id,
      sha256: a.sha256,
      originalSHA256: a.originalSHA256,
      width: a.width,
      height: a.height,
    })),
  };
  const license = readFileSync(join(presentationFonts().directory, "OFL.txt"));
  const archive = {
    "document.docx": generated.bytes,
    "document.pdf": rendered.pdf,
    "word-quality-report.json": strToU8(JSON.stringify(report, null, 2)),
    "word-spec.json": strToU8(JSON.stringify(spec, null, 2)),
    "content-manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "render-manifest.json": strToU8(JSON.stringify(rendered.receipt, null, 2)),
    "OFL.txt": new Uint8Array(license),
    ...iterations,
    ...pages,
  };
  event(
    "Word 5/5：保存最终版本、同源PDF、全页预览、来源与修复记录；仍需人工复核。",
  );
  return {
    summary: `已生成${rendered.pages.length}页原生Word与同源PDF；执行${rounds.length - 1}轮修复，内容清单未变。状态：${quality.releaseStatus === "blocked" ? "存在阻断问题，仅供诊断" : "需人工复核，未商业验收"}。未调用外部模型。`,
    outputs: [
      out(
        "document.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        generated.bytes,
      ),
      out("document.pdf", "application/pdf", rendered.pdf),
      out("word-pages.jpg", "image/jpeg", sheet),
      json("word-quality-report.json", report),
      json("content-manifest.json", manifest),
      out(
        "word-delivery.zip",
        "application/zip",
        zipSync(archive, { level: 1 }),
      ),
    ],
  };
}
