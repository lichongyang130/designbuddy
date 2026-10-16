import { runtimeSkills, type RuntimeSkill } from '../../shared/skillRuntime';
import { asrConfiguration } from './asr-config';
import { imageEndpoint } from './image-generate';
import { collaborationChannels } from './collaboration-sync';

/**
 * Browser contracts are not evidence that optional server dependencies exist.
 *
 * A skill is only `ready` when its executor is wired up *and* the server side
 * dependency it needs is actually configured. When the executor exists but the
 * credential is missing, the catalogue says so explicitly instead of pretending
 * the capability is absent or silently mocking a result.
 */
export function runtimeCatalog(): RuntimeSkill[] {
  const configuration = asrConfiguration();
  const image = imageEndpoint();
  const channels = collaborationChannels();
  return runtimeSkills.map(s => {
    if (s.id === 'audio.transcribe-en' && !configuration.ready)
      return { ...s, status: 'unavailable' as const, description: configuration.reason + ' ' + s.description };
    if (s.id === 'document.summarize' && !process.env.AI_API_KEY && !process.env.OPENAI_API_KEY)
      return { ...s, status: 'unavailable' as const, description: '服务端AI_API_KEY/OPENAI_API_KEY未配置；不会生成伪摘要。 ' + s.description };
    if (s.id === 'image.generate' && !image)
      return { ...s, status: 'unavailable' as const, description: '执行器已接入，但服务端未配置图像模型通道（IMAGE_API_KEY/IMAGE_BASE_URL/IMAGE_MODEL）；不会用占位图冒充生成结果。 ' + s.description };
    if (s.id === 'collaboration.sync' && !channels.calendar && !channels.email)
      return { ...s, status: 'unavailable' as const, description: '执行器已接入，但服务端未配置日历或邮件通道（COLLABORATION_CALENDAR_BASE_URL/TOKEN/ID、COLLABORATION_EMAIL_BASE_URL/API_KEY/FROM）；不会假装外发成功。 ' + s.description };
    return s;
  });
}
