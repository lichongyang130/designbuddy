import test from 'node:test'
import assert from 'node:assert/strict'
import {parseLines,matchFilename,departmentStatus,fileIssues,reminder,progressCsv} from '../apps/web/public/collection-core.js'

function task(){return {title:'月报',deadline:'2026-11-25T17:00',departments:['综合部','财务部','人事部'],requirements:[{name:'工作总结',types:'docx',keywords:'本月工作,下月计划'},{name:'进度表',types:'xlsx',keywords:''}],replies:{},files:[]}}

test('collection only suggests unambiguous filename matches',()=>{
 assert.deepEqual(parseLines('综合部\n财务部\n综合部'),['综合部','财务部'])
 const requirements=[{name:'工作总结'},{name:'进度表'}]
 assert.equal(matchFilename('综合部-工作总结.docx',['综合部','财务部'],requirements).department,'综合部')
 assert.equal(matchFilename('综合部财务部-工作总结.docx',['综合部','财务部'],requirements).department,'')
 assert.equal(matchFilename('工作总结-进度表.docx',['综合部'],requirements).requirement,'')
})

test('unconfirmed files never count, confirmed versions retain missing and issue states',()=>{
 const t=task(),f={name:'综合部工作总结.docx',department:'综合部',requirement:'工作总结',size:100,text:'本月工作 下月计划',confirmed:false,final:false,error:'',partial:false}
 t.files.push(f as never);assert.equal(departmentStatus(t,'综合部').status,'未提交')
 f.confirmed=true;f.final=true;assert.equal(departmentStatus(t,'综合部').status,'部分提交')
 t.files.push({...f,name:'进度表.xlsx',requirement:'进度表'} as never);assert.equal(departmentStatus(t,'综合部').status,'已齐全')
 f.text='本月工作';assert.equal(departmentStatus(t,'综合部').status,'需补正');assert.match(departmentStatus(t,'综合部').issues[0],/下月计划/)
 f.name='错误.pdf';assert.match(fileIssues(f,t.requirements[0]).join(' '),/格式不符/)
 f.final=false;assert.equal(departmentStatus(t,'综合部').status,'部分提交')
})

test('reminders distinguish replies and missing materials, CSV is formula safe',()=>{
 const t=task();t.replies['综合部']='已回复';assert.doesNotMatch(reminder(t,t.departments,'reply'),/综合部/);assert.match(reminder(t,t.departments,'missing'),/工作总结、进度表/)
 t.departments.push('=CMD()');assert.match(progressCsv(t),/"'=CMD\(\)"/)
})
