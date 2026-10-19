import { runtimeSkills, type RuntimeSkill } from '../../shared/skillRuntime';
import { asrConfiguration } from './asr-config';
import { imageEndpoint } from './image-generate';
import { collaborationChannels } from './collaboration-sync';
import { skillPermissions } from './skill-permissions';
import { presentationFontsAvailable } from './presentation/fonts';
import { presentationRendererAvailable } from './pptx-render';

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
    const catalog = { ...s, permissions: skillPermissions(s.id) };
    if (s.id === 'audio.transcribe-en' && !configuration.ready)
      return { ...catalog, status: 'unavailable' as const, description: configuration.reason + ' ' + s.description };
    if (s.id === 'document.summarize' && !process.env.AI_API_KEY && !process.env.OPENAI_API_KEY)
      return { ...catalog, status: 'unavailable' as const, description: '服务端AI_API_KEY/OPENAI_API_KEY未配置；不会生成伪摘要。 ' + s.description };
    if (s.id === 'image.generate' && !image)
      return { ...catalog, status: 'unavailable' as const, description: '执行器已接入，但服务端未配置图像模型通道（IMAGE_API_KEY/IMAGE_BASE_URL/IMAGE_MODEL）；不会用占位图冒充生成结果。 ' + s.description };
    if (s.id === 'collaboration.sync' && !channels.calendar && !channels.email)
      return { ...catalog, status: 'unavailable' as const, description: '执行器已接入，但服务端未配置日历或邮件通道（COLLABORATION_CALENDAR_BASE_URL/TOKEN/ID、COLLABORATION_EMAIL_BASE_URL/API_KEY/FROM）；不会假装外发成功。 ' + s.description };
    if (s.id === 'slides.create' && ((!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) || !presentationRendererAvailable() || !presentationFontsAvailable()))
      return { ...catalog, status: 'unavailable' as const, description: '商业PPT执行器已接入，但需服务端AI_API_KEY/OPENAI_API_KEY、LibreOffice平台引擎及经哈希校验的中文字体；缺任一项不会冒充生成。 ' + s.description };
    if (s.id === 'document.create' && (!presentationRendererAvailable() || !presentationFontsAvailable()))
      return { ...catalog, status: 'unavailable' as const, description: 'Word执行器需本地LibreOffice平台引擎及经校验的中文字体；缺少时不生成伪预览。 ' + s.description };
    if (s.id === 'slides.inspect' && !presentationRendererAvailable())
      return { ...catalog, status: 'unavailable' as const, description: '执行器已接入，但当前环境未安装LibreOffice Kit及平台渲染引擎；不会以结构分析冒充逐页渲染。 ' + s.description };
    return catalog;
  });
}
