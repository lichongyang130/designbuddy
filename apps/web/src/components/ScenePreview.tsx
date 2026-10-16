import {
  Component,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SceneDemo } from "./SceneDemo";
import { modeLabels, type HomeScene } from "./homeScenes";
import { SceneSession, SceneSessionContext } from "./scene-demos/workspace";
import { Delivery, exportProject } from "./scene-demos/Delivery";
import { saveBlob } from "./scene-demos/files";
class WorkErrorBoundary extends Component<
  { children: ReactNode; session: SceneSession },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <section className="ws-error">
        <h3>作品内容无法显示</h3>
        <p>
          可能是保存数据损坏或格式不兼容。可先下载备份，不会自动删除原内容。
        </p>
        <button onClick={() => exportProject(this.props.session)}>
          下载内容备份
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                "使用默认示例重新开始？当前内容仍可通过撤销恢复，但损坏内容可能再次无法显示。",
              )
            ) {
              this.props.session.recoverCorrupt();
              this.setState({ error: false });
            }
          }}
        >
          使用示例重新开始
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
const short = (value: unknown) => {
  const text =
    typeof value === "string"
      ? value
      : (JSON.stringify(value, null, 2) ?? "未设置");
  return text.includes("data:image")
    ? text.replace(/data:image[^"\s]+/g, "[已上传图片]")
    : text;
};
const fieldNames: Record<string, string> = {
  title: "标题",
  body: "正文",
  notes: "讨论记录",
  tasks: "行动事项",
  orders: "订单",
  rows: "销售数据",
  slides: "演示页面",
  layers: "海报图层",
  name: "名称",
  budget: "预算",
  schedule: "排期",
  completed: "完成数量",
  target: "目标",
  page: "当前页面",
  screen: "页面状态",
  signature: "签名",
  attachments: "附件",
  decisions: "决策",
  requests: "请求集合",
  bookings: "预订草稿",
};
export function ScenePreview({
  scene,
  onClose,
  onUse,
}: {
  scene: HomeScene;
  onClose(): void;
  onUse(): boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const [session] = useState(() => new SceneSession(scene.id));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [tab, setTab] = useState("作品"),
    [versionName, setVersionName] = useState(""),
    [compare, setCompare] = useState(""),
    [device, setDevice] = useState("desktop");
  const close = () => {
    if (
      !session.save() &&
      !confirm(
        "当前修改尚未保存。建议取消并下载项目 JSON。仍然关闭并放弃未保存的修改？",
      )
    )
      return;
    onClose();
  };
  useLayoutEffect(() => {
    const node = dialog.current!;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    session.activate();
    node.showModal();
    const flush = () => session.save();
    const warn = (event: BeforeUnloadEvent) => {
      if (!session.save()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === session.key || event.key === null) session.save();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", flush);
    window.addEventListener("storage", storage);
    return () => {
      session.dispose();
      node.close();
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("storage", storage);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [session]);
  const version = snapshot.versions.find((v) => v.id === compare);
  const changed = version
    ? Object.keys({ ...version.data, ...snapshot.data }).filter(
        (k) =>
          JSON.stringify(version.data[k]) !== JSON.stringify(snapshot.data[k]),
      )
    : [];
  return (
    <SceneSessionContext.Provider value={session}>
      <dialog
        ref={dialog}
        className="scene-preview-dialog scene-workspace"
        aria-label={`${scene.title}场景预览`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }}
        onKeyDown={(e) => {
          if (
            (e.ctrlKey || e.metaKey) &&
            ["z", "y", "s"].includes(e.key.toLowerCase()) &&
            !(e.target as HTMLElement).matches(
              "input,textarea,[contenteditable=true]",
            )
          ) {
            e.preventDefault();
            if (e.key === "s") session.save();
            else if (e.key === "y" || e.shiftKey) session.redo();
            else session.undo();
          }
          if (e.key !== "Tab") return;
          const nodes = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
            ),
          ).filter(
            (n) => n.offsetParent !== null && !n.closest("[inert],[hidden]"),
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="scene-preview-header">
          <div>
            <small>{modeLabels[scene.mode]} / MY WORKSPACE</small>
            <h2>{scene.title}</h2>
            <p>{scene.description}</p>
          </div>
          <button
            className="scene-preview-close"
            aria-label="关闭场景预览"
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="ws-command-bar">
          <nav aria-label="作品工作区">
            {["作品", "版本与比较", "交付中心"].map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="ws-history-actions">
            <span
              className={`ws-save-status ${snapshot.error ? "has-error" : ""}`}
              role="status"
            >
              {snapshot.status}
            </span>
            <button
              title="撤销整个作品上一步修改"
              disabled={!snapshot.canUndo}
              onClick={session.undo}
            >
              ↶ 撤销
            </button>
            <button disabled={!snapshot.canRedo} onClick={session.redo}>
              ↷ 重做
            </button>
            <button onClick={session.save}>保存</button>
            <button
              onClick={() => {
                if (
                  confirm(
                    "重置当前作品为示例？命名版本不会删除，可通过撤销恢复本次修改。",
                  )
                )
                  session.reset();
              }}
            >
              重置作品
            </button>
          </div>
        </div>
        {snapshot.error && (
          <div className="ws-error" role="alert">
            <p>{snapshot.error}</p>
            <button onClick={() => exportProject(session)}>下载当前草稿</button>
            {snapshot.conflict && (
              <button
                onClick={() => {
                  if (confirm("载入其他标签页版本？当前草稿可先下载备份。"))
                    session.reloadFromDisk();
                }}
              >
                载入其他标签页内容
              </button>
            )}
            {session.isBlocked() && (
              <>
                <button
                  onClick={() =>
                    saveBlob(
                      `${scene.id}-unreadable-backup.json`,
                      new Blob([session.rawBackup()], {
                        type: "application/json",
                      }),
                    )
                  }
                >
                  下载原存储备份
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "原存储将在下一次保存时被新作品覆盖。请先下载原存储备份。是否继续？",
                      )
                    )
                      session.recoverCorrupt();
                  }}
                >
                  重新开始并允许保存
                </button>
              </>
            )}
          </div>
        )}
        <div className="scene-preview-scroll">
          <section hidden={tab !== "作品"}>
            <div className="ws-artwork-bar">
              <p>
                <span className="ws-live-dot" />
                直接编辑 · {scene.testHint}
              </p>
              <div role="group" aria-label="设备预览">
                {[
                  ["desktop", "桌面"],
                  ["tablet", "平板"],
                  ["mobile", "手机"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={device === id}
                    onClick={() => setDevice(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={`scene-preview-canvas ws-device-${device}`}
              ref={canvas}
            >
              <WorkErrorBoundary session={session}>
                <SceneDemo scene={scene} interactive />
              </WorkErrorBoundary>
            </div>
          </section>
          {tab === "版本与比较" && (
            <section className="ws-versions">
              <header>
                <small>VERSION HISTORY / 保存每一次关键决定</small>
                <h2>有版本，才敢放心修改。</h2>
                <p>
                  最多保留 10
                  个命名版本。恢复版本不会删除当前历史，可撤销；刷新后的撤销历史不保留。
                </p>
              </header>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (session.checkpoint(versionName)) setVersionName("");
                }}
              >
                <input
                  aria-label="版本名称"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  maxLength={60}
                  placeholder="例如：客户评审前 / 第二轮方案"
                  required
                />
                <button>保存命名版本</button>
              </form>
              <div className="ws-version-list">
                {!snapshot.versions.length && (
                  <p>还没有命名版本。保存当前设计，继续探索新的方向。</p>
                )}
                {snapshot.versions.map((v) => (
                  <article key={v.id}>
                    <div>
                      <h3>{v.name}</h3>
                      <time>{new Date(v.at).toLocaleString("zh-CN")}</time>
                    </div>
                    <button onClick={() => setCompare(v.id)}>
                      比较当前作品
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`恢复“${v.name}”？可通过撤销返回。`))
                          session.restore(v);
                      }}
                    >
                      恢复
                    </button>
                    <button
                      aria-label={`删除版本${v.name}`}
                      onClick={() => {
                        if (
                          confirm(`删除命名版本“${v.name}”？此操作无法撤销。`)
                        ) {
                          session.removeVersion(v.id);
                          if (compare === v.id) setCompare("");
                        }
                      }}
                    >
                      删除
                    </button>
                  </article>
                ))}
              </div>
              {version && (
                <div className="ws-compare">
                  <h3>
                    {version.name} → 当前作品 · {changed.length} 项变化
                  </h3>
                  {!changed.length && <p>与当前作品内容一致。</p>}
                  {changed.map((k) => (
                    <article key={k}>
                      <h4>{fieldNames[k] || k}</h4>
                      <div>
                        <section>
                          <small>命名版本</small>
                          <pre>{short(version.data[k]).slice(0, 6000)}</pre>
                        </section>
                        <section>
                          <small>当前作品</small>
                          <pre>{short(snapshot.data[k]).slice(0, 6000)}</pre>
                        </section>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {tab === "交付中心" && (
            <Delivery scene={scene} session={session} canvas={canvas} />
          )}
        </div>
        <footer className="scene-preview-footer">
          <p>仅保存在此浏览器 · 不上传、不自动发送任务 · 关闭后可继续编辑</p>
          <button
            onClick={() => {
              if (!session.save()) {
                alert("请先处理保存问题，或导出备份后再使用场景。");
                return;
              }
              if (onUse()) onClose();
            }}
          >
            使用此场景 <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </dialog>
    </SceneSessionContext.Provider>
  );
}
