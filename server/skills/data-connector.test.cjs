const {test}=require('node:test');const assert=require('node:assert/strict');const {mkdtempSync,writeFileSync,readFileSync,existsSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');const http=require('node:http');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');
const {validateConnectorConfig,compareCursor,coerceValue}=require('../../dist/local/server/skills/data-connector.js');

const run=(config,filename='connectors.json')=>executeSkill({skillId:'data.connect',filename,bytes:new TextEncoder().encode(JSON.stringify(config)),deduplicate:false});
const artifact=(result,name)=>JSON.parse(Buffer.from(result.outputs.find(output=>output.name===name).bytes).toString('utf8'));
const text=(result,name)=>Buffer.from(result.outputs.find(output=>output.name===name).bytes).toString('utf8');

function withRoots(fn){const previousRoots=process.env.SKILL_CONNECTOR_ROOTS,previousHosts=process.env.SKILL_CONNECTOR_ALLOWED_HOSTS,previousTokens=process.env.SKILL_CONNECTOR_TOKENS;return async()=>{try{return await fn();}finally{if(previousRoots===undefined)delete process.env.SKILL_CONNECTOR_ROOTS;else process.env.SKILL_CONNECTOR_ROOTS=previousRoots;if(previousHosts===undefined)delete process.env.SKILL_CONNECTOR_ALLOWED_HOSTS;else process.env.SKILL_CONNECTOR_ALLOWED_HOSTS=previousHosts;if(previousTokens===undefined)delete process.env.SKILL_CONNECTOR_TOKENS;else process.env.SKILL_CONNECTOR_TOKENS=previousTokens;}}}

test('CSV connector reads real files, maps fields, coerces types and tags every row with its source',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'connector-csv-'));
 const restore=withRoots(async()=>{
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  writeFileSync(join(dir,'orders.csv'),'order_id,amount,paid\nA-1,12.5,true\nA-2,7,false\n');
  const result=await run({connectors:[{id:'orders',type:'csv',path:'orders.csv',cursorField:'order_id',fields:[{source:'order_id',target:'订单号',type:'string'},{source:'amount',target:'金额',type:'number'},{source:'paid',target:'已付款',type:'boolean'}]}],statePath:'state.json',auditPath:'audit.jsonl'});
  const rows=artifact(result,'connected-rows.json').rows;
  assert.equal(rows.length,2);
  assert.equal(rows[0]['订单号'],'A-1');assert.equal(rows[0]['金额'],12.5);assert.equal(rows[0]['已付款'],true);
  assert.equal(rows[1]['已付款'],false);
  assert.equal(rows[0].__source.connector,'orders');assert.equal(rows[0].__source.type,'csv');assert.equal(rows[0].__source.rowIndex,1);assert.ok(rows[0].__source.origin.endsWith('orders.csv'));
  assert.ok(rows[0].__fetchedAt);
  const report=artifact(result,'connector-report.json');
  assert.equal(report.connectors[0].rowsRead,2);assert.equal(report.connectors[0].rowsEmitted,2);assert.equal(report.connectors[0].cursorAfter,'A-2');assert.equal(report.connectors[0].incremental,true);
  assert.match(text(result,'connected-rows.csv'),/订单号,金额,已付款/);
  assert.equal(existsSync(join(dir,'state.json')),true);
  const state=JSON.parse(readFileSync(join(dir,'state.json'),'utf8'));assert.equal(state.orders.cursor,'A-2');
  assert.match(readFileSync(join(dir,'audit.jsonl'),'utf8'),/connector\.pull/);
 });
 await restore();
});

test('cursor makes the second run incremental and skips rows already delivered',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'connector-cursor-'));
 const restore=withRoots(async()=>{
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  writeFileSync(join(dir,'rows.csv'),'id,name\n1,一\n2,二\n3,三\n');
  await run({connectors:[{id:'rows',type:'csv',path:'rows.csv',cursorField:'id'}],statePath:'state.json'});
  writeFileSync(join(dir,'rows.csv'),'id,name\n1,一\n2,二\n3,三\n4,四\n');
  const second=await run({connectors:[{id:'rows',type:'csv',path:'rows.csv',cursorField:'id'}],statePath:'state.json'});
  const report=artifact(second,'connector-report.json');
  assert.equal(report.connectors[0].rowsRead,4);
  assert.equal(report.connectors[0].rowsEmitted,1);
  assert.equal(report.connectors[0].rowsSkippedByCursor,3);
  assert.equal(report.connectors[0].cursorAfter,'4');
  assert.equal(artifact(second,'connected-rows.json').rows[0]['name'],'四');
 });
 await restore();
});

