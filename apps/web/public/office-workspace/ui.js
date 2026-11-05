export const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
export function button(text,fn,cls='subtle'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b}
export function option(select,value,label){const o=el('option',label);o.value=String(value);select.append(o)}
export function label(text,control){const box=el('label',text);box.append(control);return box}
export function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
export const safeName=s=>String(s||'文档').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,80)

// Copy only after an explicit click; keep the selected text available on failure.
export async function copyEditable(area){
 area.focus();area.select();try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(area.value);return true}if(typeof document.execCommand==='function')return !!document.execCommand('copy')}catch{}return false
}
