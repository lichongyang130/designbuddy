import { runtimeSkills, type RuntimeSkill } from '../../shared/skillRuntime';
import { asrConfiguration } from './asr-config';
/** Browser contracts are not evidence that optional server dependencies exist. */
export function runtimeCatalog():RuntimeSkill[]{
 const configuration=asrConfiguration();
 return runtimeSkills.map(s=>s.id==='audio.transcribe-en'&&!configuration.ready?{...s,status:'unavailable',description:configuration.reason+' '+s.description}:s.id==='document.summarize'&&!process.env.AI_API_KEY&&!process.env.OPENAI_API_KEY?{...s,status:'unavailable',description:'服务端AI_API_KEY/OPENAI_API_KEY未配置；不会生成伪摘要。 '+s.description}:s);
}
