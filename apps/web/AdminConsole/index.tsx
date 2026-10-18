import { useState } from 'react';

export interface AdminConsoleStats {
  users: number;
  projects: number;
  activeSessions: number;
}

export interface AdminConsoleProps {
  stats?: AdminConsoleStats;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void | Promise<void>;
}

export default function AdminConsole({ stats, loading = false, error, onRefresh }: AdminConsoleProps) {
  const [notice, setNotice] = useState('');
  async function refresh() {
    if (!onRefresh) {
      setNotice('管理 API 尚未连接。请传入 onRefresh 并从后端读取真实统计数据。');
      return;
    }
    setNotice('');
    try { await onRefresh(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : '刷新失败'); }
  }

  const cards = [
    ['用户总数', stats?.users],
    ['项目总数', stats?.projects],
    ['活跃会话', stats?.activeSessions],
  ] as const;

  return (
    <main className="admin-console">
      <header>
        <div><h1>管理控制台</h1><p>查看平台运行概况与服务状态。</p></div>
        <button type="button" onClick={refresh} disabled={loading}>{loading ? '正在刷新…' : '刷新数据'}</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section aria-label="平台统计" className="admin-console__stats">
        {cards.map(([label, value]) => (
          <article key={label} className="admin-console__stat">
            <h2>{label}</h2>
            <p>{value === undefined ? '尚未加载' : value.toLocaleString()}</p>
          </article>
        ))}
      </section>
      {!stats && <p>当前未提供统计数据。接入管理 API 后，此处将显示实时数据。</p>}
    </main>
  );
}
