import { useEffect, useState } from "react";
type Audit = {
  version: string;
  summary: {
    registered: number;
    legacy: number;
    newBenchmarks: number;
    catalog: number;
    industryCategories: number;
    descriptorCount: number;
    uniquePageNameSequences: number;
  };
  registered: {
    id: string;
    name: string;
    category: string;
    stage: string;
    dataMode: string;
    exports: string;
    review: string;
  }[];
  catalog: {
    id: string;
    name: string;
    category: string;
    stage: string;
    missing: string[];
  }[];
};
export default function TemplateReadiness() {
  const [audit, set] = useState<Audit | null>(null),
    [error, fail] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${import.meta.env.BASE_URL}template-benchmarks/readiness.json`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw Error("能力清单读取失败");
        return r.json();
      })
      .then(set)
      .catch((e) => {
        if (!abort.signal.aborted) fail(e.message);
      });
    return () => abort.abort();
  }, []);
  return (
    <section className="readiness-panel" aria-label="模板能力与缺口清单">
      <h2>能力与缺口清单</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : audit ? (
        <>
          <p>
            版本 {audit.version} · 当前登记 {audit.summary.registered} 项（原有{" "}
            {audit.summary.legacy} + 本批新增 {audit.summary.newBenchmarks}
            ）。目录另有 {audit.summary.catalog}{" "}
            个行业选题，不能直接相加为成品数量。
          </p>
          <p>
            {audit.summary.descriptorCount.toLocaleString()} 条目录页面描述仅有{" "}
            {audit.summary.uniquePageNameSequences}{" "}
            种页面名称序列；需要逐项重写业务结构。待完整复核项不会自动标成“商业验收通过”。
          </p>
          <details open>
            <summary>当前展示模板：能力声明与复核状态</summary>
            <div className="readiness-scroll">
              <table>
                <thead>
                  <tr>
                    <th>模板</th>
                    <th>分类 / 数据模式</th>
                    <th>交付声明</th>
                    <th>复核状态</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.registered.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <a href={`/inspiration/${t.id}`}>{t.name}</a>
                        <small style={{ display: "block" }}>{t.id}</small>
                      </td>
                      <td>
                        {t.category}
                        <br />
                        {t.dataMode}
                      </td>
                      <td>{t.exports}</td>
                      <td>{t.review}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>130 个商业目录项：待落地缺口</summary>
            <div className="readiness-scroll">
              <table>
                <thead>
                  <tr>
                    <th>目录项</th>
                    <th>行业</th>
                    <th>状态</th>
                    <th>缺口</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.catalog.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.id} / {t.name}
                      </td>
                      <td>{t.category}</td>
                      <td>{t.stage}</td>
                      <td>{t.missing.join("、")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p>
            “能力声明”是源码与目录检查，不等于本轮全量实际验收。原有模板逐套复核及
            130 项业务化仍在后续清单中；正式服务接入单独验收。
          </p>
        </>
      ) : (
        <p role="status">正在读取清单…</p>
      )}
    </section>
  );
}
