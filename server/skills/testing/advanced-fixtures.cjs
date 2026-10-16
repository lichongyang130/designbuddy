const ExcelJS = require('exceljs');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
process.env.DESIGNBUDDY_ASSET_ROOT ||= require('node:path').resolve(__dirname, '../../..');
const { textPaths } = require('../../../dist/local/server/skills/fonts.js');
async function workbook(left=[['编号','金额'],['001',10],['1',20],[1,30],['missing',40],['',50],['001',60]],right=[['编号','客户'],['001','客户甲'],[1,'数值客户'],['unused','未使用'],['','空编号']]) {
 const book=new ExcelJS.Workbook();book.addWorksheet('订单').addRows(left);book.addWorksheet('客户').addRows(right);return {book,bytes:Buffer.from(await book.xlsx.writeBuffer())};
}
async function scannedPDF({blank=false,rotate=false,pages=2}={}) {
 const pdf=await PDFDocument.create();
 for(let i=0;i<pages;i++){
  const page=pdf.addPage([500,130]);
  if(blank && i===pages-1)continue;
  const phrase=i===0?'项目验收 SALES 12345':`INVOICE PAGE ${i+1} TOTAL 67890`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260"><rect width="100%" height="100%" fill="white"/>${await textPaths(phrase,24,135,44,960,1,'#000000')}</svg>`;
  const png=await sharp(Buffer.from(svg)).png().toBuffer();const image=await pdf.embedPng(png);
  // Make an upside-down image + rotated page so visible content is upright.
  if(rotate && i===0){page.drawImage(image,{x:500,y:130,width:500,height:130,rotate:degrees(180)});page.setRotation(degrees(180));}
  else page.drawImage(image,{x:0,y:0,width:500,height:130});
 }
 return Buffer.from(await pdf.save());
}
async function mixedPDF(){const scanned=await scannedPDF({pages:1});const pdf=await PDFDocument.load(scanned);const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([500,130]).drawText('DIGITAL PAGE 2 CHECK 24680',{x:20,y:60,size:24,font});pdf.addPage([500,130]);return Buffer.from(await pdf.save());}
module.exports={workbook,scannedPDF,mixedPDF};
