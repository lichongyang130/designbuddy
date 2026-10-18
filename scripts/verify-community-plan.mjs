import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const path = new URL('../docs/plans/community-180-manifest.json', import.meta.url);
const {entries,baseline,addedTarget,targetTotal}=JSON.parse(readFileSync(path,'utf8'));
const categories=['原型','幻灯片','文档','图片','HyperFrames','视频','音频','实时产物','WebGL'];
assert.equal(entries.length,180);assert.equal(addedTarget,180);assert.equal(baseline+addedTarget,targetTotal);assert.equal(targetTotal,193);
assert.equal(new Set(entries.map(e=>e.id)).size,180);assert.equal(new Set(entries.map(e=>e.title)).size,180);
for(const category of categories)assert.equal(entries.filter(e=>e.category===category).length,20,category);
for(const entry of entries){assert(categories.includes(entry.category));assert(Number.isInteger(entry.targetPages)&&entry.targetPages>=20&&entry.targetPages<=30);assert(['planned','verification','verified'].includes(entry.status));if(entry.status==='planned')assert.equal(entry.route,null);else assert.equal(entry.route,`/inspiration/${entry.id}`);}
console.log(`Production plan: 180 unique entries, 9 × 20; ${entries.filter(e=>e.status==='verified').length} verified. Planned entries are not live templates.`);
// Keep the shipped catalog and server allowlist aligned with verified work.
const shared=readFileSync(new URL('../apps/web/src/inspiration/samples/shared.tsx',import.meta.url),'utf8');
const catalog=shared.split('export const samples:')[1].split('export type DraftRecord')[0];
const shipped=[...catalog.matchAll(/\bid:\s*["']([^"']+)["']/g)].map(m=>m[1]);
const verified=entries.filter(e=>e.status==='verified');
assert.equal(shipped.length,baseline+verified.length,'Only verified additions belong in the shipped catalog');
for(const entry of verified){assert(shipped.includes(entry.id));assert.equal(entry.implementedPages,entry.targetPages);assert(entry.verification?.length>20);}
for(const entry of entries.filter(e=>e.status==='planned'))assert(!shipped.includes(entry.id),'Planned work must not masquerade as a shipped template');
const backend=readFileSync(new URL('../server/api/workspace-backend.ts',import.meta.url),'utf8').match(/const samples = new Set\(\[([\s\S]*?)\]\)/)?.[1]||'';
for(const id of shipped)assert(backend.includes(`"${id}"`),`${id} needs server backup support`);
console.log(`Catalog: ${shipped.length} shipped works; ${entries.length-verified.length} additions remain unimplemented.`);
