import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isMainThread, parentPort } from 'node:worker_threads';
import { asrConfiguration } from './asr-config';
/** API-owned child: cancellation/worker exit/service shutdown all abort and reap it. */
export function startASRProcess(pcm:Uint8Array, timeoutMs=24000) {
  if(pcm.byteLength<16000||pcm.byteLength>480000||pcm.byteLength%2)throw Error('音频PCM尺寸不符合离线识别限制。');
  const c=asrConfiguration();if(!c.ready)throw Error(c.reason);
  const child=spawn(c.python,['-I','-B',c.helper,c.root,String(process.pid)],{cwd:c.root,detached:true,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
  let killed=false,closed=false,problem='';
  const abort=()=>{if(closed)return;killed=true;try{if(child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}};
  const promise=new Promise<unknown>((resolve,reject)=>{
    const chunks:Buffer[]=[];let size=0,stderr=0;
    const timer=setTimeout(()=>{problem='离线识别超时，未交付部分转写。';abort();},timeoutMs);
    child.on('error',()=>{problem='无法启动已配置的离线识别进程，请在服务端重新检查安装。';});
    child.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>256000){problem='识别结果超过安全上限。';abort();}else chunks.push(b);});
    child.stderr.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>16000){problem='离线识别进程异常，未交付部分转写。';abort();}});
    child.stdin.on('error',()=>{/* Rejection is handled on child close, including EPIPE. */});
    child.on('close',(code)=>{closed=true;clearTimeout(timer);if(problem||killed||code!==0){reject(Error(problem||(killed?'离线识别已终止。':'离线识别失败；请核对安装、英语音频质量与资源限制。')));return;}try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('离线识别结果格式错误。'));}});
    const header=Buffer.alloc(4);header.writeUInt32LE(pcm.length);child.stdin.end(Buffer.concat([header,Buffer.from(pcm)]));
  });
  return {pid:child.pid,abort,promise};
}
export async function decodePCM(pcm:Uint8Array):Promise<unknown> {
  if(isMainThread)return startASRProcess(pcm).promise;
  if(!parentPort)throw Error('离线识别需要受控进程管理器。');
  const port=parentPort,id=randomUUID();
  return new Promise((resolve,reject)=>{
    const receive=(m:any)=>{if(m?.type!=='asr-result'||m.id!==id)return;port.off('message',receive);m.error?reject(Error(m.error)):resolve(m.result);};
    port.on('message',receive);port.postMessage({type:'asr-request',id,pcm});
  });
}
