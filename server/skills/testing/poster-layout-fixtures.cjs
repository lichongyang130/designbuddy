const sharp=require('sharp');
const {posterExample}=require('../../../dist/local/shared/posterLayout.js');
const rectangle=(id,color,x=0,y=0,width=100,height=100)=>({id,name:id,type:'rect',x,y,width,height,opacity:100,visible:true,locked:false,color,radius:0});
const simple=()=>({version:1,title:'图层验收样例',width:320,height:320,background:'#ffffff',assets:[],layers:[rectangle('red','#ff0000')]});
async function picture(){return sharp(Buffer.from('<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/><rect x="100" width="100" height="100" fill="blue"/></svg>')).png().toBuffer();}
async function withImage(fit='contain'){const p=simple(),bytes=await picture();p.assets=[{id:'source',source:'测试自绘色块；非摄影/生成式图片',data:'data:image/png;base64,'+bytes.toString('base64')}];p.layers=[{id:'picture',name:'图片',type:'image',x:20,y:20,width:100,height:100,opacity:100,visible:true,locked:false,assetId:'source',fit}];return {project:p,bytes};}
module.exports={posterExample,rectangle,simple,picture,withImage};
