import { useEffect, useMemo, useRef, useState } from "react";
import { createZipBlob } from "../utils/zip";
import { apiFetch } from "../../../apps/web/src/api/client";
import { createDesignContract, designSystems } from "../utils/designSystem";
import { AIProviderSettings, getAIProviderCredentials } from "../AIProviderSettings";

type StudioKind = "prototype" | "slides" | "image" | "video";
type Slide = { title: string; body: string; bullets: string[] };
type VideoScene = { title: string; caption: string };
type ImageMotif = { shape: "circle" | "rect"; x: number; y: number; size: number };
type StudioArtifact = {
  id: string;
  kind: StudioKind;
  title: string;
  brief: string;
  systemId: string;
  slides: Slide[];
  imageSubtitle: string;
  prototypeHtml?: string;
  videoScenes?: VideoScene[];
  imageMotif?: ImageMotif[];
  updatedAt: string;
};

const STORE_KEY = "designbuddy.studio.artifacts.v1";
const modes: Array<{ id: StudioKind; label: string; description: string }> = [
  { id: "prototype", label: "网页原型", description: "可编辑的单页 HTML 作品" },
  { id: "slides", label: "演示文稿", description: "多页幻灯片，可导出 PDF / PPTX" },
  { id: "image", label: "矢量海报", description: "可编辑图形，可导出 SVG / PNG" },
  { id: "video", label: "动态短片", description: "用浏览器录制动画并导出 WebM" },
];

const systemOptions = designSystems as Array<{
  id: string; name: string; primary: string;
  tokens?: { color?: { background?: string; surface?: string; text?: string; muted?: string } };
}>;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function dataFromShare(): StudioArtifact | null {
  const match = window.location.hash.match(/^#share=(.+)$/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(match[1])));
    const data = JSON.parse(decoded) as StudioArtifact;
    return data && data.title && data.kind ? data : null;
  } catch { return null; }
}

