import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  changeAccountPassword,
  deleteAccount,
  fetchAccount,
  fetchAccountAudit,
  updateAccountProfile,
  type AccountAuditEntry,
  type AccountIdentity,
} from "../api/account";
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
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState("");
  const [consent, setConsent] = useState(false);
  const [forgetConfirmed, setForgetConfirmed] = useState(false);
  const [account, setAccount] = useState<AccountIdentity | null>(null);
  const [audit, setAudit] = useState<AccountAuditEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const load = useCallback(async () => {
    try {
      setProfile(await fetchProfile());
      if (!actionError.current) setError("");
    } catch (cause) {
      setProfile(null);
      if (!actionError.current) setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "账号数据服务暂不可用，请确认后端已启动。");
    }
    try {
      const me = await fetchAccount();
      setAccount(me);
      setDisplayName((current) => current || me.displayName || "");
      setEmail((current) => current || me.email || "");
    } catch {
      setAccount(null);
    }
    try {
      setAudit(await fetchAccountAudit());
    } catch {
      setAudit([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMemory() {
    if (!consent) {
      fail("写入长期记忆需要先勾选同意。");
      return;
    }
    setBusy(true);
    try {
      await addProfileMemory({ content: memory.trim(), kind: "note", source: "账号数据页" });
      setMemory("");
      setConsent(false);
      setNotice("已写入一条长期记忆。");
      clearError();
      await load();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "写入失败。");
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
      fail(cause instanceof Error ? cause.message : "删除失败。");
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
      fail(cause instanceof Error ? cause.message : "清空失败。");
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
      clearError();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "导出失败。");
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    if (!forgetConfirmed) {
      fail("清除数据需要先勾选确认。");
      return;
    }
    setBusy(true);
    try {
      const result = await forgetProfile();
      setNotice(`已清除 ${result.memories} 条记忆与 ${result.preferences} 项偏好。`);
      setForgetConfirmed(false);
      await load();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "清除失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccountProfile() {
    setBusy(true);
    try {
      const updated = await updateAccountProfile({ displayName: displayName.trim(), email: email.trim() });
      setAccount(updated);
      setNotice("账号资料已更新，并记入账号审计。");
      clearError();
      setAudit(await fetchAccountAudit());
      // Let the account menu pick up the new display name.
      window.dispatchEvent(new Event("designbuddy:server-identity"));
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "账号资料保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function rotatePassword() {
    if (!currentPassword) {
      fail("修改密码需要先输入当前密码。");
      return;
    }
    if (newPassword.length < 10) {
      fail("新密码至少 10 位。");
      return;
    }
    setBusy(true);
    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setNotice("密码已修改，其他设备的登录会话已失效。");
      clearError();
      setAudit(await fetchAccountAudit());
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "修改密码失败。");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!deleteConfirmed) {
      fail("注销账号需要先勾选确认。");
      return;
    }
    if (!deletePassword) {
      fail("注销账号需要输入当前密码。");
      return;
    }
    setBusy(true);
    try {
      // Clear the account's own data first, then drop the account row.
      const cleared = await forgetProfile();
      const trail = await deleteAccount({ currentPassword: deletePassword, confirm: true });
      setAudit(trail);
      setAccount(null);
      setDeleteConfirmed(false);
      setDeletePassword("");
      setNotice(
        `账号已注销：已清除 ${cleared.memories} 条记忆与 ${cleared.preferences} 项偏好，并注销登录身份。`,
      );
      clearError();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "注销账号失败。");
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

          <section className="profile-card" aria-label="账号资料">
            <h2>账号资料</h2>
            <p className="profile-note">
              {account?.kind === "account"
                ? `登录用户名：${account.username}`
                : "当前是游客会话：没有账号可编辑，注册账号后即可保存资料与密码。"}
            </p>
            <div className="profile-form-grid">
              <label>
                显示名
                <input
                  aria-label="显示名"
                  value={displayName}
                  maxLength={40}
                  placeholder="团队里怎么称呼你"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label>
                邮箱
                <input
                  aria-label="邮箱"
                  type="email"
                  value={email}
                  maxLength={120}
                  placeholder="name@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            </div>
            <div className="profile-actions">
              <button className="profile-button is-primary" type="button" disabled={busy || account?.kind !== "account"} onClick={() => void saveAccountProfile()}>
                保存账号资料
              </button>
            </div>

            <h3 className="profile-subhead">修改密码</h3>
            <div className="profile-form-grid">
              <label>
                当前密码
                <input
                  aria-label="当前密码"
                  type="password"
                  value={currentPassword}
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                新密码
                <input
                  aria-label="新密码"
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  placeholder="至少 10 位"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
            </div>
            <div className="profile-actions">
              <button className="profile-button" type="button" disabled={busy || account?.kind !== "account"} onClick={() => void rotatePassword()}>
                修改密码
              </button>
            </div>

            <h3 className="profile-subhead">账号审计</h3>
            {audit.length > 0 ? (
              <table className="profile-table">
                <thead><tr><th>动作</th><th>说明</th><th>时间</th></tr></thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id} data-audit={entry.action}>
                      <td><code>{entry.action}</code></td>
                      <td>{entry.detail || "—"}</td>
                      <td>{time(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="profile-note">还没有账号审计记录。</p>
            )}
          </section>

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

            <h3 className="profile-subhead">注销账号</h3>
            <p className="profile-note">
              注销会先清除本账号的长期记忆与已同步偏好，再删除账号并让所有设备退出登录；账号审计记录会保留在服务端作为操作凭证。
            </p>
            <label className="profile-consent">
              <input type="checkbox" aria-label="确认注销账号" checked={deleteConfirmed} onChange={(event) => setDeleteConfirmed(event.target.checked)} />
              我确认注销这个账号，且不再需要其中的数据
            </label>
            <label className="profile-field">
              当前登录密码
              <input
                aria-label="当前登录密码"
                type="password"
                value={deletePassword}
                autoComplete="current-password"
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
            <div className="profile-actions">
              <button className="profile-button is-danger" type="button" disabled={busy || account?.kind !== "account"} onClick={() => void removeAccount()}>
                注销账号
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
