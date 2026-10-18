import { useState } from "react";
import { useSceneState } from "./workspace";
import { art, Avatar, Badge, Field, Toolbar, type DemoProps } from "./shared";
export type Draft = {
  id: string;
  address: string;
  subject: string;
  body: string;
  signature: string;
  attachments: { name: string; size: number; data: string }[];
};
const seed: Draft[] = [
  {
    id: "launch",
    address: "partner@example.com",
    subject: "邀请评审｜AURA ONE 产品发布方案",
    body: "你好，\n\nAURA ONE 的产品发布方案已经完成第一轮整理，诚邀你参与本周五的方案评审。\n\n本次重点讨论产品叙事、首发页面和渠道节奏，预计用时 45 分钟。请提前查看产品视觉方向，并回复你方便的时间。\n\n期待你的建议！",
    signature: "林晓 / PRODUCT DESIGN\nAURA 品牌项目 · 内部协作草稿",
    attachments: [],
  },
  {
    id: "photo",
    address: "visual@example.com",
    subject: "摄影素材确认",
    body: "陈宁，你好，\n\n请复核耳机产品摄影的色彩与材质，并确认移动端裁切的留白。请在周三前提供可用素材与授权说明。\n\n谢谢！",
    signature: "林晓 / 产品设计组",
    attachments: [],
  },
  {
    id: "channel",
    address: "team@example.com",
    subject: "渠道会议安排",
    body: "各位同事，\n\n本周渠道会议将核对首发页面、库存与售后条款。请各负责人提前更新资料，记录需要决策的问题。",
    signature: "周远 / 运营组",
    attachments: [],
  },
];
export function Email({ interactive }: DemoProps) {
  const [drafts, setDrafts] = useSceneState("drafts", seed),
    [mail, setMail] = useSceneState("mail", "launch"),
    [tab, setTab] = useSceneState("tab", interactive ? "编辑" : "预览");
  const [feedback, setFeedback] = useState(""),
    [mobile, setMobile] = useState(false);
  const draft = drafts.find((d) => d.id === mail) || drafts[0];
  const update = (patch: Partial<Draft>) =>
    setDrafts((v) =>
      v.map((d) => (d.id === draft.id ? { ...d, ...patch } : d)),
    );
  return (
    <div className="pd-email-client">
      <Toolbar brand="POSTBOX" title="品牌协作邮箱">
        <Badge tone="neutral">本地草稿</Badge>
        <button
          onClick={() =>
            setFeedback(
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.address)
                ? "邮箱格式不正确，请检查收件地址。"
                : !draft.subject.trim() || !draft.body.trim()
                  ? "请填写主题和正文。"
                  : "格式检查通过，草稿未发送。可在交付中心下载含附件的 EML 草稿。",
            )
          }
        >
          检查格式
        </button>
      </Toolbar>
      <div className="pd-email-layout">
        <aside className="pd-inbox">
          <button
            className="pd-primary"
            disabled={drafts.length >= 10}
            onClick={() => {
              const id = crypto.randomUUID();
              setDrafts([
                ...drafts,
                {
                  id,
                  address: "",
                  subject: "未命名草稿",
                  body: "",
                  signature: "",
                  attachments: [],
                },
              ]);
              setMail(id);
              setTab("编辑");
            }}
          >
            ＋ 编写邮件
          </button>
          <h3>我的草稿 / {drafts.length}</h3>
          <p>不会真实收发邮件</p>
          <hr />
          {drafts.map((d, i) => (
            <button
              className="pd-mail-item"
              aria-pressed={draft.id === d.id}
              key={d.id}
              onClick={() => {
                setMail(d.id);
                setFeedback("");
              }}
            >
              <Avatar name={["林晓", "陈宁", "周远"][i % 3]} index={i} />
              <span>
                <strong>{d.subject || "未命名草稿"}</strong>
                <small>{d.address || "未填写收件人"}</small>
              </span>
            </button>
          ))}
        </aside>
        <section className="pd-message-pane">
          <div className="pd-mail-tabs">
            {["编辑", "预览"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
            <button onClick={() => setMobile(!mobile)}>
              {mobile ? "桌面邮件" : "手机邮件"}
            </button>
            <span>草稿自动保存 · 不连接邮箱</span>
          </div>
          {tab === "编辑" ? (
            <div className="pd-email-editor">
              <Field
                label="收件地址"
                value={draft.address}
                onChange={(address) => update({ address })}
              />
              <Field
                label="邮件主题"
                value={draft.subject}
                onChange={(subject) => update({ subject })}
              />
              <Field
                label="邮件正文"
                value={draft.body}
                onChange={(body) => update({ body })}
                multiline
              />
              <Field
                label="邮件签名"
                value={draft.signature}
                onChange={(signature) => update({ signature })}
                multiline
              />
              <div className="ws-email-attachments">
                <label className="ws-upload">
                  ＋ 添加附件
                  <input
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (
                        file.size > 256000 ||
                        draft.attachments.length >= 5 ||
                        draft.attachments.reduce((n, a) => n + a.size, 0) +
                          file.size >
                          600000
                      ) {
                        setFeedback(
                          "单个附件不超过 250 KB，最多 5 个，总计不超过 600 KB。",
                        );
                        return;
                      }
                      try {
                        const data = await new Promise<string>(
                          (resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () =>
                              resolve(String(reader.result));
                            reader.onerror = () =>
                              reject(new Error("附件读取失败"));
                            reader.readAsDataURL(file);
                          },
                        );
                        update({
                          attachments: [
                            ...draft.attachments,
                            { name: file.name, size: file.size, data },
                          ],
                        });
                        setFeedback("附件已加入本地草稿，将随 EML 导出。");
                      } catch (err) {
                        setFeedback((err as Error).message);
                      }
                    }}
                  />
                </label>
                {draft.attachments.map((a, i) => (
                  <div key={i}>
                    <span>▧ {a.name}</span>
                    <small>{Math.ceil(a.size / 1024)} KB</small>
                    <button
                      aria-label={`移除附件${a.name}`}
                      onClick={() =>
                        update({
                          attachments: draft.attachments.filter(
                            (_, j) => i !== j,
                          ),
                        })
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
              <div className="ws-actions">
                <button onClick={() => setTab("预览")}>预览邮件效果 →</button>
                <button
                  disabled={drafts.length <= 1}
                  onClick={() => {
                    if (confirm("删除当前草稿？可撤销。")) {
                      setDrafts((v) => v.filter((d) => d.id !== draft.id));
                      setMail(drafts.find((d) => d.id !== draft.id)!.id);
                    }
                  }}
                >
                  删除草稿
                </button>
              </div>
            </div>
          ) : (
            <article
              className="pd-email-letter"
              style={{
                maxWidth: mobile ? 360 : undefined,
                marginInline: "auto",
              }}
            >
              <header>
                <span>AURA</span>
                <small>PRODUCT TEAM / 2026</small>
              </header>
              <h1>{draft.subject}</h1>
              <div className="pd-letter-person">
                <Avatar name="林晓" />
                <p>
                  产品设计组<small>发送至 {draft.address} / 未发送</small>
                </p>
              </div>
              <img src={art.headphones} alt="邮件中的耳机概念摄影" />
              <p className="pd-prose">{draft.body}</p>
              {draft.attachments.length > 0 && (
                <div className="pd-mail-event">
                  <strong>附件 / {draft.attachments.length}</strong>
                  {draft.attachments.map((a, i) => (
                    <small key={i}>{a.name}</small>
                  ))}
                </div>
              )}
              <footer style={{ whiteSpace: "pre-wrap" }}>
                {draft.signature}
              </footer>
            </article>
          )}
          {feedback && (
            <p role="status" className="ws-inline-status">
              {feedback}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
