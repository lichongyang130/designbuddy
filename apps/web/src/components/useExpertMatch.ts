import { useEffect, useMemo, useState } from "react";
import { apiJSON } from "../api/client";
import { getAIProviderCredentials } from "../../../../frontend/workspace/AIProviderSettings";
import { expertCatalog, customExpertCatalog } from "../../../../frontend/workspace/expertCatalog";
import { useWorkspaceStore } from "../../../../frontend/workspace/store";
import { expertExecutionBrief, localExpertSuggestion, validExpertMatch, type ExpertMatch, type ExpertProfile } from "../../../../shared/expertRouting";

const consentKey = "designbuddy.expert-match-consent.v1";
function initialConsent() { try { return localStorage.getItem(consentKey) === "allowed"; } catch { return false; } }
const defaultMethod = ["先确认交付目标、使用对象、已有材料和约束", "按专业职责拆解工作，区分事实、假设和建议", "交付主体结果、依据及待复核事项"];
const defaultChecks = ["不编造事实、引用、数字和执行结果", "工具与外部服务必须实际接入才能使用", "资料不足只询问必要问题，外部操作遵守原有权限"];
type Input = { prompt: string; mode: "office" | "code" | "design"; model: string; permission: string; attachments: { name: string; text?: string }[]; selectedExpert: string; enabled: boolean };
export function useExpertMatch(input: Input) {
  const custom = useWorkspaceStore(s => s.experts);
  const profiles = useMemo<ExpertProfile[]>(() => {
    const personal = custom.slice(0, 25).map(customExpertCatalog);
    return [...expertCatalog, ...personal].map(p => ({
      id: p.id, name: p.name.slice(0, 100), description: p.description.slice(0, 1200),
      method: p.method.slice(0, 6).map(s => s.slice(0, 400)), checks: p.checks.slice(0, 6).map(s => s.slice(0, 400)),
    }));
  }, [custom]);
  const [consent, setConsent] = useState(initialConsent);
  const [attempt, setAttempt] = useState(0);
  const [answerState, setAnswerState] = useState({ base: "", value: "" });
  const attachmentContext = input.attachments.filter(a => a.text).map(a => `${a.name}\n${a.text}`).join("\n\n").slice(0, 6000);
  const base = JSON.stringify([input.prompt, input.mode, attachmentContext]);
  const answer = answerState.base === base ? answerState.value : "";
  const key = JSON.stringify([base, answer, input.model, input.permission, profiles, attempt]);
  const [state, setState] = useState<{ key: string; result?: ExpertMatch; error?: string; loading?: boolean }>({ key: "" });
  const allowed = consent && input.enabled && input.permission !== "仅本地" && !input.selectedExpert && !!input.prompt.trim();
  // Render-time key checks make stale responses unusable even before effect cleanup.
  const current = allowed && state.key === key ? state : undefined;
  const result = current?.result;
  const suggested = result?.kind === "match" ? profiles.find(p => p.id === result.expertId) : undefined;
  const collaborators = result?.kind === "match" ? result.collaboratorIds.map(id => profiles.find(p => p.id === id)).filter((p): p is ExpertProfile => !!p) : [];
  const manual = input.selectedExpert ? profiles.find(p => p.name === input.selectedExpert) || { id: "manual", name: input.selectedExpert, description: "用户明确指定的专业角色；以用户需求与提供的材料为准", method: defaultMethod, checks: defaultChecks } : undefined;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController(); let active = true;
    const timer = setTimeout(async () => {
      setState({ key, loading: true });
      try {
        const value = await apiJSON<unknown>("/expert-match", {
          method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true, prompt: input.prompt.slice(0, 16000), mode: input.mode, model: input.model || undefined, permission: input.permission, attachmentContext, answer, experts: profiles, ...getAIProviderCredentials() }),
        });
        if (!validExpertMatch(value, profiles)) throw Error("匹配结果格式不正确，请重试或手动选择。");
        if (active) setState({ key, result: value });
      } catch (error) {
        if (active && !controller.signal.aborted) setState({ key, error: error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "匹配超时，可以重试或直接发送。" : error instanceof Error ? error.message.slice(0, 300) : "暂未完成匹配。" });
      }
    }, 900);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [allowed, key]);
  function changeConsent(value: boolean) { setConsent(value); setState({ key: "" }); try { if (value) localStorage.setItem(consentKey, "allowed"); else localStorage.removeItem(consentKey); } catch { /* Consent still applies only in this mounted view. */ } }
  function reset() { setState({ key: "" }); setAnswerState({ base: "", value: "" }); }
  const label = manual ? manual.name : input.permission === "仅本地" ? "仅本地 · 手动选择" : !consent || !input.prompt.trim() ? "自动匹配专家" : current?.error ? "暂未完成匹配" : result?.kind === "clarify" ? "需要确认需求" : result?.kind === "general" ? "直接处理即可" : suggested ? `推荐：${suggested.name}` : "正在匹配专家…";
  const profile = manual || suggested;
  // Expert understanding may contradict the selected homepage column. Only explicit
  // web deliverables use the web artifact generator; other expert work stays in chat.
  const isWebDeliverable = /网页|网站|官网|落地页|后台|看板|\bhtml\b|\breact\b|\bvue\b|\bweb\b/i.test(`${input.prompt}\n${answer}`);
  const replyMode: "chat" | "generation" | undefined = profile
    ? profile.id === "developer" && isWebDeliverable ? "generation" : "chat"
    : result?.kind === "general" ? "chat" : undefined;
  return { consent, changeConsent, label, result, suggested, collaborators, manual, profile, error: current?.error, loading: allowed && !result && !current?.error, localOnly: input.permission === "仅本地", answer,
    answerQuestion(question: string, value: string) { setAnswerState({ base, value: `${question}\n用户确认：${value.trim().slice(0, 800)}` }); },
    clearAnswer() { setAnswerState({ base: "", value: "" }); },
    retry() { setAttempt(a => a + 1); }, reset,
    fallback: current?.error || input.permission === "仅本地" ? localExpertSuggestion(input.prompt) : undefined,
    executionBrief: profile ? `${expertExecutionBrief(profile, manual ? undefined : result)}${!manual && collaborators.length ? `\n协作专家（仅按明确分工提供辅助指导，不替代主责）：\n${collaborators.map(expert => `- ${expert.name}：${expert.description}\n  方法：${expert.method.join("；")}`).join("\n")}` : ""}` : "",
    confirmedContext: answer ? `\n已确认的任务要求：\n${answer}\n` : "",
    profiles, replyMode,
  };
}
export type ExpertMatchController = ReturnType<typeof useExpertMatch>;
