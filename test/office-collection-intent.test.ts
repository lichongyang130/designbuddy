import test from 'node:test'
import assert from 'node:assert/strict'
import {suggestCollectionDraft} from '../apps/web/public/office-workspace/collection-intent.js'
test('draft extracts explicit labels without inventing dates, contacts or requirements',()=>{
 const d=suggestCollectionDraft('收集月报；部门：财务部、人事部；材料：工作总结 | docx | 完成情况,下一步计划；截止时间：2026-11-30 18:00；交付对象：办公室；联系人：小李')
 assert.deepEqual(d.departments,['财务部','人事部']);assert.deepEqual(d.materials,['工作总结 | docx | 完成情况,下一步计划']);assert.equal(d.deadline,'2026-11-30T18:00');assert.equal(d.deliveryTo,'办公室');assert.equal(d.contact,'小李');assert.deepEqual(d.warnings,[])
})
test('natural wording suggests only explicit names; each is still a reviewable suggestion',()=>{
 const d=suggestCollectionDraft('收集财务部、人事部的月度总结，并核对未交名单');assert.deepEqual(d.departments,['财务部','人事部']);assert.deepEqual(d.materials,['月度总结']);assert.equal(d.deadline,'');assert.equal(d.deliveryTo,'');assert.ok(d.warnings.some(x=>x.includes('格式')))
})
test('ambiguous, conflicting and invalid information remains unfilled',()=>{
 let d=suggestCollectionDraft('收集各部门月度总结，11月30日前交给办公室');assert.deepEqual(d.departments,[]);assert.equal(d.deadline,'');assert.equal(d.deliveryTo,'办公室')
 d=suggestCollectionDraft('收集；部门：财务部；部门：人事部；材料：总结；截止时间：2026-02-30 18:00');assert.deepEqual(d.departments,[]);assert.equal(d.deadline,'')
 d=suggestCollectionDraft('2026-11-30 18:00召开会议，收集财务部和人事部的报告');assert.deepEqual(d.departments,[]);assert.equal(d.deadline,'')
 d=suggestCollectionDraft('部门：财务部，材料：总结');assert.deepEqual(d.departments,[])
 d=suggestCollectionDraft('收集12个部门的月度总结');assert.deepEqual(d.departments,[]);assert.deepEqual(d.materials,['月度总结'])
})
