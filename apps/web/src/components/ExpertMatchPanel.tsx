import { useState } from "react";
import type { ExpertMatchController } from "./useExpertMatch";
import "./expert-match.css";
import { expertCatalog } from "../../../../frontend/workspace/expertCatalog";

export function ExpertMatchPanel({ match, onManual, onSelect, onConfigure, onClose, onViewDetails }: { match: ExpertMatchController; onManual(): void; onSelect(name: string): void; onConfigure(): void; onClose(): void; onViewDetails?(): void }) {
  const [custom, setCustom] = useState("");
  const result = match.result;
  const activeProfile = match.manual || match.suggested;
  const avatar = expertCatalog.find(expert => expert.id === activeProfile?.id)?.avatar;
  const portrait = avatar ? <img className="expert-match-avatar" src={avatar} alt="" width={32} height={32} /> : null;
  return <section className="expert-match-panel" aria-label="专家匹配详情">
    <header className="expert-match-header">
      <div className="expert-match-heading"><b>{match.manual ? "已手动指定 · 不会自动替换" : "自动匹配一位主专家"}</b><small>工作规范指导 · 非外部代理</small></div>
      <button type="button" className="expert-match-close" aria-label="关闭专家匹配" title="关闭" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    {match.preferenceError && <p role="alert">{match.preferenceError}</p>}
    {match.manual ? <>
      <h3 className="expert-match-identity">{portrait}{match.manual.name}</h3><p>{match.manual.description}</p>
      <h4>工作方法</h4><ul>{match.manual.method.map(s => <li key={s}>{s}</li>)}</ul>
      <button onClick={() => { onSelect(""); match.retry(); }}>恢复自动匹配</button>
    </> : <>
      {match.localOnly ? <p className="expert-match-note">仅本地模式不会向模型发送草稿或附件。可手动选择专家；不会执行云端匹配。</p> : !match.consent ? <div className="expert-match-consent">
        <p>开启后，停止输入后，会按助理设置中的等待时间，将当前草稿、已读取的附件片段及候选专家资料发送给所选模型，用于判断任务，而不是执行任务。</p>
        <p>每次最多发送草稿前 16,000 字、附件前 6,000 字；可能产生模型费用。不会读取未解析的图片或 PDF。允许设置保存在本机，可随时关闭。</p>
        <button onClick={() => match.changeConsent(true)}>允许并开启自动匹配</button>
        <small>不开启也能手动选择或直接发送任务。</small>
      </div> : <>
        {!match.loading && !result && !match.error && <p>描述想完成的事情；我会判断是否需要专家。简单任务直接处理，不强行分配专家。</p>}
        {match.loading && <p role="status">正在理解任务目标与材料…匹配不阻塞直接发送。</p>}
        {match.error && <div role="status"><h3>暂未完成匹配</h3><p>{match.error}</p><div className="expert-match-actions"><button onClick={match.retry}>重试匹配</button><button onClick={onConfigure}>配置模型服务</button></div></div>}
        {result?.kind === "general" && <><h3>直接处理即可</h3><p>{result.reason}</p><small>发送时不添加专家规范。</small></>}
        {result?.kind === "match" && match.suggested && <>
          <h3 className="expert-match-identity">{portrait}{match.suggested.name} <small>推荐 · 主责</small></h3><p>{result.reason}</p>
          {!!match.collaborators.length && <div className="expert-match-collaborators"><b>可选协作</b>{match.collaborators.map(expert => <p key={expert.id}><strong>{expert.name}</strong> · {expert.description}</p>)}</div>}
          <h4>本次负责</h4><ul>{result.responsibilities.map(s => <li key={s}>{s}</li>)}</ul>
          {!!result.missing.length && <><h4>还需要</h4><ul>{result.missing.map(s => <li key={s}>{s}</li>)}</ul></>}
          <details><summary>工作方法与交付核验</summary><ul>{[...match.suggested.method, ...match.suggested.checks].map(s => <li key={s}>{s}</li>)}</ul></details>
          <small>直接发送将使用这位专家的工作规范；未授权任何外部操作。</small>
          <button onClick={() => onSelect(match.suggested!.name)}>使用推荐并锁定</button>
        </>}
        {result?.kind === "clarify" && <div className="expert-match-question" key={result.question}>
          <h3>{result.question}</h3><div className="expert-match-options">{result.options.map(option => <button key={option} onClick={() => match.answerQuestion(result.question, option)}>{option}</button>)}</div>
          <form onSubmit={e => { e.preventDefault(); if (custom.trim()) { match.answerQuestion(result.question, custom); setCustom(""); } }}><label>其他需求<input aria-label="专家匹配补充需求" maxLength={800} value={custom} onChange={e => setCustom(e.target.value)} /></label><button disabled={!custom.trim()} type="submit">确认需求</button></form>
          <small>只确认这个影响专家选择的问题，不改动输入框和附件。</small>
        </div>}
      </>}
      {match.fallback && <div className="expert-match-fallback"><b>本地规则建议 · 非模型匹配</b><p>{match.fallback.name}：仅按任务词语粗略判断，可能不准确，不会自动用于执行。</p><button onClick={() => onSelect(match.fallback!.name)}>使用本地建议并锁定</button></div>}
    </>}
    {match.answer && <div className="expert-match-note"><b>已确认</b><p>{match.answer}</p><button onClick={match.clearAnswer}>修改确认信息</button></div>}
    {match.skillSuggestion && <div className="expert-match-skill-suggestion">
      <b>🔧 推荐技能：{match.skillSuggestion.name}</b>
      <p>{match.skillSuggestion.hint}</p>
      {match.skillSuggestion.accepts.length > 0 && <small>支持文件：{match.skillSuggestion.accepts.join("、")}</small>}
      <small>发送任务后，技能工作台会自动预选此技能，上传文件即可执行。</small>
    </div>}
    <footer>{onViewDetails && <button onClick={onViewDetails}>查看专家详情</button>}<button onClick={onManual}>{match.manual ? "切换专家" : "手动选择专家"}</button>{match.consent && <button onClick={() => match.changeConsent(false)}>关闭自动匹配</button>}</footer>
    <p className="expert-match-boundary">专家只使用实际可用的材料与工具；未接入服务不假装执行。实际文件处理请进入专家详情的技能执行台，聊天不会自动调用这些工具。匹配失败时仍可直接发送。</p>
  </section>;
}
