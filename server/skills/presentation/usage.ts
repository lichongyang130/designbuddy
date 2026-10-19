import type { UsageRecord } from '../../api/model-registry';
import { object, safeText } from './sources';
/** Worker messages are attributed to the authenticated run owner, never an owner named by a model. */
export function validatePresentationUsage(value: unknown): UsageRecord {
  const u = object(value, ['model', 'provider', 'promptTokens', 'completionTokens', 'totalTokens', 'reported', 'latencyMs', 'status', 'error', 'createdAt'], '模型用量');
  safeText(u.model, 200, '模型标识'); safeText(u.provider, 50, '通道标识');
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens']) if (u[key] !== null && (!Number.isSafeInteger(u[key]) || u[key] < 0 || u[key] > 1_000_000_000)) throw Error('模型用量未报告或格式不合法。');
  if (typeof u.reported !== 'boolean' || !['succeeded', 'failed'].includes(u.status) || typeof u.error !== 'string' || u.error.length > 1000 || !Number.isFinite(u.latencyMs) || u.latencyMs < 0 || u.latencyMs > 300000 || !Number.isSafeInteger(u.createdAt) || u.createdAt <= 0) throw Error('模型用量时间或状态不合法。');
  return u as UsageRecord;
}
