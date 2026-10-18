export type LayerBase={id:string;name:string;x:number;y:number;width:number;height:number;opacity:number;visible:boolean;locked:boolean};
export type PosterLayer=LayerBase&({type:'text';text:string;fontSize:number;color:string}|{type:'rect';color:string;radius:number}|{type:'image';assetId:string;fit:'contain'|'cover'});
export type PosterAsset={id:string;data:string;source:string};
export type PosterLayout={version:1;title:string;width:number;height:number;background:string;layers:PosterLayer[];assets:PosterAsset[]};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fields(v:unknown,names:string[],name:string):asserts v is Record<string,any>{if(!object(v)||Object.keys(v).length!==names.length||names.some(n=>!Object.hasOwn(v,n)))throw Error(name+'字段缺失或包含未支持字段。');}
function number(v:unknown,min:number,max:number,name:string){if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw Error(`${name}须为${min}–${max}的整数。`);}
function line(v:unknown,max:number,name:string,multiline=false){if(typeof v!=='string'||!v.trim()||[...v].length>max||(multiline?/[\x00-\x09\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/:/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/).test(v))throw Error(name+'为空、过长或含不支持的控制字符。');}
function id(v:unknown){if(typeof v!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v))throw Error('图层/素材ID须为1–32位字母开头的字母、数字、横线或下划线。');}
function color(v:unknown){if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))throw Error('颜色须为六位十六进制值；不接受URL、CSS或脚本。');}
/** Bounded header checks before a browser/native decoder sees an image. Full decode still occurs on the server. */
export function rasterHeader(bytes:Uint8Array){
 const b=bytes,d=new DataView(b.buffer,b.byteOffset,b.byteLength),ascii=(p:number,n:number)=>String.fromCharCode(...b.subarray(p,p+n));let width=0,height=0,format='';
 if(b.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)&&ascii(12,4)==='IHDR'){
  format='png';width=d.getUint32(16);height=d.getUint32(20);let end=false;
  for(let p=8;p<b.length;){if(p+12>b.length)throw Error('PNG块不完整。');const n=d.getUint32(p),type=ascii(p+4,4);if(p+12+n>b.length)throw Error('PNG块越界。');if(type==='acTL')throw Error('不支持动态PNG。');p+=n+12;if(type==='IEND'){if(n!==0||p!==b.length)throw Error('PNG结尾异常。');end=true;break;}}
  if(!end)throw Error('PNG缺少结尾。');
 }else if(b.length>=4&&b[0]===255&&b[1]===216){
  format='jpeg';for(let p=2;p<b.length;){if(b[p++]!==255)throw Error('JPEG标记异常。');while(b[p]===255)p++;const marker=b[p++];if(marker===0xd9||marker===0xda)break;if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;if(p+2>b.length)throw Error('JPEG段不完整。');const n=d.getUint16(p);if(n<2||p+n>b.length)throw Error('JPEG段越界。');if(marker===0xc0||marker===0xc2){if(n<8)throw Error('JPEG帧不完整。');height=d.getUint16(p+3);width=d.getUint16(p+5);break;}p+=n;}
 }else if(b.length>=25&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&d.getUint32(4,true)===b.length-8){
  format='webp';for(let p=12;p<b.length;){if(p+8>b.length)throw Error('WebP块不完整。');const kind=ascii(p,4),n=d.getUint32(p+4,true),q=p+8;if(q+n+(n%2)>b.length)throw Error('WebP块越界。');if(kind==='ANIM'||kind==='ANMF')throw Error('不支持动态WebP。');if(kind==='VP8X'&&n>=10){if(b[q]&2)throw Error('不支持动态WebP。');width=1+b[q+4]+(b[q+5]<<8)+(b[q+6]<<16);height=1+b[q+7]+(b[q+8]<<8)+(b[q+9]<<16);}else if(!width&&kind==='VP8 '&&n>=10&&b[q+3]===0x9d&&b[q+4]===1&&b[q+5]===0x2a){width=d.getUint16(q+6,true)&0x3fff;height=d.getUint16(q+8,true)&0x3fff;}else if(!width&&kind==='VP8L'&&n>=5&&b[q]===0x2f){const v=d.getUint32(q+1,true);width=1+(v&0x3fff);height=1+((v>>>14)&0x3fff);}p=q+n+n%2;}
 }
 if(!format||!width||!height||width>4000||height>4000||width*height>4000000)throw Error('素材须为PNG、基线/渐进JPEG或静态WebP；每张最长边4000、最多400万像素。');
 return {width,height,format};
}
export function assetBytes(data:string){
 const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!m||m[2].length%4)throw Error('素材必须是内嵌PNG/JPEG/WebP的规范base64，不读取远程地址或SVG。');
 const raw=atob(m[2]);if(btoa(raw)!==m[2])throw Error('素材base64编码不规范。');const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const meta=rasterHeader(bytes);if(meta.format!==m[1])throw Error('素材声明格式与实际文件不一致。');return {bytes,...meta};
}
export function validatePosterLayout(v:unknown):PosterLayout{
 fields(v,['version','title','width','height','background','layers','assets'],'画布');if(v.version!==1)throw Error('只支持画布格式version=1。');line(v.title,60,'画布名称');number(v.width,320,2000,'画布宽');number(v.height,320,2000,'画布高');if(v.background!=='transparent')color(v.background);
 if(!Array.isArray(v.layers)||v.layers.length<1||v.layers.length>24||!Array.isArray(v.assets)||v.assets.length>6)throw Error('需要1–24个图层，最多6张素材。');
 const assets=new Set<string>();let bytes=0,pixels=0,text=0;
 for(const a of v.assets){fields(a,['id','data','source'],'素材');id(a.id);if(assets.has(a.id))throw Error('素材ID重复。');assets.add(a.id);line(a.source,200,'素材来源/授权说明');if(typeof a.data!=='string'||a.data.length>1800000)throw Error('素材编码过长。');const b=assetBytes(a.data);bytes+=b.bytes.length;pixels+=b.width*b.height;}
 if(bytes>1300000||pixels>8000000)throw Error('素材原字节合计最多130万字节、800万像素。');
 const ids=new Set<string>();let visible=0;
 for(const l of v.layers){if(!object(l)||!['text','rect','image'].includes(l.type))throw Error('图层类型只支持text、rect、image。');fields(l,['id','name','type','x','y','width','height','opacity','visible','locked',...(l.type==='text'?['text','fontSize','color']:l.type==='rect'?['color','radius']:['assetId','fit'])],'图层');id(l.id);if(ids.has(l.id))throw Error('图层ID重复。');ids.add(l.id);line(l.name,40,'图层名称');number(l.x,0,v.width-8,'X');number(l.y,0,v.height-8,'Y');number(l.width,8,v.width-l.x,'图层宽');number(l.height,8,v.height-l.y,'图层高');number(l.opacity,0,100,'不透明度');if(typeof l.visible!=='boolean'||typeof l.locked!=='boolean')throw Error('可见/锁定字段须为布尔值。');if(l.visible&&l.opacity>0)visible++;
  if(l.type==='text'){line(l.text,500,'文字',true);text+=[...l.text].length;number(l.fontSize,8,160,'字号');color(l.color);}else if(l.type==='rect'){color(l.color);number(l.radius,0,Math.floor(Math.min(l.width,l.height)/2),'圆角');}else{if(!assets.has(l.assetId)||!['contain','cover'].includes(l.fit))throw Error('图片引用缺失或适配方式不支持。');}
 }
 if(!visible||text>2000)throw Error('至少一个可见非零透明度图层，全部文字最多2000字。');
 return v as PosterLayout;
}
export const posterExample=():PosterLayout=>({version:1,title:'自由排版示例',width:960,height:1200,background:'#f3f0e7',assets:[],layers:[
 {id:'accent',name:'橙色圆形',type:'rect',x:608,y:80,width:272,height:272,opacity:100,visible:true,locked:false,color:'#d47749',radius:136},
 {id:'panel',name:'绿色底板',type:'rect',x:64,y:520,width:832,height:520,opacity:100,visible:true,locked:false,color:'#294f43',radius:24},
 {id:'eyebrow',name:'上方说明',type:'text',x:64,y:64,width:480,height:64,opacity:100,visible:true,locked:false,text:'DESIGNBUDDY / LAYOUT STUDIO',fontSize:20,color:'#294f43'},
 {id:'title',name:'主标题',type:'text',x:64,y:178,width:680,height:264,opacity:100,visible:true,locked:false,text:'把想法\n变成画面。',fontSize:84,color:'#243d34'},
 {id:'body',name:'说明文字',type:'text',x:112,y:616,width:720,height:300,opacity:100,visible:true,locked:false,text:'文字、图片、色块\n自由移动与调整层级\n从你的实际素材开始',fontSize:42,color:'#f3f0e7'},
 {id:'footer',name:'样例声明',type:'text',x:64,y:1096,width:832,height:64,opacity:100,visible:true,locked:false,text:'版式示例 · 非真实活动 · 请替换内容后导出',fontSize:22,color:'#647368'}
]});
