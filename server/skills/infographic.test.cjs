const {test}=require('node:test');const assert=require('node:assert/strict');const {createHash,randomUUID}=require('node:crypto');const sharp=require('sharp');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');const {readInfographic}=require('../../dist/local/server/skills/infographic.js');const {SkillService}=require('../../dist/local/server/skills/service.js');const {planningCandidates,validateDecision}=require('../../dist/local/server/skills/planner.js');const {fixture}=require('./testing/infographic-fixtures.cjs');
const bytes=v=>Buffer.from(JSON.stringify(v));const run=v=>executeSkill({skillId:'infographic.compose',filename:'input.json',bytes:bytes(v),deduplicate:false});const parse=r=>JSON.parse(Buffer.from(r.outputs.find(o=>o.name==='infographic-report.json').bytes));const hash=b=>createHash('sha256').update(b).digest('hex');
async function finished(s,id){for(let i=0;i<1800;i++){const r=await(await s.handle(new Request('http://local/api/skill-runs/'+id),'owner')).json();if(!['queued','running'].includes(r.status))return r;await new Promise(r=>setTimeout(r,20));}throw Error('worker timed out');}
function request(v,extra={}){const f=new FormData();for(const [k,val]of Object.entries({skillId:'infographic.compose',expertId:'infographics',consent:'true',requestId:randomUUID(),...extra}))f.set(k,val);f.set('file',new File([bytes(v)],'data.json'));return new Request('http://local/api/skill-runs',{method:'POST',body:f});}