function makeArtifact(kind: StudioKind, brief: string): StudioArtifact {
  const title = brief.trim().replace(/^(请|帮我|设计|制作)+/g, "").slice(0, 48) || "新作品";
  return {
    id: crypto.randomUUID(), kind, title, brief, systemId: "ds-01",
    slides: [
      { title, body: brief || "用一句话讲清楚这次演示的主题。", bullets: ["背景与机会", "核心方案", "下一步行动"] },
      { title: "核心方案", body: "把复杂问题拆解成团队可以执行的清晰步骤。", bullets: ["用户需求", "产品价值", "落地路径"] },
      { title: "下一步行动", body: "从最重要的假设开始验证，持续根据反馈迭代。", bullets: ["明确负责人", "设定时间节点", "复盘关键指标"] },
    ],
    imageSubtitle: "把想法变成可分享的作品",
    updatedAt: new Date().toISOString(),
  };
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.hidden = true;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function svgFor(artifact: StudioArtifact): string {
  const system = systemOptions.find((item) => item.id === artifact.systemId) ?? systemOptions[0];
  const bg = system?.tokens?.color?.background ?? "#f8f9fc";
  const primary = system?.primary ?? "#5e6ad2";
  const ink = system?.tokens?.color?.text ?? "#171923";
  const subtitle = artifact.imageSubtitle || artifact.brief;
  const motif = (artifact.imageMotif ?? [
    { shape: "circle" as const, x: 1000, y: 190, size: 490 }, { shape: "circle" as const, x: 180, y: 1040, size: 520 },
  ]).map((shape, index) => shape.shape === "circle"
    ? `<circle cx="${shape.x}" cy="${shape.y}" r="${shape.size / 2}" fill="${primary}" opacity="${0.08 + (index % 4) * 0.035}"/>`
    : `<rect x="${shape.x}" y="${shape.y}" width="${shape.size}" height="${shape.size * 0.58}" rx="${Math.min(48, shape.size / 5)}" fill="${primary}" opacity="${0.08 + (index % 4) * 0.035}" transform="rotate(${(index % 5 - 2) * 9} ${shape.x} ${shape.y})"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="${bg}"/>${motif}<path d="M120 820 C 420 650, 720 990, 1080 690" fill="none" stroke="${primary}" stroke-width="4" opacity=".55"/><rect x="96" y="96" width="1008" height="1008" rx="48" fill="none" stroke="${primary}" stroke-opacity=".2" stroke-width="2"/><text x="120" y="270" font-family="Arial,sans-serif" font-size="24" letter-spacing="8" fill="${primary}">DESIGNBUDDY STUDIO</text><text x="120" y="510" font-family="Arial,sans-serif" font-size="74" font-weight="700" fill="${ink}">${esc(artifact.title).slice(0, 32)}</text><foreignObject x="120" y="570" width="820" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font:28px/1.6 Arial,sans-serif;color:${ink};opacity:.68">${esc(subtitle).slice(0, 140)}</div></foreignObject><rect x="120" y="860" width="190" height="8" rx="4" fill="${primary}"/><text x="120" y="940" font-family="Arial,sans-serif" font-size="18" letter-spacing="4" fill="${ink}" opacity=".55">A THOUGHTFUL WORK IN PROGRESS</text></svg>`;
}

function slideHtml(artifact: StudioArtifact): string {
  const system = systemOptions.find((item) => item.id === artifact.systemId) ?? systemOptions[0];
  const primary = system?.primary ?? "#5e6ad2";
  const bg = system?.tokens?.color?.background ?? "#f8f9fc";
  const ink = system?.tokens?.color?.text ?? "#171923";
  const slides = artifact.slides.map((slide, index) => `<section class="slide"><div class="kicker">${esc(artifact.title)} · ${String(index + 1).padStart(2, "0")}</div><h1>${esc(slide.title)}</h1><p>${esc(slide.body)}</p><ul>${slide.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul><footer>DESIGNBUDDY STUDIO <span>${index + 1} / ${artifact.slides.length}</span></footer></section>`).join("");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(artifact.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#eceef4;color:${ink};font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.slide{position:relative;display:flex;flex-direction:column;justify-content:center;width:1280px;height:720px;padding:100px 130px;margin:24px auto;background:${bg};page-break-after:always;overflow:hidden}.slide:before{content:"";position:absolute;width:460px;height:460px;border:1px solid ${primary}33;border-radius:50%;right:-160px;top:-180px}.kicker{color:${primary};font-size:16px;letter-spacing:.18em;text-transform:uppercase}.slide h1{max-width:900px;margin:40px 0 16px;font-size:64px;line-height:1.12;letter-spacing:-.04em}.slide p{max-width:850px;color:${ink}aa;font-size:24px;line-height:1.6}.slide ul{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:42px 0 0;padding:0;list-style:none}.slide li{padding:20px 22px;border-top:3px solid ${primary};background:${primary}0d;font-size:19px}.slide footer{position:absolute;bottom:42px;left:130px;right:130px;display:flex;justify-content:space-between;color:${ink}88;font-size:12px;letter-spacing:.14em}@media print{body{background:white}.slide{margin:0;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style><body>${slides}</body></html>`;
}

function pptxBlob(artifact: StudioArtifact): Blob {
  const slideXml = (slide: Slide, index: number) => {
    const runs = (text: string, size: number, color: string, bold = false) => `<a:p><a:r><a:rPr lang="zh-CN" sz="${size}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color.replace("#", "").toUpperCase()}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>${esc(text)}</a:t></a:r><a:endParaRPr lang="zh-CN"/></a:p>`;
    const body = [runs(slide.title, 3000, "171923", true), runs(slide.body, 1800, "50566A"), ...slide.bullets.map((bullet) => runs(`•  ${bullet}`, 1500, "33384A"))].join("");
    const shape = (id: number, name: string, x: number, y: number, cx: number, cy: number, text: string) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${text}</p:txBody></p:sp>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Slide ${index + 1}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shape(2, "Slide content", 900000, 900000, 10400000, 5400000, body)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  };
  const slideIds = artifact.slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const slideRels = artifact.slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const entries = [
    { path: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${artifact.slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>` },
    { path: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
    { path: "ppt/presentation.xml", content: `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { path: "ppt/_rels/presentation.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}</Relationships>` },
    { path: "ppt/slideMasters/slideMaster1.xml", content: `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="DesignBuddy Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>` },
    { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` },
    { path: "ppt/slideLayouts/slideLayout1.xml", content: `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` },
    { path: "ppt/theme/theme1.xml", content: `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DesignBuddy"><a:themeElements><a:clrScheme name="DesignBuddy"><a:dk1><a:srgbClr val="171923"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="33384A"/></a:dk2><a:lt2><a:srgbClr val="F8F9FC"/></a:lt2><a:accent1><a:srgbClr val="5E6AD2"/></a:accent1><a:accent2><a:srgbClr val="14866D"/></a:accent2><a:accent3><a:srgbClr val="B7791F"/></a:accent3><a:accent4><a:srgbClr val="C23D4B"/></a:accent4><a:accent5><a:srgbClr val="707584"/></a:accent5><a:accent6><a:srgbClr val="E6E8EF"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="DesignBuddy"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="DesignBuddy"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>` },
    ...artifact.slides.map((slide, index) => ({ path: `ppt/slides/slide${index + 1}.xml`, content: slideXml(slide, index) })),
    ...artifact.slides.map((_, index) => ({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` })),
  ];
  return createZipBlob(entries);
}

export default function StudioPage() {
  const [artifact, setArtifact] = useState<StudioArtifact>(() => dataFromShare() ?? makeArtifact("prototype", ""));
  const [saved, setSaved] = useState<StudioArtifact[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]") as StudioArtifact[]; } catch { return []; }
  });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectedSystem = useMemo(() => systemOptions.find((system) => system.id === artifact.systemId) ?? systemOptions[0], [artifact.systemId]);
  const slide = artifact.slides[selectedSlide] ?? artifact.slides[0];

  useEffect(() => {
    const canvas = videoCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const draw = (time: number) => {
      const t = time / 1000;
      context.fillStyle = selectedSystem?.tokens?.color?.background ?? "#f8f9fc";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = `${selectedSystem?.primary ?? "#5e6ad2"}20`;
      context.beginPath(); context.arc(980 + Math.sin(t) * 55, 170, 220, 0, Math.PI * 2); context.fill();
      context.fillStyle = selectedSystem?.primary ?? "#5e6ad2"; context.font = '700 24px "Noto Sans SC", sans-serif'; context.fillText("DESIGNBUDDY STUDIO", 100, 145);
      const scenes = artifact.videoScenes ?? [];
      const scene = scenes.length ? scenes[Math.floor((t % 10) / 10 * scenes.length)] : undefined;
      context.fillStyle = selectedSystem?.tokens?.color?.text ?? "#171923"; context.font = '700 68px "Noto Sans SC", sans-serif'; context.fillText((scene?.title || artifact.title).slice(0, 24), 100, 340);
      context.font = '28px "Noto Sans SC", sans-serif'; context.fillText((scene?.caption || artifact.imageSubtitle).slice(0, 52), 100, 410);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [artifact.title, artifact.imageSubtitle, artifact.videoScenes, selectedSystem]);

  useEffect(() => {
    if (dataFromShare()) setNotice("已打开分享的作品副本；编辑内容只保存在此浏览器。");
  }, []);

  function patch(next: Partial<StudioArtifact>) {
    setArtifact((current) => ({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  function saveArtifact() {
    const next = [artifact, ...saved.filter((item) => item.id !== artifact.id)];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); setSaved(next); setNotice("作品已保存到本机工作区。"); }
    catch { setNotice("本机存储空间不足，无法保存作品。"); }
  }

  async function generateContent() {
    if (!artifact.brief.trim() || generating) { setNotice("请先写一段创作简报，再开始 AI 生成。"); return; }
    setGenerating(true); setNotice("正在根据创作简报和设计系统生成首稿…");
    try {
      const response = await apiFetch("/studio/generation", {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ kind: artifact.kind, title: artifact.title, prompt: artifact.brief, ...getAIProviderCredentials(), designContract: createDesignContract(designSystems.find((system) => system.id === artifact.systemId) ?? designSystems[0]) }),
      });
      const body = await response.json().catch(() => ({} as { error?: string; message?: string }));
      if (!response.ok) throw new Error(body.message || body.error || `AI 生成失败 (${response.status})`);
      const result = body as { artifact: Record<string, unknown> };
      if (artifact.kind === "slides" && Array.isArray(result.artifact.slides)) patch({ slides: result.artifact.slides as Slide[] });
      else if (artifact.kind === "image" && typeof result.artifact.subtitle === "string" && Array.isArray(result.artifact.motif)) patch({ imageSubtitle: result.artifact.subtitle, imageMotif: result.artifact.motif as ImageMotif[] });
      else if (artifact.kind === "video" && Array.isArray(result.artifact.scenes)) patch({ videoScenes: result.artifact.scenes as VideoScene[] });
      else if (artifact.kind === "prototype" && typeof result.artifact.html === "string") patch({ prototypeHtml: result.artifact.html });
      else throw new Error("AI 返回内容与作品类型不匹配。");
      setNotice("AI 首稿已生成，可以继续编辑并导出。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "AI 生成失败。"); }
    finally { setGenerating(false); }
  }

  function createKind(kind: StudioKind) {
    const next = makeArtifact(kind, artifact.brief || artifact.title);
    next.systemId = artifact.systemId;
    setArtifact(next); setSelectedSlide(0); setNotice(`${modes.find((mode) => mode.id === kind)?.label}已创建。`);
  }

  function shareArtifact() {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(artifact))));
    const url = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(data)}`;
    if (url.length > 90_000) { setNotice("作品内容过大，无法编码为分享链接。请先缩短内容。"); return; }
    void navigator.clipboard.writeText(url).then(() => setNotice("分享链接已复制。链接包含作品内容，打开后会载入一份独立副本。"), () => setNotice("复制失败，请检查浏览器剪贴板权限。"));
  }

  function exportSlides(kind: "html" | "pdf" | "pptx" | "md") {
    if (kind === "pptx") { downloadBlob(pptxBlob(artifact), `${artifact.title}.pptx`); setNotice("可编辑 PowerPoint 已导出。"); return; }
    if (kind === "md") {
      const markdown = `# ${artifact.title}\n\n${artifact.slides.map((item, index) => `## ${index + 1}. ${item.title}\n\n${item.body}\n\n${item.bullets.map((bullet) => `- ${bullet}`).join("\n")}`).join("\n\n")}`;
      downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), `${artifact.title}.md`); return;
    }
    const html = slideHtml(artifact);
    if (kind === "html") { downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${artifact.title}.html`); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setNotice("浏览器拦截了打印窗口，请允许弹出窗口后重试。"); return; }
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }

  async function exportPng() {
    try {
      const svg = new Blob([svgFor(artifact)], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svg);
      const image = new Image(); image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1200;
      canvas.getContext("2d")?.drawImage(image, 0, 0); URL.revokeObjectURL(url);
      canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${artifact.title}.png`); else setNotice("PNG 渲染失败。"); }, "image/png");
    } catch { setNotice("PNG 渲染失败，请稍后重试。"); }
  }

  async function recordVideo() {
    const previewCanvas = videoCanvasRef.current;
    if (!previewCanvas || !previewCanvas.captureStream || typeof MediaRecorder === "undefined") { setNotice("当前浏览器不支持画布录制，请使用最新版本 Chrome、Edge 或 Firefox。"); return; }
    setRecording(true); setNotice("正在准备视频字体…");
    try { await document.fonts.load('400 28px "Noto Sans SC"', [artifact.title, artifact.imageSubtitle, ...(artifact.videoScenes ?? []).flatMap(scene => [scene.title, scene.caption])].join(" ")); }
    catch { setRecording(false); setNotice("视频字体加载失败，请检查网络后重试。"); return; }
    setNotice("正在录制 5 秒动画…");
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) { setRecording(false); return; }
    const stream = canvas.captureStream(30);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      const webm = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      stream.getTracks().forEach((track) => track.stop());
      try {
        const response = await apiFetch("/video/transcode", { method: "POST", headers: { "Content-Type": "video/webm" }, body: webm });
        if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || `MP4 转码失败 (${response.status})`);
        if (!response.headers.get("content-type")?.includes("video/mp4")) throw new Error("转码接口没有返回 MP4，已拒绝把网页内容当作视频下载。");
        const mp4 = await response.arrayBuffer();
        if (mp4.byteLength < 12 || new TextDecoder().decode(mp4.slice(4,8)) !== "ftyp") throw new Error("服务器返回的视频格式无效。");
        downloadBlob(new Blob([mp4], {type:"video/mp4"}), `${artifact.title}.mp4`);
        setNotice("MP4 动画视频已导出。");
      } catch (error) {
        downloadBlob(webm, `${artifact.title}.webm`);
        setNotice(`${error instanceof Error ? error.message : "MP4 转码服务不可用。"} 已为你保留 WebM 文件。`);
      } finally { setRecording(false); }
    };
    const started = performance.now();
    const draw = (time: number) => {
      if (recorder.state !== "recording") return;
      const t = (time - started) / 1000;
      const bg = selectedSystem?.tokens?.color?.background ?? "#f8f9fc";
      const primary = selectedSystem?.primary ?? "#5e6ad2";
      context.fillStyle = bg; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = `${primary}20`; context.beginPath(); context.arc(1000 + Math.sin(t * 1.5) * 90, 170 + Math.cos(t) * 34, 230, 0, Math.PI * 2); context.fill();
      context.fillStyle = primary; context.font = '700 24px "Noto Sans SC", sans-serif'; context.fillText("DESIGNBUDDY STUDIO", 100, 145);
      const scenes = artifact.videoScenes ?? [];
      const scene = scenes.length ? scenes[Math.min(scenes.length - 1, Math.floor(t / 5 * scenes.length))] : undefined;
      context.fillStyle = selectedSystem?.tokens?.color?.text ?? "#171923"; context.font = '700 68px "Noto Sans SC", sans-serif'; context.fillText((scene?.title || artifact.title).slice(0, 24), 100, 340);
      context.globalAlpha = .75; context.font = '28px "Noto Sans SC", sans-serif'; context.fillText((scene?.caption || artifact.imageSubtitle).slice(0, 52), 100, 410); context.globalAlpha = 1;
      context.fillStyle = primary; context.fillRect(100, 500, 200 + ((t * 80) % 450), 5);
      if (t < 5) requestAnimationFrame(draw); else recorder.stop();
    };
    recorder.start(); requestAnimationFrame(draw);
  }

  return <main className="studio-page">
    <header className="studio-header"><button onClick={() => { window.location.hash = ""; window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }}>← 工作台</button><div><b>创作工作室</b><span>在一个项目中制作、预览并交付多种设计作品</span></div><div className="studio-header-actions"><button onClick={saveArtifact}>保存到本机</button><button onClick={shareArtifact}>复制分享链接</button></div></header>
    <div className="studio-layout"><aside className="studio-sidebar"><div className="studio-section-label">新建作品</div>{modes.map((mode) => <button key={mode.id} className={artifact.kind === mode.id ? "is-active" : ""} onClick={() => createKind(mode.id)}><b>{mode.label}</b><small>{mode.description}</small></button>)}<div className="studio-section-label">最近作品</div>{saved.slice(0, 8).map((item) => <button className="studio-recent" key={item.id} onClick={() => { setArtifact(item); setSelectedSlide(0); }}>{item.title}<small>{modes.find((mode) => mode.id === item.kind)?.label}</small></button>)}</aside>
      <section className="studio-workspace"><div className="studio-toolbar"><input aria-label="作品标题" value={artifact.title} onChange={(event) => patch({ title: event.target.value })}/><label>设计系统<select value={artifact.systemId} onChange={(event) => patch({ systemId: event.target.value })}>{systemOptions.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label><button disabled={generating} onClick={() => void generateContent()}>{generating ? "AI 生成中…" : "AI 生成首稿"}</button>{artifact.kind === "slides" ? <div className="studio-export-actions"><button onClick={() => exportSlides("html")}>HTML</button><button onClick={() => exportSlides("pdf")}>PDF</button><button onClick={() => exportSlides("pptx")}>PPTX</button><button onClick={() => exportSlides("md")}>Markdown</button></div> : artifact.kind === "image" ? <div className="studio-export-actions"><button onClick={() => downloadBlob(new Blob([svgFor(artifact)], { type: "image/svg+xml" }), `${artifact.title}.svg`)}>SVG</button><button onClick={() => void exportPng()}>PNG</button></div> : artifact.kind === "video" ? <button disabled={recording} onClick={() => void recordVideo()}>{recording ? "录制并转码中…" : "录制并导出 MP4"}</button> : <button onClick={() => { const html = artifact.prototypeHtml || `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(artifact.title)}</title><body style="font:16px/1.7 system-ui;max-width:960px;margin:10vh auto;padding:0 24px"><h1>${esc(artifact.title)}</h1><p>${esc(artifact.brief)}</p><h2>核心体验</h2><p>从清晰的信息层级开始，围绕用户任务呈现内容与行动入口。</p><h2>下一步</h2><p>与团队分享原型，收集反馈并持续迭代。</p></body></html>`; downloadBlob(new Blob([html], { type: "text/html" }), `${artifact.title}.html`); }}>导出 HTML</button>}</div>
        <div className="studio-brief-row"><span>创作简报</span><textarea rows={2} value={artifact.brief} onChange={(event) => patch({ brief: event.target.value })} placeholder="描述目标、受众和作品重点…"/></div>
        <AIProviderSettings />
        {notice && <div className="studio-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {artifact.kind === "prototype" && (artifact.prototypeHtml ? <iframe className="studio-prototype-preview" title={`${artifact.title} 原型预览`} sandbox="allow-scripts" srcDoc={artifact.prototypeHtml} /> : <div className="studio-prototype-empty">填写创作简报并点击“AI 生成首稿”来创建网页原型。</div>)}
        {artifact.kind === "slides" && <div className="studio-slide-editor"><nav>{artifact.slides.map((item, index) => <button className={selectedSlide === index ? "is-active" : ""} key={index} onClick={() => setSelectedSlide(index)}>{String(index + 1).padStart(2, "0")}<small>{item.title}</small></button>)}<button onClick={() => { patch({ slides: [...artifact.slides, { title: "新页面", body: "补充本页核心观点。", bullets: ["关键点一", "关键点二", "关键点三"] }] }); setSelectedSlide(artifact.slides.length); }}>＋ 新增页面</button></nav><div className="studio-slide-preview" style={{ background: selectedSystem?.tokens?.color?.background }}><span style={{ color: selectedSystem?.primary }}>{artifact.title} · {selectedSlide + 1}</span><input value={slide?.title ?? ""} onChange={(event) => patch({ slides: artifact.slides.map((item, index) => index === selectedSlide ? { ...item, title: event.target.value } : item) })}/><textarea value={slide?.body ?? ""} onChange={(event) => patch({ slides: artifact.slides.map((item, index) => index === selectedSlide ? { ...item, body: event.target.value } : item) })}/><ul>{(slide?.bullets ?? []).map((bullet, index) => <li key={index}><input value={bullet} onChange={(event) => patch({ slides: artifact.slides.map((item, slideIndex) => slideIndex === selectedSlide ? { ...item, bullets: item.bullets.map((value, bulletIndex) => bulletIndex === index ? event.target.value : value) } : item) })}/></li>)}</ul></div></div>}
        {artifact.kind === "image" && <div className="studio-image-workspace"><div className="studio-image-controls"><label>副标题<input value={artifact.imageSubtitle} onChange={(event) => patch({ imageSubtitle: event.target.value })}/></label><label>画面说明<p>作品使用选定设计系统的颜色与字级，可继续编辑标题、副标题和主题。</p></label></div><div className="studio-artwork" dangerouslySetInnerHTML={{ __html: svgFor(artifact) }}/></div>}
        {artifact.kind === "video" && <div className="studio-video-workspace"><canvas className="studio-video-canvas" width="1280" height="720" ref={videoCanvasRef}/><p>动画预览 · 点击“录制并导出 MP4”生成视频；本机服务未配置 FFmpeg 时会自动下载 WebM。</p></div>}
      </section>
    </div>
  </main>;
}
