function fixture(purpose='comparison'){
 return {title:'渠道收入对比',purpose,metric:'确认收入',unit:'万元',scope:purpose==='trend'?'2026年9月累计确认收入；仅列出已提供观测日期':'2026年9月已确认收入，各渠道采用相同记账口径',source:'演示样例，未独立验证业务事实',...(purpose==='composition'?{compositionConfirmed:true}:{}),data:purpose==='trend'?[{label:'2026-09-04',value:'150'},{label:'2026-09-01',value:'100'},{label:'2026-09-02',value:'125'}]:[{label:'线上直营',value:'128.5'},{label:'线下门店',value:'96.2'},{label:'合作渠道',value:'73.8'},{label:'企业客户',value:'155.6'}]};
}
module.exports={fixture};
