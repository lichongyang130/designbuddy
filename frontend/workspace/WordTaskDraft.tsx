import { useEffect, useRef, useState } from "react";
import { apiJSON } from "../../apps/web/src/api/client";
import type { ExpertTaskPlan } from "../../shared/expertExecution";
import type { WordDocument } from "../../shared/wordDocument";
/** Content only: no native-file claims and no implicit execution/third-party consent. */
export default function WordTaskDraft({
  plan,
  materials,
  disabled,
  onPrepare,
  onInvalidate,
}: {
  plan: ExpertTaskPlan;
  materials?: File[];
  disabled: boolean;
  onPrepare: (file: File) => void;
  onInvalidate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [type, setType] = useState("business-report");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const sending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current++;
    };
  }, []);
  function invalidate() {
    generation.current++;
    setConsent(false);
    setDraft("");
    setMessage("");
    onInvalidate();
  }
  async function useMaterial(file?: File) {
    if (!file) return;
    invalidate();
    const version = generation.current;
    if (!/\.(txt|md)$/i.test(file.name) || !file.size || file.size > 100000) {
      setError(
        "自动写作此入口只读取非空TXT/MD正文；DOCX等请走明确提取流程，不冒充读取。",
      );
      return;
    }
    const text = await file.text();
    if (!active.current || version !== generation.current) return;
    if (text.length > 20000) {
      setError("原文超过20000字，未截断或发送。");
      return;
    }
    setSourceText(text);
    setSourceName(file.name);
    setError("");
  }
  async function generate() {
    if (!consent || sending.current || disabled) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    onInvalidate();
    const version = ++generation.current;
    try {
      const result = await apiJSON<{ document: WordDocument; model: string }>(
        `/expert-task-plans/${plan.id}/word-draft`,
        {
          method: "POST",
          retryOnIdentityChange: false,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            externalConsent: true,
            title,
            audience,
            sourceName,
            sourceText,
            documentType: type,
          }),
        },
      );
      if (!active.current || version !== generation.current) return;
      setDraft(JSON.stringify(result.document, null, 2));
      setMessage(
        `已收到 ${result.model} 的结构化正文草稿。尚未生成Word文件；请审阅或编辑，再准备排版输入。`,
      );
    } catch (cause) {
      if (active.current && version === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "内容准备失败，没有启动排版。",
        );
    } finally {
      sending.current = false;
      if (active.current) {
        setBusy(false);
        setConsent(false);
      }
    }
  }
  function prepare() {
    try {
      const value = JSON.parse(draft);
      if (value.schemaVersion !== 1 || !Array.isArray(value.blocks))
        throw Error("结构化稿格式错误。");
      onPrepare(
        new File([JSON.stringify(value)], "expert-word-draft.json", {
          type: "application/json",
        }),
      );
      setMessage(
        "已准备你审阅后的实际JSON输入；完整校验、DOCX生成与同源渲染在另行确认执行后进行。",
      );
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "JSON无效。");
    }
  }
  return (
    <details className="word-task-draft">
      <summary>让主责专家按真实材料撰写Word内容（可选，需第三方模型）</summary>
      <p>
        这是有来源的内容准备，不是排版已完成。只调用服务端配置的模型；未配置时可使用下方人工成稿表单。
      </p>
      <fieldset disabled={disabled || busy}>
        <label>
          文档标题
          <input
            value={title}
            maxLength={100}
            onChange={(e) => {
              invalidate();
              setTitle(e.target.value);
            }}
          />
        </label>
        <label>
          目标读者
          <input
            value={audience}
            maxLength={200}
            onChange={(e) => {
              invalidate();
              setAudience(e.target.value);
            }}
          />
        </label>
        <label>
          文档类型
          <select
            value={type}
            onChange={(e) => {
              invalidate();
              setType(e.target.value);
            }}
          >
            <option value="business-report">商业报告</option>
            <option value="project-plan">项目方案</option>
          </select>
        </label>
        <label>
          真实原稿名称
          <input
            value={sourceName}
            maxLength={120}
            onChange={(e) => {
              invalidate();
              setSourceName(e.target.value);
            }}
          />
        </label>
        <label>
          实际提供的原稿全文
          <textarea
            rows={7}
            value={sourceText}
            maxLength={20000}
            onChange={(e) => {
              invalidate();
              setSourceText(e.target.value);
            }}
          />
        </label>
        <label>
          读取TXT / MD原稿
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => void useMaterial(e.target.files?.[0])}
          />
        </label>
        {materials
          ?.filter((f) => /\.(txt|md)$/i.test(f.name))
          .map((f) => (
            <button
              type="button"
              key={f.name}
              onClick={() => void useMaterial(f)}
            >
              使用已带入的原稿：{f.name}
            </button>
          ))}
        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          我单次同意将以上原稿全文、目标和受众发送给服务端配置的第三方模型，按服务商政策与实际账单处理。内容草稿保存在本应用后台；不自动制作或发布文件。
        </label>
        <button
          type="button"
          disabled={
            !consent ||
            !title.trim() ||
            !audience.trim() ||
            !sourceName.trim() ||
            !sourceText.trim()
          }
          onClick={() => void generate()}
        >
          按专家方法准备正文（一次模型调用）
        </button>
      </fieldset>
      {busy && (
        <p role="status">
          正文请求已提交，等待真实模型结果；不会模拟完成或自动重试。
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={async () => {
          if (
            !window.confirm(
              "删除本计划在应用后台保存的正文模型草稿？不会删除已生成的Word运行、文件或服务商记录。",
            )
          )
            return;
          try {
            await apiJSON(`/expert-task-plans/${plan.id}/word-draft`, {
              method: "DELETE",
              retryOnIdentityChange: false,
            });
            setMessage(
              "已删除本计划的后台正文草稿记录；已有产物和服务商记录未删除。",
            );
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "删除失败。");
          }
        }}
      >
        删除本计划后台正文草稿记录
      </button>
      {draft && (
        <>
          <label>
            审阅与编辑结构化正文
            <textarea
              aria-label="专家Word结构化正文"
              rows={15}
              value={draft}
              onChange={(e) => {
                onInvalidate();
                setDraft(e.target.value);
                setMessage("内容已修改，需重新准备并确认排版。");
              }}
            />
          </label>
          <button type="button" disabled={disabled || busy} onClick={prepare}>
            将审阅后的正文准备为排版输入
          </button>
        </>
      )}
    </details>
  );
}
