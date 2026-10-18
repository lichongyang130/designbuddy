import { parse as parseJS } from "acorn";
import { text, json, out } from "./io";
import type { SkillInput } from "./executors";
type Finding={code:string;message:string;line:number|null};
export async function htmlAudit(input:SkillInput,event:(m:string)=>void){
  const source=text(input.bytes);if(source.length>150000)throw Error("HTML静态检查最多150000字。");
  const {parse}=await import("parse5");const findings:Finding[]=[];
  const doc=parse(source,{sourceCodeLocationInfo:true,onParseError:e=>{if(findings.length<200)findings.push({code:`HTML_${e.code}`,message:"HTML解析器报告格式问题。",line:e.startLine});}});
  const elements:any[]=[];function walk(node:any,depth:number){if(depth>200||elements.length>10000)throw Error("HTML嵌套过深或节点过多。");if(node.tagName)elements.push(node);for(const child of node.childNodes||[])walk(child,depth+1);if(node.content)walk(node.content,depth+1);}walk(doc,0);
  const attrs=(n:any):Record<string,string>=>Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));
  const find=(n:any,code:string,message:string)=>{if(findings.length<500)findings.push({code,message,line:n.sourceCodeLocation?.startLine||null});};
  const html=elements.find(n=>n.tagName==="html"),title=elements.find(n=>n.tagName==="title");
  const content=(n:any):string=>(n.childNodes||[]).map((c:any)=>c.nodeName==="#text"?c.value:content(c)).join("").trim();
  if(!html||!attrs(html).lang?.trim())find(html||{},"MISSING_LANG","缺少页面语言lang。");
  if(!title||!content(title))find(title||{},"MISSING_TITLE","缺少非空页面标题。");
  if(!elements.some(n=>n.tagName==="meta"&&attrs(n).name?.toLowerCase()==="viewport"))find({},"MISSING_VIEWPORT","缺少viewport声明，需要检查手机端布局。");
  const ids=new Map<string,any>();
  for(const n of elements){const a=attrs(n);if(a.id){if(ids.has(a.id))find(n,"DUPLICATE_ID",`重复id：${a.id.slice(0,80)}`);ids.set(a.id,n);}}
  for(const n of elements){const a=attrs(n);
    if(n.tagName==="img"&&!Object.hasOwn(a,"alt"))find(n,"MISSING_ALT","图片缺少alt属性；装饰图可明确设为空。");
    if(n.tagName==="input"&&a.type!=="hidden"&&!a["aria-label"]?.trim()&&!a["aria-labelledby"]?.trim()&&!elements.some(label=>label.tagName==="label"&&((a.id&&attrs(label).for===a.id&&content(label))||(label.childNodes||[]).includes(n))))find(n,"MISSING_LABEL","输入控件未发现可访问名称，请检查label或aria-label。");
    if(n.tagName==="button"&&!content(n)&&!a["aria-label"]?.trim()&&!a["aria-labelledby"]?.trim())find(n,"EMPTY_BUTTON","按钮未发现可访问名称。");
    if(a["aria-labelledby"])for(const id of a["aria-labelledby"].trim().split(/\s+/))if(!ids.has(id))find(n,"BROKEN_ARIA_REFERENCE",`aria-labelledby引用不存在：${id.slice(0,80)}`);
    if(n.tagName==="a"&&a.href?.startsWith("#")&&a.href.length>1){let id=a.href.slice(1);try{id=decodeURIComponent(id);}catch{}if(!ids.has(id))find(n,"BROKEN_ANCHOR",`页内锚点不存在：${id.slice(0,80)}`);}
    if(a.target==="_blank"&&!/\bnoopener\b/i.test(a.rel||""))find(n,"NEW_WINDOW_REL","新窗口链接建议显式添加rel=noopener。");
    if(Object.values(a).some(v=>/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(v)))find(n,"LOCALHOST_URL","浏览器资源使用localhost，远端预览可能不可访问。");
  }
  event(`实际解析 ${elements.length} 个HTML元素，静态规则发现 ${findings.length} 个问题；没有运行页面脚本或浏览器。`);
  return {summary:`HTML静态检查完成：${findings.length} 个规则问题。未执行浏览器、交互、CSS布局或接口验收，不能据此称网站测试通过。`,outputs:[json("html-audit.json",{elements:elements.length,findings,truncated:findings.length>=500,executed:"HTML解析与静态规则",notExecuted:["浏览器运行","脚本","网络请求","交互","布局","全量无障碍审计"]}),out("html-audit.txt","text/plain; charset=utf-8",findings.map(f=>`${f.line||"-"}: ${f.code} ${f.message}`).join("\n")||"已实现静态规则未发现问题。未执行浏览器验收。") ]};
}
export async function codeInspect(input:SkillInput,event:(m:string)=>void){
  const source=text(input.bytes);if(source.length>150000)throw Error("JavaScript静态检查最多150000字。");
  const findings:Finding[]=[];let ast:any;try{ast=parseJS(source,{ecmaVersion:2025,sourceType:"module",locations:true});}catch(e:any){findings.push({code:"SYNTAX_ERROR",message:String(e.message).slice(0,300),line:e.loc?.line||null});}
  let nodes=0;const functions:{name:string;line:number|null}[]=[];
  function visit(node:any,depth:number){if(!node||typeof node!=="object")return;if(++nodes>30000||depth>200)throw Error("代码语法树过大或嵌套过深。");
    const report=(code:string,message:string)=>{if(findings.length<300)findings.push({code,message,line:node.loc?.start.line||null});};
    if(node.type==="CallExpression"&&node.callee?.name==="eval")report("DYNAMIC_EVAL","发现eval调用；需要人工复核输入来源。");
    if((node.type==="NewExpression"||node.type==="CallExpression")&&node.callee?.name==="Function")report("DYNAMIC_FUNCTION","发现动态Function构造，需要人工复核。");
    if(node.type==="AssignmentExpression"&&node.left?.type==="MemberExpression"&&["innerHTML","outerHTML"].includes(node.left.property?.name||node.left.property?.value))report("HTML_ASSIGNMENT","发现HTML写入点，请检查是否经过可信清理；此规则不判断可利用性。");
    if(node.type==="Literal"&&typeof node.value==="string"&&/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(node.value))report("LOCALHOST_URL","代码含localhost地址，远端浏览器可能无法访问。");
    if(node.type==="FunctionDeclaration")functions.push({name:node.id?.name||"anonymous",line:node.loc?.start.line||null});
    for(const [key,value]of Object.entries(node)){if(["loc","start","end"].includes(key))continue;if(Array.isArray(value))value.forEach(v=>visit(v,depth+1));else if(value&&typeof value==="object")visit(value,depth+1);}}
  if(ast)visit(ast,0);event(`实际JavaScript语法解析${ast?"通过":"失败"}，记录 ${findings.length} 个语法/风险提示；未执行代码。`);
  return {summary:`JavaScript静态检查完成：语法${ast?"可解析":"有错误"}，${findings.length} 个提示。没有安装依赖、构建、运行服务、执行测试或连接数据库。`,outputs:[json("javascript-report.json",{syntaxValid:!!ast,findings,functions,truncated:findings.length>=300,notExecuted:["用户代码","依赖安装","构建","测试","数据库"],securityNotice:"仅有限AST规则，不是漏洞证明或安全认证"})]};
}
