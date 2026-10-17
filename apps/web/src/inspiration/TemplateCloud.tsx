import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiJSON } from "../api/client";
import {
  publishCommunityTemplate,
  type CommunityVisibility,
} from "../../../../frontend/workspace/api/community";
import "./template-cloud.css";
type Binding = { read: () => unknown; restore: (raw: unknown) => void };
const CloudContext = createContext<{
  sample: string;
  draft: string;
  binding: Binding | null;
  register: (binding: Binding | null) => void;
} | null>(null);
export function TemplateCloudProvider({
  sample,
  draft,
  children,
}: {
  sample: string;
  draft?: string;
  children: ReactNode;
}) {
  const [binding, setBinding] = useState<Binding | null>(null);
  const register = useCallback(
    (value: Binding | null) => setBinding(value),
    [],
  );
  return (
    <CloudContext.Provider
      value={{ sample, draft: draft || "sample", binding, register }}
    >
      {children}
    </CloudContext.Provider>
  );
}
export function useTemplateBinding(
  value: unknown,
  restore: (raw: unknown) => void,
) {
  const context = useContext(CloudContext),
    latest = useRef({ value, restore });
  latest.current = { value, restore };
  const register = context?.register;
  useEffect(() => {
    if (!register) return;
    register({
      read: () => latest.current.value,
      restore: (raw) => latest.current.restore(raw),
    });
    return () => register(null);
  }, [register]);
}
export function TemplateCloudControls() {
  const context = useContext(CloudContext);
  const [revision, setRevision] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("服务器状态未核验"),
    [available, setAvailable] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishVisibility, setPublishVisibility] = useState<CommunityVisibility>("private");
  const current = useRef(0);
  const path = context ? `/templates/${context.sample}/${context.draft}` : "";
  const check = useCallback(async () => {
    const generation = ++current.current;
    setRevision(null);
    setAvailable(false);
    try {
      const data = await apiJSON<{ revision: number; updatedAt: string }>(path);
      if (generation !== current.current) return;
      setRevision(data.revision);
      setAvailable(true);
      setMessage(
        `服务器版本 ${data.revision} · ${new Date(data.updatedAt).toLocaleString("zh-CN")}`,
      );
    } catch (e) {
      if (generation !== current.current) return;
      if ((e as { status?: number }).status === 404) {
        setRevision(0);
        setAvailable(true);
        setMessage("尚未保存服务器版本");
      } else setMessage((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    if (!context) return;
    void check();
    const changed = () => void check();
    window.addEventListener("designbuddy:server-identity", changed);
    return () => {
      current.current++;
      window.removeEventListener("designbuddy:server-identity", changed);
    };
  }, [check, !!context]);
  if (!context) return null;
  const save = async () => {
    if (!context.binding || revision === null) return;
    if (
      revision > 0 &&
      !confirm(
        `将当前本地内容保存为新版本？服务器第 ${revision} 版将被替换，请先保留需要的备份。`,
      )
    )
      return;
    const generation = current.current;
    setBusy(true);
    try {
      const data = await apiJSON<{
        saved: boolean;
        revision: number;
        updatedAt: string;
      }>(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: context.binding.read(), revision }),
      });
      if (generation !== current.current) return;
      if (!data.saved) throw Error("服务器没有确认保存。");
      setRevision(data.revision);
      setMessage(`已保存到服务器 · 版本 ${data.revision}`);
    } catch (e) {
      if (generation !== current.current) return;
      setMessage((e as Error).message);
      if ((e as { status?: number }).status === 409) {
        setRevision(null);
        setAvailable(false);
      }
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (
      !context.binding ||
      !confirm("用服务器版本替换当前编辑内容？请先下载重要的本地修改。")
    )
      return;
    const generation = current.current;
    setBusy(true);
    try {
      const data = await apiJSON<{ state: unknown; revision: number }>(path);
      if (generation !== current.current) return;
      context.binding.restore(data.state);
      setRevision(data.revision);
      setAvailable(true);
      setMessage(`已恢复服务器版本 ${data.revision}`);
    } catch (e) {
      if (generation === current.current) setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!context?.binding || !publishTitle.trim()) return;
    setBusy(true);
    try {
      const template = await publishCommunityTemplate({
        sample: context.sample,
        title: publishTitle.trim(),
        visibility: publishVisibility,
        state: context.binding.read(),
      });
      setMessage(
        `已发布到社区 · 第 ${template.revision} 版 · ${template.visibility === "public" ? "已公开" : template.visibility === "workspace" ? "工作空间可见" : "仅自己可见"}`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="template-cloud" aria-label="模板服务器保存">
      <div>
        <strong>服务器备份</strong>
        <span aria-live="polite">{message}</span>
        <small>
          本机仍自动保存。点击下方按钮才上传当前数据（含填写的联系信息）；不上传命名版本历史。注册账号后可跨设备恢复。
        </small>
      </div>
      <div className="template-cloud-actions">
        <button
          disabled={busy || !context.binding || !available || revision === null}
          onClick={() => void save()}
        >
          {busy ? "处理中…" : "保存到服务器"}
        </button>
        <button
          disabled={busy || !context.binding || revision === 0}
          onClick={() => void restore()}
        >
          恢复服务器版本
        </button>
        <button disabled={busy} onClick={() => void check()}>
          检查服务器版本
        </button>
      </div>
      <div className="template-cloud-actions template-cloud-publish">
        <input
          aria-label="发布到社区的标题"
          value={publishTitle}
          maxLength={80}
          placeholder="给社区里的这份模板起个标题"
          onChange={(event) => setPublishTitle(event.target.value)}
        />
        <select
          aria-label="发布到社区的可见范围"
          value={publishVisibility}
          onChange={(event) => setPublishVisibility(event.target.value as CommunityVisibility)}
        >
          <option value="private">仅自己可见</option>
          <option value="workspace">工作空间可见</option>
          <option value="public">已公开</option>
        </select>
        <button
          className="is-primary"
          disabled={busy || !context.binding || !publishTitle.trim()}
          onClick={() => void publish()}
        >
          发布到社区
        </button>
      </div>
    </section>
  );
}
