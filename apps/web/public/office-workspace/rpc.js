// Same-origin host protocol; one short-lived connection per request.
export async function request(method,params,timeout=65000){
 const id=globalThis.crypto?.randomUUID?.()||`office-${Date.now()}-${Math.random()}`
 const stream=new EventSource('/events?id='+encodeURIComponent(id))
 return new Promise((resolve,reject)=>{
  let finished=false
  const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);stream.close();error?reject(error):resolve(value)}
  const timer=setTimeout(()=>done(Error('请求超时，请检查模型配置或网络。')),timeout)
  stream.onerror=()=>done(Error('无法连接服务，请刷新后重试。'))
  stream.onmessage=event=>{let frame;try{frame=JSON.parse(event.data)}catch{return}if(frame.id!=='office-1')return;if(frame.type==='rpc.result')done(null,frame.result);else if(frame.type==='rpc.error')done(Error(frame.message||'请求失败'))}
  stream.addEventListener('open',()=>{fetch('/send?id='+encodeURIComponent(id),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'office-1',method,params})}).then(res=>{if(!res.ok)done(Error(`服务请求失败（${res.status}）`))}).catch(done)},{once:true})
 })
}
