import { useCallback, useEffect, useState } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import {
  addProfileMemory,
  clearProfileMemories,
  deleteProfileMemory,
  exportProfile,
  fetchProfile,
  forgetProfile,
  type ProfileSnapshot,
} from "../api/profile";
import { usePreferenceSync } from "../settingsStore";
import { navigateTo } from "../workspaceRoutes";
import "./profile.css";

function time(value: number): string {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Account data: preferences that follow the account, memories the person
 * allowed, the devices that used it, and export / forget.
 *
 * The page only shows what the server holds for the current account.
 */
export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const syncStatus = usePreferenceSync((state) => state.status);
  const syncError = usePreferenceSync((state) => state.error);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState("");
  const [consent, setConsent] = useState(false);
  const [forgetConfirmed, setForgetConfirmed] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await fetchProfile());
      setError("");
    } catch (cause) {
      setProfile(null);
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "账号数据服务暂不可用，请确认后端已启动。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMemory() {
    if (!consent) {
      setError("写入长期记忆需要先勾选同意。");
      return;
    }
    setBusy(true);
    try {
      await addProfileMemory({ content: memory.trim(), kind: "note", source: "账号数据页" });
      setMemory("");
      setConsent(false);
      setNotice("已写入一条长期记忆。");
      setError("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "写入失败。");
    } finally {
      setBusy(false);
    }
  }

  async function removeMemory(id: string) {
    setBusy(true);
    try {
      await deleteProfileMemory(id);
      setNotice("已删除该条记忆。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  }

  async function clearMemories() {
    setBusy(true);
    try {
      await clearProfileMemories();
      setNotice("已清空全部长期记忆。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "清空失败。");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    setBusy(true);
    try {
      const blob = await exportProfile();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "designbuddy-profile.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("已导出当前账号的偏好、记忆与设备记录。");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败。");
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    if (!forgetConfirmed) {
      setError("清除数据需要先勾选确认。");
      return;
    }
    setBusy(true);
    try {
      const result = await forgetProfile();
      setNotice(`已清除 ${result.memories} 条记忆与 ${result.preferences} 项偏好。`);
      setForgetConfirmed(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "清除失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbuddy-app profile-workspace">
      <WorkBuddySidebar active="plugins" go={navigateTo} setNotice={setNotice} projectCount={0} />
      <main className="profile-main" aria-label="账号与数据">
        <header className="profile-topbar">
          <MarketNavigation active="connectors" className="profile-nav" />
          <button className="profile-button" type="button" onClick={() => void load()}>刷新</button>
        </header>
        <div className="profile-content">
          <section className="profile-hero">
            <div>
              <span className="profile-eyebrow">属于你的数据</span>
              <h1>账号与数据</h1>
              <p>偏好会跟着账号走，长期记忆只有你勾选同意才写入；数据可以随时导出或清除。</p>
            </div>
          </section>

          {(error || notice) && <p className={error ? "profile-message is-error" : "profile-message"} role="status">{error || notice}</p>}

          <section className="profile-card" aria-label="账号概览">
            <h2>账号概览</h2>
            <p className="profile-note">
              {syncStatus === "synced"
                ? "偏好已同步到账号：换设备登录同一账号即可继续。"
                : syncStatus === "syncing"
                  ? "正在与账号同步偏好…"
                  : syncStatus === "offline"
                    ? syncError || "账号同步暂不可用：偏好只保存在本机。"
                    : "偏好会在修改后自动同步到账号。"}
            </p>
            <dl className="profile-facts">
              <div><dt>账号标识</dt><dd>{profile?.owner ?? "—"}</dd></div>
              <div><dt>已同步偏好</dt><dd>{profile?.preferences.length ?? 0}</dd></div>
              <div><dt>长期记忆</dt><dd>{profile?.memories.length ?? 0}</dd></div>
              <div><dt>使用过的设备</dt><dd>{profile?.devices.length ?? 0}</dd></div>
            </dl>
            {profile && profile.preferences.length > 0 && (
              <table className="profile-table">
                <thead><tr><th>偏好</th><th>值</th><th>更新时间</th></tr></thead>
                <tbody>
                  {profile.preferences.map((preference) => (
                    <tr key={preference.key}>
                      <td><code>{preference.key}</code></td>
                      <td>{typeof preference.value === "string" ? preference.value : JSON.stringify(preference.value)}</td>
                      <td>{time(preference.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="profile-card" aria-label="长期记忆">
            <h2>长期记忆</h2>
            <p className="profile-note">只有勾选同意后才会写入；每条记忆都可以单独删除或一次清空。</p>
            <div className="profile-memory-form">
              <label>
                要记住的内容
                <textarea
                  aria-label="要记住的内容"
                  value={memory}
                  maxLength={2000}
                  rows={3}
                  placeholder="例如：汇报请先给结论，再给论据"
                  onChange={(event) => setMemory(event.target.value)}
                />
              </label>
              <label className="profile-consent">
                <input type="checkbox" aria-label="同意保存这条记忆" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                我同意让 DesignBuddy 记住这条内容
              </label>
              <button className="profile-button is-primary" type="button" disabled={busy || !memory.trim()} onClick={() => void addMemory()}>
                保存记忆
              </button>
            </div>
            <ul className="profile-memory-list">
              {(profile?.memories ?? []).map((item) => (
                <li key={item.id} data-memory={item.id}>
                  <div>
                    <p>{item.content}</p>
                    <small>{item.kind} · {item.source || "未标注来源"} · {time(item.createdAt)}</small>
                  </div>
                  <button className="profile-button" type="button" onClick={() => void removeMemory(item.id)} disabled={busy}>删除</button>
                </li>
              ))}
              {profile && !profile.memories.length && <li className="profile-empty">还没有长期记忆。</li>}
            </ul>
            {profile && profile.memories.length > 0 && (
              <button className="profile-button" type="button" onClick={() => void clearMemories()} disabled={busy}>清空全部记忆</button>
            )}
          </section>

          <section className="profile-card" aria-label="使用过的设备">
            <h2>使用过的设备</h2>
            <p className="profile-note">来自真实请求的浏览器标识；用于你识别"是不是我的设备"。</p>
            <table className="profile-table">
              <thead><tr><th>设备</th><th>最近使用</th><th>首次使用</th></tr></thead>
              <tbody>
                {(profile?.devices ?? []).map((device) => (
                  <tr key={device.id}>
                    <td>{device.label}</td>
                    <td>{time(device.lastSeen)}</td>
                    <td>{time(device.firstSeen)}</td>
                  </tr>
                ))}
                {profile && !profile.devices.length && <tr><td colSpan={3}>还没有设备记录。</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="profile-card" aria-label="导出与清除">
            <h2>导出与清除</h2>
            <div className="profile-actions">
              <button className="profile-button" type="button" onClick={() => void downloadExport()} disabled={busy}>导出我的数据（JSON）</button>
            </div>
            <label className="profile-consent">
              <input type="checkbox" aria-label="确认清除长期记忆与偏好" checked={forgetConfirmed} onChange={(event) => setForgetConfirmed(event.target.checked)} />
              我确认清除本账号的全部长期记忆与已同步偏好
            </label>
            <button className="profile-button is-danger" type="button" onClick={() => void forget()} disabled={busy}>清除长期记忆与偏好</button>
            <p className="profile-note">
              <HomeIcon name="help" size={12} /> 清除只影响本账号在服务端的记忆与已同步偏好；浏览器本地设置不会被自动改动。
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