test('JSON and SQLite connectors read real data without executing user SQL',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'connector-db-'));
 const restore=withRoots(async()=>{
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  writeFileSync(join(dir,'items.json'),JSON.stringify({data:{items:[{sku:'X1',stock:4}]}}));
  const {DatabaseSync}=require('node:sqlite');
  const database=new DatabaseSync(join(dir,'stock.sqlite'));
  database.exec('CREATE TABLE stock (sku TEXT, qty INTEGER)');
  database.prepare('INSERT INTO stock (sku, qty) VALUES (?, ?)').run('X1',4);
  database.close();
  const result=await run({connectors:[{id:'items',type:'json',path:'items.json',itemsPath:'data.items'},{id:'stock',type:'sqlite',path:'stock.sqlite',table:'stock'}]});
  const rows=artifact(result,'connected-rows.json').rows;
  assert.equal(rows.length,2);
  assert.equal(rows[0].sku,'X1');assert.equal(rows[0].stock,4);
  assert.match(rows[1].__source.origin,/stock\.sqlite#stock/);
 });
 await restore();
});

test('remote JSON source requires an allow-listed origin and reads the bearer token from the server environment',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'connector-http-'));
 const server=http.createServer((request,response)=>{
  if(request.headers.authorization!=='Bearer secret-token'){response.writeHead(401).end('{"error":"unauthorized"}');return;}
  response.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({rows:[{id:'R1',value:9}]}));
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const port=server.address().port;
 const restore=withRoots(async()=>{
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  process.env.SKILL_CONNECTOR_ALLOWED_HOSTS=`http://127.0.0.1:${port}`;
  process.env.SKILL_CONNECTOR_TOKENS=JSON.stringify({[`http://127.0.0.1:${port}`]:'secret-token'});
  const result=await run({connectors:[{id:'remote',type:'http-json',url:`http://127.0.0.1:${port}/api/rows`,itemsPath:'rows'}]});
  const rows=artifact(result,'connected-rows.json').rows;
  assert.equal(rows.length,1);assert.equal(rows[0].id,'R1');assert.equal(rows[0].value,9);
  assert.equal(rows[0].__source.type,'http-json');
 });
 await restore();
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  process.env.SKILL_CONNECTOR_ALLOWED_HOSTS='https://api.example.com';
  await assert.rejects(async()=>run({connectors:[{id:'remote',type:'http-json',url:`http://127.0.0.1:${port}/api/rows`}]}),/不在服务端允许列表内/);
  delete process.env.SKILL_CONNECTOR_ROOTS;delete process.env.SKILL_CONNECTOR_ALLOWED_HOSTS;delete process.env.SKILL_CONNECTOR_TOKENS;
  server.close();
});

test('paths outside the allowed roots, unknown fields, bad types and missing sources fail closed',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'connector-guard-'));
 const restore=withRoots(async()=>{
  process.env.SKILL_CONNECTOR_ROOTS=dir;
  await assert.rejects(async()=>run({connectors:[{id:'x',type:'csv',path:'../../etc/passwd'}]}),/不在允许目录内/);
  await assert.rejects(async()=>run({connectors:[{id:'x',type:'csv',path:'a.csv',unknown:1}]}),/未知字段/);
  await assert.rejects(async()=>run({connectors:[{id:'x',type:'csv',path:'a.csv',fields:[{source:'a',target:'b',type:'money'}]}]}),/字段类型/);
  writeFileSync(join(dir,'a.csv'),'a,b\n1,2\n');
  await assert.rejects(async()=>run({connectors:[{id:'x',type:'csv',path:'a.csv',fields:[{source:'a',target:'甲',type:'number'},{source:'missing',target:'乙',type:'string'}]}]}),/缺少来源字段/);
  writeFileSync(join(dir,'b.csv'),'a,b\nxyz,2\n');
  await assert.rejects(async()=>run({connectors:[{id:'x',type:'csv',path:'b.csv',fields:[{source:'a',target:'甲',type:'number'}]}]}),/无法转换为数值/);
 });
 await restore();
});

test('connector config and coercion helpers keep the documented boundaries',()=>{
 assert.throws(()=>validateConnectorConfig({id:'bad id',type:'csv',path:'a.csv'}),/id/);
 assert.throws(()=>validateConnectorConfig({id:'a',type:'mongo',path:'a.csv'}),/类型/);
 assert.throws(()=>validateConnectorConfig({id:'a',type:'sqlite',path:'a.sqlite',table:'a b;drop'}),/表名/);
 assert.throws(()=>validateConnectorConfig({id:'a',type:'csv',path:'a.json'}),/扩展名/);
 assert.equal(compareCursor(5,'3'),1);assert.equal(compareCursor(5,'5'),0);assert.equal(compareCursor(5,'7'),-1);
 assert.equal(coerceValue('12','number','x'),12);assert.equal(coerceValue('true','boolean','x'),true);
 assert.throws(()=>coerceValue('1,5','number','x'),/无法转换为数值/);
});
