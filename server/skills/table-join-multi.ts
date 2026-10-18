import { inflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import { inspectZip } from './office';
import { json } from './io';
import type { SkillInput } from './executors';
import { validateSkillOptions } from './contracts';
import { parse } from 'csv-parse/sync';

const tableName=/^[A-Za-z0-9][A-Za-z0-9_. -]{0,63}\.csv$/;
const aliasName=/^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const headerName=/^[^\x00-\x1f\x7f]{1,100}$/;
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
type Row={values:Record<string,string|null>; lineage:{source:string;row:number}[]};
type Dataset={name:string;headers:string[];rows:Row[]};
type Join={left:string;right:string;leftKey:string;rightKey:string;type:'left'|'inner'|'full';as:string};

/** ZIP is inspected before decompression; top-level CSVs and one joins.json only. */
export function readMultiJoinZip(bytes:Uint8Array){
 const paths=inspectZip(bytes);if(paths.size<3||paths.size>6||[...paths].some(p=>p.includes('/')||p.includes('\\')||p.includes('\x00')||/[\x00-\x1f\x7f]/.test(p)))throw Error('ZIP必须只含2–5个顶层CSV和一个joins.json，不接受子目录或额外文件。');
 const buffer=Buffer.from(bytes);let end=buffer.length-22;while(end>=0&&!(buffer.readUInt32LE(end)===0x06054b50&&end+22+buffer.readUInt16LE(end+20)===buffer.length))end--;if(end<0)throw Error('ZIP结束目录损坏。');
 const count=buffer.readUInt16LE(end+10);let position=buffer.readUInt32LE(end+16),total=0;const files=new Map<string,Buffer>();
 for(let i=0;i<count;i++){
  if(position+46>end||buffer.readUInt32LE(position)!==0x02014b50)throw Error('ZIP中央目录不完整。');
  const method=buffer.readUInt16LE(position+10),expectedCRC=buffer.readUInt32LE(position+16),compressed=buffer.readUInt32LE(position+20),expanded=buffer.readUInt32LE(position+24),nameSize=buffer.readUInt16LE(position+28),extra=buffer.readUInt16LE(position+30),comment=buffer.readUInt16LE(position+32),offset=buffer.readUInt32LE(position+42);
  const rawName=buffer.subarray(position+46,position+46+nameSize);let name:string;try{name=new TextDecoder('utf-8',{fatal:true}).decode(rawName);}catch{throw Error('ZIP文件名必须是UTF-8。');}
  if(files.has(name)||![0,8].includes(method)||!expanded||expanded>2_000_000||(total+=expanded)>6_000_000||offset+30>buffer.length||buffer.readUInt32LE(offset)!==0x04034b50)throw Error('ZIP重复条目、压缩方式或展开资源超限。每个CSV≤2MB，合计≤6MB。');
  const localNameSize=buffer.readUInt16LE(offset+26),localExtra=buffer.readUInt16LE(offset+28),start=offset+30+localNameSize+localExtra;
  if(start+compressed>buffer.length||!buffer.subarray(offset+30,offset+30+localNameSize).equals(rawName)||buffer.readUInt16LE(offset+8)!==method)throw Error('ZIP本地目录与中央目录不匹配。');
  let data:Buffer;try{data=method===0?buffer.subarray(start,start+compressed):inflateRawSync(buffer.subarray(start,start+compressed),{maxOutputLength:2_000_000});}catch{throw Error('ZIP内容损坏或展开超限。');}
  if(data.length!==expanded||crc32(data)!==expectedCRC)throw Error('ZIP条目长度或CRC校验失败。');files.set(name,Buffer.from(data));position+=46+nameSize+extra+comment;
 }
 if(position!==end||!files.has('joins.json'))throw Error('ZIP必须包含有效目录和joins.json。');
 const csvs=[...files.keys()].filter(n=>n!=='joins.json');if(csvs.length<2||csvs.length>5||csvs.some(n=>!tableName.test(n)))throw Error('ZIP必须包含2–5个名称安全的顶层CSV，以及joins.json。');
 let manifest:any;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files.get('joins.json')!));}catch{throw Error('joins.json必须是有效UTF-8 JSON。');}
 return{files,manifest,csvs};
}
function validateManifest(value:any,csvs:string[]):{joins:Join[];output:string}{
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!=='joins,output'||!Array.isArray(value.joins)||value.joins.length<1||value.joins.length>4||typeof value.output!=='string'||!aliasName.test(value.output))throw Error('joins.json需包含1–4步joins数组及output别名。');
 const available=new Set(csvs),joins:Join[]=[];
 for(const [i,j]of value.joins.entries()){
  if(!j||Array.isArray(j)||typeof j!=='object'||Object.keys(j).sort().join(',')!=='as,left,leftKey,right,rightKey,type'||![...csvs,...joins.map(x=>x.as)].includes(j.left)||!csvs.includes(j.right)||!aliasName.test(j.as)||typeof j.leftKey!=='string'||j.leftKey.length<1||j.leftKey.length>120||typeof j.rightKey!=='string'||j.rightKey.length<1||j.rightKey.length>120||!['left','inner','full'].includes(j.type)||j.left===j.right||available.has(j.as)||joins.some(x=>x.as===j.as))throw Error(`第${i+1}步关联参数不合法：只能把已存在的表/结果与一个来源CSV关联，别名不得重复。`);
  if(!available.has(j.left)&&!joins.some(x=>x.as===j.left))throw Error(`第${i+1}步左侧结果尚未生成；请按依赖顺序排列关联步骤。`);
  joins.push(j);available.add(j.as);
 }
 if(!available.has(value.output)||!joins.some(j=>j.as===value.output))throw Error('output必须指向本次关联产生的结果别名。');
 return{joins,output:value.output};
}
function readCSV(name:string,bytes:Buffer):Dataset{
 let rows:string[][];try{rows=parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{bom:true,skip_empty_lines:true,relax_column_count:false,max_record_size:10000, to:5002});}catch{throw Error(`${name}不是结构一致的UTF-8 CSV，或超过单表行数/单元格长度限制。`);}
 if(rows.length<2||rows.length>5001||rows[0].length<1||rows[0].length>50||rows.length*rows[0].length>100_000)throw Error(`${name}需要表头和数据，最多5000行、50列、100000单元格。`);
 const headers=rows[0];if(headers.some(h=>!headerName.test(h)||h!==h.trim())||new Set(headers).size!==headers.length)throw Error(`${name}表头需为唯一的1–100字符文本，不得含首尾空格或控制字符。`);
 for(const row of rows)if(row.length!==headers.length||row.some(x=>x.length>10_000))throw Error(`${name}记录列数不一致或单元格超过10000字符。`);
 const records=rows.slice(1).map((r,i)=>({values:Object.fromEntries(headers.map((h,c)=>[`${name}.${h}`,r[c]])),lineage:[{source:name,row:i+2}]})).filter(r=>Object.values(r.values).some(v=>v!==''));
 if(!records.length)throw Error(`${name}没有非空数据行。`);return{name,headers:headers.map(h=>`${name}.${h}`),rows:records};
}
const key=(row:Row,field:string,source:string)=>{const value=row.values[field.includes('.')?field:`${source}.${field}`];if(value===undefined)throw Error(`字段“${field}”不存在于关联左侧数据。请按CSV名.字段名填写。`);return value===null||value===''?undefined:value;};
function join(left:Dataset,right:Dataset,spec:Join):Dataset{
 const lk=spec.leftKey.includes('.')?spec.leftKey:`${spec.left}.${spec.leftKey}`,rk=spec.rightKey.includes('.')?spec.rightKey:`${spec.right}.${spec.rightKey}`;
 if(!left.headers.includes(lk)||!right.headers.includes(rk))throw Error(`步骤“${spec.as}”关联字段不存在。左字段需从${left.name}选择，右字段需从${right.name}选择；复合键可分步预处理后再接入。`);
 const index=new Map<string,Row>();for(const row of right.rows){const k=key(row,rk,right.name);if(k===undefined)continue;const previous=index.get(k);if(previous)throw Error(`${right.name}右侧键不唯一：来源行${previous.lineage.at(-1)?.row}与${row.lineage.at(-1)?.row}。为防止静默行膨胀，本次整批失败。`);index.set(k,row);}
 const used=new Set<Row>(),out:Row[]=[];for(const l of left.rows){const k=key(l,lk,left.name),r=k===undefined?undefined:index.get(k);if(r){used.add(r);out.push({values:{...l.values,...r.values},lineage:[...l.lineage,...r.lineage]});}else if(spec.type!=='inner')out.push({values:{...l.values,...Object.fromEntries(right.headers.map(h=>[h,null]))},lineage:[...l.lineage]});if(out.length>5000)throw Error(`步骤“${spec.as}”展开超过5000行，整批失败；不会截断或静默扩张。`);}
 if(spec.type==='full')for(const r of right.rows)if(!used.has(r)){out.push({values:{...Object.fromEntries(left.headers.map(h=>[h,null])),...r.values},lineage:[...r.lineage]});if(out.length>5000)throw Error(`步骤“${spec.as}”全外连接超过5000行，整批失败。`);}
 const headers=[...left.headers,...right.headers];if(out.length*headers.length>100_000)throw Error('关联结果超过100000个单元格限制。');return{name:spec.as,headers,rows:out};
}
export async function joinMultiTables(input:SkillInput,event:(message:string)=>void){
 validateSkillOptions('table.join-multi',{deduplicate:false});const{files,manifest,csvs}=readMultiJoinZip(input.bytes),plan=validateManifest(manifest,csvs);
 const datasets=new Map<string,Dataset>(csvs.map(name=>[name,readCSV(name,files.get(name)!)]));const initialNames=[...datasets.keys()];let cumulative=0;
 for(const spec of plan.joins){const left=datasets.get(spec.left),right=datasets.get(spec.right);if(!left||!right)throw Error(`关联步骤引用未定义数据集：${spec.left} / ${spec.right}。`);event(`执行第${plan.joins.indexOf(spec)+1}/${plan.joins.length}步：${left.name} × ${right.name}（${spec.type}）。`);const result=join(left,right,spec);cumulative+=result.rows.length;if(cumulative>10_000)throw Error('多步关联累计中间结果超过10000行，整批失败。');datasets.set(spec.as,result);}
 const result=datasets.get(plan.output)!;const wb=new ExcelJS.Workbook();wb.creator='DesignBuddy bounded multi-file join';const data=wb.addWorksheet('关联结果'),lineage=wb.addWorksheet('来源行号');data.addRow(result.headers);lineage.addRow(['结果行',...initialNames.flatMap(n=>[`${n} 来源行`,`${n} 是否参与`])]);
 for(const[rowIndex,row]of result.rows.entries()){data.addRow(result.headers.map(h=>row.values[h]??null));const refs=new Map(row.lineage.map(x=>[x.source,x.row]));lineage.addRow([rowIndex+2,...initialNames.flatMap(n=>[refs.get(n)??null,refs.has(n)?'是':'否'])]);}
 for(const sheet of wb.worksheets){sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];sheet.columns.forEach(c=>c.width=24);}
 const buffer=new Uint8Array(await wb.xlsx.writeBuffer());if(buffer.length>8_000_000)throw Error('关联工作簿超过8MB，整批不交付。');
 const report={schema:'designbuddy.multi-table-join/1',sourceArchiveSHA256:(await import('node:crypto')).createHash('sha256').update(input.bytes).digest('hex'),tables:csvs.map(n=>({filename:n,rows:datasets.get(n)!.rows.length,headers:datasets.get(n)!.headers})),steps:plan.joins.map(j=>({left:j.left,right:j.right,leftKey:j.leftKey,rightKey:j.rightKey,type:j.type,as:j.as,rows:datasets.get(j.as)!.rows.length})),output:plan.output,outputRows:result.rows.length,outputColumns:result.headers,provenanceSheet:'来源行号',policy:'仅对CSV明确指定的字段按UTF-8文本逐字精确关联；不去空格、不改大小写、不把字符串转为数字、不推断业务语义。右表非空键必须唯一；空键不匹配；左表重复键可以保留但本实现不做一对多右侧展开。所有CSV来源行号写入来源工作表。没有执行公式、语义分类、隐私删除或真实性核验。结果需由业务负责人核对。',requiresReview:true,atomicDelivery:true};
 event(`完成${csvs.length}份CSV的${plan.joins.length}步跨文件关联，实际导出${result.rows.length}行，并写入逐来源文件/行号对照。`);
 return{summary:`实际完成${csvs.length}份CSV、${plan.joins.length}步关联，输出${result.rows.length}行、${result.headers.length}列；XLSX含逐行来源文件及原始行号。只按指定文本键精确匹配，不推断业务口径；请复核关联条件。`,outputs:[{name:'multi-joined.xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes:buffer},json('multi-join-report.json',report)]};
}
