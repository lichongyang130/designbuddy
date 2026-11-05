// Tab-separated table: first column categories, remaining columns series.
const cell = value => String(value ?? '').replace(/[\t\r\n]/g, ' ')
export function formatChartData(chart) {
  const series = chart.series?.length ? chart.series : [{name:'数据',values:[]}]
  return [['分类',...series.map(s=>cell(s.name))],...(chart.categories||[]).map((category,i)=>[cell(category),...series.map(s=>String(s.values?.[i] ?? 0))])].map(row=>row.join('\t')).join('\n')
}
export function parseChartData(text) {
  const rows=String(text).split(/\r?\n/).filter(line=>line.trim()).map(line=>line.split('\t'))
  if(rows.length<2 || rows[0].length<2 || rows[0].slice(1).some(s=>!s.trim())) throw Error('请填写分类、系列名称和至少一行数据，列之间使用 Tab')
  const count=rows[0].length
  if(rows.slice(1).some(row=>row.length!==count || !row[0].trim() || row.slice(1).some(v=>!v.trim() || !Number.isFinite(Number(v))))) throw Error('数据行列数须一致，数值不能为空且必须为数字')
  return {categories:rows.slice(1).map(row=>row[0].trim()),series:rows[0].slice(1).map((name,i)=>({name:name.trim(),values:rows.slice(1).map(row=>Number(row[i+1]))}))}
}
