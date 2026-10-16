const ExcelJS=require('exceljs');
async function formulaWorkbook(){
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('明细');sheet.addRows([['项目','单价','数量','金额'],['服务A',0.1,3,{formula:'B2*C2',result:999}],['服务B',12.5,2,{formula:'ROUND(B3*C3,2)',result:-999}]]);
 const totals=book.addWorksheet('汇总');totals.addRows([['指标','结果'],['总金额',{formula:"SUM('明细'!D2:D3)",result:0}],['平均单价',{formula:"AVERAGE('明细'!B2:B3)",result:0}],['数量',{formula:"SUM('明细'!C2:C3)",result:999}],['折扣金额',{formula:'ROUND(B2*90%,2)',result:0}]]);
 return {book,bytes:Buffer.from(await book.xlsx.writeBuffer())};
}
module.exports={formulaWorkbook};
