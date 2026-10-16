import sharp from "sharp";
import { embeddedFontSubsets, fontLicense, textPaths } from "./fonts";
import { json, out, text } from "./io";
import type { Output, SkillInput } from "./executors";

const hex = /^#[0-9a-fA-F]{6}$/;
const safe = (v: unknown, max: number, field: string, required = true) => {
 if (typeof v !== "string" || v.length > max || (required && !v.trim()) || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(v)) throw Error(`${field}为空、过长或包含不支持字符。`);
 return v.trim();
};
function svgDoc(w:number,h:number,body:string){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;}
function symbol(shape:string,color:string){
 if(shape==='seed') return `<path d="M120 24C67 33 34 65 40 111c5 42 43 61 80 31 29-24 29-76 0-118Z" fill="${color}"/><path d="M54 143c15-39 40-66 74-91" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;
 if(shape==='orbit') return `<circle cx="96" cy="96" r="52" fill="none" stroke="${color}" stroke-width="19"/><ellipse cx="96" cy="96" rx="78" ry="33" transform="rotate(-35 96 96)" fill="none" stroke="${color}" stroke-width="10"/><circle cx="145" cy="47" r="13" fill="${color}"/>`;
 return `<path d="M96 13 113 76 176 96 113 116 96 179 79 116 16 96 79 76Z" fill="${color}"/><circle cx="151" cy="43" r="12" fill="${color}" opacity=".5"/><circle cx="44" cy="148" r="8" fill="${color}" opacity=".65"/>`;
}
export async function brandSystem(input:SkillInput):Promise<{summary:string;outputs:Output[]}>{
 let b:any;try{b=JSON.parse(text(input.bytes));}catch{throw Error('品牌方案必须是有效UTF-8 JSON。');}
 if(!b||Array.isArray(b)||typeof b!=='object'||Object.keys(b).sort().join(',')!=='brandName,colors,concept,description,logoShape,tagline,voice')throw Error('品牌JSON必须且只能包含品牌名、简介、理念、口号、语气、色彩和标志构形字段。');
 const brandName=safe(b.brandName,32,'品牌名'),description=safe(b.description,500,'品牌简介'),concept=safe(b.concept,240,'品牌理念'),tagline=safe(b.tagline,60,'品牌口号',false),voice=safe(b.voice,240,'品牌语气');
 if(!['seed','orbit','spark'].includes(b.logoShape))throw Error('标志构形只能选seed、orbit或spark。');
 if(!Array.isArray(b.colors)||b.colors.length<3||b.colors.length>5||b.colors.some((c:any)=>!c||Object.keys(c).sort().join(',')!=='hex,name,role'||!hex.test(c.hex)||typeof c.name!=='string'||c.name.length>24||typeof c.role!=='string'||c.role.length>24))throw Error('色板需要3至5组{name,role,hex}；颜色须为六位HEX。');
 if(new Set(b.colors.map((c:any)=>c.role)).size!==b.colors.length||new Set(b.colors.map((c:any)=>c.hex.toLowerCase())).size!==b.colors.length)throw Error('色板角色及颜色须各自唯一。');
 const colors=b.colors.map((c:any)=>({name:safe(c.name,24,'颜色名称'),role:safe(c.role,24,'颜色用途'),hex:c.hex.toUpperCase()}));
 const primary=colors[0].hex,secondary=colors[1].hex,accent=colors[2].hex,fonts='Noto Sans SC, Noto Sans, sans-serif';
 const logoShape=b.logoShape as string;const mark= symbol(logoShape,primary);
 const namePaths=await textPaths(brandName,0,0,56,560,1,'#18312C');
 const taglinePaths=tagline?await textPaths(tagline,0,0,22,560,1,'#52645E'):'';
 const symbolSvg=svgDoc(192,192,`<rect width="192" height="192" rx="44" fill="#FFFFFF"/><g transform="translate(0 0)">${mark}</g>`);
 const lockupSvg=svgDoc(760,240,`<g transform="translate(24 24) scale(1)">${mark}</g><g transform="translate(246 107)">${namePaths}</g>${taglinePaths?`<g transform="translate(248 158)">${taglinePaths}</g>`:''}`);
 const favicon=new Uint8Array(await sharp(Buffer.from(symbolSvg)).resize(64,64).png().toBuffer());
 const avatar=new Uint8Array(await sharp(Buffer.from(symbolSvg)).resize(512,512).png().toBuffer());
 const contrast=(a:string,fg:string)=>{const lin=(x:number)=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};const rgb=(s:string)=>[1,3,5].map(i=>lin(parseInt(s.slice(i,i+2),16)));const [r,g,bl]=rgb(a),[R,G,B]=rgb(fg);const l=.2126*r+.7152*g+.0722*bl,L=.2126*R+.7152*G+.0722*B;return(Math.max(l,L)+.05)/(Math.min(l,L)+.05)};
 const tokens=colors.map((c:any,i:number)=>({...c,token:`brand-${i+1}`,contrastBlack:+contrast(c.hex,'#000000').toFixed(2),contrastWhite:+contrast(c.hex,'#FFFFFF').toFixed(2)}));
 const system={schema:'designbuddy.brand-system/1',brandName,description,concept,tagline,logo:{shape:logoShape,markColor:primary,wordmarkText:brandName,wordmarkOutlined:true,usage:'此为基于所选几何构形自动生成的原创示意标志，不含商标检索或独占性审查。'},palette:tokens,typography:{recommended:fonts,license:'本工具内嵌字体许可见 font-license.txt；CSS字体需本机安装/加载，不打包字体文件。',scale:{display:'48px/1.1',heading:'32px/1.25',body:'16px/1.7',caption:'12px/1.5'}},voice:{attributes:voice,tagline},usage:{clearSpace:'至少一个图形标志半径的留白（视觉建议）',minimumSymbolPixels:32,minimumWordmarkPixels:180,backgrounds:'浅色/白底优先；需在目标尺寸重新检查对比度',doNot:['不压扁或拉伸标志','不将强调色用作长段正文','不把自动构形称作商标注册或版权核验']},limitations:['确定性模板资产生成，不是AI创意设计或商标检索。','不验证品牌名可注册性、商标冲突、市场差异或目标受众。','颜色对比度仅为数学参考；完整产品无障碍需另行验收。','使用前应由品牌负责人审阅文字、文化语境、版权与适用性。']};
 const css=`:root {\n${tokens.map((c:any)=>`  --${c.token}: ${c.hex};`).join('\n')}\n  --brand-font: ${fonts};\n  --brand-display-size: 48px;\n  --brand-heading-size: 32px;\n  --brand-body-size: 16px;\n  --brand-caption-size: 12px;\n}\n`;
 const swatches=tokens.map((c:any,i:number)=>`<article><span class="swatch" style="background:${c.hex}"></span><h3>${esc(c.name)}</h3><p>${esc(c.role)} · <code>${c.hex}</code></p><p>黑字对比 ${c.contrastBlack}:1；白字 ${c.contrastWhite}:1</p><p>${Math.max(c.contrastBlack,c.contrastWhite)>=4.5?'至少一个文字色达到普通文本4.5:1参考值':'未达普通文本4.5:1参考值'}</p></article>`).join('');
 let html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brandName)}品牌规范草案</title><style>body{margin:0;background:#f4f3ef;color:#18312c;font:16px/1.7 BrandKitNoto,${fonts}}main{max-width:980px;margin:auto;padding:40px}section{background:white;border:1px solid #dde3dc;border-radius:20px;padding:28px;margin:20px 0}h1{font-size:36px}.lockup{width:min(100%,760px)}.palette{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.swatch{height:90px;border-radius:12px;display:block}code{font-size:14px}li{margin:8px 0}@media(max-width:500px){main{padding:16px}section{padding:18px}}</style><main><header><h1>${esc(brandName)} · 品牌系统草案</h1><p>自动生成的确定性构形，不是AI品牌创意或商标审查。</p><img class="lockup" alt="${esc(brandName)}标志排版" src="data:image/svg+xml;base64,${Buffer.from(lockupSvg).toString('base64')}"></header><section><h2>品牌简介与理念</h2><p>${esc(description)}</p><p>${esc(concept)}</p>${tagline?`<p>口号：${esc(tagline)}</p>`:''}<p>表达语气：${esc(voice)}</p></section><section><h2>色彩变量</h2><div class="palette">${swatches}</div></section><section><h2>标志构形与使用</h2><p>构形：${logoShape}。建议最小图标32px、字标180px；四周留白至少一个图形半径。浅色底优先，具体使用须检查目标尺寸。</p><ul>${system.usage.doNot.map((x:string)=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h2>字体与层级</h2><p>${fonts} · 展示48px、标题32px、正文16px、注释12px。若字体未安装，系统回退可能改变字形。</p></section><section><h2>限制与人工复核</h2><ul>${system.limitations.map((x:string)=>`<li>${esc(x)}</li>`).join('')}</ul></section></main></html>`;
 const subsets=await embeddedFontSubsets(html);const inlineFonts=subsets.map(s=>`@font-face{font-family:BrandKitNoto;src:url(data:font/woff2;base64,${Buffer.from(s.bytes).toString('base64')}) format('woff2');font-style:normal;font-weight:100 900;unicode-range:${s.unicodeRange}}`).join('');html=html.replace('<style>','<style>'+inlineFonts);
 const license=await fontLicense();
 return {summary:`为“${brandName}”实际生成标志构形、${colors.length}色设计变量、字体层级、响应式品牌规范和PNG图标，共8份成果。属于模板化品牌系统草案；未做AI创意、商标/版权检索或市场验收。`,outputs:[out('logo-symbol.svg','image/svg+xml',symbolSvg),out('logo-lockup.svg','image/svg+xml',lockupSvg),out('brand-icon-64.png','image/png',favicon),out('brand-avatar-512.png','image/png',avatar),json('brand-system.json',system),out('brand-system.css','text/css; charset=utf-8',css),out('brand-guidelines.html','text/html; charset=utf-8',html),out('font-license.txt','text/plain; charset=utf-8',license)]};
}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
