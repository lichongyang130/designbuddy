import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { unzipSync, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { openOffice } from './office';
import { imageInput } from './images';
import { fontFor, fontLicense } from './fonts';
import { out, json, text, xml } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput, Output } from './executors';

type XNode = Record<string, any>;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const decode = (s: unknown): string => String(s ?? '').replace(/&(?:amp|lt|gt|quot|apos|#x[\da-fA-F]+|#\d+);/g, v => {
  const known: Record<string,string> = { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }; if (known[v]) return known[v];
  const n = v.startsWith('&#x') ? parseInt(v.slice(3,-1),16) : Number(v.slice(2,-1));
  if (!Number.isInteger(n) || n < 1 || n < 32 && ![9,10,13].includes(n) || n === 0xfffe || n === 0xffff || n > 0x10ffff || n >= 0xd800 && n <= 0xdfff) throw Error('不支持的XML字符实体。'); return String.fromCodePoint(n);
});
const name = (node: XNode) => Object.keys(node).find(k => k !== ':@') || '';
const children = (node?: XNode): XNode[] => node && Array.isArray(node[name(node)]) ? node[name(node)] : [];
const elements = (nodes: XNode[]) => nodes.filter(n => !name(n).startsWith('#') && !name(n).startsWith('?'));
const child = (node: XNode | undefined, tag: string) => children(node).find(n => name(n) === tag);
const attr = (node: XNode | undefined, key: string) => decode(node?.[':@']?.[key]);
function descendants(nodes: XNode[], tag: string): XNode[] { return nodes.flatMap(n => [...(name(n) === tag ? [n] : []), ...descendants(children(n),tag)]); }
function parse(bytes: Uint8Array): XNode[] {
  const source = text(bytes);
  if (/&(?!(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);)/.test(source)) throw Error('XML包含未声明或不支持的字符实体。');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source) || XMLValidator.validate(source) !== true) throw Error('XML损坏或包含不支持的实体/CDATA声明。');
  let depth = 0, count = 0;
  for (const tag of source.matchAll(/<\/?[A-Za-z_][^<>]*>/g)) {
    if (++count > 30000) throw Error('单个XML超过30000个标签。');
    if (tag[0].startsWith('</')) depth--; else if (!tag[0].endsWith('/>')) depth++;
    if (depth > 64) throw Error('XML嵌套超过64层。');
  }
  return new XMLParser({ preserveOrder:true, ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, parseAttributeValue:false, trimValues:false, processEntities:false, ignoreDeclaration:true, ignorePiTags:true }).parse(source);
}
const value = (parent: XNode | undefined, tag: string) => attr(child(parent,tag),'w:val');
function integer(s: string, min: number, max: number, fallback?: number) {
  if (!s && fallback !== undefined) return fallback;
  if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) throw Error('表格/段落属性超出支持范围。'); return Number(s);
}
const enabled = (node: XNode | undefined, tag: string) => !!child(node,tag) && !['0','false','off','none'].includes(value(node,tag));
function twipsPx(node:XNode|undefined,key:string,allowNegative=false):number|undefined {const raw=attr(node,key);if(!raw)return undefined;if(!(allowNegative?/^-?\d+$/.test(raw):/^\d+$/.test(raw)))throw Error('段落/表格长度单位不受支持。');const n=Number(raw);if(!Number.isSafeInteger(n)||Math.abs(n)>14400)throw Error('段落/表格长度超出支持范围。');return Math.round(n/15*100)/100;}
type TextFormat={bold:boolean;italic:boolean;underline:boolean;color?:string;fontSizePx?:number;fontFamily?:string};
type StyleInfo={basedOn:string;styleType:string;builtinHeading:number;outline?:number;alignment?:string;indentPx?:Record<string,number>;spacingPx?:Record<string,number>;keepNext?:boolean;run:Partial<TextFormat>};
type Inline = { type:'text'; text:string; bold:boolean; italic:boolean; underline:boolean;color?:string;fontSizePx?:number;fontFamily?:string } | { type:'image'; imageId:string; width?:number; floatSide?:'left'|'right'; wrapMode?:'square'|'tight'|'topAndBottom'|'none'; marginLeftPx?:number; marginRightPx?:number; anchorPosition?:{horizontalRelativeFrom:string;verticalRelativeFrom:string;horizontalAlign?:string;verticalAlign?:string;horizontalOffsetEmu?:number;verticalOffsetEmu?:number;simpleXEmu?:number;simpleYEmu?:number;relativeHeight?:number} } | { type:'break'; kind:string } | { type:'tab' };
type Paragraph = { type:'paragraph'; id:string; sourcePath:string; sectionIndex:number; styleId:string; heading:number; alignment:string; indentPx:{left?:number;right?:number;firstLine?:number;hanging?:number}; spacingPx:{before?:number;after?:number;lineHeight?:number}; keepNext:boolean; list?: { numId:string; level:number }; pageBreakBefore:boolean; runs:Inline[]; text:string };
type Cell = { column:number; colSpan:number; rowSpan:number; background?:string; verticalAlign:'top'|'center'|'bottom'; sourcePaths:string[]; paragraphs:Paragraph[]; continuations:{sourcePath:string;paragraphs:Paragraph[]}[] };
type Table = { type:'table'; id:string; sourcePath:string; sectionIndex:number; columns:number; columnWidthsTwips:number[]; rows:{ sourceRow:number; cells:Cell[] }[] };
type PageSection = {index:number;sourcePath:string;pageSizeTwips:{width:number;height:number;orientation:string};marginsTwips:{top:number;right:number;bottom:number;left:number;header:number;footer:number;gutter:number};columns:{count:number;gapTwips:number;separator:boolean};headerRefs:{id:string;type:string}[];footerRefs:{id:string;type:string}[];headers:Paragraph[];footers:Paragraph[]};
type ImageRecord = { id:string; sourcePath:string; originalFile:string; sourceSHA256:string; previewSHA256:string; previewWidth:number; previewHeight:number; sourceBytes:number };

