import sharp from "sharp";
import { openLocalOCR } from "./local-ocr";
import { fontLicense, textPaths } from "./fonts";
import { out, json } from "./io";
import type { SkillInput, Output } from "./executors";
sharp.cache(false); sharp.concurrency(1);
export async function imageInput(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  // Reject SVG, PDF, animated and unknown images before decoding/rasterization.
  const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp) throw Error("仅接受真实 PNG、JPEG、WebP 位图，不接受 SVG/PDF/伪装文件。");
  const pipeline = sharp(buffer, { limitInputPixels: 12_000_000, failOn: "warning", animated: true });
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height || (meta.pages || 1) !== 1 || meta.width > 8000 || meta.height > 8000) throw Error("仅支持单帧图片，最长边8000像素、总像素1200万以内。");
  const normalized = await pipeline.rotate().toColourspace("srgb").png().toBuffer();
  return { bytes: normalized, meta: await sharp(normalized).metadata() };
}
function luminance(rgb: number[]) { const c = rgb.map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
export async function palette(input: SkillInput, event: (m: string) => void) {
  const source = await imageInput(input.bytes);
  const { data, info } = await sharp(source.bytes).resize(96, 96, { fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { count: number; sums: number[] }>(); let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    opaque++; const c = [data[i], data[i+1], data[i+2]]; const key = c.map(v => Math.floor(v / 32)).join(",");
    const b = buckets.get(key) || { count: 0, sums: [0,0,0] }; b.count++; c.forEach((v,j) => b.sums[j] += v); buckets.set(key,b);
  }
  if (!opaque) throw Error("图片完全透明，无法提取色板。");
  const colors = [...buckets.values()].sort((a,b) => b.count-a.count || a.sums[0]/a.count-b.sums[0]/b.count).slice(0,6).map((b,i) => {
    const rgb = b.sums.map(n=>Math.round(n/b.count)); const l = luminance(rgb); const black=(l+.05)/.05, white=1.05/(l+.05);
    return { token: `brand-${i+1}`, hex: "#"+rgb.map(n=>n.toString(16).padStart(2,"0")).join(""), sampleShare: b.count/opaque, contrastBlack: black, contrastWhite: white, suggestedText: black>=white?"#000000":"#ffffff", passesNormalTextAA: Math.max(black,white)>=4.5 };
  });
  event(`按透明度过滤和RGB量化，提取 ${colors.length} 个主色，并实际计算WCAG对比度。`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${colors.length*100}" viewBox="0 0 960 ${colors.length*100}">${colors.map((c,i)=>`<rect x="0" y="${i*100}" width="960" height="100" fill="${c.hex}"/><text x="28" y="${i*100+58}" fill="${c.suggestedText}" font-family="sans-serif" font-size="28">${c.token} / ${c.hex} / contrast ${(Math.max(c.contrastBlack,c.contrastWhite)).toFixed(2)}:1</text>`).join("")}</svg>`;
  return { summary: `已从实际图片提取 ${colors.length} 个主色，交付CSS变量、色板和黑/白文字对比度；不是完整品牌设计或所有组件的无障碍认证。`, outputs: [json("brand-tokens.json", { colors, sample: "96px以内缩略图、忽略alpha<128像素、RGB32级量化；占比按所有保留样本计算。" }), out("brand-tokens.css","text/css",`:root {\n${colors.map(c=>`  --${c.token}: ${c.hex};`).join("\n")}\n`), out("palette.svg","image/svg+xml",svg)] };
}
export async function productImages(input: SkillInput, event: (m: string) => void) {
  const source = await imageInput(input.bytes); event(`读取 ${source.meta.width}×${source.meta.height} 图片并修正EXIF方向；只缩放留白，不裁掉商品。`);
  const outputs: Output[] = [];
  const sizes = [["square",1200,1200],["portrait",1200,1600],["landscape",1600,900]] as const;
  for (const [name,width,height] of sizes) {
    const bytes = await sharp(source.bytes).resize(width,height,{fit:"contain",background:"#ffffff"}).flatten({background:"#ffffff"}).jpeg({quality:92}).toBuffer();
    outputs.push(out(`product-${name}.jpg`,"image/jpeg",bytes));
  }
  outputs.push(out("original-preview.png","image/png",await sharp(source.bytes).resize(900,900,{fit:"inside",withoutEnlargement:true}).png().toBuffer()));
  outputs.push(json("image-processing.json",{ inputWidth:source.meta.width,inputHeight:source.meta.height, outputs:sizes.map(([name,width,height])=>({name,width,height})),policy:"保留全部画面、白底留边、转sRGB、去除EXIF。没有抠图、去水印、生成背景或修饰商品特征。" }));
  return { summary:"已交付3种真实尺寸的商品图及原图预览。仅方向修正、等比缩放和白底留边，未执行抠图或AI修图。",outputs };
}
export async function marketing(input: SkillInput, event: (m: string) => void) {
  const { title="", subtitle="", action="" } = input.parameters || {};
  if (!title.trim() || title.length>36 || subtitle.length>80 || action.length>16 || /[\x00-\x1f\x7f]/.test(title+subtitle+action)) throw Error("海报标题必填，最多36字；副标题80字、行动文字16字；不支持控制字符。");
  const source = await imageInput(input.bytes); const outputs: Output[]=[];
  for (const [name,width,height] of [["square",1080,1080],["portrait",1080,1440]] as const) {
    const header=300, footer=150, pictureHeight=height-header-footer;
    const picture=await sharp(source.bytes).resize(width-96,pictureHeight,{fit:"contain",background:"#f3f2ec"}).flatten({background:"#f3f2ec"}).jpeg({quality:90}).toBuffer();
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f3f2ec"/>${await textPaths(title,48,98,48,width-96,2,"#263e35")}${await textPaths(subtitle,48,220,24,width-96,2,"#647369")}<image x="48" y="${header}" width="${width-96}" height="${pictureHeight}" xlink:href="data:image/jpeg;base64,${picture.toString("base64")}"/><rect x="48" y="${height-110}" width="984" height="2" fill="#bcc6bb"/>${await textPaths(action,48,height-48,28,width-96,1,"#263e35")}</svg>`;
    outputs.push(out(`poster-${name}.png`,"image/png",await sharp(Buffer.from(svg)).png().toBuffer()));
    outputs.push(out(`poster-${name}.svg`,"image/svg+xml",svg));
  }
  event("两种版式已实际排版并光栅化，文字使用本地字体轮廓，图片未裁切、未AI生成。");
  outputs.push(json("poster-layout.json", {title,subtitle,action,formats:[{width:1080,height:1080},{width:1080,height:1440}],policy:"基于上传图片的固定版式合成；SVG文字转曲，不能直接编辑文字；不生成新图片、不自动发布。"}));
  outputs.push(out("font-license.txt","text/plain; charset=utf-8",await fontLicense()));
  return {summary:"已交付方形/竖版PNG及SVG海报，使用实际上传图片与用户文字。未调用生成式图像服务或发布平台。", outputs};
}
export async function ocr(input: SkillInput, event: (m: string) => void) {
  const source=await imageInput(input.bytes);
  if (source.meta.width!*source.meta.height!>6_000_000) throw Error("OCR图片最多600万像素，请先缩小图片。");
  event("正在使用本地简体中文/英文识别模型，未上传外部OCR服务。");
  const { worker, modelHashes } = await openLocalOCR();
  try {
    const result=await worker.recognize(source.bytes,{}, {text:true,blocks:true});
    if (!result.data.text.trim()) throw Error("未识别到文字，不能视为OCR成功。请更换清晰图片。");
    if (result.data.text.length>60000) throw Error("OCR结果超过60000字。");
    const lines=(result.data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>({text:l.text,confidence:l.confidence,bbox:l.bbox}))));
    event(`OCR完成，平均置信度 ${result.data.confidence.toFixed(1)}%；低置信度和数字需人工复核。`);
    return {summary:`完成本地中英文OCR，平均置信度 ${result.data.confidence.toFixed(1)}%。识别结果未经人工校对，不保证姓名、金额、表格正确。`,outputs:[out("recognized.txt","text/plain; charset=utf-8",result.data.text),json("ocr-evidence.json",{confidence:result.data.confidence,language:"chi_sim+eng",engine:"tesseract.js@6.0.1",modelSource:"@tesseract.js-data@1.0.0/4.0.0_best_int",modelHashes,width:source.meta.width,height:source.meta.height,lines,requiresReview:true})]};
  } finally {await worker.terminate();}
}
