const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,HeadingLevel,ImageRun,Header}=require('docx');
const sharp=require('sharp');const {unzipSync,zipSync,strToU8,strFromU8}=require('fflate');
async function docxFixture(){
 const png=await sharp({create:{width:120,height:60,channels:3,background:'#287b69'}}).png().toBuffer();
 const para=t=>new Paragraph(t);
 const doc=new Document({sections:[{headers:{default:new Header({children:[para('页眉不应混入正文')]})},children:[
 new Paragraph({text:'项目交付核对',heading:HeadingLevel.HEADING_1}),
 new Paragraph({children:[new TextRun({text:'真实正文 & <script>window.BAD=1</script>',bold:true}),new TextRun({text:' / 斜体',italics:true}),new TextRun({text:' / 下划线',underline:{}})]}),
 new Table({columnWidths:[2400,2400,2400],rows:[
 new TableRow({children:[new TableCell({columnSpan:2,children:[para('合并标题')]}),new TableCell({children:[para('金额')]})]}),
 new TableRow({children:[new TableCell({rowSpan:2,children:[para('跨行项目')]}),new TableCell({children:[para('第一阶段')]}),new TableCell({children:[para('12.50')]})]}),
 new TableRow({children:[new TableCell({children:[para('第二阶段')]}),new TableCell({children:[para('=1+1（原始文本）')]})]})]}),
 new Paragraph({children:[new ImageRun({type:'png',data:png,transformation:{width:120,height:60}})]}),
 new Paragraph({text:'核对完成',heading:HeadingLevel.HEADING_2}),
 ]}]});
 return {bytes:Buffer.from(await Packer.toBuffer(doc)),png};
}
function mutateDocx(bytes,fn){const entries=unzipSync(bytes);const source=strFromU8(entries['word/document.xml']);const result=fn(source,entries);if(typeof result==='string')entries['word/document.xml']=strToU8(result);return Buffer.from(zipSync(entries));}
module.exports={docxFixture,mutateDocx};
