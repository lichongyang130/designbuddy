import test from 'node:test'
import assert from 'node:assert/strict'
import {isOverdue,localDate,taskSnapshot,taskReport} from '../apps/web/public/office-workspace/task-core.js'
test('task progress only reflects manually recorded facts and local due dates',()=>{
 const t={id:'1',title:'收集材料',owner:'财务部',status:'进行中',due:'2026-11-04',notes:''}
 assert.equal(localDate(new Date(2026,10,5,12)),'2026-11-05');assert.equal(isOverdue(t,'2026-11-05'),true)
 assert.equal(isOverdue({...t,status:'已完成'},'2026-11-05'),false);assert.equal(isOverdue({...t,due:''},'2026-11-05'),false)
 const report=taskReport([t],'2026-11-05');assert.match(report,/财务部/);assert.match(report,/已超过所填日期/);assert.match(report,/不代表实际完成情况/)
 const snapshot=taskSnapshot([t],'2026-11-05');assert.notEqual(snapshot,taskSnapshot([{...t,status:'已完成'}],'2026-11-05'));assert.notEqual(snapshot,taskSnapshot([t],'2026-11-06'))
})
