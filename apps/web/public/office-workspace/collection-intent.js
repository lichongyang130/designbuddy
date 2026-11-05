// Suggestions are derived only from text the user supplied, never from filenames or invented context.
const splitList=s=>String(s).split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean)
const concreteDepartment=x=>!/[：:]/.test(x)&&!/^(?:各|所有|相关|其他)(?:部门|单位)$/.test(x)&&!/^[零一二三四五六七八九十百两0-9]+个?(?:部门|单位)$/.test(x)
function fields(text,names){
 const labels=names.join('|'), re=new RegExp(`(?:^|[；;\\n])\\s*(?:${labels})\\s*[：:]\\s*([^；;\\n]+)`,'g')
 return [...text.matchAll(re)].map(m=>m[1].trim()).filter(Boolean)
}
function validLocalDate(value){
 const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value);if(!m)return ''
 const [year,month,day,hour,minute]=m.slice(1).map(Number),d=new Date(year,month-1,day,hour,minute)
 return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day&&d.getHours()===hour&&d.getMinutes()===minute?`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`:''
}
export function suggestCollectionDraft(input){
 const text=String(input||'').trim(),warnings=[]
 const title=text.length<=120?text.replace(/\s+/g,' '):'';if(text.length>120)warnings.push('需求超过任务名称长度，请手动填写较短名称。')
 let departments=[];const ds=fields(text,['部门名单','部门']);if(ds.length===1){const values=splitList(ds[0]);if(values.length&&values.every(x=>x.length<=80&&concreteDepartment(x)))departments=[...new Set(values)]}
 else if(ds.length>1)warnings.push('发现多处部门名单，请手动核对。')
 if(!ds.length){const matches=[...text.matchAll(/(?:收集|收取)([^，,；;。\n]{1,100}?(?:部门|部|处|局|室|中心|科|组))的/g)];if(matches.length===1){const values=splitList(matches[0][1]);if(values.length&&values.every(x=>/^[\p{Script=Han}A-Za-z0-9\s]{1,80}(?:部|处|局|室|中心|科|组)$/u.test(x)&&!/[和及]/.test(x)&&concreteDepartment(x)))departments=[...new Set(values)]}}
 let materials=[];const ms=fields(text,['必交材料','材料']);if(ms.length===1){materials=(ms[0].includes('|')?[ms[0]]:splitList(ms[0])).filter(x=>x.length<=200&&!/[。！？：:]/.test(x))}else if(ms.length>1)warnings.push('发现多处材料要求，请手动核对。')
 if(!ms.length){const matches=[...text.matchAll(/的([^，,；;。\n]{1,30}?(?:总结|报告|方案|报表))(?=并|，|,|；|;|。|$)/g)];if(matches.length===1)materials=[matches[0][1]]}
 const recipient=fields(text,['交付对象','交给']);let deliveryTo=recipient.length===1&&recipient[0].length<=120&&!/[：:]/.test(recipient[0])?recipient[0]:'';if(!recipient.length){const matches=[...text.matchAll(/交给([^，,；;。\n]{1,30}?)(?=，|,|；|;|。|$)/g)];if(matches.length===1)deliveryTo=matches[0][1]}
 const contacts=fields(text,['联系人']);const contact=contacts.length===1&&contacts[0].length<=120&&!/[：:]/.test(contacts[0])?contacts[0]:''
 const deadlines=fields(text,['截止时间','截止']);let deadline=deadlines.length===1?validLocalDate(deadlines[0]):''
 if(!deadlines.length){const dates=[...text.matchAll(/\b(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})(?:前|截止)/g)];if(dates.length===1)deadline=validLocalDate(dates[0][1])}
 if(!deadline)warnings.push('截止时间未明确到完整日期和时间，请自行填写或确认无固定截止。')
 if(!departments.length)warnings.push('未识别出明确的部门名单；“各部门”不等于具体名单。')
 if(!materials.length)warnings.push('未识别出明确的必交材料，请自行填写。')
 if(materials.some(x=>!String(x.split('|')[1]||'').trim()))warnings.push('材料格式未明确，请填写格式或人工确认不限格式。')
 if(!deliveryTo)warnings.push('未明确交付对象。')
 if(!contact)warnings.push('未明确工作联系人。')
 return {title,departments,materials,deadline,deliveryTo,contact,warnings}
}
