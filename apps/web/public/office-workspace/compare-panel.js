import {el,button,label,option,download,safeName} from './ui.js'
import {readComparable,compareLines,comparisonText} from './compare-core.js'
export function mountComparison(root,ctx){
 const older=el('select'),newer=el('select'),message=el('p','先添加两个 TXT 或 DOCX 文件，再选择旧版和新版。','hint'),output=el('div');let oldFile=null,newFile=null,busy=false,report=''
 function refresh(){
  const files=ctx.files(),allowed=files.filter(f=>/\.(txt|docx)$/i.test(f.name))
  if(!files.includes(oldFile))oldFile=null;if(!files.includes(newFile))newFile=null
  if(allowed.length===2&&!oldFile&&!newFile){[oldFile,newFile]=allowed}
  for(const [select,selected] of [[older,oldFile],[newer,newFile]]){select.replaceChildren();option(select,'','请选择文件');files.forEach((f,i)=>{if(/\.(txt|docx)$/i.test(f.name))option(select,i,f.webkitRelativePath||f.name)});select.value=selected?String(files.indexOf(selected)):''}
  report='';output.replaceChildren();save.disabled=true;message.textContent='先添加两个 TXT 或 DOCX 文件，再选择旧版和新版。'
 }
 older.onchange=()=>{oldFile=older.value===''?null:ctx.files()[Number(older.value)];report='';output.replaceChildren();save.disabled=true;message.textContent='文件选择已变化，请重新比较。'}
 newer.onchange=()=>{newFile=newer.value===''?null:ctx.files()[Number(newer.value)];report='';output.replaceChildren();save.disabled=true;message.textContent='文件选择已变化，请重新比较。'}
 const compare=button('比较正文',async()=>{if(busy)return;if(!oldFile||!newFile){message.textContent='请选择旧文件和新文件。';return}if(oldFile===newFile){message.textContent='请选择两个不同的文件。';return}busy=true;compare.disabled=true;save.disabled=true;report='';output.replaceChildren();const version=ctx.version(),a=oldFile,b=newFile;message.textContent='正在本地读取和比较正文…';try{const [left,right]=await Promise.all([readComparable(a),readComparable(b)]);if(version!==ctx.version()||a!==oldFile||b!==newFile)throw Error('所选文件已变化，请重新比较。');const changes=compareLines(left.lines,right.lines),warnings=[...left.warnings.map(x=>`旧文件：${x}`),...right.warnings.map(x=>`新文件：${x}`)];report=comparisonText(a.name,b.name,changes,warnings);message.textContent=changes.length?`发现 ${changes.length} 条逐行变动。修改通常显示为删除旧行和新增新行；请核对原文件。`:'提取的正文未发现逐行差异，不代表文件完全相同。';for(const warning of warnings)output.append(el('p',warning,'warning'));for(const change of changes.slice(0,100)){const row=el('p',`【${change.type} 第 ${change.line} 行】${change.text}`,'compare-change');row.style.whiteSpace='pre-wrap';row.style.overflowWrap='anywhere';output.append(row)}if(changes.length>100)output.append(el('p',`这里只显示前 100 条，共 ${changes.length} 条；可下载完整比较结果。`));save.disabled=false}catch(e){message.textContent=`无法比较：${e?.message||e}`}finally{busy=false;compare.disabled=false}},'primary')
 const save=button('下载比较结果',()=>{if(report)download('\ufeff'+report,safeName((newFile?.name||'文件')+'-正文比较')+'.txt','text/plain;charset=utf-8')});save.disabled=true
 const actions=el('div',undefined,'actions');actions.append(button('添加文件',()=>ctx.pickFiles('.txt,.docx',()=>refresh())),compare,save,button('核对文档与表格数字',()=>ctx.openTask('crossreview')));const controls=el('div',undefined,'grid2');controls.append(label('旧文件',older),label('新文件',newer));root.append(el('p','在本机逐行比较 TXT 或 DOCX 的正文，不修改原文件。单文件最多 10 MB，正文最多 50000 字符、500 行或段。'),el('p','仅比较可提取文字（换行符会统一），不比较图片、版式、表格结构、页眉页脚、批注或修订记录；不支持扫描件。','hint'),controls,actions,message,output)
 return {activate(){refresh()},filesChanged(){refresh();message.textContent='文件已变化，请选择旧版与新版后重新比较。'}}
}