test('REAL SVG and PNG infographic contains actual values, source hashes and disclosed rule selection',async()=>{
 const data=fixture(),r=await run(data),report=parse(r),svg=r.outputs.find(o=>o.name==='infographic.svg'),png=r.outputs.find(o=>o.name==='infographic.png');assert.equal(report.chartType,'zero-baseline-bars');assert.equal(report.sourceSHA256,hash(bytes(data)));assert.deepEqual(report.rows.map(r=>r.value),['128.5','96.2','73.8','155.6']);assert.deepEqual(report.kpis.map(k=>k.value),['73.8','155.6','4']);assert.equal(report.sourceIndependentlyVerified,false);assert.match(report.selectionMethod,/not AI/);
 assert.equal(hash(svg.bytes),report.render.svgSHA256);assert.equal(hash(png.bytes),report.render.pngSHA256);const meta=await sharp(png.bytes).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,report.render.height);const stats=await sharp(png.bytes).stats();assert.ok(stats.channels.some(c=>c.stdev>20));assert.match(Buffer.from(svg.bytes).toString(),/SIL OPEN FONT LICENSE/);assert.match(Buffer.from(svg.bytes).toString(),/<path /);
});
test('comparison uses a real shared zero baseline for negative values and retains source order',async()=>{
 const v=fixture();v.data=[{label:'负值',value:'-10'},{label:'正值',value:'20'},{label:'零值',value:'0'}];const report=parse(await run(v));assert.deepEqual(report.domain,{min:'-10',max:'20'});assert.ok(report.geometry[0].valueX<report.geometry[0].zeroX);assert.ok(report.geometry[1].valueX>report.geometry[1].zeroX);assert.equal(report.geometry[2].valueX,report.geometry[2].zeroX);assert.deepEqual(report.rows.map(r=>r.sourceRow),[1,2,3]);
});
test('trend sorts actual dates while preserving provenance and plots elapsed time instead of ordinal spacing',async()=>{
 const r=parse(await run(fixture('trend')));assert.equal(r.chartType,'date-line');assert.deepEqual(r.rows.map(r=>r.sourceRow),[2,3,1]);assert.equal(r.change,'50');assert.equal(r.changePercent,'50');assert.equal(r.missingDatesFilled,false);const [a,b,c]=r.geometry;assert.ok(Math.abs((b.x-a.x)/(c.x-a.x)-1/3)<1e-12);assert.deepEqual(r.kpis.map(k=>k.value),['100','150','50']);
});
test('zero/negative base dates produce no invented percentage or misleading artificial nonzero observations',async()=>{
 for(const base of ['0','-10']){const v=fixture('trend');v.data=[{label:'2026-09-01',value:base},{label:'2026-09-02',value:'0'}];const r=parse(await run(v));assert.equal(r.changePercent,null);assert.ok(r.notes.some(n=>n.includes('不提供变化率')));if(base==='0'){assert.deepEqual(r.domain,{min:'0',max:'1'});assert.ok(r.notes.some(n=>n.includes('全部观测为零')));assert.ok(r.rows.every(r=>r.value==='0'));assert.equal(r.geometry[0].y,r.geometry[1].y);}}
});
test('composition uses actual decimal total, preserves zero shares and discloses rounded share sum',async()=>{
 const v=fixture('composition');v.data=[{label:'甲',value:'0.1'},{label:'乙',value:'0.1'},{label:'丙',value:'0.1'},{label:'零',value:'0'}];const r=parse(await run(v));assert.equal(r.total,'0.3');assert.equal(r.displayedSharesSum,'99.99');assert.equal(r.rows[0].shareDisplay,'33.33%');assert.equal(r.rows[3].shareDisplay,'0.00%');assert.equal(r.geometry[3].width,0);assert.equal(r.userDeclaredPartsCompleteAndDisjoint,true);assert.ok(Math.abs(r.geometry.reduce((n,g)=>n+g.width,0)-1028)<1e-9);
});
test('schema rejects unconfirmed composition, negatives, invalid dates, duplicate categories and missing/mixed-unit data',()=>{
 const invalid=[{...fixture('composition'),compositionConfirmed:false},{...fixture('composition'),data:[{label:'a',value:'-1'},{label:'b',value:'1'}]},{...fixture('composition'),data:[{label:'a',value:'0'},{label:'b',value:'0'}]},{...fixture('trend'),data:[{label:'2026-02-30',value:'1'},{label:'2026-03-01',value:'2'}]},{...fixture(),unit:''},{...fixture(),scope:''},{...fixture(),source:''},{...fixture(),script:'eval()'},{...fixture(),data:[{label:'a',value:'1'},{label:'a',value:'2'}]}];
 for(const value of [null,true,'1万元','1,000','001','0.0000001','1000000000001',Infinity])invalid.push({...fixture(),data:[{label:'a',value},{label:'b',value:'2'}]});for(const v of invalid)assert.throws(()=>readInfographic(bytes(v)));
 assert.equal(readInfographic(bytes({...fixture('trend'),data:[{label:'2024-02-29',value:'1'},{label:'2024-03-01',value:'2'}]})).points.length,2);
});
test('resource/cardinality and label limits fail without silently truncating input',()=>{
 for(const v of [{...fixture(),data:Array.from({length:25},(_,i)=>({label:String(i),value:1}))},{...fixture('composition'),data:Array.from({length:13},(_,i)=>({label:String(i),value:1}))},{...fixture(),title:'长'.repeat(37)},{...fixture(),data:[{label:'x\n',value:1},{label:'y',value:2}]},{...fixture(),data:[{label:'x',value:1,unit:'different'},{label:'y',value:2}]}])assert.throws(()=>readInfographic(bytes(v)));
});
test('boundary-sized labels and values render all data rows within image dimension bounds',async()=>{
 const v=fixture();v.title='标题'.repeat(18);v.metric='指标'.repeat(10);v.unit='单位'.repeat(6);v.source='来源'.repeat(60);v.scope='口径'.repeat(60);v.data=Array.from({length:24},(_,i)=>({label:'渠道'.repeat(10)+String(i),value:i%2?'999999999999.999999':'-999999999999.999999'}));const r=parse(await run(v));assert.equal(r.rows.length,24);assert.ok(r.render.width*r.render.height<6000000);assert.equal(r.rows[0].value,'-999999999999.999999');
});
test('untrusted markup is escaped in metadata and rendered as glyphs, not executable SVG or remote content',async()=>{
 const v=fixture();v.title='<script>alert(1)</script>';v.source='https://untrusted.invalid/image.svg';const r=await run(v);const svg=Buffer.from(r.outputs[0].bytes).toString();assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('href='));assert.ok(!svg.includes('<foreignObject'));assert.ok(svg.includes('&lt;script&gt;'));assert.equal(parse(r).source,v.source);
});
test('actual bounded worker persists artifacts and source receipt with owner-only downloads; malformed data gets no artifact',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());const response=await s.handle(request(fixture()),'owner');assert.equal(response.status,202);const q=await response.json(),r=await finished(s,q.id);assert.equal(r.status,'succeeded',r.error);assert.equal(r.artifacts.length,5);const a=r.artifacts.find(a=>a.name==='infographic-report.json'),url='http://local/api/skill-runs/'+q.id+'/artifacts/'+a.id;assert.equal((await s.handle(new Request(url),'other')).status,404);assert.equal((await(await s.handle(new Request(url),'owner')).json()).rows.length,4);assert.equal((await s.handle(request(fixture(),{parameters:'{"purpose":"other"}'}),'owner')).status,400);
 const bad=await(await s.handle(request({...fixture(),unit:''}),'owner')).json();const failed=await finished(s,bad.id);assert.equal(failed.status,'failed');assert.equal(failed.artifacts.length,0);
});
test('planner does not substitute this explicit JSON workflow for arbitrary CSV, prose or another expert',()=>{
 const d={kind:'plan',expertId:'infographics',skillId:'infographic.compose',reason:'按用户明确目的制作图表',options:{deduplicate:false}};assert.equal(validateDecision(d,planningCandidates({file:{name:'source.json'}})).skillId,d.skillId);assert.throws(()=>validateDecision(d,planningCandidates({file:{name:'source.csv'}})));assert.throws(()=>validateDecision({...d,expertId:'data'},planningCandidates({file:{name:'source.json'}})));
});

test('JSON numeric lexemes preserve decimal precision and reject silently rounded or underflowed values',async()=>{
 const source=literal=>Buffer.from(JSON.stringify({...fixture(),data:[{label:'甲',value:'NUMERIC_TOKEN'},{label:'乙',value:'0'}]}).replace('"NUMERIC_TOKEN"',literal));
 const b=source('999999999999.999999'),v=readInfographic(b);assert.equal(v.points[0].value.toFixed(),'999999999999.999999');
 const r=await executeSkill({skillId:'infographic.compose',filename:'numbers.json',bytes:b,deduplicate:false});assert.equal(parse(r).rows[0].value,'999999999999.999999');assert.equal(parse(r).sourceSHA256,hash(b));
 assert.equal(readInfographic(source('1e-6')).points[0].value.toFixed(),'0.000001');assert.equal(readInfographic(source('-0')).points[0].value.toFixed(),'0');
 for(const raw of ['1.0000000000000001','1000000000000.000001','1e-7','1e9999','1e-99999999999999999','1'.repeat(65)])assert.throws(()=>readInfographic(source(raw)));
 const f=fixture();f.data[0].value={source:'1'};assert.throws(()=>readInfographic(bytes(f)));
});
