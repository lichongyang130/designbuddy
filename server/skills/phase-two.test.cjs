const { test }=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {PDFDocument}=require('pdf-lib');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');
const {SkillService}=require('../../dist/local/server/skills/service.js');
const {textPaths}=require('../../dist/local/server/skills/fonts.js');
const {runtimeSkills}=require('../../dist/local/shared/skillRuntime.js');
const run=(skillId,filename,bytes,parameters)=>executeSkill({skillId,filename,bytes:typeof bytes==='string'?Buffer.from(bytes):bytes,deduplicate:false,parameters});
const decoded=(r,name)=>Buffer.from(r.outputs.find(o=>o.name===name).bytes).toString();
const parsed=(r,name)=>JSON.parse(decoded(r,name));
const red=()=>sharp({create:{width:300,height:200,channels:4,background:'#ff0000'}}).png().toBuffer();
const sample=id=>runtimeSkills.find(s=>s.id===id).example.content;

test('all twelve experts now bind at least one actual ready executor, while external/runtime promises stay unavailable',()=>{
 const experts=['documents','data','slides','communication','brand','visual','product-visual','infographics','product','web-design','developer','qa'];
 for(const id of experts)assert.ok(runtimeSkills.some(s=>s.status==='ready'&&s.expertIds.includes(id)),id);
 for(const id of ['collaboration.sync','image.generate','web.verify','code.build','test.browser'])assert.equal(runtimeSkills.find(s=>s.id===id).status,'unavailable');
});
test('Chinese document produces an actual selectable-text PDF that reads back with page provenance',async()=>{
 const formatted=await run('document.format','notes.md','# 项目验收\n销售金额 120.50 元\nPlease verify the source.');
 const bytes=formatted.outputs.find(o=>o.name==='organized.pdf').bytes;assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
 const pdf=await run('pdf.extract','source.pdf',bytes);const pages=parsed(pdf,'pdf-pages.json');assert.equal(pages.length,1);assert.equal(pages[0].page,1);assert.match(pages[0].text,/销售金额 120.50 元/);assert.match(pages[0].text,/Please verify/);
 assert.ok(formatted.outputs.some(o=>o.name==='font-license.txt'));
});
test('scanned/blank and excessive-page PDFs fail, mixed text/blank PDF reports incompleteness',async()=>{
 const blank=await PDFDocument.create();blank.addPage();await assert.rejects(()=>run('pdf.extract','fake.pdf',Buffer.from('not a PDF')),/真实 PDF/);
 await assert.rejects(async()=>run('pdf.extract','blank.pdf',await blank.save()),/无可提取文字/);
 const many=await PDFDocument.create();for(let i=0;i<41;i++)many.addPage();await assert.rejects(async()=>run('pdf.extract','many.pdf',await many.save()),/最多 40 页/);
 const base=await run('document.format','one.txt','Actual text');const mixed=await PDFDocument.load(base.outputs.find(o=>o.name==='organized.pdf').bytes);mixed.addPage();const report=await run('pdf.extract','mixed.pdf',await mixed.save());assert.match(report.summary,/1 页无文本/);assert.ok(parsed(report,'pdf-pages.json')[1].warning);
});
test('real RGB palette extraction emits tokens and WCAG ratios, no external image service',async()=>{
 const r=await run('brand.assets','red.png',await red());const colors=parsed(r,'brand-tokens.json').colors;
 assert.equal(colors.length,1);assert.equal(colors[0].hex,'#ff0000');assert.ok(Math.abs(colors[0].contrastBlack-5.252)<.01);assert.equal(colors[0].suggestedText,'#000000');assert.match(decoded(r,'brand-tokens.css'),/--brand-1: #ff0000/);
});
test('product images preserve content with white padding at three exact sizes and strip EXIF',async()=>{
 const r=await run('image.product','red.png',await red());
 for(const [name,w,h]of[['square',1200,1200],['portrait',1200,1600],['landscape',1600,900]]){
  const bytes=r.outputs.find(o=>o.name===`product-${name}.jpg`).bytes;const meta=await sharp(bytes).metadata();assert.equal(meta.width,w);assert.equal(meta.height,h);assert.equal(meta.exif,undefined);
 }
 const bytes=r.outputs.find(o=>o.name==='product-square.jpg').bytes;const {data}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});assert.ok(data[0]>245&&data[1]>245&&data[2]>245);const center=(600*1200+600)*3;assert.ok(data[center]>240&&data[center+1]<20);
});
test('real poster rasterization produces two sizes, outlined Chinese typography, preserved input and parameter receipt',async()=>{
 const r=await run('image.marketing','red.png',await red(),{title:'新品发布',subtitle:'实际素材排版',action:'了解更多'});
 for(const [name,height]of[['square',1080],['portrait',1440]]){const meta=await sharp(r.outputs.find(o=>o.name===`poster-${name}.png`).bytes).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,height);const svg=decoded(r,`poster-${name}.svg`);assert.match(svg,/<path /);assert.match(svg,/data:image\/jpeg;base64,/);assert.ok(!svg.includes('<script'));}
 assert.equal(parsed(r,'poster-layout.json').title,'新品发布');
});
test('image formats, pixel limits, empty alpha and overlong poster copy are rejected',async()=>{
 await assert.rejects(()=>run('image.product','fake.png','<svg onload="alert(1)"></svg>'),/真实 PNG/);
 await assert.rejects(async()=>run('brand.assets','clear.png',await sharp({create:{width:30,height:30,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer()),/完全透明/);
 await assert.rejects(async()=>run('image.product','wide.png',await sharp({create:{width:8001,height:1,channels:3,background:'red'}}).png().toBuffer()),/最长边/);
 await assert.rejects(async()=>run('image.marketing','x.png',await red(),{title:'很'.repeat(37)}),/标题/);
});
test('local OCR recognizes actual Chinese/English pixels and records confidence/coordinates',async()=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="200"><rect width="100%" height="100%" fill="white"/>${await textPaths('项目验收 SALES 12345',30,110,48,950,1,'#000000')}</svg>`;
 const png=await sharp(Buffer.from(svg)).png().toBuffer();const r=await run('image.ocr','scan.png',png);const text=decoded(r,'recognized.txt').replace(/\s/g,'');assert.match(text,/项目验收/);assert.match(text,/SALES12345/);
 const evidence=parsed(r,'ocr-evidence.json');assert.ok(evidence.confidence>60);assert.ok(evidence.lines.length);assert.ok(evidence.lines[0].bbox);assert.equal(evidence.requiresReview,true);
});
test('OCR of blank image does not invent text or claim success',async()=>{
 const png=await sharp({create:{width:400,height:300,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(()=>run('image.ocr','blank.png',png),/未识别到文字/);
});
test('schedule export computes timezone offsets and folds UTF8 calendar lines without sending events',async()=>{
 const r=await run('collaboration.schedule','plan.csv',sample('collaboration.schedule'));const report=parsed(r,'schedule-report.json');assert.equal(report.findings.length,0);assert.equal(report.calendarExported,true);const ics=decoded(r,'schedule.ics');assert.match(ics,/DTSTART:20261020T010000Z/);assert.match(ics,/BEGIN:VEVENT/);assert.ok(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));assert.match(r.summary,/没有创建外部日历/);
});
test('schedule detects overlap, dependency cycles, missing references, invalid dates and withholds calendar',async()=>{
 const source='id,task,owner,start,end,dependsOn\nT1,任务一,张三,2026-10-20T09:00:00+08:00,2026-10-20T11:00:00+08:00,T2\nT2,任务二,张三,2026-10-20T10:00:00+08:00,2026-10-20T12:00:00+08:00,T1;MISSING\nT3,错误日期,李四,2026-02-30T09:00:00Z,2026-03-01T10:00:00Z,';
 const r=await run('collaboration.schedule','bad.csv',source);const codes=parsed(r,'schedule-report.json').findings.map(f=>f.code);for(const c of ['OWNER_OVERLAP','DEPENDENCY_CYCLE','DEPENDENCY_ORDER','MISSING_DEPENDENCY','INVALID_TIME'])assert.ok(codes.includes(c),c);assert.ok(!r.outputs.some(o=>o.name.endsWith('.ics')));
});
test('requirements validator generates actual traceability and detects missing acceptance/references/cycles',async()=>{
 const good=await run('requirements.check','requirements.json',sample('requirements.check'));assert.equal(parsed(good,'requirements-report.json').findings.length,0);assert.match(decoded(good,'traceability.md'),/R1/);
 const invalid={project:'项目',requirements:[{id:'A',title:'甲',dependsOn:['B']},{id:'B',title:'乙',dependsOn:['A','missing']}],acceptance:[{id:'T',requirementId:'missing',check:'核对'}]};const bad=await run('requirements.check','invalid.json',JSON.stringify(invalid));const codes=parsed(bad,'requirements-report.json').findings.map(f=>f.code);for(const c of ['MISSING_DEPENDENCY','NO_ACCEPTANCE','ORPHAN_ACCEPTANCE','DEPENDENCY_CYCLE'])assert.ok(codes.includes(c));
 await assert.rejects(()=>run('requirements.check','x.json','{}'),/示例JSON/);
});
test('HTML checker reports genuine line-level static problems without executing script or claiming browser coverage',async()=>{
 const good=await run('web.audit','page.html',sample('web.audit'));assert.equal(parsed(good,'html-audit.json').findings.length,0);
 const bad=await run('web.audit','bad.html','<!doctype html><html><head></head><body><img src="http://localhost/x"><input><div id="dup"></div><div id="dup"></div><a href="#absent">go</a><script>throw Error("MUST NOT RUN")</script></body></html>');const report=parsed(bad,'html-audit.json');for(const code of ['MISSING_LANG','MISSING_TITLE','MISSING_ALT','MISSING_LABEL','DUPLICATE_ID','BROKEN_ANCHOR','LOCALHOST_URL'])assert.ok(report.findings.some(f=>f.code===code),code);assert.match(bad.summary,/未执行浏览器/);
});
test('JavaScript parser catches syntax and actual risky constructs, never runs uploaded code',async()=>{
 const bad=await run('code.inspect','bad.js','function {');assert.equal(parsed(bad,'javascript-report.json').syntaxValid,false);
 const r=await run('code.inspect','source.js','eval(userInput);\ndocument.body.innerHTML = userInput;\nconst endpoint = "http://localhost:3000";\nthrow new Error("must not run");');const report=parsed(r,'javascript-report.json');assert.equal(report.syntaxValid,true);for(const code of ['DYNAMIC_EVAL','HTML_ASSIGNMENT','LOCALHOST_URL'])assert.ok(report.findings.some(f=>f.code===code));
});
test('real service worker persists image parameters, rejects forged parameters and protects resulting files',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());
 async function post(params,skill='image.marketing',expert='visual'){const form=new FormData();form.set('file',new File([await red()],'red.png'));form.set('skillId',skill);form.set('expertId',expert);form.set('consent','true');if(params!==undefined)form.set('parameters',JSON.stringify(params));return service.handle(new Request('http://local/api/skill-runs',{method:'POST',body:form}),'alice');}
 assert.equal((await post({title:'标题',command:'rm -rf /'})).status,400);assert.equal((await post(undefined)).status,400);assert.equal((await post({title:'标题'},'image.product','product-visual')).status,400);
 const response=await post({title:'实际排版',subtitle:'来源照片',action:'了解更多'});assert.equal(response.status,202);const queued=await response.json();let result;
 for(let i=0;i<200;i++){result=await(await service.handle(new Request(`http://local/api/skill-runs/${queued.id}`),'alice')).json();if(!['queued','running'].includes(result.status))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(result.status,'succeeded',result.error);assert.equal(result.options.parameters.title,'实际排版');assert.equal(result.artifacts.length,7);assert.equal((await service.handle(new Request(`http://local/api/skill-runs/${queued.id}/artifacts/${result.artifacts[0].id}`),'bob')).status,404);
});
test('OCR runs inside the bounded service worker, not only when called directly',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="140"><rect width="100%" height="100%" fill="white"/>${await textPaths('SALES 12345',20,90,50,650,1,'#000')}</svg>`;const png=await sharp(Buffer.from(svg)).png().toBuffer();const form=new FormData();form.set('file',new File([png],'scan.png'));form.set('skillId','image.ocr');form.set('expertId','documents');form.set('consent','true');const q=await(await service.handle(new Request('http://local/api/skill-runs',{method:'POST',body:form}),'alice')).json();let r;
 for(let i=0;i<300;i++){r=await(await service.handle(new Request(`http://local/api/skill-runs/${q.id}`),'alice')).json();if(!['queued','running'].includes(r.status))break;await new Promise(resolve=>setTimeout(resolve,50));}assert.equal(r.status,'succeeded',r.error);assert.ok(r.events.some(e=>e.message.includes('OCR完成')));
});
