import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSkillOptions } from './contracts';
import { decodePCM } from './asr-process';
import { asrAssets, assetRoot } from './asr-config';
import { out, json, xml } from './io';
import type { SkillInput } from './executors';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
/** Narrow, non-lossy PCM contract. No FFmpeg, resampling, channel mixing or hidden truncation. */
export function readSpeechWav(bytes:Uint8Array){
 const b=Buffer.from(bytes);
 if(b.length<44||b.length>2000000||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.readUInt32LE(4)!==b.length-8)throw Error('需要长度完整的RIFF/WAVE文件，不接受MP3、压缩WAV、RF64或拼接/截断文件。');
 let fmt:Buffer|undefined,pcm:Buffer|undefined,chunks=0;const metadata:string[]=[];
 for(let p=12;p<b.length;){
  if(++chunks>32||p+8>b.length)throw Error('WAV块结构不完整或过多。');
  const type=b.toString('ascii',p,p+4),n=b.readUInt32LE(p+4),end=p+8+n;if(end+(n%2)>b.length)throw Error('WAV块长度越界。');
  const value=b.subarray(p+8,end);
  if(type==='fmt '){if(fmt)throw Error('WAV含重复格式块。');fmt=value;}
  else if(type==='data'){if(pcm)throw Error('WAV含多个音频块，不会拼接或只取首段。');pcm=value;}
  else if(type==='JUNK'||type==='LIST'&&value.toString('ascii',0,4)==='INFO')metadata.push(type);
  else throw Error('不支持此WAV扩展块；只接受fmt/data及JUNK、LIST/INFO元数据。');
  p=end+n%2;
 }
 if(!fmt||![16,18].includes(fmt.length)||fmt.length===18&&fmt.readUInt16LE(16)!==0||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(2)!==1||fmt.readUInt32LE(4)!==16000||fmt.readUInt32LE(8)!==32000||fmt.readUInt16LE(12)!==2||fmt.readUInt16LE(14)!==16)throw Error('仅支持16000Hz、单声道、16位有符号小端PCM WAV；不自动转换采样率或混音。');
 if(!pcm||pcm.length%2||pcm.length<16000||pcm.length>480000)throw Error('音频必须为0.5–15秒，不截断超长录音。');
 let sum=0,peak=0,clipped=0;for(let i=0;i<pcm.length;i+=2){const v=pcm.readInt16LE(i),a=Math.abs(v);sum+=v*v;peak=Math.max(peak,a);if(a>=32760)clipped++;}
 const samples=pcm.length/2,rms=Math.sqrt(sum/samples);if(rms<2)throw Error('音频静音或有效音量过低，未生成虚构转写。');
 return {pcm,durationSeconds:samples/16000,samples,sampleRate:16000,channels:1,bitsPerSample:16,rms,peak,clippedSampleFraction:clipped/samples,ignoredMetadataChunks:metadata};
}
const timestamp=(seconds:number)=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
const round=(n:number)=>Math.round(n*1000)/1000;
const fillers=new Set(['<s>','</s>','<sil>','[NOISE]','[SPEECH]','[LAUGHTER]']);
export function validateTranscript(raw:any,duration:number){
 if(raw?.engine!=='pocketsphinx'||raw.version!=='5.1.1'||raw.frameRate!==100||!Array.isArray(raw.regions)||!raw.regions.length||raw.regions.length>32)throw Error('未检测到可识别语音，或识别结果无效；未生成转写。');
 let lastEnd=0,total=0;const words:any[]=[],cues:any[]=[];
 for(const [i,r]of raw.regions.entries()){
  if(!Number.isFinite(r.speechStart)||!Number.isFinite(r.speechEnd)||r.speechStart<0||r.speechStart>=duration||r.speechEnd<=r.speechStart||r.speechEnd>duration+.1||!Array.isArray(r.words)||r.words.length>600||typeof r.hypothesis!=='string'||r.hypothesis.length>8000)throw Error('语音段时间或长度异常，未交付部分结果。');
  const items:any[]=[];
  for(const w of r.words){
   if(++total>600||typeof w.rawWord!=='string'||w.rawWord.length>100||/[\x00-\x1f\x7f]/.test(w.rawWord)||!Number.isInteger(w.startFrame)||!Number.isInteger(w.endFrameInclusive)||w.startFrame<0||w.endFrameInclusive<w.startFrame||w.endFrameInclusive>Math.ceil((r.speechEnd-r.speechStart)*100)+10||!Number.isFinite(w.posteriorApprox)||w.posteriorApprox<0||w.posteriorApprox>1.01)throw Error('识别词语证据无效。');
   if(fillers.has(w.rawWord))continue;
   const word=w.rawWord.replace(/\(\d+\)$/,''),nativeEnd=r.speechStart+(w.endFrameInclusive+1)/100;
   const start=round(r.speechStart+w.startFrame/100),end=round(Math.min(duration,nativeEnd));
   if(!word.trim()||start<lastEnd-.002||end<=start||end>duration+.001||nativeEnd>r.speechEnd+.1)throw Error('识别时间戳越界或顺序异常。');
   const item={word,rawWord:w.rawWord,region:i+1,startSeconds:start,endSeconds:end,startFrame:w.startFrame,endFrameInclusive:w.endFrameInclusive,posteriorApprox:w.posteriorApprox,displayConfidence:Math.min(1,w.posteriorApprox),lowConfidence:w.posteriorApprox<.8,endClampedToAudio:nativeEnd>duration,requiresReview:true};
   words.push(item);items.push(item);lastEnd=end;
  }
  if(!items.length)throw Error('至少一个检测段未能识别成词，未交付部分转写；请核对录音质量。');
  cues.push({index:i+1,startSeconds:items[0].startSeconds,endSeconds:items.at(-1).endSeconds,text:items.map(w=>w.word).join(' '),speechStart:r.speechStart,speechEnd:r.speechEnd,nativeHypothesis:r.hypothesis,nativeSegments:r.words});
 }
 if(words.length>300)throw Error('识别超过300词，未截断结果。');
 return {words,cues,text:cues.map(c=>c.text).join('\n')+'\n'};
}
export async function transcribeEnglish(input:SkillInput,event:(s:string)=>void){
 validateSkillOptions('audio.transcribe-en',{deduplicate:input.deduplicate,parameters:input.parameters});
 const wav=readSpeechWav(input.bytes);
 event(`已校验${wav.durationSeconds.toFixed(3)}秒16kHz单声道PCM；用户声明主要为英语，未自动识别语言。`);
 const raw=await decodePCM(wav.pcm),result=validateTranscript(raw,wav.durationSeconds);
 const low=result.words.filter(w=>w.lowConfidence).length;
 const notes=['仅美式英语离线模型；用户语言声明未经自动检测。中文、音乐、噪声、口音、姓名及数字可能被误识别。','词级分数不是准确率或已校准置信度；所有文字都须与原音频核对，低于0.8仅作为优先复核提示。','模型近似后验分数可能略大于1；报告保留原值，显示值限于0–1。','时间来自VAD起点加100Hz解码帧；帧末为含端点，导出取下一帧边界并按毫秒舍入，必要时限于录音末尾。','未自动加标点、摘要、翻译、分离说话人或处理长会议；VAD之外的声音未转写。','核对音频保留原文件字节及元数据；分享前请自行核对权限和隐私。'];
 if(wav.clippedSampleFraction>.01)notes.push('超过1%的采样接近满幅，可能有削波失真。');
 const {pcm,...audio}=wav;
 const license=await readFile(join(assetRoot(),'docs/licenses/pocketsphinx-5.1.1.txt'));
 const report={skill:'audio.transcribe-en',version:'1.0.0',sourceSHA256:hash(input.bytes),pcmSHA256:hash(pcm),audio,userDeclaredLanguage:'en',languageAutomaticallyVerified:false,engine:{name:asrAssets.engine,version:asrAssets.version,wheelSHA256:asrAssets.wheelSHA256,modelSHA256:Object.fromEntries(Object.entries(asrAssets.files).filter(([p])=>p.startsWith('pocketsphinx/model/')).map(([p,v])=>[p,v.sha256])),networkUsed:false,frameRate:100},wordCount:result.words.length,lowConfidenceWordCount:low,confidenceIsAccuracy:false,reviewThreshold:.8,words:result.words,cues:result.cues,notes,requiresReview:true};
 const srt=result.cues.map(c=>`${c.index}\n${timestamp(c.startSeconds)} --> ${timestamp(c.endSeconds)}\n${c.text}\n`).join('\n');
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; media-src data:; base-uri 'none'; form-action 'none'"><title>English transcript review</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f5ef;color:#243c37;font:16px/1.65 system-ui,sans-serif;overflow-wrap:anywhere}main{max-width:900px;margin:auto}h1{font-size:26px;line-height:1.25}audio{display:block;width:100%;margin:22px 0}section{background:white;border-radius:12px;padding:18px;margin:18px 0}small{color:#536762}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}mark{background:#ffe7b1;color:#563b10}code{font-size:12px} .scroll{overflow:auto}</style></head><body><main><h1>English audio transcript</h1><p>Machine recognition — review required. This is not a verified transcript.</p><audio controls preload="metadata" aria-label="Original uploaded audio" src="data:audio/wav;base64,${Buffer.from(input.bytes).toString('base64')}"></audio><small>${wav.durationSeconds.toFixed(3)} seconds · US English model · ${result.words.length} words · ${low} priority-review words</small>${result.cues.map(c=>`<section><small>${timestamp(c.startSeconds)} → ${timestamp(c.endSeconds)}</small><p>${xml(c.text)}</p></section>`).join('')}<h2>Word timing and review</h2><p>Scores are not accuracy. Highlighted scores below 0.8 need priority review; all other words still need checking. Raw approximate scores may exceed 1 slightly; displayed scores are clamped. No punctuation, speaker identification, translation or summary has been added.</p><div class="scroll"><table><thead><tr><th>Word</th><th>Start–end (s)</th><th>Score</th></tr></thead><tbody>${result.words.map(w=>`<tr><td>${w.lowConfidence?'<mark>':''}${xml(w.word)}${w.lowConfidence?'</mark>':''}</td><td>${w.startSeconds.toFixed(3)}–${w.endSeconds.toFixed(3)}</td><td>${w.displayConfidence.toFixed(3)}</td></tr>`).join('')}</tbody></table></div><p>Timing is approximate; VAD may omit speech. Non-English speech, names, numbers, music and noise can produce wrong words. Your English-language declaration has not been independently verified.</p><p>Input SHA-256: <code>${hash(input.bytes)}</code></p><details><summary>Engine and model license</summary><pre style="white-space:pre-wrap">${xml(license.toString())}</pre></details></main></body></html>`;
 event(`实际识别${result.words.length}词，${low}词低分；全部需复核，不将分数当准确率。`);
 return {summary:`实际识别${wav.durationSeconds.toFixed(3)}秒英语音频，输出${result.words.length}词、${result.cues.length}段时间戳；${low}词低分，全部须听音复核。未做语言检测、摘要或说话人分离。`,outputs:[out('transcript.txt','text/plain; charset=utf-8',result.text),out('transcript.srt','text/plain; charset=utf-8',srt),json('transcript-report.json',report),out('review-audio.wav','audio/wav',input.bytes),out('transcript-review.html','text/html; charset=utf-8',html),out('recognizer-license.txt','text/plain; charset=utf-8',license)]};
}
