import { useEffect, useState } from "react";
import { ServerDialog } from "../components/ServerStatusPanel";
import { apiJSON } from "../api/client";
import { samples, drafts } from "./samples/shared";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
type Entry = {
  sample: string;
  draft: string;
  revision: number;
  updatedAt: string;
};
export function ServerLibrary({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [message, setMessage] = useState("正在加载服务器作品…"),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const result = await apiJSON<Entry[]>("/templates");
      if (!Array.isArray(result)) throw Error("服务器目录格式无效。");
      setEntries(
        result.filter(
          (e) =>
            samples.some((s) => s.id === e.sample) &&
            /^[a-zA-Z0-9-]{1,60}$/.test(e.draft),
        ),
      );
      setMessage(
        result.length
          ? "以下是当前服务器身份保存的快照。"
          : "还没有服务器作品。打开模板，点击“保存到服务器”后会出现在这里。",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function open(entry: Entry) {
    if (
      !confirm(
        "恢复这份服务器快照到当前浏览器？同一作品或副本的本地内容会被替换，请先导出备份。",
      )
    )
      return;
    setBusy(true);
    try {
      const data = await apiJSON<{ state: unknown }>(
        `/templates/${entry.sample}/${entry.draft}`,
      );
      if (
        !data.state ||
        typeof data.state !== "object" ||
        Array.isArray(data.state)
      )
        throw Error("快照格式无效。");
      const sample = samples.find((s) => s.id === entry.sample)!;
      const key = `designbuddy.samples.v2.${sample.id}.${entry.draft}`;
      localStorage.setItem(key, JSON.stringify(data.state));
      if (entry.draft !== "sample") {
        const list = drafts();
        if (!list.some((d) => d.id === entry.draft && d.sample === sample.id))
          localStorage.setItem(
            "designbuddy.samples.drafts.v2",
            JSON.stringify(
              [
                {
                  id: entry.draft,
                  sample: sample.id,
                  title: sample.title + " · 服务器副本",
                  createdAt: new Date().toISOString(),
                },
                ...list,
              ].slice(0, 40),
            ),
          );
      }
      onClose();
      navigateTo(
        `/inspiration/${sample.id}${entry.draft === "sample" ? "" : `/draft/${entry.draft}`}`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ServerDialog title="服务器作品" onClose={onClose}>
      <p role="status">{message}</p>
      <p>
        访客身份只属于当前浏览器；注册或登录账号后才能跨设备找回。身份切换请使用左下角“工作区状态”。
      </p>
      <button disabled={busy} onClick={() => void load()}>
        刷新服务器目录
      </button>
      <ul>
        {entries.map((e) => (
          <li key={`${e.sample}-${e.draft}`}>
            <div>
              <strong>{samples.find((s) => s.id === e.sample)?.title}</strong>
              <small>
                {e.draft === "sample" ? "样板编辑内容" : "独立副本"} · 版本{" "}
                {e.revision} · {new Date(e.updatedAt).toLocaleString("zh-CN")}
              </small>
            </div>
            <button disabled={busy} onClick={() => void open(e)}>
              恢复并打开
            </button>
          </li>
        ))}
      </ul>
    </ServerDialog>
  );
}