export async function docxStructure(input: SkillInput, event: (message:string)=>void) {
  validateSkillOptions('document.structure',{deduplicate:input.deduplicate,...(input.parameters?{parameters:input.parameters}:{})});
  const entries = openOffice(input.bytes,'word/document.xml');
  if (!entries['_rels/.rels'] || !entries['[Content_Types].xml']) throw Error('缺少DOCX包关系或内容类型声明。');
  function relations(bytes: Uint8Array) {
    const root = parse(bytes).find(n => name(n) === 'Relationships');
    if (!root || attr(root,'xmlns') !== 'http://schemas.openxmlformats.org/package/2006/relationships') throw Error('不支持的包关系命名空间。');
    const list = elements(children(root));
    if (list.some(n => /^[a-z][a-z0-9+.-]*:|^[/\\]{2}/i.test(attr(n,'Target').trim()))) throw Error('包关系包含外部地址。');
    if (list.some(n => name(n) !== 'Relationship' || attr(n,'TargetMode') && attr(n,'TargetMode') !== 'Internal')) throw Error('包关系包含外部目标或不支持的内容。');
    return list;
  }
  const types = parse(entries['[Content_Types].xml']).find(n => name(n) === 'Types');
  if (!types || attr(types,'xmlns') !== 'http://schemas.openxmlformats.org/package/2006/content-types' || !children(types).some(n => name(n) === 'Override' && attr(n,'PartName') === '/word/document.xml' && attr(n,'ContentType') === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) throw Error('包内容类型不是标准DOCX主文档。');
  const rootRels = relations(entries['_rels/.rels']).filter(n => attr(n,'Type') === R+'/officeDocument');
  if (rootRels.length !== 1 || !['word/document.xml','/word/document.xml'].includes(attr(rootRels[0],'Target')) || attr(rootRels[0],'TargetMode') && attr(rootRels[0],'TargetMode') !== 'Internal') throw Error('仅支持以word/document.xml为主文档的标准DOCX。');
  const tree = parse(entries['word/document.xml']), doc = tree.find(n => name(n) === 'w:document'), body = child(doc,'w:body');
  if (!doc || !body || attr(doc,'xmlns:w') !== W) throw Error('仅支持标准w前缀的OOXML Word正文。');
  const warnings = new Set<string>(['这是正文结构重排预览，不是Word原始分页或像素级版式还原；没有AI摘要。','所有正文文字均提取并显示，不应用隐藏文字或隐藏样式；请留意原件中的隐藏内容。','预览按文档明确声明的字体名尝试系统匹配，并嵌入授权回退字体；原字体未嵌入，替换字体可能改变字宽、换行和分页。','当前支持常见docDefaults、段落/字符basedOn、主题RGB颜色和部分显式字体属性；不等于完整OOXML级联，列表编号、表格样式、主题字体映射、边框和原生Word布局仍需对照原件。']);
  const forbidden = new Set(['w:ins','w:del','w:moveFrom','w:moveTo','w:altChunk','w:object','w:pict','w:txbxContent','w:fldSimple','w:fldChar','w:instrText','w:footnoteReference','w:endnoteReference','m:oMath','m:oMathPara','mc:AlternateContent','w:pPrChange','w:rPrChange','w:tblPrChange','w:trPrChange','w:tcPrChange','w:sectPrChange']);
  function inspect(nodes:XNode[],parent="") { for(const n of nodes) {
    if(name(n)==='#text' && String(n['#text']).trim() && !['w:t','wp:align','wp:posOffset'].includes(parent)) throw Error('正文含不能定位的非标准文字节点。');
    const namespaces:Record<string,string> = {w:W,r:R,a:'http://schemas.openxmlformats.org/drawingml/2006/main',pic:'http://schemas.openxmlformats.org/drawingml/2006/picture',wp:'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'};
    for(const [prefix,uri] of Object.entries(namespaces)) if(n[':@']?.['xmlns:'+prefix] !== undefined && attr(n,'xmlns:'+prefix) !== uri) throw Error('不支持重绑定标准OOXML命名空间。');
    if (forbidden.has(name(n))) throw Error(`不支持${name(n)}内容（修订、域、文本框、公式、脚注或嵌入对象），请先转为普通正文；未静默丢弃。`);
    if (name(n)==='wp:anchor') warnings.add('浮动图片预览仅按支持的左右对齐/环绕规则近似重排；不保证相对页、栏、字符的锚点坐标或与Word一致的避让布局。');
    if (name(n)==='a:srcRect' || name(n)==='a:xfrm') warnings.add('图片预览不还原裁剪或图形变换；图片包保留原始位图供核对。');
    inspect(children(n),name(n));
  } } inspect([doc]);
  if (Object.keys(entries).some(p=>/^word\/(header|footer|comments|footnotes|endnotes)\d*\.xml$/.test(p))) warnings.add('包内含页眉/页脚/批注/注释部件；只显示sectPr明确引用的静态页眉/页脚段落，不还原批注、自动页码或原生分页条件。');
  const relationships = new Map<string,XNode>();
  if (entries['word/_rels/document.xml.rels']) for (const n of relations(entries['word/_rels/document.xml.rels'])) {
    const id = attr(n,'Id'), mode = attr(n,'TargetMode');
    if (!id || relationships.has(id) || mode && mode !== 'Internal') throw Error('DOCX关系存在重复ID或外部目标。'); relationships.set(id,n);
  }
  const imagePaths = new Map<string,string>();
  for (const blip of descendants(children(body),'a:blip')) {
    if (attr(blip,'r:link')) throw Error('不支持外部链接图片。');
    const id = attr(blip,'r:embed'), relation = relationships.get(id), target = attr(relation,'Target');
    if (!id || !relation || attr(relation,'Type') !== R+'/image' || !/^media\/[^/\\:]+\.(png|jpe?g|webp)$/i.test(target) || target.includes('..') || !/^[^\x00-\x1f\x7f]+$/.test(target)) throw Error('图片引用缺失或不是支持的内嵌PNG/JPEG/WebP。');
    imagePaths.set(id,'word/'+target);
  }
  const paths = new Set(imagePaths.values()); if (paths.size > 12) throw Error('内嵌图片超过12张。');
  let expanded = 0;
  const media = unzipSync(input.bytes,{filter:entry=>{ if(!paths.has(entry.name))return false;expanded+=entry.originalSize;if(entry.originalSize>2000000||expanded>3000000)throw Error('内嵌图片每张≤2MB、总计≤3MB。');return true; }});
  const assets:Record<string,Uint8Array> = {}, imageRecords:ImageRecord[] = [], previews = new Map<string,Uint8Array>(), relationImages = new Map<string,string>(), pathIds = new Map<string,string>();
  for (const [rid,path] of imagePaths) {
    let id = pathIds.get(path);
    if (!id) {
      const bytes = media[path]; if (!bytes || bytes.length>2000000) throw Error('引用图片缺失或超出大小限制。');
      const checked = await imageInput(bytes);
      const preview = await sharp(checked.bytes).resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).png().toBuffer();
      if (preview.length>2000000) throw Error('图片预览超出2MB，请先简化图片。');
      const meta = await sharp(preview).metadata(); id = `image-${String(imageRecords.length+1).padStart(3,'0')}`;
      const format = bytes[0]===137?'png':bytes[0]===255?'jpg':'webp', originalFile = id+'.'+format;
      assets[originalFile]=bytes; previews.set(id,preview); pathIds.set(path,id);
      imageRecords.push({id,sourcePath:path,originalFile,sourceSHA256:sha(bytes),previewSHA256:sha(preview),previewWidth:meta.width!,previewHeight:meta.height!,sourceBytes:bytes.length});
    }
    relationImages.set(rid,id);
  }
  const styles = new Map<string,StyleInfo>();
  const themeColors=new Map<string,string>();
  const themeRelations=[...relationships.values()].filter(n=>attr(n,'Type')===R+'/theme');if(themeRelations.length>1)throw Error('DOCX包含多个主题关系，无法确定有效颜色方案。');const themeTarget=themeRelations.length?attr(themeRelations[0],'Target'):'';const themePath=themeTarget?(themeTarget.startsWith('/')?themeTarget.slice(1):themeTarget.startsWith('word/')?themeTarget:'word/'+themeTarget):'';if(themePath&&!/^word\/theme\/theme\d+\.xml$/i.test(themePath))throw Error('主题关系路径不受支持。');const themeBytes=themePath?entries[themePath]:undefined;
  const themeRoot=themeBytes?parse(themeBytes).find(n=>name(n)==='a:theme'):undefined;
  if(themeRoot){if(attr(themeRoot,'xmlns:a')!=='http://schemas.openxmlformats.org/drawingml/2006/main')throw Error('主题颜色的DrawingML命名空间不受支持。');inspect([themeRoot]);const scheme=child(themeRoot,'a:themeElements')&&child(child(themeRoot,'a:themeElements'),'a:clrScheme');for(const item of elements(children(scheme))){const clr=elements(children(item))[0],short=name(item).replace(/^a:/,''),hex=attr(clr,'val')||attr(clr,'lastClr');if(short&&/^[0-9a-f]{6}$/i.test(hex))themeColors.set(short,hex.toUpperCase());}}
  const themeAliases:Record<string,string>={light1:'lt1',dark1:'dk1',light2:'lt2',dark2:'dk2',text1:'dk1',background1:'lt1',text2:'dk2',background2:'lt2'};
  function resolveColor(node:XNode|undefined,themeKey:string,valueKey:string,tintKey:string,shadeKey:string){const theme=attr(node,themeKey).toLowerCase(),base=themeColors.get(themeAliases[theme]||theme);if(base){let channels=base.match(/.{2}/g)!.map(x=>parseInt(x,16));const shade=attr(node,shadeKey),tint=attr(node,tintKey);if(shade){if(!/^[0-9a-f]{2}$/i.test(shade))throw Error('OOXML主题阴影值无效。');const f=parseInt(shade,16)/255;channels=channels.map(c=>Math.round(c*f));}if(tint){if(!/^[0-9a-f]{2}$/i.test(tint))throw Error('OOXML主题色调值无效。');const f=parseInt(tint,16)/255;channels=channels.map(c=>Math.round(c+(255-c)*f));}return '#'+channels.map(c=>c.toString(16).padStart(2,'0')).join('').toUpperCase();}const fallback=attr(node,valueKey);return /^[0-9a-f]{6}$/i.test(fallback)?'#'+fallback.toUpperCase():undefined;}
  const safeFontFamily=(raw:string)=>/^[\p{L}\p{N} _.-]{1,64}$/u.test(raw)?raw:undefined;
  const parseRunStyle=(node:XNode|undefined):Partial<TextFormat>=>{const result:Partial<TextFormat>={};for(const [tag,key]of [['w:b','bold'],['w:i','italic'],['w:u','underline']] as const){const x=child(node,tag);if(x)result[key]=enabled(node,tag);}const colorNode=child(node,'w:color'),color=resolveColor(colorNode,'w:themeColor','w:val','w:themeTint','w:themeShade');if(color)result.color=color;const size=value(node,'w:sz');if(size)result.fontSizePx=Math.round(Number(integer(size,2,200))*2/3*100)/100;const fonts=child(node,'w:rFonts'),rawFont=attr(fonts,'w:eastAsia')||attr(fonts,'w:hAnsi')||attr(fonts,'w:ascii')||attr(fonts,'w:cs'),font=safeFontFamily(rawFont);if(font)result.fontFamily=font;else if(rawFont)warnings.add('包含无法安全应用的字体名称，预览改用内嵌字体回退。');return result;};
  const defaultsRoot=entries['word/styles.xml']?parse(entries['word/styles.xml']).find(n=>name(n)==='w:styles'):undefined;
  const docDefaults=child(defaultsRoot,'w:docDefaults'),defaultRun=parseRunStyle(child(child(docDefaults,'w:rPrDefault'),'w:rPr'));
  const parseStyle=(id:string,n:XNode,pOverride?:XNode,rOverride?:XNode):StyleInfo=>{const p=child(n,'w:pPr')||pOverride,r=child(n,'w:rPr')||rOverride,indent=child(p,'w:ind'),spacing=child(p,'w:spacing'),outline=value(p,'w:outlineLvl'),align=value(p,'w:jc'),lineRaw=attr(spacing,'w:line'),lineRule=attr(spacing,'w:lineRule');const indentPx:Record<string,number>={},spacingPx:Record<string,number>={};for(const [k,v]of [['left','w:left'],['right','w:right'],['firstLine','w:firstLine'],['hanging','w:hanging']] as const){const x=twipsPx(indent,v);if(x!==undefined)indentPx[k]=x;}for(const [k,v]of [['before','w:before'],['after','w:after']] as const){const x=twipsPx(spacing,v);if(x!==undefined)spacingPx[k]=x;}if(lineRaw){if(!/^\d+$/.test(lineRaw)||Number(lineRaw)>14400)throw Error('样式行距超出支持范围。');spacingPx.lineHeight=!lineRule||lineRule==='auto'?Math.min(4,Math.max(.5,Number(lineRaw)/240)):twipsPx(spacing,'w:line')!;}return {basedOn:value(n,'w:basedOn'),styleType:attr(n,'w:type')||'docDefaults',builtinHeading:attr(n,'w:type')==='paragraph'&&!['1','true','on'].includes(attr(n,'w:customStyle'))?Number(/^Heading([1-9])$/.exec(id)?.[1]||0):0,...(outline?{outline:integer(outline,0,9)}:{}),...(['left','right','center','both'].includes(align)?{alignment:align}:{}),...(Object.keys(indentPx).length?{indentPx}:{}),...(Object.keys(spacingPx).length?{spacingPx}:{}),...(child(p,'w:keepNext')?{keepNext:enabled(p,'w:keepNext')}:{}),run:parseRunStyle(r)};};
  const defaultParagraphStyle=parseStyle('docDefaults',{},child(child(docDefaults,'w:pPrDefault'),'w:pPr'),child(child(docDefaults,'w:rPrDefault'),'w:rPr'));
  if(defaultsRoot) for(const n of descendants(children(defaultsRoot),'w:style')){const id=attr(n,'w:styleId');if(!id||styles.has(id))throw Error('样式ID缺失或重复。');styles.set(id,parseStyle(id,n));}
  function styleChain(style:string,seen=new Set<string>()):StyleInfo[]{if(!style)return[defaultParagraphStyle];if(seen.has(style)||seen.size>64)throw Error('样式继承循环或超过64层。');seen.add(style);const s=styles.get(style);if(!s||s.styleType!=='paragraph'){warnings.add('有未解析或类型不兼容的段落样式，直接格式仍可读取。');return[defaultParagraphStyle];}return[...styleChain(s.basedOn,seen),s];}
  function characterStyleChain(style:string,seen=new Set<string>()):StyleInfo[]{if(!style)return[];if(seen.has(style)||seen.size>64)throw Error('字符样式继承循环或超过64层。');seen.add(style);const s=styles.get(style);if(!s||s.styleType!=='character'){warnings.add('有未解析或类型不兼容的字符样式，直接格式仍可读取。');return[];}return[...characterStyleChain(s.basedOn,seen),s];}
  function heading(style:string,seen=new Set<string>()):number {const chain=styleChain(style,seen);for(let i=chain.length-1;i>=0;i--){if(chain[i].outline!==undefined)return chain[i].outline===9?0:chain[i].outline!+1;if(chain[i].builtinHeading)return chain[i].builtinHeading;}if(chain.some(s=>s.builtinHeading))warnings.add('部分标题层级来自继承样式，须对照原件核对。');return 0;}

  let paragraphCount=0,tableCount=0,cellCount=0,chars=0,previewBytes=0,placements=0;
  const ignore = new Set(['w:bookmarkStart','w:bookmarkEnd','w:proofErr','w:commentRangeStart','w:commentRangeEnd','w:commentReference','w:lastRenderedPageBreak','w:permStart','w:permEnd']);
  function paragraph(node:XNode,path:string):Paragraph {
    if(++paragraphCount>2000)throw Error('正文段落超过2000个。');
    const props=child(node,'w:pPr'), styleId=value(props,'w:pStyle'), outline=value(props,'w:outlineLvl'), level=outline?integer(outline,0,9):undefined;
    const numPr=child(props,'w:numPr'),align=value(props,'w:jc'); const runs:Inline[]=[];const inherited=styleChain(styleId);const runBase:TextFormat={bold:false,italic:false,underline:false,...defaultRun};for(const st of inherited)Object.assign(runBase,st.run);
    if(numPr)warnings.add('包含列表编号，保留numId/层级但不计算自动编号，预览仅显示列表标记。');
    function inline(nodes:XNode[],format:TextFormat=runBase) {
      for(const n of elements(nodes)) {
        const tag=name(n);
        if(tag==='w:r') { const pr=child(n,'w:rPr'),next={...format};for(const st of characterStyleChain(value(pr,'w:rStyle')))Object.assign(next,st.run);for(const [tag,key]of [['w:b','bold'],['w:i','italic'],['w:u','underline']] as const)if(child(pr,tag))next[key]=enabled(pr,tag);const color=resolveColor(child(pr,'w:color'),'w:themeColor','w:val','w:themeTint','w:themeShade');if(color)next.color=color;const fonts=child(pr,'w:rFonts'),rawFont=attr(fonts,'w:eastAsia')||attr(fonts,'w:hAnsi')||attr(fonts,'w:ascii')||attr(fonts,'w:cs'),font=safeFontFamily(rawFont);if(font)next.fontFamily=font;const size=value(pr,'w:sz');if(size)next.fontSizePx=Math.round(Number(integer(size,2,200))*2/3*100)/100;inline(children(n),next); }
        else if(tag==='w:t') {if(children(n).some(v=>name(v)!=='#text'))throw Error('文字节点包含非文本内容。');const t=children(n).map(v=>name(v)==='#text'?decode(v['#text']):'').join('');chars+=t.length;if(chars>60000)throw Error('正文文字超过60000字。');runs.push({type:'text',text:t,...format});}
        else if(tag==='w:tab')runs.push({type:'tab'});
        else if(tag==='w:br'||tag==='w:cr')runs.push({type:'break',kind:attr(n,'w:type')||'line'});
        else if(tag==='w:drawing') {
          const graphics=descendants(children(n),'a:graphicData');if(graphics.length!==1||attr(graphics[0],'uri')!=='http://schemas.openxmlformats.org/drawingml/2006/picture'||elements(children(graphics[0])).length!==1||!child(graphics[0],'pic:pic'))throw Error('不支持非图片绘图或组合形状。');
          const blips=descendants(children(n),'a:blip');if(blips.length!==1)throw Error('绘图不是单一受支持的内嵌位图；不静默省略图表或形状。');
          const imageId=relationImages.get(attr(blips[0],'r:embed'));if(!imageId)throw Error('图片引用没有可用位图。');
          previewBytes+=previews.get(imageId)!.length;if(++placements>30||previewBytes>2000000)throw Error('图片位置超过30处或预览图片累计超过2MB。');
          const extent=descendants(children(n),'wp:extent')[0],width=Number(attr(extent,'cx'))/9525,anchor=descendants(children(n),'wp:anchor')[0];
          if(anchor){const horizontal=child(anchor,'wp:positionH'),vertical=child(anchor,'wp:positionV'),readText=(node:XNode|undefined)=>children(node).filter(x=>name(x)==='#text').map(x=>decode(String(x['#text']||''))).join('').trim(),hAlign=readText(child(horizontal,'wp:align')),vAlign=readText(child(vertical,'wp:align')),hRaw=readText(child(horizontal,'wp:posOffset')),vRaw=readText(child(vertical,'wp:posOffset')),coordinate=(raw:string)=>{if(!raw)return undefined;if(!/^-?\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Math.abs(Number(raw))>1000000000)throw Error('浮动图片锚点坐标超出支持范围。');return Number(raw);},relativeH=attr(horizontal,'relativeFrom'),relativeV=attr(vertical,'relativeFrom');if(relativeH&&!['page','margin','column','character','leftMargin','rightMargin','insideMargin','outsideMargin'].includes(relativeH)||relativeV&&!['page','margin','paragraph','line','topMargin','bottomMargin','insideMargin','outsideMargin'].includes(relativeV))throw Error('浮动图片锚点参照系不受支持。');const hOffset=coordinate(hRaw),vOffset=coordinate(vRaw),simple=child(anchor,'wp:simplePos'),simpleX=coordinate(attr(simple,'x')),simpleY=coordinate(attr(simple,'y')),zRaw=attr(anchor,'relativeHeight'),relativeHeight=zRaw?integer(zRaw,0,4294967295):undefined,side=['left','right'].includes(hAlign)?hAlign as 'left'|'right':undefined;const wrap=children(anchor).find(x=>['wp:wrapSquare','wp:wrapTight','wp:wrapThrough','wp:wrapTopAndBottom','wp:wrapNone'].includes(name(x)));const wrapMode=name(wrap||{})==='wp:wrapTopAndBottom'?'topAndBottom':name(wrap||{})==='wp:wrapNone'?'none':name(wrap||{})==='wp:wrapTight'||name(wrap||{})==='wp:wrapThrough'?'tight':'square';if(!side&&wrapMode!=='topAndBottom')warnings.add('浮动图片无左右对齐信息，预览按行内显示，未猜测页面坐标。');if(wrapMode==='none')warnings.add('不环绕浮动图片不能用文档流准确叠放，预览保留为行内内容并记录定位元数据。');const distance=(key:string)=>{const n=Number(attr(anchor,key))/9525;return Number.isFinite(n)&&n>=0&&n<=500?Math.round(n*100)/100:undefined;};const anchorPosition={horizontalRelativeFrom:relativeH||'unknown',verticalRelativeFrom:relativeV||'unknown',...(hAlign?{horizontalAlign:hAlign}:{}),...(vAlign?{verticalAlign:vAlign}:{}),...(hOffset!==undefined?{horizontalOffsetEmu:hOffset}:{}),...(vOffset!==undefined?{verticalOffsetEmu:vOffset}:{}),...(simpleX!==undefined?{simpleXEmu:simpleX}:{}),...(simpleY!==undefined?{simpleYEmu:simpleY}:{}),...(relativeHeight!==undefined?{relativeHeight}: {})};runs.push({type:'image',imageId,...(Number.isFinite(width)&&width>0?{width:Math.min(1600,width)}:{}),...(side?{floatSide:side}:{}),wrapMode,anchorPosition,...(distance('distL')!==undefined?{marginLeftPx:distance('distL')}:{}),...(distance('distR')!==undefined?{marginRightPx:distance('distR')}: {})});}
          else runs.push({type:'image',imageId,...(Number.isFinite(width)&&width>0?{width:Math.min(1600,width)}:{})});
        } else if(tag==='w:hyperlink')inline(children(n),format);
        else if(tag==='w:sdt') {const content=child(n,'w:sdtContent');if(!content)throw Error('内容控件缺少正文。');inline(children(content),format);}
        else if(tag==='w:pPr'||tag==='w:rPr'||ignore.has(tag))continue;
        else throw Error(`不支持正文行内元素${tag}，请先转换为普通文字或图片。`);
      }
    } inline(children(node));
    const ind=child(props,'w:ind'),space=child(props,'w:spacing'),lineRaw=attr(space,'w:line'),lineRule=attr(space,'w:lineRule');let lineHeight:number|undefined;if(lineRaw){if(!/^\d+$/.test(lineRaw)||Number(lineRaw)>14400)throw Error('段落行距超出支持范围。');const n=Number(lineRaw);lineHeight=!lineRule||lineRule==='auto'?Math.min(4,Math.max(.5,n/240)):twipsPx(space,'w:line');}const inheritedIndent:Record<string,number>={},inheritedSpacing:Record<string,number>={};for(const st of inherited){Object.assign(inheritedIndent,st.indentPx||{});Object.assign(inheritedSpacing,st.spacingPx||{});}for(const [k,v]of [['left','w:left'],['right','w:right'],['firstLine','w:firstLine'],['hanging','w:hanging']] as const){const x=twipsPx(ind,v);if(x!==undefined)inheritedIndent[k]=x;}for(const [k,v]of [['before','w:before'],['after','w:after']] as const){const x=twipsPx(space,v);if(x!==undefined)inheritedSpacing[k]=x;}if(lineHeight!==undefined)inheritedSpacing.lineHeight=lineHeight;let keep=inherited.reduce<boolean|undefined>((acc,st)=>st.keepNext===undefined?acc:st.keepNext,undefined);if(child(props,'w:keepNext'))keep=enabled(props,'w:keepNext');const directAlign=['left','right','center','both'].includes(align)?align:undefined;let effectiveAlign=directAlign||inherited.reduce<string|undefined>((acc,st)=>st.alignment||acc,undefined)||'left';
    const result:Paragraph={type:'paragraph',id:'p'+paragraphCount,sourcePath:path,sectionIndex:0,styleId,heading:level===undefined?heading(styleId):level===9?0:level+1,alignment:effectiveAlign,indentPx:inheritedIndent as Paragraph['indentPx'],spacingPx:inheritedSpacing as Paragraph['spacingPx'],keepNext:keep||false,pageBreakBefore:enabled(props,'w:pageBreakBefore'),runs,text:runs.map(r=>r.type==='text'?r.text:r.type==='image'?`[图片 ${r.imageId}]`:r.type==='tab'?'\t':'\n').join('')};
    if(numPr)result.list={numId:value(numPr,'w:numId'),level:integer(value(numPr,'w:ilvl'),0,8,0)};
    return result;
  }
  function table(node:XNode,path:string):Table {
    if(++tableCount>30)throw Error('正文表格超过30个。');
    const grid=elements(children(child(node,'w:tblGrid'))).filter(n=>name(n)==='w:gridCol');const columnWidthsTwips=grid.map(n=>integer(attr(n,'w:w'),1,14400));const cols=columnWidthsTwips.length;
    if(cols<1||cols>30)throw Error('表格必须声明1至30列网格。');
    const rows=elements(children(node)).filter(n=>name(n)==='w:tr');if(!rows.length||rows.length>500)throw Error('表格需有1至500行。');
    for(const n of elements(children(node)))if(!['w:tblPr','w:tblGrid','w:tr'].includes(name(n)))throw Error('不支持表格容器或行级内容控件。');
    const result:Table={type:'table',id:'table'+tableCount,sourcePath:path,sectionIndex:0,columns:cols,columnWidthsTwips,rows:[]};let previous=new Map<number,Cell>();
    rows.forEach((row,r)=>{
      const pr=child(row,'w:trPr');if(child(pr,'w:gridBefore')||child(pr,'w:gridAfter'))throw Error('不支持省略首尾网格的表格行。');
      let col=0;const active=new Map<number,Cell>(),cells:Cell[]=[];
      for(const n of elements(children(row))) {
        if(name(n)==='w:trPr')continue;if(name(n)!=='w:tc')throw Error('不支持非普通表格单元格。');
        if(++cellCount>10000)throw Error('表格单元格超过10000个。');
        const cp=child(n,'w:tcPr'),span=integer(value(cp,'w:gridSpan'),1,30,1),merge=child(cp,'w:vMerge');
        if(child(cp,'w:hMerge'))throw Error('请将旧式横向合并转换为gridSpan后重试。');
        if(col+span>cols)throw Error('表格跨列越界。');
        const sourcePath=`${path}/row[${r+1}]/column[${col+1}]`,paragraphs:Paragraph[]=[];const shade=child(cp,'w:shd'),rawFill=attr(shade,'w:fill'),resolvedFill=resolveColor(shade,'w:themeFill','w:fill','w:themeFillTint','w:themeFillShade'),fill=rawFill.toLowerCase()==='auto'&&!attr(shade,'w:themeFill')?'':resolvedFill?.slice(1)||'';if(rawFill&&rawFill.toLowerCase()!=='auto'&&!/^[0-9a-f]{6}$/i.test(rawFill)&&!attr(shade,'w:themeFill'))throw Error('表格底纹不是明确的RGB或受支持主题颜色。');const valign=value(cp,'w:vAlign');if(valign&&!['top','center','bottom'].includes(valign))throw Error('表格单元格垂直对齐方式不受支持。');
        for(const [i,item]of elements(children(n)).entries()) {if(name(item)==='w:tcPr')continue;if(name(item)!=='w:p')throw Error('不支持嵌套表格或单元格内容控件。');paragraphs.push(paragraph(item,sourcePath+`/p[${i+1}]`));}
        if(merge && value(cp,'w:vMerge')!=='restart') {
          if(value(cp,'w:vMerge') && value(cp,'w:vMerge')!=='continue')throw Error('未知纵向合并类型。');
          const origin=previous.get(col);if(!origin||origin.colSpan!==span||paragraphs.some(p=>p.text.trim()||p.runs.some(r=>r.type==='image')))throw Error('纵向合并缺少起点、宽度不一致或续行含内容，不能可靠还原。');
          origin.rowSpan++;origin.sourcePaths.push(sourcePath);origin.continuations.push({sourcePath,paragraphs});active.set(col,origin);
        } else {const cell:Cell={column:col+1,colSpan:span,rowSpan:1,verticalAlign:(valign||'top') as Cell['verticalAlign'],...(fill?{background:'#'+fill.toUpperCase()}:{}),sourcePaths:[sourcePath],paragraphs,continuations:[]};cells.push(cell);if(merge)active.set(col,cell);}
        col+=span;
      }
      if(col!==cols)throw Error('表格行未完整覆盖声明网格。');result.rows.push({sourceRow:r+1,cells});previous=active;
    });return result;
  }
  const blocks:(Paragraph|Table)[]=[], sections:PageSection[]=[];let currentSection=0;
  const makeSection=(index:number,path:string):PageSection=>sections[index]||{index,sourcePath:path,pageSizeTwips:{width:12240,height:15840,orientation:'portrait'},marginsTwips:{top:1440,right:1440,bottom:1440,left:1440,header:720,footer:720,gutter:0},columns:{count:1,gapTwips:720,separator:false},headerRefs:[],footerRefs:[],headers:[],footers:[]};
  function section(n:XNode,path:string,index=currentSection){const size=child(n,'w:pgSz'),mar=child(n,'w:pgMar'),cols=child(n,'w:cols'),count=integer(attr(cols,'w:num'),1,4,1),rawWidth=attr(size,'w:w'),rawHeight=attr(size,'w:h');if(!rawWidth||!rawHeight)warnings.add('缺少显式纸张尺寸，预览使用默认Letter画布。');const width=integer(rawWidth||'12240',1000,31680),height=integer(rawHeight||'15840',1000,31680),orientation=attr(size,'w:orient')||'portrait';if(!['portrait','landscape'].includes(orientation))throw Error('不支持的页面方向。');if((orientation==='landscape'&&width<height)||(orientation==='portrait'&&width>height))warnings.add('页面方向标记与纸张宽高不一致，按声明的宽高渲染。');const margin=(key:string,fallback:number)=>integer(attr(mar,'w:'+key)||String(fallback),0,14400);const item=makeSection(index,path);item.sourcePath=path;item.pageSizeTwips={width,height,orientation};item.marginsTwips={top:margin('top',1440),right:margin('right',1440),bottom:margin('bottom',1440),left:margin('left',1440),header:margin('header',720),footer:margin('footer',720),gutter:margin('gutter',0)};item.columns={count,gapTwips:integer(attr(cols,'w:space')||'720',0,7200),separator:['1','true','on'].includes(attr(cols,'w:sep').toLowerCase())};item.headerRefs=elements(children(n)).filter(x=>name(x)==='w:headerReference').map(x=>({id:attr(x,'r:id'),type:attr(x,'w:type')||'default'}));item.footerRefs=elements(children(n)).filter(x=>name(x)==='w:footerReference').map(x=>({id:attr(x,'r:id'),type:attr(x,'w:type')||'default'}));sections[index]=item;}
  function resolveSectionParts() {for(const s of sections){for(const [kind,refs] of [['header',s.headerRefs],['footer',s.footerRefs]] as const)for(const ref of refs){const rel=relationships.get(ref.id),expected=R+'/'+kind,target=attr(rel,'Target'),part=target.replace(/^\/?word\//,'');if(!rel||attr(rel,'Type')!==expected||attr(rel,'TargetMode')&&attr(rel,'TargetMode')!=='Internal'||!new RegExp('^'+kind+'\\d+\\.xml$','i').test(part)||target.includes('..'))throw Error(`${kind==='header'?'页眉':'页脚'}引用无效或指向外部内容。`);const path='word/'+part,bytes=entries[path];if(!bytes)throw Error(`${kind==='header'?'页眉':'页脚'}部件缺失。`);const root=parse(bytes).find(n=>name(n)===(kind==='header'?'w:hdr':'w:ftr'));if(!root||attr(root,'xmlns:w')!==W)throw Error(`不支持的${kind==='header'?'页眉':'页脚'}XML。`);inspect([root]);const paras=elements(children(root));if(paras.some(p=>name(p)!=='w:p'))throw Error(`仅支持静态段落型${kind==='header'?'页眉':'页脚'}；表格或绘图内容需先转换。`);const rendered=paras.map((p,i)=>paragraph(p,`${path}/p[${i+1}]`));if(kind==='header')s.headers.push(...rendered);else s.footers.push(...rendered);}}
    if(sections.some(s=>s.headerRefs.length||s.footerRefs.length))warnings.add('已显示引用到的静态页眉/页脚段落；first/even/default应用条件、自动页码和字段动态计算不等同于Word原生分页。');}
  function blocksFrom(nodes:XNode[],path:string) { for(const [i,n]of elements(nodes).entries()) {
    const loc=path+'/'+(i+1)+':'+name(n);
    if(name(n)==='w:p'){const p=paragraph(n,loc);p.sectionIndex=currentSection;blocks.push(p);for(const s of descendants(children(n),'w:sectPr')){section(s,loc,currentSection);currentSection++;}}
    else if(name(n)==='w:tbl'){const t=table(n,loc);t.sectionIndex=currentSection;blocks.push(t);}
    else if(name(n)==='w:sectPr')section(n,loc,currentSection);
    else if(name(n)==='w:sdt'){const content=child(n,'w:sdtContent');if(!content)throw Error('内容控件无正文。');blocksFrom(children(content),loc+'/content');}
    else if(!ignore.has(name(n)))throw Error(`不支持正文块${name(n)}，没有静默丢弃。`);
  } } blocksFrom(children(body),'word/document.xml/body');resolveSectionParts();if(!sections.length)sections[0]=makeSection(0,'default');while(sections.length<=currentSection)sections.push(makeSection(sections.length,'default'));
  if(!blocks.length||!chars&&!placements&&!tableCount)throw Error('正文没有可提取的文字或图片。');
  function renderParagraph(p:Paragraph){const tag=p.heading?'h'+Math.min(6,p.heading):'p';const css=[`text-align:${p.alignment==='both'?'justify':p.alignment}`,...(p.indentPx.left!==undefined?[`margin-left:${p.indentPx.left}px`]:[]),...(p.indentPx.right!==undefined?[`margin-right:${p.indentPx.right}px`]:[]),...(p.indentPx.firstLine!==undefined?[`text-indent:${p.indentPx.firstLine}px`]:p.indentPx.hanging!==undefined?[`text-indent:-${p.indentPx.hanging}px`,`padding-left:${p.indentPx.hanging}px`]:[]),...(p.spacingPx.before!==undefined?[`margin-top:${p.spacingPx.before}px`]:[]),...(p.spacingPx.after!==undefined?[`margin-bottom:${p.spacingPx.after}px`]:[]),...(p.spacingPx.lineHeight!==undefined?[`line-height:${p.spacingPx.lineHeight}${p.spacingPx.lineHeight<5?'':'px'}`]:[]),...(p.keepNext?['break-after:avoid-page']:[]),...(p.pageBreakBefore?['break-before:page']:[])].join(';');return `<${tag} data-source="${xml(p.sourcePath)}" style="${css}">${p.list?'<span class="marker">[列表标记]</span> ':''}${p.pageBreakBefore?'<span class="marker">[显式分页标记]</span> ':''}${p.runs.map(r=>{
    if(r.type==='tab')return '&#9;';if(r.type==='break')return `<br>${r.kind==='page'||r.kind==='column'?'<span class="marker">[显式'+(r.kind==='page'?'分页':'分栏')+'标记]</span>':''}`;
    if(r.type==='image'){const css=[...(r.width?[`width:${r.width}px`]:[]),...(r.floatSide?[`float:${r.floatSide}`]:[]),...(r.wrapMode==='topAndBottom'?['display:block','clear:both']:[]),...(r.marginLeftPx!==undefined?[`margin-left:${r.marginLeftPx}px`]:[]),...(r.marginRightPx!==undefined?[`margin-right:${r.marginRightPx}px`]:[])].join(';');return `<img alt="${r.imageId}" data-wrap="${r.wrapMode||'inline'}"${r.floatSide?` data-float="${r.floatSide}"`:''} src="data:image/png;base64,${Buffer.from(previews.get(r.imageId)!).toString('base64')}"${css?` style="${css}"`:''}>`;}
    let v=xml(r.text);if(r.bold)v='<strong>'+v+'</strong>';if(r.italic)v='<em>'+v+'</em>';if(r.underline)v='<u>'+v+'</u>';if(r.color||r.fontSizePx||r.fontFamily)v=`<span style=\"${r.color?`color:${r.color};`:''}${r.fontSizePx?`font-size:${r.fontSizePx}px;`:''}${r.fontFamily?`font-family:&quot;${xml(r.fontFamily)}&quot;`:''}\">${v}</span>`;return v;
  }).join('')}</${tag}>`;}
  // Embed only the licensed local font subsets needed by the preview; never fetch fonts.
  const previewFonts=new Map<string,Uint8Array>(), unsupportedGlyphs:string[]=[];let fontBytes=0;
  const characters=new Set(JSON.stringify({blocks,sections})+[...warnings].join('')+'DOCX正文结构预览结构重排，不是Word渲染截图或原始分页还原。列表标记显式分页分栏图片');
  if(characters.size>4000)throw Error('预览不同字符超过4000，请拆分文档。');
  for(const character of characters) {
    if(!character.trim())continue;
    try {const f=await fontFor(character);if(!previewFonts.has(f.file)){fontBytes+=f.bytes.length;if(fontBytes>3000000)throw Error('预览字体超过3MB，请拆分文档。');previewFonts.set(f.file,f.bytes);}}
    catch(error){if(error instanceof Error && error.message.startsWith('字体不支持字符'))unsupportedGlyphs.push('U+'+character.codePointAt(0)!.toString(16).toUpperCase());else throw error;}
  }
  const fontCss=[...previewFonts.values()].map((bytes,i)=>`@font-face{font-family:DP${i};src:url(data:font/woff2;base64,${Buffer.from(bytes).toString('base64')}) format('woff2');font-display:swap}`).join('');
  const fontFamily=[...previewFonts.keys()].map((_,i)=>`DP${i}`).concat('sans-serif').join(',');
  const license=await fontLicense();
  const sectionCss=sections.map(s=>{const w=s.pageSizeTwips.width/15,h=s.pageSizeTwips.height/15,m=s.marginsTwips,cols=s.columns;return `@page page${s.index}{size:${w}px ${h}px;margin:0}.word-section[data-index="${s.index}"]{page:page${s.index};width:min(100%,${w}px);min-height:${h}px;padding:${m.top/15}px ${m.right/15}px ${m.bottom/15}px ${m.left/15+m.gutter/15}px;--word-columns:${cols.count};--word-column-gap:${cols.gapTwips/15}px;--word-column-rule:${cols.separator?'1px solid #9ba8a2':'none'}}`}).join('');
  const renderBlock=(b:Paragraph|Table)=>b.type==='paragraph'?renderParagraph(b):`<div class="table-wrap"><table aria-label="${b.id}" style="min-width:${Math.max(b.columns*80,b.columnWidthsTwips.reduce((n,w)=>n+w,0)/15)}px"><colgroup>${b.columnWidthsTwips.map(w=>`<col style="width:${w/15}px">`).join('')}</colgroup>${b.rows.map(r=>'<tr>'+r.cells.map(c=>`<td rowspan="${c.rowSpan}" colspan="${c.colSpan}" style="vertical-align:${c.verticalAlign==='center'?'middle':c.verticalAlign}${c.background?`;background-color:${c.background}`:''}">${c.paragraphs.map(renderParagraph).join('')}</td>`).join('')+'</tr>').join('')}</table></div>`;
  const sectionsHtml=sections.map(s=>{const bodyBlocks=blocks.filter(b=>b.sectionIndex===s.index),header=s.headers.length?`<header class="word-header" data-variants="${xml(s.headerRefs.map(r=>r.type).join(','))}">${s.headers.map(renderParagraph).join('')}</header>`:'',footer=s.footers.length?`<footer class="word-footer" data-variants="${xml(s.footerRefs.map(r=>r.type).join(','))}">${s.footers.map(renderParagraph).join('')}</footer>`:'',columns=s.columns.count>1?`style="column-count:${s.columns.count};column-gap:${s.columns.gapTwips/15}px;column-rule:${s.columns.separator?'1px solid #9ba8a2':'none'}"`:'';return `<section class="word-section" data-index="${s.index}" data-source="${xml(s.sourcePath)}" data-page-size-twips="${s.pageSizeTwips.width}x${s.pageSizeTwips.height}" data-orientation="${s.pageSizeTwips.orientation}">${header}<div class="word-columns" ${columns}>${bodyBlocks.map(renderBlock).join('')}</div>${footer}</section>`}).join('');
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>DOCX正文结构预览</title><style>'+fontCss+sectionCss+'body{font:16px/1.7 '+fontFamily+';color:#273c38;background:#e8ebe8;margin:auto;padding:24px;overflow-wrap:anywhere}.word-section{box-sizing:border-box;background:#fff;margin:24px auto;box-shadow:0 2px 14px #0002;overflow:visible}.word-columns{column-count:var(--word-columns,1);column-gap:var(--word-column-gap,48px);column-rule:var(--word-column-rule,none)}.word-header,.word-footer{font-size:.85em;color:#536762}.word-header{margin-bottom:12px}.word-footer{margin-top:12px}p{white-space:pre-wrap}img{max-width:100%;height:auto;vertical-align:middle}.table-wrap{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%;table-layout:fixed}td{border:1px solid #aebcb5;padding:8px;vertical-align:top;overflow-wrap:anywhere}td p{margin:0}.marker,aside{color:#795f31;font-size:13px}aside{background:#fff8e8;padding:16px;margin:16px auto;max-width:1000px}h1{font-size:26px}@media print{body{background:white;padding:0}.word-section{margin:0;box-shadow:none;break-after:page}.word-section:last-of-type{break-after:auto}}</style></head><body><h1>DOCX正文结构预览</h1><aside>按OOXML直接页面设置重排，可显示受限段落/表格格式、静态页眉页脚和等宽多栏；仍不是Word原生分页或像素级渲染。请核对原件。<ul>'+[...warnings].map(w=>'<li>'+xml(w)+'</li>').join('')+'</ul></aside>'+sectionsHtml+'<details><summary>内嵌字体许可</summary><pre style="white-space:pre-wrap">'+xml(license.toString('utf8'))+'</pre></details></body></html>'
  const report={sourceSHA256:sha(input.bytes),sourcePart:'word/document.xml',paragraphCount,tableCount,imageCount:imageRecords.length,imagePlacements:placements,blocks,sections,images:imageRecords,warnings:[...warnings],previewFonts:[...previewFonts].map(([file,bytes])=>({file,sha256:sha(bytes)})),unsupportedGlyphs,requiresReview:true,wordRenderVerified:false,layoutMethod:'Bounded OOXML-to-HTML reconstruction. Page dimensions/margins, equal-width columns, static referenced headers/footers, selected paragraph/table direct formatting and square/top-bottom floating-image wrap are applied in preview CSS; native Word pagination/render fidelity is not verified.',requiresNativeRenderReview:true};
  const outputs:Output[]=[json('document-structure.json',report),out('document-preview.html','text/html; charset=utf-8',html),out('document-content.txt','text/plain; charset=utf-8',blocks.map(b=>b.type==='paragraph'?b.text:`【${b.id}】\n`+b.rows.map(r=>r.cells.map(c=>`[第${c.column}列;跨度${c.rowSpan}行/${c.colSpan}列] `+c.paragraphs.map(p=>p.text).join('\n')).join('\t')).join('\n')).join('\n\n'))];
  outputs.push(out('font-license.txt','text/plain; charset=utf-8',license));
  if(tableCount){const book=new ExcelJS.Workbook();for(const b of blocks)if(b.type==='table'){const s=book.addWorksheet(b.id);for(const r of b.rows)for(const c of r.cells){s.getCell(r.sourceRow,c.column).value=c.paragraphs.map(p=>p.text).join('\n');if(c.rowSpan>1||c.colSpan>1)s.mergeCells(r.sourceRow,c.column,r.sourceRow+c.rowSpan-1,c.column+c.colSpan-1);}s.columns.forEach(c=>c.width=24);s.eachRow(r=>r.alignment={vertical:'top',wrapText:true});}outputs.push(out('document-tables.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',new Uint8Array(await book.xlsx.writeBuffer())));}
  if(imageRecords.length){assets['image-manifest.json']=json('image-manifest.json',imageRecords).bytes;outputs.push(out('document-images.zip','application/zip',zipSync(assets)));}
  event(`实际提取${paragraphCount}个段落、${tableCount}张表、${imageRecords.length}张内嵌位图；合并网格已校验，预览仅结构重排。`);
  return {summary:`实际提取正文${paragraphCount}个段落、${tableCount}张表、${imageRecords.length}张图片，交付结构JSON、可核对预览${tableCount?'、表格XLSX':''}${imageRecords.length?'和原始位图包':''}。未执行AI摘要或Word真实渲染，需对照原件核验。`,outputs};
}
