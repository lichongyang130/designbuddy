import { useCallback, useEffect, useRef, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { navigateTo } from "../workspaceRoutes";
import {
  assetVisibilityLabel,
  deleteAsset,
  fetchAssetText,
  formatAssetSize,
  listAssetEvents,
  listAssets,
  setAssetVisibility,
  uploadAsset,
  type Asset,
  type AssetEvent,
  type AssetVisibility,
} from "../api/assets";
import "./assets.css";

const VISIBILITIES: AssetVisibility[] = ["private", "workspace", "public"];

/**
 * The server side asset library.
 *
 * Files that people attach to a task are stored on the server instead of being
 * pasted into the message: the server keeps the bytes, a fingerprint and, for
 * text files, the parsed text. The visibility of a file decides who may see
 * it, and every change is written into the file's own history.
 */
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [events, setEvents] = useState<Record<string, AssetEvent[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<AssetVisibility>("private");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
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
      setAssets(await listAssets());
      if (!actionError.current) setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "素材库服务暂不可用。");
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

  async function upload(files: File[]) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    await run(async () => {
      for (const file of selected) {
        const asset = await uploadAsset(file, visibility);
        setAssets((current) => [asset, ...current]);
      }
    }, `已上传 ${selected.length} 个文件到服务器素材库。`);
  }

  async function showText(asset: Asset) {
    try {
      const text = await fetchAssetText(asset.id);
      setTexts((current) => ({ ...current, [asset.id]: text }));
      setError("");
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "读取文件内容失败。");
    }
  }

  async function showEvents(asset: Asset) {
    try {
      const list = await listAssetEvents(asset.id);
      setEvents((current) => ({ ...current, [asset.id]: list }));
      setError("");
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "读取操作记录失败。");
    }
  }

  return (
    <div className="workbuddy-app assets-workspace">
      <WorkBuddySidebar
        active="plugins"
        go={navigateTo}
        setNotice={setNotice}
        projectCount={0}
        workspaceCount={0}
      />
      <main className="as-main" aria-label="素材库">
        <div className="as-content">
          <section className="as-hero">
            <div>
              <span className="as-eyebrow">文件与素材</span>
              <h1>素材库</h1>
              <p>上传的文件由服务器保存：服务器记录指纹与大小，文本类文件由服务器解析，可见范围决定谁能看到它们。</p>
            </div>
          </section>

          {(error || notice) && (
            <p className={error ? "as-message is-error" : "as-message"} role="status">{error || notice}</p>
          )}

          <section className="as-card" aria-label="上传素材">
            <h2>上传素材</h2>
            <p className="as-note">单个文件最多 5 MB，每个账号最多 50 个文件；文本类文件（txt / md / csv / json 等）会被服务端解析，其它类型只保存不解析。</p>
            <div className="as-forms">
              <label>
                上传后的可见范围
                <select
                  aria-label="上传后的可见范围"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as AssetVisibility)}
                >
                  {VISIBILITIES.map((item) => <option key={item} value={item}>{assetVisibilityLabel(item)}</option>)}
                </select>
              </label>
              <input
                ref={fileInput}
                type="file"
                multiple
                aria-label="选择要上传的文件"
                onChange={(event) => {
                  // The file list has to be copied before the input is cleared:
                  // clearing the value empties the live list.
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  void upload(files);
                }}
              />
              <button
                className="as-button is-primary"
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                选择文件并上传
              </button>
            </div>
          </section>

          <section className="as-card" aria-label="我的素材">
            <h2>素材（{assets.length}）</h2>
            <p className="as-note">列表里是服务器确认的归属与可见范围；别人的私密素材不会出现在这里。</p>
            <ul className="as-list">
              {assets.map((asset) => (
                <li key={asset.id} data-asset={asset.id}>
                  <div className="as-item-head">
                    <strong>{asset.name}</strong>
                    <span>
                      {formatAssetSize(asset.size)} · {asset.mime} · {assetVisibilityLabel(asset.visibility)} ·{" "}
                      {asset.extracted ? "服务端已解析文本" : "未解析（二进制文件）"} ·{" "}
                      {new Date(asset.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="as-item-actions">
                    {asset.extracted && (
                      <button
                        className="as-button"
                        type="button"
                        onClick={() => void showText(asset)}
                      >
                        查看解析文本
                      </button>
                    )}
                    <select
                      aria-label={`${asset.name} 的可见范围`}
                      value={asset.visibility}
                      disabled={busy}
                      onChange={(event) => void run(
                        () => setAssetVisibility(asset.id, event.target.value as AssetVisibility).then(() => undefined),
                        `已更新「${asset.name}」的可见范围。`,
                      )}
                    >
                      {VISIBILITIES.map((item) => <option key={item} value={item}>{assetVisibilityLabel(item)}</option>)}
                    </select>
                    <button
                      className="as-button"
                      type="button"
                      onClick={() => void showEvents(asset)}
                    >
                      操作记录
                    </button>
                    <button
                      className="as-button is-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(
                        () => deleteAsset(asset.id).then(() => undefined),
                        `已删除「${asset.name}」及其服务器副本。`,
                      )}
                    >
                      删除
                    </button>
                  </div>
                  {texts[asset.id] !== undefined && (
                    <pre className="as-text">{texts[asset.id] || "（服务端没有解析出文本）"}</pre>
                  )}
                  {events[asset.id] && (
                    <ul className="as-events">
                      {events[asset.id].map((event) => (
                        <li key={event.id}>
                          {event.action} · {new Date(event.createdAt).toLocaleString("zh-CN")}
                        </li>
                      ))}
                      {!events[asset.id].length && <li>暂无操作记录。</li>}
                    </ul>
                  )}
                </li>
              ))}
              {!assets.length && <li className="as-empty">素材库还是空的。上传一个文件试试。</li>}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
