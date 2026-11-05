import {validateArchive} from '../excel-assistant-core.js'
export function canonicalNumber(value){
 const s=String(value??'').trim();if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))throw Error('请输入普通数字，可带千分位和小数；暂不支持百分号、货币符号或科学计数。')
 const plain=s.replaceAll(',',''),neg=plain.startsWith('-'),unsigned=plain.replace(/^[+-]/,''),[integer,fraction='']=unsigned.split('.')
 if(integer.length>15||fraction.length>10)throw Error('数字过长，请使用整数最多 15 位、小数最多 10 位的数字。')
 const a=integer.replace(/^0+(?=\d)/,''),b=fraction.replace(/0+$/,'');return (neg&&(a!=='0'||b)?'-':'')+a+(b?'.'+b:'')
}
export function findExactNumber(text,needle){
 canonicalNumber(needle);const source=String(text),q=String(needle).trim(),items=[];let start=0,count=0
 while(start<=source.length-q.length){const i=source.indexOf(q,start);if(i<0)break;const before=source[i-1]||'',after=source[i+q.length]||'';if(!/[\d,.+\-−–—]/.test(before)&&!/[\d,.]/.test(after)&&!(/[eE]/.test(before)&&/[\d+\-]/.test(source[i-2]||''))&&!(/[eE]/.test(after)&&/[\d+\-]/.test(source[i+q.length+1]||''))){count++;if(items.length<10)items.push(source.slice(Math.max(0,i-30),Math.min(source.length,i+q.length+30)).replace(/\n/g,' '))}start=i+q.length}
 return {count,contexts:items}
}
export async function loadNumberWorkbook(ExcelJS,file){
 if(!ExcelJS)throw Error('Excel 解析器未加载，请刷新页面重试。')
 if(!file||!/\.xlsx$/i.test(file.name))throw Error('仅支持 XLSX 工作簿。')
 if(file.size>20*1024*1024)throw Error('单个 Excel 文件不能超过 20 MB。')
 const bytes=await file.arrayBuffer();validateArchive(bytes);const book=new ExcelJS.Workbook();await book.xlsx.load(bytes)
 if(book.worksheets.length>30)throw Error('单个工作簿超过 30 个工作表。')
 for(const ws of book.worksheets)if(ws.rowCount>10001||ws.columnCount>100)throw Error(`工作表 ${ws.name} 超过 10000 行或 100 列。`)
 return book
}
export function readNumberCell(book,sheetName,address){
 const sheet=book.getWorksheet(sheetName);if(!sheet)throw Error('请选择工作表。')
 const ref=String(address||'').trim().toUpperCase(),match=ref.match(/^([A-Z]{1,2})([1-9]\d{0,4})$/);if(!match)throw Error('请输入单元格地址，例如 B2。')
 let col=0;for(const c of match[1])col=col*26+c.charCodeAt(0)-64
 const row=Number(match[2]);if(col>100||row>10001)throw Error('仅支持前 100 列、前 10001 行。')
 const cell=sheet.getRow(row).getCell(col);if(String(cell.numFmt||'').includes('%'))throw Error('百分比单元格涉及显示换算，请人工核对。')
 let raw=cell.value,formula=false;if(raw&&typeof raw==='object'&&(raw.formula!==undefined||raw.sharedFormula!==undefined)){formula=true;raw=raw.result;if(raw==null)throw Error('公式没有缓存结果，请在 Excel 中重新计算后保存。')}
 if(typeof raw!=='number'&&typeof raw!=='string')throw Error('所选单元格不是可比较的普通数字。')
 const canonical=canonicalNumber(raw);return {canonical,display:String(raw),formula,ref,merged:!!cell.isMerged}
}
