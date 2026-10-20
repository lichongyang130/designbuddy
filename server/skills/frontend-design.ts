import postcss from "postcss";
import sharp from "sharp";
import { zipSync, strToU8 } from "fflate";
import type { SkillInput } from "./executors";
import { imageInput } from "./images";
import { json, out, text, xml } from "./io";

type Finding = { code: string; severity: "error" | "warning" | "info"; message: string; line: number | null };

export async function cssAudit(input: SkillInput, event: (message: string) => void) {
  const source = text(input.bytes);
  if (source.length > 150_000) throw Error("CSS检查最多150000字。");
  const findings: Finding[] = [];
  let root: postcss.Root;
  try { root = postcss.parse(source, { from: input.filename }); }
  catch (error) {
    const e = error as postcss.CssSyntaxError;
    return { summary: `CSS语法解析失败：${e.reason}。没有运行浏览器。`, outputs: [json("css-audit.json", { syntaxValid: false, findings: [{ code: "CSS_SYNTAX", severity: "error", message: e.reason, line: e.line || null }], notExecuted: ["浏览器", "DOM计算样式", "视觉验收"] }), out("css-audit.txt", "text/plain; charset=utf-8", `语法错误（第 ${e.line || "?"} 行）：${e.reason}`)] };
  }
  let nodes = 0, rules = 0;
  const seenSelectors = new Map<string, number>();
  const customProperties = new Set<string>(), usedProperties = new Set<string>();
  const report = (code: string, severity: Finding["severity"], message: string, line?: number) => { if (findings.length < 500) findings.push({ code, severity, message: message.slice(0, 240), line: line || null }); };
  root.walk(node => {
    if (++nodes > 10_000) throw Error("CSS AST超过10000节点，停止检查。");
    if (node.type === "rule") {
      rules++;
      if (rules > 2_000) throw Error("CSS规则超过2000条限制，停止检查。");
      const rule = node as postcss.Rule;
      const selector = rule.selector.replace(/\s+/g, " ").trim();
      if (seenSelectors.has(selector)) report("DUPLICATE_SELECTOR", "warning", `重复选择器：${selector.slice(0, 120)}`, rule.source?.start?.line);
      else seenSelectors.set(selector, 1);
      if (selector.includes(":focus") || selector.includes(":focus-visible")) seenSelectors.set("__FOCUS__", 1);
      rule.walkDecls(decl => {
        if (decl.prop.startsWith("--")) customProperties.add(decl.prop);
        for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) usedProperties.add(match[1]);
        if (decl.important) report("IMPORTANT_OVERRIDE", "warning", `${decl.prop} 使用 !important，检查是否存在级联冲突。`, decl.source?.start?.line);
        if (/^(?:width|min-width|max-width)$/.test(decl.prop) && /(?:^|\s)(?:1[0-9]{3,}|[2-9][0-9]{3,})px\b/i.test(decl.value)) report("LARGE_FIXED_WIDTH", "warning", `${decl.prop} 设置了较大的固定像素宽度，可能导致窄屏溢出。`, decl.source?.start?.line);
        if (/^(?:width|min-width)$/.test(decl.prop) && /(?:^|\s)100vw\b/i.test(decl.value)) report("VIEWPORT_WIDTH_OVERFLOW", "warning", "100vw 可能包含滚动条宽度；请在实际页面检查横向溢出。", decl.source?.start?.line);
        if (/url\(\s*['"]?https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|['")])/i.test(decl.value)) report("LOCALHOST_RESOURCE", "error", "样式引用 localhost 资源，远端预览通常无法访问。", decl.source?.start?.line);
      });
    }
    if (node.type === "atrule" && (node as postcss.AtRule).name.toLowerCase() === "import") {
      const rule = node as postcss.AtRule;
      if (/^\s*url\(\s*['"]?https?:/i.test(rule.params)) report("REMOTE_IMPORT", "info", "发现远程CSS @import；需确认来源、隐私与加载失败策略。", rule.source?.start?.line);
    }
  });
  for (const name of usedProperties) if (!customProperties.has(name)) report("UNDEFINED_CUSTOM_PROPERTY", "warning", `引用了未在本文件中定义的自定义属性 ${name}；它也可能由其他样式表提供。`);
  if (!seenSelectors.has("__FOCUS__")) report("NO_FOCUS_RULE", "info", "本文件未发现 :focus/:focus-visible 规则；焦点样式可能由其他样式表提供。请检查键盘可见性。");
  if (!root.nodes?.some(node => node.type === "atrule" && (node as postcss.AtRule).name.toLowerCase() === "media")) report("NO_MEDIA_QUERY", "info", "本文件没有媒体查询；若样式应适配多视口，请检查响应式断点是否在其他样式表中。", 1);
  event(`PostCSS实际解析 ${rules} 条CSS规则和 ${nodes} 个语法节点，发现 ${findings.length} 条静态提示；未启动浏览器或计算布局。`);
  const errors = findings.filter(f => f.severity === "error").length;
  return { summary: `CSS语法解析通过；${errors} 个错误、${findings.filter(f => f.severity === "warning").length} 个警告及 ${findings.filter(f => f.severity === "info").length} 条提示。静态结果不等于浏览器验收。`, outputs: [json("css-audit.json", { syntaxValid: true, nodes, rules, findings, truncated: findings.length >= 500, notExecuted: ["DOM与计算样式", "浏览器布局", "键盘交互", "视觉验收"] }), out("css-audit.txt", "text/plain; charset=utf-8", findings.map(f => `${f.severity.toUpperCase()} ${f.line ?? "-"} ${f.code}: ${f.message}`).join("\n") || "已实现的CSS静态规则未发现问题；未执行浏览器验收。" )] };
}

const safeName = (name: unknown) => typeof name === "string" && /^[a-z][a-z0-9-]{0,47}$/.test(name);
const hex = (value: unknown): value is string => typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
function ratio(fg: string, bg: string) {
  const channel = (hexValue: string, offset: number) => parseInt(hexValue.slice(offset, offset + (hexValue.length === 4 ? 1 : 2)).repeat(hexValue.length === 4 ? 2 : 1), 16) / 255;
  const lum = (value: string) => { const c = [channel(value,1),channel(value,value.length===4?2:3),channel(value,value.length===4?3:5)].map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
  const a=lum(fg),b=lum(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
const scalar = (value: unknown) => typeof value === "string" || typeof value === "number" && Number.isFinite(value);
const cssValueSafe = (value: string) => value.length <= 160 && !/[;{}<>\\\n\r]/.test(value) && !/url\s*\(|expression\s*\(|javascript:/i.test(value);

export async function designTokens(input: SkillInput, event: (message: string) => void) {
  let data: unknown;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("设计令牌文件必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("设计令牌JSON根节点必须是对象。");
  const root = data as Record<string, unknown>;
  const allowedGroups = ["name", "colors", "spacing", "typography", "radii", "shadows", "contrast"];
  if (Object.keys(root).some(key => !allowedGroups.includes(key))) throw Error(`仅支持以下顶层字段：${allowedGroups.join("、")}。`);
  const tokenGroups = ["colors", "spacing", "typography", "radii", "shadows"] as const;
  const entries: { group: string; name: string; value: string }[] = [];
  const errors: string[] = [];
  for (const group of tokenGroups) {
    const value = root[group]; if (value === undefined) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${group} 必须是键值对象。`); continue; }
    for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!safeName(name)) { errors.push(`${group}.${name.slice(0,60)} 令牌名称格式错误。`); continue; }
      if (!scalar(raw)) { errors.push(`${group}.${name} 只接受字符串或有限数字。`); continue; }
      const css = String(raw);
      if (group === "colors" ? !hex(css) : !cssValueSafe(css)) { errors.push(`${group}.${name} 值不符合白名单格式。`); continue; }
      entries.push({ group, name, value: css });
    }
  }
  const contrasts: { label: string; foreground: string; background: string; ratio: number; normalAA: boolean; largeAA: boolean }[] = [];
  if (root.contrast !== undefined) {
    if (!Array.isArray(root.contrast) || root.contrast.length > 50) errors.push("contrast 必须是最多50项的数组。");
    else root.contrast.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push(`contrast[${index}] 必须是对象。`); return; }
      const c=item as Record<string,unknown>;
      if (Object.keys(c).some(k=>!['label','foreground','background'].includes(k)) || typeof c.label!=="string" || !c.label.trim() || c.label.length>80 || !hex(c.foreground) || !hex(c.background)) { errors.push(`contrast[${index}] 需包含label、foreground和background十六进制颜色。`); return; }
      const value=ratio(c.foreground,c.background); contrasts.push({label:c.label,foreground:c.foreground,background:c.background,ratio:value,normalAA:value>=4.5,largeAA:value>=3});
    });
  }
  if (entries.length > 200) errors.push("令牌总数最多200个。");
  if (entries.filter(entry => entry.group === "colors").length > 80) errors.push("颜色令牌最多80个。");
  if (errors.length) throw Error(`令牌校验失败：${errors.slice(0,5).join(" ")}`);
  if (!entries.length) throw Error("没有发现可导出的令牌。");
  const vars = entries.map(entry => `  --${entry.group}-${entry.name}: ${entry.value};`).join("\n");
  const css = `:root {\n${vars}\n}\n`;
  const colors=entries.filter(e=>e.group==="colors");
  const width=Math.max(600,colors.length*180), swatches=colors.map((color,index)=>`<g><rect x="${index*180+8}" y="42" width="164" height="104" rx="12" fill="${color.value}"/><text x="${index*180+12}" y="174" font-family="sans-serif" font-size="14" fill="#222">${xml(color.name)} ${xml(color.value)}</text></g>`).join("");
  const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="210" viewBox="0 0 ${width} 210"><rect width="100%" height="100%" fill="#fff"/><text x="12" y="24" font-family="sans-serif" font-size="16" fill="#222">Design token color preview · not a full UI review</text>${swatches}</svg>`;
  event(`已校验并导出 ${entries.length} 个设计令牌，计算 ${contrasts.length} 组明确指定的文字/背景对比度。`);
  return {summary:`真实校验并生成 ${entries.length} 个CSS自定义属性和 ${contrasts.length} 组 WCAG 对比度报告。`,outputs:[out("tokens.css","text/css; charset=utf-8",css),json("token-audit.json",{name:typeof root.name==="string"?root.name.slice(0,100):"Untitled design tokens",tokenCount:entries.length,entries,contrasts,failedNormalAA:contrasts.filter(c=>!c.normalAA).map(c=>c.label),limitations:["仅验证文件内提供的令牌，不检查实际网页或组件。","对比度只针对明确提交的前景/背景颜色对；不是整站无障碍认证。","CSS输出不嵌入外部字体或资源。"]}),out("token-preview.svg","image/svg+xml; charset=utf-8",preview)]};
}

const escapeHTML=(value: unknown, max=500)=>xml(typeof value==="string"?value.slice(0,max):"");
const idFor=(value:string,index:number)=>`${value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,36)||"section"}-${index+1}`;
export async function webScaffold(input: SkillInput, event:(message:string)=>void) {
  let data:unknown;try{data=JSON.parse(text(input.bytes));}catch{throw Error("页面配置必须是有效JSON。");}
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("页面配置根节点必须是对象。");
  const d=data as Record<string,unknown>;
  if(Object.keys(d).some(k=>!['title','description','language','theme','navigation','sections'].includes(k)))throw Error("页面配置含未知字段；只接受title、description、language、theme、navigation、sections。");
  const title=typeof d.title==="string"?d.title.trim():"";if(!title||title.length>100)throw Error("title 必填且最多100字。");
  const description=typeof d.description==="string"?d.description.trim():"";if(description.length>240)throw Error("description最多240字。");
  const lang=d.language===undefined?"zh-CN":d.language;if(typeof lang!=="string"||!/^([a-z]{2,3})(-[A-Z]{2})?$/.test(lang))throw Error("language必须是简短语言代码，例如zh-CN或en。");
  const defaults={primary:"#335C4A",surface:"#F5F4EF",text:"#202720",accent:"#D8774A"};
  if(d.theme!==undefined&&(!d.theme||typeof d.theme!=="object"||Array.isArray(d.theme)))throw Error("theme必须是颜色配置对象。");
  const theme={...defaults,...(d.theme||{})} as Record<string,unknown>;
  if(Object.keys(theme).some(k=>!['primary','surface','text','accent'].includes(k))||Object.values(theme).some(v=>!hex(v)))throw Error("theme只接受primary、surface、text、accent四种十六进制颜色。");
  if(!Array.isArray(d.navigation)||d.navigation.length>8)throw Error("navigation必须是最多8项的数组。");
  const nav=(d.navigation as unknown[]).map((item,i)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw Error(`navigation[${i}]格式无效。`);const v=item as Record<string,unknown>;if(Object.keys(v).some(k=>!['label','section'].includes(k))||typeof v.label!=="string"||!v.label.trim()||v.label.length>40||typeof v.section!=="string"||!v.section.trim()||v.section.length>80)throw Error(`navigation[${i}]需包含label和匹配的section标题。`);return {label:v.label,section:v.section};});
  if(!Array.isArray(d.sections)||d.sections.length<1||d.sections.length>12)throw Error("sections必须包含1至12个区块。");
  const supported=new Set(["hero","features","gallery","faq","contact","footer"]);
  const sections:any[]=(d.sections as unknown[]).map((item,index)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))throw Error(`sections[${index}]格式无效。`);
    const v=item as Record<string,unknown>;if(!supported.has(String(v.type)))throw Error(`sections[${index}]类型不支持；允许hero/features/gallery/faq/contact/footer。`);
    const sectionTitle=typeof v.title==="string"?v.title.trim():"";if(index===0&&v.type!=="hero")throw Error("第一个区块必须是hero。");if(!sectionTitle||sectionTitle.length>100)throw Error(`sections[${index}].title必填且最多100字。`);
    const known=v.type==="hero"?["type","title","eyebrow","body","button"]:v.type==="features"||v.type==="gallery"?["type","title","items"]:v.type==="faq"?["type","title","items"]:v.type==="contact"?["type","title","body","email"]:["type","title","body"];
    if(Object.keys(v).some(k=>!known.includes(k)))throw Error(`sections[${index}]含未知字段。`);
    const body=typeof v.body==="string"?v.body:"";if(body.length>1200)throw Error(`sections[${index}].body最多1200字。`);
    if(["features","gallery","faq"].includes(String(v.type))){if(!Array.isArray(v.items)||!v.items.length||v.items.length>20)throw Error(`sections[${index}].items需为1至20项。`);for(const [i,raw] of (v.items as unknown[]).entries()){if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("区块条目格式无效。");const row=raw as Record<string,unknown>;const fields=v.type==="faq"?["question","answer"]:["title","body"];if(Object.keys(row).some(k=>!fields.includes(k))||fields.some(k=>typeof row[k]!=="string"||!(row[k] as string).trim()||(row[k] as string).length>600))throw Error(`${v.type}第${i+1}项字段无效。`);}}
    if(v.type==="hero"&&(typeof v.button!=="string"||!v.button.trim()||(v.button as string).length>40))throw Error("hero.button必填且最多40字。");
    if(v.type==="contact"&&v.email!==undefined&&(typeof v.email!=="string"||v.email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)))throw Error("contact.email必须是有效邮件地址。");
    const id=idFor(sectionTitle,index);return {...v,id,title:sectionTitle,body};
  });
  if(sections.filter(s=>s.type==="hero").length!==1)throw Error("页面必须且只能有一个hero区块。");
  if(new Set(sections.map(section=>section.id)).size!==sections.length)throw Error("区块标题生成了重复锚点，请修改为不同标题。");
  for(const entry of nav)if(!sections.some(section=>section.title===entry.section))throw Error(`导航“${entry.label}”未匹配任何区块标题。`);
  const sectionId=(label:string)=>String(sections.find(s=>s.title===label)?.id||"");
  const navHTML=nav.map(item=>`<a href="#${sectionId(item.section)}">${escapeHTML(item.label,40)}</a>`).join("\n");
  const bodyHTML=sections.map((section,index)=>{
    const titleHTML=`<h${section.type==="hero"?1:2}>${escapeHTML(section.title,100)}</h${section.type==="hero"?1:2}>`;
    if(section.type==="hero")return `<section class="hero" id="${section.id}"><p class="eyebrow">${escapeHTML(section.eyebrow,80)}</p>${titleHTML}<p class="lede">${escapeHTML(section.body,1200)}</p><a class="button" href="#${sectionId(sections[1]?.title||section.title)}">${escapeHTML(section.button,40)}</a></section>`;
    if(section.type==="features"||section.type==="gallery")return `<section id="${section.id}" class="content-section"><div class="section-heading">${titleHTML}<p>${escapeHTML(section.body,1200)}</p></div><div class="cards">${(section.items as Record<string,string>[]).map(item=>`<article class="card">${section.type==="gallery"?`<div class="visual-placeholder" aria-label="图片占位区域"></div>`:""}<h3>${escapeHTML(item.title,100)}</h3><p>${escapeHTML(item.body,600)}</p></article>`).join("")}</div></section>`;
    if(section.type==="faq")return `<section id="${section.id}" class="content-section"><div class="section-heading">${titleHTML}</div><div class="faq-list">${(section.items as Record<string,string>[]).map(item=>`<details><summary>${escapeHTML(item.question,600)}</summary><p>${escapeHTML(item.answer,600)}</p></details>`).join("")}</div></section>`;
    if(section.type==="contact")return `<section id="${section.id}" class="contact-section">${titleHTML}<p>${escapeHTML(section.body,1200)}</p>${section.email?`<a href="mailto:${escapeHTML(section.email,160)}">${escapeHTML(section.email,160)}</a>`:"<p class=\"muted\">请补充真实联系方式；此页面不会代发信息。</p>"}</section>`;
    return `<footer id="${section.id}"><span>${escapeHTML(section.title,100)}</span><span>${new Date().getUTCFullYear()}</span></footer>`;
  }).join("\n");
  const css=`:root{color-scheme:light;--color-primary:${theme.primary};--color-surface:${theme.surface};--color-text:${theme.text};--color-accent:${theme.accent};--content-width:1120px;font-family:Inter,"Noto Sans SC",system-ui,sans-serif;color:var(--color-text);background:var(--color-surface);font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:320px}a{color:inherit}header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--color-surface) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid #00000012}.nav{max-width:var(--content-width);margin:auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-weight:750;color:var(--color-primary);text-decoration:none}.links{display:flex;gap:22px}.links a{text-decoration:none;font-size:14px}.menu{display:none}.hero,.content-section,.contact-section{max-width:var(--content-width);margin:auto;padding:88px 24px}.hero{min-height:480px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.eyebrow{text-transform:uppercase;letter-spacing:.12em;color:var(--color-accent);font-size:13px;font-weight:700}.hero h1{max-width:850px;margin:8px 0;font-size:clamp(42px,8vw,88px);line-height:1.03;letter-spacing:-.045em}.lede{max-width:680px;font-size:clamp(17px,2vw,22px);line-height:1.7;color:color-mix(in srgb,var(--color-text) 76%,transparent)}.button{display:inline-flex;margin-top:16px;padding:12px 18px;border-radius:999px;background:var(--color-primary);color:white;text-decoration:none;font-weight:650}.content-section{border-top:1px solid #00000012}.section-heading{max-width:700px;margin-bottom:28px}.section-heading h2,.contact-section h2{font-size:clamp(28px,4vw,48px);line-height:1.12;letter-spacing:-.03em}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}.card{padding:22px;border:1px solid #00000018;border-radius:18px;background:#ffffff9c}.card h3{font-size:20px}.card p,.contact-section p,.faq-list p{line-height:1.75;color:color-mix(in srgb,var(--color-text) 74%,transparent)}.visual-placeholder{height:170px;border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--color-primary) 16%,white),color-mix(in srgb,var(--color-accent) 18%,white));border:1px dashed color-mix(in srgb,var(--color-primary) 45%,white)}.faq-list details{padding:18px 0;border-bottom:1px solid #00000020}.faq-list summary{font-weight:650;cursor:pointer}.contact-section{background:color-mix(in srgb,var(--color-primary) 8%,var(--color-surface));border-radius:24px;margin-bottom:42px}.contact-section>a{color:var(--color-primary)}.muted{opacity:.7}footer{padding:24px max(24px,calc((100vw - var(--content-width))/2));display:flex;justify-content:space-between;border-top:1px solid #00000018;font-size:13px}.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:12px;background:white;padding:10px;z-index:9}:focus-visible{outline:3px solid var(--color-accent);outline-offset:3px}@media(max-width:700px){.nav{padding:12px 18px}.menu{display:inline-flex;border:0;background:transparent;color:var(--color-text);font:inherit}.links{display:none;position:absolute;top:100%;left:0;right:0;padding:18px;background:var(--color-surface);border-bottom:1px solid #00000018;flex-direction:column}.links.open{display:flex}.hero,.content-section,.contact-section{padding:64px 20px}.hero{min-height:400px}.cards{grid-template-columns:1fr}.contact-section{margin:0 12px 24px}footer{padding:20px}}`;
  const js=`const menu=document.querySelector('[data-menu]');const links=document.querySelector('[data-links]');menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));links?.classList.toggle('open',open)});links?.addEventListener('click',event=>{if(event.target instanceof HTMLAnchorElement){menu?.setAttribute('aria-expanded','false');links.classList.remove('open')}});`;
  const html=`<!doctype html>\n<html lang="${escapeHTML(lang,8)}">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHTML(description,240)}"><meta name="color-scheme" content="light"><title>${escapeHTML(title,100)}</title><link rel="stylesheet" href="./styles.css"></head>\n<body id="top"><a class="skip" href="#main">跳到主要内容</a><header><nav class="nav" aria-label="主导航"><a class="brand" href="#top">${escapeHTML(title,100)}</a><button class="menu" type="button" data-menu aria-expanded="false" aria-controls="site-links">菜单</button><div class="links" id="site-links" data-links>${navHTML}</div></nav></header><main id="main">${bodyHTML}</main><script src="./app.js" defer></script></body>\n</html>`;
  const parsed=JSON.stringify({pageTitle:title,language:lang,navigation:nav,sectionCount:sections.length,files:["index.html","styles.css","app.js"],contactForm:"none",externalResources:"none",generatedFrom:"validated JSON schema"});
  const files={"index.html":strToU8(html),"styles.css":strToU8(css),"app.js":strToU8(js),"scaffold-report.json":strToU8(parsed)};
  const archive=zipSync(files,{level:6});
  if(archive.length>8_000_000)throw Error("生成的站点ZIP超过8MB。");
  event(`已根据受限配置生成HTML/CSS/JS并打包ZIP（${sections.length}个区块）；未安装依赖、运行服务或发布站点。`);
  return {summary:`已实际生成 ${sections.length} 个内容区块的响应式静态网站和ZIP。内含可运行的移动导航交互、键盘焦点样式和语义化HTML；没有后端、数据库或线上发布。`,outputs:[out("static-site.zip","application/zip",archive),out("index.html","text/html; charset=utf-8",html),out("styles.css","text/css; charset=utf-8",css),out("app.js","text/javascript; charset=utf-8",js),json("scaffold-report.json",JSON.parse(parsed))]};
}

export async function webImagePack(input:SkillInput,event:(message:string)=>void){
  const source=await imageInput(input.bytes);const originalWidth=source.meta.width!,originalHeight=source.meta.height!;const outputs=[] as ReturnType<typeof out>[];const records=[] as Record<string,unknown>[];
  for(const target of [480,960,1600]){const width=Math.min(target,originalWidth),height=Math.max(1,Math.round(originalHeight*width/originalWidth));const bytes=await sharp(source.bytes).resize({width,withoutEnlargement:true,fit:"inside"}).webp({quality:82,effort:4}).toBuffer();const metadata=await sharp(bytes).metadata();const name=`image-${width}w.webp`;outputs.push(out(name,"image/webp",bytes));records.push({name,width:metadata.width,height:metadata.height,bytes:bytes.length,quality:82});}
  outputs.push(json("responsive-image.json",{original:{width:originalWidth,height:originalHeight,format:source.meta.format},outputs:records,htmlExample:`<img src=\"${records[0].name}\" srcset=\"${records.map(r=>`${r.name} ${r.width}w`).join(", ")}\" sizes=\"(max-width: 600px) 100vw, 960px\" alt=\"请替换为对图片的准确说明\">`,limitations:["图片内容未改变，但WebP有损编码可能改变细节；请人工查看。","srcset示例中的alt是占位提醒，需由使用者编写真实替代文本。","不检查图片是否含个人信息或授权。"]}));
  event(`图片实际转码为${records.length}个自适应WebP尺寸；最大输出边不超过原图。`);
  return{summary:`已真实生成${records.length}个WebP响应尺寸。执行了方向校正、sRGB归一化和有损压缩；未生成或修饰图像。`,outputs};
}
