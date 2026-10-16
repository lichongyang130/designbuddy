import Decimal from 'decimal.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fontLicense, textPaths } from './fonts';
import { out, json, text, xml } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput } from './executors';
const D=Decimal.clone({precision:40});
// Preserve the JSON number lexeme instead of trusting JSON.parse's rounded binary float.
class NumericLexeme { constructor(readonly source:string|undefined){} }
type Purpose='comparison'|'trend'|'composition';
type Point={label:string;value:Decimal;sourceRow:number;date?:number};
export type InfographicData={title:string;metric:string;unit:string;source:string;scope:string;purpose:Purpose;compositionConfirmed:boolean;points:Point[]};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function line(x:unknown,max:number,name:string){if(typeof x!=='string'||!x.trim()||x!==x.trim()||[...x].length>max||/[\x00-\x1f\x7f]/.test(x))throw Error(`${name}必须为无首尾空格/控制字符的非空文本，最多${max}字。`);return x;}
export function readInfographic(bytes:Uint8Array):InfographicData {
  let v:unknown;try{v=JSON.parse(text(bytes),(key,value,context?:{source?:string})=>key==='value'&&typeof value==='number'?new NumericLexeme(context?.source):value);}catch{throw Error('信息图输入必须是有效UTF-8 JSON。');}
  if(!object(v)||Object.keys(v).some(k=>!['title','metric','unit','source','scope','purpose','compositionConfirmed','data'].includes(k)))throw Error('信息图需要规定的JSON字段，不支持额外配置或脚本。');
  const title=line(v.title,36,'标题'),metric=line(v.metric,20,'指标'),unit=line(v.unit,12,'单位'),source=line(v.source,120,'来源'),scope=line(v.scope,120,'统计口径');
  if(!['comparison','trend','composition'].includes(v.purpose as string))throw Error('purpose只能为comparison（比较）、trend（趋势）或composition（构成）；不猜测业务目的。');
  const purpose=v.purpose as Purpose;
  if(v.compositionConfirmed!==undefined&&typeof v.compositionConfirmed!=='boolean')throw Error('compositionConfirmed必须为布尔值。');
  if(purpose==='composition'&&v.compositionConfirmed!==true)throw Error('构成图须明确设置compositionConfirmed=true，确认各类别互斥且覆盖所述总体、口径与单位一致；程序不能替你验证业务事实。');
  if(!Array.isArray(v.data)||v.data.length<2||v.data.length>(purpose==='composition'?12:24))throw Error('至少2条观测；比较/趋势最多24条，构成最多12条。');
  const labels=new Set<string>();
  const points=v.data.map((row,i)=>{
    if(!object(row)||Object.keys(row).some(k=>!['label','value'].includes(k)))throw Error(`第${i+1}条需要label/value，不支持其他字段。`);
    const label=line(row.label,24,`第${i+1}条标签`);if(labels.has(label))throw Error('存在重复类别或日期；请先明确聚合口径，程序不自动求和或去重。');labels.add(label);
    if(!(row.value instanceof NumericLexeme)&&!(typeof row.value==='string'&&/^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,6})?$/.test(row.value)))throw Error(`第${i+1}条数值必须是十进制数，不接受缺失值、千分位、单位混入或前导零编号。`);
    const raw=row.value instanceof NumericLexeme?row.value.source:row.value as string;
    if(!raw||raw.length>64)throw Error('JSON数值词法最长64字符且须支持原始词法读取；请用不超过6位小数的十进制字符串。');
    const value=new D(raw);if(!value.isFinite()||value.abs().gt('1e12')||value.decimalPlaces()>6||(value.isZero()&&/[1-9]/.test(raw.split(/[eE]/)[0])))throw Error('数值绝对值最多1e12，小数最多6位；不静默舍入输入。');
    if(purpose==='composition'&&value.lt(0))throw Error('构成图不接受负数；不能把负值取绝对值画份额。');
    let date:number|undefined;
    if(purpose==='trend'){
      if(!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(label))throw Error('趋势标签必须是1900–2199年的YYYY-MM-DD实际日期。');
      date=Date.parse(label+'T00:00:00Z');if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==label)throw Error('趋势数据含不存在的日历日期。');
    }
    return {label,value,sourceRow:i+1,...(date!==undefined?{date}:{})};
  });
  if(purpose==='composition'&&points.every(p=>p.value.isZero()))throw Error('全部为零，无法定义构成比例。');
  if(purpose==='trend')points.sort((a,b)=>a.date!-b.date!);
  return {title,metric,unit,source,scope,purpose,compositionConfirmed:v.compositionConfirmed===true,points};
}
const compact=(d:Decimal)=>{const s=d.toFixed();return s.length>12?'约 '+d.toExponential(3):s;};
const colors=['#087f8c','#d17c36','#6f68ab','#497a51','#b45670','#547c98','#8d7346','#5c8b86','#a36eaa','#8a9250','#716558','#af6b47'];

