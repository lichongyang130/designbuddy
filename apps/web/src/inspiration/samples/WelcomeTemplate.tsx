import { useState } from "react";
import { welcomeTemplates, welcomeBase } from "../welcomeTemplates";
import { copySample, useSampleState, SampleTop, Notice } from "./shared";
import {
  navigateTo,
  normalizeAppPath,
} from "../../../../../frontend/workspace/workspaceRoutes";
import "./welcome-template.css";

export default function WelcomeTemplate({ draftId }: { draftId?: string }) {
  const template = welcomeTemplates.find(
    (t) =>
      t.id ===
      normalizeAppPath(window.location.pathname).split("/").filter(Boolean)[1],
  )!;
  const [state, setState, storageError] = useSampleState(template.id, draftId, {
    notes: "",
  });
  const [notice, setNotice] = useState("");
  return (
    <main className="welcome-template">
      <SampleTop
        type="图片模板"
        title={`欢迎页 ${template.number} · ${template.name}`}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(template.id, state);
          } catch {
            setNotice("无法保存副本，请检查浏览器存储。");
          }
        }}
      >
        <a
          className="welcome-template-download"
          href={`${welcomeBase}/${encodeURI(template.file)}`}
          download={`DesignBuddy-welcome-${template.number}.png`}
        >
          下载 PNG ↓
        </a>
      </SampleTop>
      <Notice text={storageError || notice} />
      <div className="welcome-template-body">
        <nav aria-label="欢迎页模板">
          {welcomeTemplates.map((t) => (
            <button
              key={t.id}
              aria-current={t.id === template.id ? "page" : undefined}
              onClick={() => navigateTo(`/inspiration/${t.id}`)}
            >
              {t.number} {t.name}
            </button>
          ))}
        </nav>
        <section>
          <img
            className="welcome-template-image"
            src={`${welcomeBase}/${encodeURI(template.file)}?rev=2-final`}
            alt={`欢迎页 ${template.number} ${template.name}完整设计图`}
            width="1440"
            height="1000"
          />
          <p>
            内置设计图模板 · PNG / 1440 × 1000 · 每套采用不同的 AI
            生成主视觉。此处保存的是设计参考图，不是可登录页面；07
            已用于应用欢迎页。
          </p>
          {template.number === "07" && (
            <button onClick={() => navigateTo("/welcome")}>
              查看已实现的 07 欢迎页 →
            </button>
          )}
          <label className="welcome-template-notes">
            我的使用备注
            <textarea
              value={state.notes}
              maxLength={2000}
              onChange={(e) => setState({ notes: e.target.value })}
              placeholder="记录这套设计的使用场景或调整要求；备注随副本和服务器版本保存，不会更改原始 PNG。"
            />
          </label>
        </section>
      </div>
    </main>
  );
}
