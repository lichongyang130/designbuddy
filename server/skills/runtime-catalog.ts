import { externalSkillPermissions, runtimeSkills, type RuntimeSkill } from '../../shared/skillRuntime';
import { asrConfiguration } from './asr-config';
import { imageEndpoint } from './image-generate';
import { collaborationChannels } from './collaboration-sync';
import { skillPermissions } from './skill-permissions';
import { presentationRendererAvailable } from './pptx-render';

/**
 * Browser contracts are not evidence that optional server dependencies exist.
 *
 * Every entry reports both legacy `status` ("ready" | "unavailable") for
 * existing callers and the explicit 5-state `capabilityState`:
 * - ready: dependencies met, runs locally without external credentials
 * - needs_config: real executor wired, server credential/model/runtime missing
 * - needs_auth: dependencies met, requires explicit per-run user authorization
 * - unavailable: executor missing or platform unsupported
 */
export function runtimeCatalog(): RuntimeSkill[] {
  const configuration = asrConfiguration();
  const image = imageEndpoint();
  const channels = collaborationChannels();
  return runtimeSkills.map(s => {
    const permissions = skillPermissions(s.id);
    const catalog = { ...s, permissions };
    if (s.executorState === 'missing') {
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'unavailable' as const,
        statusReason: '执行器尚未接入。',
      };
    }
    if (s.id === 'audio.transcribe-en' && !configuration.ready) {
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'needs_config' as const,
        statusReason: configuration.reason,
        description: configuration.reason + ' ' + s.description,
      };
    }
    if (s.id === 'document.summarize' && !process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) {
      const reason = '执行器已接入，需在服务端配置 AI_API_KEY 或 OPENAI_API_KEY。';
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'needs_config' as const,
        statusReason: reason,
        description: '服务端AI_API_KEY/OPENAI_API_KEY未配置；不会生成伪摘要。 ' + s.description,
      };
    }
    if (s.id === 'image.generate' && !image) {
      const reason = '执行器已接入，需配置 IMAGE_API_KEY / IMAGE_BASE_URL / IMAGE_MODEL。';
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'needs_config' as const,
        statusReason: reason,
        description: '执行器已接入，但服务端未配置图像模型通道（IMAGE_API_KEY/IMAGE_BASE_URL/IMAGE_MODEL）；不会用占位图冒充生成结果。 ' + s.description,
      };
    }
    if (s.id === 'collaboration.sync' && !channels.calendar && !channels.email) {
      const reason = '执行器已接入，需配置日历或邮件通道环境变量。';
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'needs_config' as const,
        statusReason: reason,
        description: '执行器已接入，但服务端未配置日历或邮件通道（COLLABORATION_CALENDAR_BASE_URL/TOKEN/ID、COLLABORATION_EMAIL_BASE_URL/API_KEY/FROM）；不会假装外发成功。 ' + s.description,
      };
    }
    if (s.id === 'slides.inspect' && !presentationRendererAvailable()) {
      const reason = '执行器已接入，当前环境需安装 LibreOffice 渲染引擎。';
      return {
        ...catalog,
        status: 'unavailable' as const,
        capabilityState: 'needs_config' as const,
        statusReason: reason,
        description: '执行器已接入，但当前环境未安装LibreOffice Kit及平台渲染引擎；不会以结构分析冒充逐页渲染。 ' + s.description,
      };
    }
    const needsPerRunAuth =
      permissions.some(p => externalSkillPermissions.includes(p)) ||
      Boolean(s.manualOnly) ||
      permissions.includes('network');
    if (needsPerRunAuth) {
      return {
        ...catalog,
        capabilityState: 'needs_auth' as const,
        statusReason: '依赖已满足；执行前需确认本次授权或运行参数。',
      };
    }
    return {
      ...catalog,
      capabilityState: 'ready' as const,
      statusReason: '依赖满足，可直接调用真实本地执行器。',
    };
  });
}