export async function infographic(input:SkillInput,event:(message:string)=>void){
  validateSkillOptions('infographic.compose',{deduplicate:input.deduplicate,...(input.parameters?{parameters:input.parameters}:{})});
  const data=readInfographic(input.bytes),{points,purpose}=data;
  const min=points.reduce((a,b)=>a.value.lt(b.value)?a:b).value,max=points.reduce((a,b)=>a.value.gt(b.value)?a:b).value;
  const total=points.reduce((sum,p)=>sum.plus(p.value),new D(0));
  const first=points[0].value,last=points.at(-1)!.value,change=last.minus(first);
  const rate=purpose==='trend'&&first.gt(0)?change.div(first).times(100):null;
  const chartType=purpose==='trend'?'date-line':purpose==='comparison'?'zero-baseline-bars':'100-percent-stacked-bar';
  const reason=purpose==='trend'?'用户明确选择时间趋势，使用按日期间隔定位的折线；不补齐缺失日期。':purpose==='comparison'?'用户明确选择类别比较，使用共享零基线条形图，保留输入顺序。':'用户明确确认互斥完整构成，使用100%堆叠条形图；份额由实际总量计算。';
  const notes=['单位、统计口径和来源均由用户声明，未独立核实。','图形坐标与PNG为近似呈现；完整数值及记录序号见下方明细和JSON。'];
  if(purpose==='trend'){notes.push('折线只连接已提供的数据点，不补数据、不做预测或因果解释。');if(!rate)notes.push('基期为零或负数，不提供变化率，避免误导。');}
  if(purpose==='composition')notes.push('份额按两位小数展示，四舍五入后不一定恰好为100%；极小份额请查看明细。');
  if(points.every(p=>p.value.isZero()))notes.push('全部观测为零；为绘图使用0–1刻度，不代表存在数值为1的观测。');
  const kpis=purpose==='trend'?[{label:'首期值',value:first.toFixed()},{label:'末期值',value:last.toFixed()},{label:'净变化',value:change.toFixed()}]:purpose==='composition'?[{label:'总体合计',value:total.toFixed()},{label:'类别数量',value:String(points.length)},{label:'最大份额',value:max.div(total).times(100).toDecimalPlaces(2).toFixed(2)+'%'}]:[{label:'最低值',value:min.toFixed()},{label:'最高值',value:max.toFixed()},{label:'类别数量',value:String(points.length)}];
  const chartHeight=purpose==='comparison'?points.length*50+110:purpose==='trend'?400:140;
  const chartTop=430,tableTop=chartTop+chartHeight+55,footerTop=tableTop+144+points.length*36;
  const height=footerTop+Math.max(280,144+notes.length*34);
  const parts:string[]=[];
  const rect=(x:number,y:number,w:number,h:number,fill:string,r=0)=>parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`);
  const path=(d:string,color:string,width=1)=>parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`);
  const label=async(s:string,x:number,y:number,size:number,width:number,lines=1,color='#183c46')=>parts.push(await textPaths(s,x,y,size,width,lines,color));
  rect(0,0,1200,height,'#f4f3ed');rect(0,0,1200,12,'#087f8c');
  await label('DESIGNBUDDY / DATA REPORT',64,62,14,1050,1,'#53727a');
  await label(data.title,64,128,40,1072,2);
  await label(`${data.metric} · 单位：${data.unit}`,64,217,21,1072);
  const purposeName={trend:'时间趋势',comparison:'类别比较',composition:'总体构成'}[purpose];
  for(const [i,k]of kpis.entries()){
    const x=64+i*364;rect(x,252,344,118,'#ffffff',12);
    await label(k.label,x+22,286,16,300,1,'#53727a');
    const displayed=k.value.endsWith('%')?k.value:compact(new D(k.value));
    await label(displayed,x+22,335,34,300);
  }
  await label(`${purposeName} / ${data.metric}`,64,410,22,1072);
  rect(64,chartTop,1072,chartHeight,'#ffffff',12);
  const geometry:Record<string,unknown>[]=[];
  let domainMin=new D(min.lt(0)?min:0),domainMax=new D(max.gt(0)?max:0);
  if(domainMin.eq(domainMax))domainMax=new D(1);
  const span=domainMax.minus(domainMin);
  if(purpose==='comparison'){
    const left=352,plotWidth=520,y0=chartTop+50,zero=left+new D(0).minus(domainMin).div(span).toNumber()*plotWidth;
    for(let i=0;i<5;i++){const tick=domainMin.plus(span.times(i).div(4)),x=left+i*plotWidth/4;path(`M ${x} ${chartTop+28} V ${chartTop+chartHeight-55}`,'#e1e7e5');await label(compact(tick),Math.max(left-12,x-35),chartTop+chartHeight-24,13,160);}
    path(`M ${zero} ${chartTop+25} V ${chartTop+chartHeight-55}`,'#658189',1.5);
    for(const [i,p]of points.entries()){
      const y=y0+i*50,end=left+p.value.minus(domainMin).div(span).toNumber()*plotWidth;
      await label(p.label,86,y+5,17,245,2);
      rect(Math.min(zero,end),y-17,Math.abs(end-zero),28,p.value.lt(0)?'#b45670':'#087f8c',0);
      await label(p.value.toFixed(),908,y+5,16,202);
      geometry.push({sourceRow:p.sourceRow,label:p.label,zeroX:zero,valueX:end,y});
    }
  }else if(purpose==='trend'){
    const left=210,top=chartTop+36,w=860,h=266,start=points[0].date!,duration=points.at(-1)!.date!-start;
    for(let i=0;i<5;i++){const tick=domainMin.plus(span.times(i).div(4)),y=top+h-i*h/4;path(`M ${left} ${y} H ${left+w}`,'#dce5e3');await label(compact(tick),86,y+5,14,116);}
    const coords=points.map(p=>({x:left+(p.date!-start)/duration*w,y:top+h-p.value.minus(domainMin).div(span).toNumber()*h,sourceRow:p.sourceRow,label:p.label}));
    path(coords.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),'#087f8c',3);
    for(const p of coords){parts.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#087f8c" stroke="#ffffff" stroke-width="2"/>`);geometry.push(p);}
    await label(points[0].label,left,top+h+35,15,200);await label(points.at(-1)!.label,left+w-110,top+h+35,15,180);
    await label(rate===null?'基期≤0：变化率不适用':`首末变化率：${compact(rate.toDecimalPlaces(2))}%`,left,top+h+73,17,850);
  }else{
    let x=86;const width=1028;
    for(const [i,p]of points.entries()){
      const segment=p.value.div(total).toNumber()*width;rect(x,chartTop+32,segment,42,colors[i]);geometry.push({sourceRow:p.sourceRow,label:p.label,x,width:segment,shareDecimal:p.value.div(total).times(100).toString(),color:colors[i]});x+=segment;
    }
    await label('0%',86,chartTop+107,14,120);await label('100%',1050,chartTop+107,14,70);
  }
  await label('数据明细 / 可追溯到上传记录',64,tableTop,23,1072);
  await label(purpose==='composition'?'类别 / 颜色':'观测标签',86,tableTop+49,16,480,1,'#53727a');
  await label(`${data.metric}（${data.unit}）`,600,tableTop+49,16,360,2,'#53727a');
  await label(purpose==='composition'?'份额 / 来源序号':'来源序号',978,tableTop+49,15,145,1,'#53727a');
  const rows=points.map((p,i)=>({label:p.label,value:p.value.toFixed(),sourceRow:p.sourceRow,...(purpose==='composition'?{shareDecimal:p.value.div(total).times(100).toString(),shareDisplay:p.value.div(total).times(100).toFixed(2)+'%',color:colors[i]}:{})}));
  for(const [i,r]of rows.entries()){
    const y=tableTop+112+i*36;if(i%2===0)rect(64,y-24,1072,36,'#ffffff',4);
    if(purpose==='composition')rect(87,y-14,12,12,colors[i],2);
    await label(r.label,purpose==='composition'?112:86,y,16,484);
    await label(r.value,600,y,16,350);
    await label(purpose==='composition'?`${r.shareDisplay} / ${r.sourceRow}`:String(r.sourceRow),978,y,15,145);
  }
  path(`M 64 ${footerTop-22} H 1136`,'#b9cbc7');
  await label('口径：'+data.scope,64,footerTop+12,15,1072,2);
  await label('来源：'+data.source,64,footerTop+64,15,1072,2);
  let noteY=footerTop+116;for(const note of notes){await label(note,64,noteY,13,1072,2,'#53727a');noteY+=34;}
  await label('按显式目的规则选图 · 未调用语义模型 · 数值须按业务口径复核',64,height-24,12,1072,1,'#53727a');
  const license=await fontLicense();
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc"><title id="title">${xml(data.title)}</title><desc id="desc">${xml(reason+' '+data.metric+' 单位：'+data.unit+'。'+rows.map(r=>r.label+': '+r.value).join('；'))}</desc><metadata>${xml(license.toString())}</metadata>${parts.join('')}</svg>`;
  if(Buffer.byteLength(svg)>6000000)throw Error('信息图SVG超过6MB，请缩短文字或减少观测。');
  event(`按用户明确的${purpose}目的选择${chartType}；实际处理${points.length}条数据，正在渲染PNG。没有执行AI业务推断。`);
  const png=await sharp(Buffer.from(svg),{limitInputPixels:6000000}).png().toBuffer();const meta=await sharp(png).metadata();if(meta.width!==1200||meta.height!==height)throw Error('信息图实际渲染尺寸校验失败。');
  const report={sourceSHA256:createHash('sha256').update(input.bytes).digest('hex'),title:data.title,metric:data.metric,unit:data.unit,scope:data.scope,source:data.source,purpose,chartType,selectionReason:reason,selectionMethod:'explicit-purpose deterministic rules, not AI semantic understanding',userDeclaredPartsCompleteAndDisjoint:purpose==='composition'&&data.compositionConfirmed,sourceIndependentlyVerified:false,calculationPolicy:'decimal.js 40位有效数字；原始数值不超过6位小数，图形坐标为双精度近似，变化率等除法结果可能舍入。',rowReference:'sourceRow为输入data数组从1开始的记录序号，不是JSON物理行号或外部数据源行号。',kpis,rows,geometry,domain:purpose==='composition'?{min:'0',max:'100',unit:'%'}:{min:domainMin.toFixed(),max:domainMax.toFixed()},...(purpose==='trend'?{change:change.toFixed(),changePercent:rate?.toString()??null,dateSpacing:'UTC date proportional',missingDatesFilled:false}:{}),...(purpose==='composition'?{total:total.toFixed(),displayedSharesSum:rows.reduce((a,r)=>a.plus(r.shareDisplay!.slice(0,-1)),new D(0)).toFixed(2)}:{}),render:{width:1200,height,svgSHA256:createHash('sha256').update(svg).digest('hex'),pngSHA256:createHash('sha256').update(png).digest('hex')},notes,requiresReview:true};
  return {summary:`实际生成${purposeName}信息图，使用${points.length}条真实上传记录；交付转曲SVG、实际PNG和选图/计算依据。规则依据用户明确目的，未验证业务事实或调用AI语义模型。`,outputs:[out('infographic.svg','image/svg+xml',svg),out('infographic.png','image/png',png),json('infographic-report.json',report),out('font-license.txt','text/plain; charset=utf-8',license)]};
}
