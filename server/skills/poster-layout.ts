import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { validatePosterLayout, assetBytes, type PosterLayer } from '../../shared/posterLayout';
import { fontFor, fontLicense } from './fonts';
import { imageInput } from './images';
import { out, json, text, xml } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput } from './executors';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export function readPosterLayout(bytes:Uint8Array){let value:unknown;try{value=JSON.parse(text(bytes));}catch{throw Error('画布输入必须是有效UTF-8 JSON。');}return validatePosterLayout(value);}
async function outlinedText(layer:Extract<PosterLayer,{type:'text'}>,fonts:Map<string,string>){
 const paths:string[]=[],lines=[];let line=0,at=layer.x+8;const top=layer.y;
 for(const content of layer.text.split('\n')){
  const baseline=top+8+layer.fontSize*1.1+line*layer.fontSize*1.4;at=layer.x+8;
  if(baseline>top+layer.height-4)throw Error(`图层“${layer.name}”文字行超出高度；请扩大字框、减小字号或减少换行。`);
  for(const c of content){
   const {font,bytes,file}=await fontFor(c);if(!fonts.has(file))fonts.set(file,hash(bytes));
   const glyph=font.glyphForCodePoint(c.codePointAt(0)!),scale=layer.fontSize/font.unitsPerEm,advance=glyph.advanceWidth*scale;
   if(at+advance>layer.x+layer.width-8+.001)throw Error(`图层“${layer.name}”文字超出宽度；请手动换行、扩大字框或减小字号，不会静默裁字。`);
   if(c.trim()){
    const b=glyph.bbox,bounds={left:at+b.minX*scale,right:at+b.maxX*scale,top:baseline-b.maxY*scale,bottom:baseline-b.minY*scale};
    if(bounds.left<layer.x-.001||bounds.right>layer.x+layer.width+.001||bounds.top<layer.y-.001||bounds.bottom>layer.y+layer.height+.001)throw Error(`图层“${layer.name}”实际字形超出字框。`);
    paths.push(`<path d="${glyph.path.toSVG()}" transform="translate(${at} ${baseline}) scale(${scale} ${-scale})" fill="${layer.color}"/>`);
   }
   at+=advance;
  }
  lines.push({text:content,baseline,width:at-layer.x-8});line++;
 }
 return {svg:paths.join(''),lines};
}
export async function posterLayout(input:SkillInput,event:(s:string)=>void){
 validateSkillOptions('image.layout',{deduplicate:input.deduplicate,...(input.parameters?{parameters:input.parameters}:{})});
 const project=readPosterLayout(input.bytes),assets=new Map<string,{bytes:Buffer;width:number;height:number}>(),sources=[];let decodedBytes=0;
 for(const a of project.assets){
  const raw=assetBytes(a.data),meta=await sharp(raw.bytes,{limitInputPixels:4000000,animated:true,failOn:'warning'}).metadata();
  if(!meta.width||!meta.height||meta.width*meta.height>4000000||(meta.pages||1)!==1)throw Error('素材实际尺寸/帧数超限。');
  const normalized=await imageInput(raw.bytes);decodedBytes+=normalized.bytes.length;if(decodedBytes>3000000)throw Error('素材转为规范PNG后合计超过3MB，请缩小素材后重试。');
  assets.set(a.id,{bytes:normalized.bytes,width:normalized.meta.width!,height:normalized.meta.height!});
  sources.push({id:a.id,declaredSource:a.source,rightsIndependentlyVerified:false,sourceSHA256:hash(raw.bytes),sourceFormat:raw.format,sourceWidth:raw.width,sourceHeight:raw.height,normalizedSHA256:hash(normalized.bytes),normalizedWidth:normalized.meta.width,normalizedHeight:normalized.meta.height,policy:'校正EXIF方向、转sRGB并移除元数据；原始素材仍保留在可编辑JSON。'});
 }
 const parts:string[]=[],geometry:any[]=[],fonts=new Map<string,string>(),imageDefs=new Map<string,string>();
 if(project.background!=='transparent')parts.push(`<rect width="${project.width}" height="${project.height}" fill="${project.background}"/>`);
 for(const [i,l]of project.layers.entries()){
  const g:any={id:l.id,name:l.name,type:l.type,order:i,x:l.x,y:l.y,width:l.width,height:l.height,opacityPercent:l.opacity,visible:l.visible,locked:l.locked,rendered:l.visible&&l.opacity>0};geometry.push(g);
  if(!g.rendered)continue;
  let drawing='';
  if(l.type==='rect')drawing=`<rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" rx="${l.radius}" fill="${l.color}"/>`;
  else if(l.type==='text'){const result=await outlinedText(l,fonts);drawing=result.svg;g.lines=result.lines;g.fontSize=l.fontSize;g.padding=8;g.lineHeight=1.4;}
  else{
   const image=assets.get(l.assetId)!,scale=(l.fit==='cover'?Math.max:Math.min)(l.width/image.width,l.height/image.height),w=image.width*scale,h=image.height*scale,x=l.x+(l.width-w)/2,y=l.y+(l.height-h)/2;
   if(!imageDefs.has(l.assetId))imageDefs.set(l.assetId,`<image id="layout-asset-${l.assetId}" width="${image.width}" height="${image.height}" xlink:href="data:image/png;base64,${image.bytes.toString('base64')}"/>`);
   drawing=`<clipPath id="layout-clip-${i}" clipPathUnits="userSpaceOnUse"><rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}"/></clipPath><g clip-path="url(#layout-clip-${i})"><use xlink:href="#layout-asset-${l.assetId}" transform="translate(${x} ${y}) scale(${scale})"/></g>`;
   g.assetId=l.assetId;g.fit=l.fit;g.drawnBox={x,y,width:w,height:h};g.visibleSourceBox=l.fit==='contain'?{x:0,y:0,width:image.width,height:image.height}:{x:(l.x-x)/scale,y:(l.y-y)/scale,width:l.width/scale,height:l.height/scale};
  }
  parts.push(`<g id="layer-${l.id}" opacity="${l.opacity/100}">${drawing}</g>`);
 }
 const license=await fontLicense(),notes=['图层按数组顺序由底到顶合成；锁定只是编辑器防误操作，不是权限隔离。','文本按显式换行和本地字体实际测量，不自动改写/缩字/换行；可见文字越界或缺字会失败。','SVG文字为轮廓路径；继续编辑请导入poster-project.json，而不是把SVG当文字编辑源。','可编辑JSON含全部图层、隐藏内容及原始内嵌素材（可能含元数据）；分享前须检查隐私和素材权利。','SVG内嵌完整规范图片，图片裁剪不删除图框外像素；裁剪/隐藏不应用作脱敏。','固定字段图层合成不是AI生图、智能改图、抠图、任意矢量编辑、PSD兼容或发布。'];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${project.width}" height="${project.height}" viewBox="0 0 ${project.width} ${project.height}" role="img" aria-labelledby="layout-title"><title id="layout-title">${xml(project.title)}</title><metadata>${xml(license.toString())}</metadata><defs>${[...imageDefs.values()].join('')}</defs>${parts.join('')}</svg>`;
 if(Buffer.byteLength(svg)>6000000)throw Error('SVG超过6MB，请减少文字或素材。');
 event(`实际合成${geometry.filter(l=>l.rendered).length}个可见图层，校验文字边界并渲染PNG；未调用生成式图像模型。`);
 const png=await sharp(Buffer.from(svg),{limitInputPixels:4000000}).png().toBuffer(),meta=await sharp(png).metadata();if(meta.width!==project.width||meta.height!==project.height)throw Error('实际PNG尺寸校验失败。');
 const report={skill:'image.layout',version:'1.0.0',sourceSHA256:hash(input.bytes),title:project.title,width:project.width,height:project.height,background:project.background,layers:geometry,assets:sources,fontSHA256:Object.fromEntries(fonts),render:{svgSHA256:hash(svg),pngSHA256:hash(png)},notes,requiresReview:true,generatedImagery:false,published:false};
 return {summary:`按实际图层生成${project.width}×${project.height}海报，交付PNG、转曲SVG、可再编辑JSON及来源报告。没有AI生成新图或发布；文字和素材权利须自行复核。`,outputs:[out('poster.png','image/png',png),out('poster.svg','image/svg+xml',svg),json('poster-project.json',project),json('poster-report.json',report),out('font-license.txt','text/plain; charset=utf-8',license)]};
}
