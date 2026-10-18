import { zipSync, strToU8 } from "fflate";
import { art } from "./shared";
export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  (document.querySelector("dialog[open]") || document.body).append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const escapeXML = (s: unknown) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export async function imageData(url: string): Promise<string> {
  if (/^data:image\/(png|jpeg|webp);base64,/.test(url) && url.length < 1500000)
    return url;
  const resolved = new URL(url, location.href);
  if (resolved.origin !== location.origin)
    throw new Error("只允许当前网站素材或已上传的图片。");
  const response = await fetch(resolved.href);
  if (!response.ok) throw new Error("图片读取失败。");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}
export async function uploadImage(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("请使用不超过 8 MB 的 PNG、JPEG 或 WebP 图片。");
  const image = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.78);
    if (data.length > 900000)
      throw new Error("图片压缩后仍过大，请先缩小图片。");
    return data;
  } finally {
    image.close();
  }
}
export async function toPng(svg: string, name: string) {
  // SVG used as an <img> cannot reliably load even embedded webfonts in Chromium.
  // Rasterize the artwork separately, then draw its text using the loaded document
  // fonts. Otherwise a PNG can silently lose all CJK text on fontless devices.
  const documentSvg = new DOMParser().parseFromString(svg, "image/svg+xml");
  const textNodes = [...documentSvg.querySelectorAll("text")];
  for (const text of textNodes) {
    await document.fonts.load(
      `${text.getAttribute("font-size") || 16}px "Noto Sans SC"`,
      text.textContent || "",
    );
    text.remove();
  }
  const background = new XMLSerializer().serializeToString(documentSvg);
  const url = URL.createObjectURL(
    new Blob([background], { type: "image/svg+xml" }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    for (const text of textNodes) {
      const size = Number(text.getAttribute("font-size")) || 16;
      ctx.font = `${size}px "Noto Sans SC", sans-serif`;
      ctx.fillStyle = text.getAttribute("fill") || "#000";
      let y = Number(text.getAttribute("y")) || 0;
      const x = Number(text.getAttribute("x")) || 0;
      const spans = [...text.querySelectorAll("tspan")];
      if (!spans.length) ctx.fillText(text.textContent || "", x, y);
      for (const span of spans) {
        y += Number(span.getAttribute("dy")) || 0;
        ctx.fillText(
          span.textContent || "",
          Number(span.getAttribute("x")) || x,
          y,
        );
      }
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片导出失败"))),
        "image/png",
      ),
    );
    saveBlob(name, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function makeDocx(
  title: string,
  paragraphs: string[],
  tables: string[][][] = [],
): Uint8Array {
  const p = (text: string, heading = false) =>
    `<w:p>${heading ? '<w:pPr><w:pStyle w:val="Title"/></w:pPr>' : ""}<w:r><w:t xml:space="preserve">${escapeXML(text)}</w:t></w:r></w:p>`;
  const table = (rows: string[][]) =>
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((v) => `<w:${v} w:val="single" w:sz="4" w:color="DDE4DD"/>`).join("")}</w:tblBorders></w:tblPr>${rows.map((row) => `<w:tr>${row.map((c) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${p(c)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/_rels/document.xml.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "word/styles.xml": strToU8(
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="385C49"/></w:rPr></w:style></w:styles>',
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p(title, true)}${paragraphs
        .flatMap((t) => t.split("\n"))
        .map((t) => p(t))
        .join(
          "",
        )}${tables.map(table).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
    ),
  });
}
/** RFC4180-style CSV reader; preserves commas/newlines/escaped quotes in quoted fields. */
export function parseCsv(text: string): string[][] {
  if (text.length > 1000000) throw new Error("CSV 不能超过 1 MB。");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error("CSV 引号格式不正确。");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed && c.trim()) throw new Error("CSV 引号后包含无效字符。");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error("CSV 引号未闭合。");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length > 1001) throw new Error("最多导入 1000 条数据。");
  return rows;
}
export async function printArtwork(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("script, button, input[type=file], [data-no-print]")
    .forEach((el) => el.remove());
  const originals = node.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input:not([type=file]),textarea,select");
  clone
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input,textarea,select")
    .forEach((el, i) => {
      const span = document.createElement("span");
      span.textContent = originals[i]?.value || "";
      el.replaceWith(span);
    });
  const styles = [...document.querySelectorAll('style,link[rel="stylesheet"]')]
    .map((el) => el.outerHTML)
    .join("");
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;left:-10000px;width:1100px;height:800px";
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  document.body.append(frame);
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${styles}<style>body{margin:25px;background:white}*{overflow:visible!important;max-height:none!important}table{page-break-inside:auto}tr,img{break-inside:avoid}button{display:none!important}@page{margin:15mm} .scene-demo{border:0!important}</style></head><body>${clone.outerHTML}</body></html>`;
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
  });
  await Promise.all(
    [...frame.contentDocument!.images].map((img) =>
      img.decode().catch(() => {}),
    ),
  );
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60000);
}
export async function exportWebsite(scene: string, data: Record<string, any>) {
  const architecture = scene === "interface";
  const picture = await imageData(
    data.heroImage || (architecture ? art.interior : art.energy),
  );
  const name = architecture ? "FORM / ARCHITECTURE" : "NORTH / ENERGY";
  const title =
    data.siteTitle ||
    (architecture ? "空间，与生活的关系。" : "为明天，注入可持续的力量。");
  const projects =
    architecture && Array.isArray(data.projectList)
      ? await Promise.all(
          data.projectList.map(async (p: any) => ({
            ...p,
            image: await imageData(p.image),
          })),
        )
      : [];
  const projectCards = projects.length
    ? projects
        .map(
          (p, i) =>
            `<article><img src="${p.image}" alt="${escapeXML(p.title)}"><small>${escapeXML(p.category)} / ${escapeXML(p.year)}</small><h2>${escapeXML(p.title)}</h2><p>${escapeXML(p.text)}</p><button data-page="project-${i}">查看项目 →</button></article>`,
        )
        .join("")
    : (architecture
        ? ["光与空间", "自然与日常", "尺度与材料"]
        : ["项目规划", "工程建设", "运营管理"]
      )
        .map(
          (t) =>
            `<article><h2>${t}</h2><p>从需求到实施，建立清晰的流程、责任与验收标准。</p><button data-page="contact">了解更多 →</button></article>`,
        )
        .join("");
  const projectPages = projects
    .map(
      (p, i) =>
        `<section id="project-${i}" hidden><button data-page="work">← 返回作品</button><h1>${escapeXML(p.title)}</h1><img src="${p.image}" alt="${escapeXML(p.title)}"><p>${escapeXML(p.text)}</p><small>${escapeXML(p.category)} / ${escapeXML(p.year)} / 概念项目</small></section>`,
    )
    .join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXML(name)}</title><style>*{box-sizing:border-box}body{margin:0;background:${architecture ? "#f5f1e8" : "#f7faf7"};color:#274638;font:16px/1.8 system-ui}nav,main,footer{max-width:1200px;margin:auto;padding:25px}nav{display:flex;align-items:center;gap:22px}nav strong{margin-right:auto}button{padding:10px 16px;border:1px solid #b1c3b1;border-radius:4px;background:transparent;color:inherit;cursor:pointer}h1{font-size:clamp(32px,5vw,64px);font-weight:500}img{width:100%;max-height:540px;object-fit:cover}section{padding:25px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}.cards article{padding:25px;border-top:1px solid #c6d2c4}input,textarea{display:block;width:100%;padding:12px;border:1px solid #ccc;margin:8px 0 20px;font:inherit}form{max-width:540px}footer{border-top:1px solid #ddd;font-size:12px;color:#829280}[hidden]{display:none}</style></head><body><nav><strong>${name}</strong><button data-page="home">首页</button><button data-page="work">${architecture ? "作品" : "项目"}</button><button data-page="contact">联系</button></nav><main><section id="home"><small>${architecture ? "ARCHITECTURE / INTERIORS" : "CLEAN ENERGY / SHARED FUTURE"}</small><h1 style="white-space:pre-line">${escapeXML(title)}</h1><img src="${picture}" alt="概念主视觉" style="object-position:${Math.max(0, Math.min(100, Number(data.focus) || 50))}% center"><p>${escapeXML(data.siteDescription || "以专业的研究与细致的执行，让每一个项目拥有清晰的方向。")}</p><button data-page="work">浏览项目 →</button></section><section id="work" hidden><h1>${architecture ? "精选作品" : "项目与服务"}</h1><div class="cards">${projectCards}</div></section><section id="contact" hidden><h1>开始一次对话</h1><form id="form"><label>联系人<input name="name" required maxlength="100"></label><label>邮箱<input name="email" type="email" required></label><label>需求<textarea name="message" required maxlength="2000"></textarea></label><button>检查表单</button><p id="status" role="status"></p></form></section>${projectPages}</main><footer>可独立运行的前端网站 · 无后端服务 · 概念图片不代表实际项目 · 由 DesignBuddy 导出</footer><script>document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!==b.dataset.page);window.scrollTo(0,0)});document.querySelector('#form').onsubmit=e=>{e.preventDefault();document.querySelector('#status').textContent='本地校验通过。此网站尚未连接邮件或线索服务，没有提交信息。'};</script></body></html>`;
  saveBlob(
    `${scene}-website.html`,
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
}
