import { useCallback, useEffect, useRef, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { copySample, samples, type SampleId } from "../../../apps/web/src/inspiration/samples/shared";
import { navigateTo } from "../workspaceRoutes";
import {
  communityVisibilityLabel,
  fetchCommunityTemplateState,
  listCommunityTemplateEvents,
  listCommunityTemplates,
  setCommunityTemplateVisibility,
  unpublishCommunityTemplate,
  type CommunityEvent,
  type CommunityTemplate,
  type CommunityVisibility,
} from "../api/community";
import "./community.css";

const VISIBILITIES: CommunityVisibility[] = ["private", "workspace", "public"];

/**
 * The community of published templates.
 *
 * Publishing is a server side change: the author publishes the current state
 * of a template, the server keeps the owner, the revision and the change
 * trail, and the visibility decides who may see and copy it. Copying always
 * creates a private copy in the browser of the person who copies it.
 */
export default function CommunityPage() {
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [events, setEvents] = useState<Record<string, CommunityEvent[]>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // A background load must not wipe the message of an action the person just
  // triggered, so an action error survives the next load.
  const actionError = useRef(false);
  const fail = (message: string) => {
    actionError.current = true;
    setError(message);
  };
  const clearError = () => {
    actionError.current = false;
    setError("");
  };

  const load = useCallback(async () => {
    try {
      setTemplates(await listCommunityTemplates());
      if (!actionError.current) setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "社区模板服务暂不可用。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setNotice(success);
      clearError();
      await load();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  async function copy(template: CommunityTemplate) {
    // A published template may name a family this build does not know; say so
    // instead of copying something that cannot be opened.
    const sample = samples.find((item) => item.id === template.sample);
    if (!sample) {
      setError(`这个模板属于「${template.sample}」系列，当前版本没有这一套模板，无法复制。`);
      return;
    }
    setBusy(true);
    try {
      const result = await fetchCommunityTemplateState(template.id);
      copySample(sample.id as SampleId, result.state);
      setNotice(`已复制「${template.title}」，副本保存在你的浏览器里。`);
      setError("");
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "复制模板失败。");
    } finally {
      setBusy(false);
    }
  }

  async function showEvents(template: CommunityTemplate) {
    try {
      const list = await listCommunityTemplateEvents(template.id);
      setEvents((current) => ({ ...current, [template.id]: list }));
      setError("");
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "读取操作记录失败。");
    }
  }

  return (
    <div className="workbuddy-app community-workspace">
      <WorkBuddySidebar
        active="plugins"
        go={navigateTo}
        setNotice={setNotice}
        projectCount={0}
        workspaceCount={0}
      />
      <main className="ct-main" aria-label="社区模板">
        <div className="ct-content">
          <section className="ct-hero">
            <div>
              <span className="ct-eyebrow">社区与模板</span>
              <h1>社区模板</h1>
              <p>模板作者可以把当前内容发布到社区：发布状态、可见范围与操作记录都在服务器上，复制会在你自己的浏览器里生成独立副本。</p>
            </div>
          </section>

          {(error || notice) && (
            <p className={error ? "ct-message is-error" : "ct-message"} role="status">{error || notice}</p>
          )}

          <section className="ct-card" aria-label="社区模板列表">
            <h2>已发布模板（{templates.length}）</h2>
            <p className="ct-note">这里只显示服务器确认可见的模板；他人的私密模板不会出现在列表里。</p>
            <ul className="ct-list">
              {templates.map((template) => (
                <li key={template.id} data-template={template.id}>
                  <div className="ct-item-head">
                    <strong>{template.title}</strong>
                    <span>
                      模板族 {template.sample} · 第 {template.revision} 版 ·{" "}
                      {communityVisibilityLabel(template.visibility)} · 发布于{" "}
                      {new Date(template.publishedAt).toLocaleString("zh-CN")}
                    </span>
                    {template.description && <p className="ct-description">{template.description}</p>}
                  </div>
                  <div className="ct-item-actions">
                    <button className="ct-button is-primary" type="button" disabled={busy} onClick={() => void copy(template)}>
                      复制到我的副本
                    </button>
                    <select
                      aria-label={`${template.title} 的可见范围`}
                      value={template.visibility}
                      disabled={busy}
                      onChange={(event) => void run(
                        () => setCommunityTemplateVisibility(template.id, event.target.value as CommunityVisibility).then(() => undefined),
                        `已更新「${template.title}」的可见范围。`,
                      )}
                    >
                      {VISIBILITIES.map((item) => <option key={item} value={item}>{communityVisibilityLabel(item)}</option>)}
                    </select>
                    <button className="ct-button" type="button" onClick={() => void showEvents(template)}>
                      操作记录
                    </button>
                    <button
                      className="ct-button is-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(
                        () => unpublishCommunityTemplate(template.id).then(() => undefined),
                        `已下架「${template.title}」。`,
                      )}
                    >
                      下架
                    </button>
                  </div>
                  {events[template.id] && (
                    <ul className="ct-events">
                      {events[template.id].map((event) => (
                        <li key={event.id}>
                          {event.action} · {new Date(event.createdAt).toLocaleString("zh-CN")}
                        </li>
                      ))}
                      {!events[template.id].length && <li>暂无操作记录。</li>}
                    </ul>
                  )}
                </li>
              ))}
              {!templates.length && <li className="ct-empty">还没有已发布的模板。到模板页编辑后点「发布到社区」。</li>}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
