// Describe only the sheets actually analyzed; preserve warnings and distinguish input and output units.
export function excelCheckSummary(result,sheets,readErrors=[]){
 const chosen=sheets.filter(s=>s.selected),outUnit=result.options.currency==='USD'?'美元':'元'
 const lines=['【表格核对结果｜须人工核对】',`已处理 ${result.selectedCount} 个工作表、${result.details.length} 条记录；发现 ${result.issues.length} 条检查提示。`,`选择的工作表：${chosen.map(s=>`${s.filename} / ${s.name}`).join('；')||'无'}`,`口径：${result.options.currency}；无单位列时输入按${result.options.unit}处理，汇总金额以${outUnit}表示。`,`查重字段：${result.options.duplicates.length?result.options.duplicates.join('、'):'未设置'}。疑似重复只标记，不删除；符合条件的重复行仍计入。原公式只读取缓存值，数据与事实需要人工核实。`]
 if(readErrors.length)lines.push(`未能读取的文件：${readErrors.join('；')}。以下结果不包含这些文件，请重新核对。`)
 lines.push('部门汇总：')
 if(!result.summaries.length)lines.push('没有符合当前口径的汇总数据。')
 for(const row of result.summaries.slice(0,50))lines.push(`${row.department}：${row.amount} ${outUnit}（计入 ${row.count} 行）`)
 if(result.summaries.length>50)lines.push(`仅列出前 50 个部门，共 ${result.summaries.length} 个；完整结果请查看导出的 Excel。`)
 if(result.issues.length){lines.push('检查提示（最多列出前 30 条）：');for(const i of result.issues.slice(0,30))lines.push(`${i.file} / ${i.sheet} / 第 ${i.row} 行：${i.note}`);if(result.issues.length>30)lines.push(`仅列出前 30 条，共 ${result.issues.length} 条；完整结果请查看导出的 Excel。`)}
 return lines.join('\n')
}
