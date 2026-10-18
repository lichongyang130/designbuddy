import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { skillPermissionLabels, type RuntimeSkill } from "../../../shared/skillRuntime";
import { apiPublicJSON } from "../../../apps/web/src/api/client";
import { HomeIcon, type HomeIconName } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import { expertCatalog } from "../expertCatalog";
import { listProjects } from "../projectStore";
import { navigateTo } from "../workspaceRoutes";
import SkillWorkbench from "../SkillWorkbench";
import "./skills.css";

const areas = ["办公提效", "设计制作", "网页应用"] as const;
type SkillArea = typeof areas[number];
const areaIcons: Record<SkillArea, "document" | "palette" | "code"> = { "办公提效": "document", "设计制作": "palette", "网页应用": "code" };
// Individually generated photo assets are added here as they are produced; remaining entries use semantic vector fallbacks until the next image batch.
const skillPhotos: Record<string, string> = {
  "table.analyze": "table-analyze.jpg", "infographic.compose": "infographic-compose.jpg", "table.calculate": "table-calculate.jpg", "table.join": "table-join.jpg", "table.join-multi": "table-join-multi.jpg",
  "document.format": "document-format.jpg", "document.summarize": "document-summarize.jpg", "document.structure": "document-structure.jpg", "slides.compose": "slides-compose.jpg", "pdf.extract": "pdf-extract.jpg",
};
const skillIcons: Record<string, HomeIconName> = {
  "table.analyze": "chart", "infographic.compose": "grid", "table.calculate": "fuel", "table.join": "link", "table.join-multi": "share",
  "document.format": "document", "document.summarize": "book", "document.structure": "panel", "slides.compose": "slides", "slides.inspect": "search", "pdf.extract": "copy",
  "pdf.ocr-batch": "folder", "pdf.ocr": "search", "image.ocr": "assistant", "audio.transcribe-en": "microphone", "collaboration.schedule": "clock",
  "brand.assets": "palette", "brand.system": "bulb", "image.marketing": "speaker", "image.layout": "grid", "image.product": "devices",
  "requirements.check": "checkCircle", "collaboration.sync": "refresh", "image.generate": "plusCircle", "design.tokens": "settings", "web.scaffold": "code",
  "web.css-audit": "palette", "image.web-pack": "folder", "social.carousel": "share", "design.review": "check", "article.magazine": "book",
  "design.brief": "pencil", "web.audit": "shield", "code.inspect": "search", "web.verify": "checkCircle", "code.build": "tools",
  "test.browser": "devices", "social.card": "copy", "engineering.runbook": "fuel", "hr.onboarding": "invite", "faq.page": "help",
  "product.spec": "document", "email.marketing": "send", "finance.report": "wallet", "data.report": "chart", "team.okrs": "growth",
};
const requirementKindLabel: Record<string, string> = { credential: "凭据", environment: "环境", material: "素材", decision: "决策", account: "账号" };
const areaCopy: Record<SkillArea, string> = {
  "办公提效": "整理材料、表格、沟通与计划，把常见工作落到实际文件交付。",
  "设计制作": "用真实输入材料完成设计检查、素材排版与视觉文件导出。",
  "网页应用": "生成静态页面并执行明确的结构检查；未接入的构建和浏览器验证会单独标注。",
};
/** The rights that go beyond reading the uploaded file and writing the result. */
function elevatedPermissions(skill: RuntimeSkill): string[] {
  return (skill.permissions ?? []).filter(
    (permission) => permission !== "local.read" && permission !== "local.write",
  );
}

function skillArea(skill: RuntimeSkill): SkillArea {
  for (const id of skill.expertIds) {
    const category = expertCatalog.find(expert => expert.id === id)?.category;
    if (category && areas.includes(category as SkillArea)) return category as SkillArea;
  }
  return "办公提效";
}
function readFavorites() {
  try { const value = JSON.parse(localStorage.getItem("designbuddy.skill-favorites.v1") || "[]"); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; }
  catch { return []; }
}
function SkillCard({ skill, favorite, onFavorite, onOpen, onRun }: { skill: RuntimeSkill; favorite: boolean; onFavorite: () => void; onOpen: () => void; onRun: () => void }) {
  const area = skillArea(skill);
  const expert = expertCatalog.find(item => skill.expertIds.includes(item.id));
  const outputs = skill.outputs.slice(0, 3);
  return <article className={`skill-directory-card${skill.status === "ready" ? " is-ready" : " is-unavailable"}`} aria-label={skill.name}>
    <div className="skill-card-heading">
      <span className={`skill-role-icon tone-${area === "办公提效" ? "office" : area === "设计制作" ? "design" : "code"}`} data-skill-id={skill.id} aria-hidden="true">{skillPhotos[skill.id] ? <img className="skill-role-photo" src={`/skill-images/${skillPhotos[skill.id]}`} alt="" loading="lazy" decoding="async" /> : <HomeIcon name={skillIcons[skill.id] || areaIcons[area]} size={23} />}</span>
      <div><h3>{skill.name}</h3><span>{expert?.name || area} · {skill.status === "ready" ? "可执行技能" : skill.executorState === "connected" ? "执行器已接入 · 缺服务端凭据" : "尚未接入"}</span></div>
      <button className={`skill-card-favorite${favorite ? " is-favorite" : ""}`} type="button" aria-label={favorite ? `取消收藏：${skill.name}` : `收藏技能：${skill.name}`} title={favorite ? "取消收藏" : "收藏技能"} onClick={onFavorite}>{favorite ? <HomeIcon name="check" size={15} /> : <HomeIcon name="plus" size={15} />}</button>
    </div>
    <p className="skill-card-description">{skill.description}</p>
    <div className="skill-card-tags" aria-label="技能输入与交付">
      {skill.accepts.slice(0, 3).map(item => <span key={`in-${item}`} title="支持的输入格式">输入 {item}</span>)}
      {outputs.map(item => <span key={`out-${item}`} title="实际交付物">{item}</span>)}
      {skill.outputs.length > 3 && <span>等 {skill.outputs.length} 项交付</span>}
      {!skill.accepts.length && skill.status !== "ready" && <span>暂无可执行输入</span>}
      {skill.requires?.length ? <span title="需要你提供的材料或凭据">需提供 {skill.requires.length} 项</span> : null}
      {elevatedPermissions(skill).length ? <span title="该技能会使用的系统权限">{elevatedPermissions(skill).length} 项系统权限</span> : null}
    </div>
    <dl className="skill-card-facts">
      <div><dt>执行状态</dt><dd><i className="skill-state-dot" />{skill.status === "ready" ? "服务端已接入" : skill.executorState === "connected" ? "执行器已接入，缺服务端凭据" : "未接入后台执行器"}</dd></div>
      <div><dt>使用边界</dt><dd title={skill.limits}>{skill.limits}</dd></div>
    </dl>
    <footer>
      <button className="skill-detail-link" type="button" aria-label={`查看技能：${skill.name}`} onClick={onOpen}>查看详情 <span aria-hidden="true">↗</span></button>
      {skill.status === "ready" ? <button className="skill-use-button" type="button" aria-label={`使用技能：${skill.name}`} onClick={onRun}>用于当前任务</button> : <button className="skill-use-button is-disabled" type="button" aria-label={`查看未接入原因：${skill.name}`} onClick={onOpen}>查看接入状态</button>}
    </footer>
  </article>;
}

export default function SkillsPage(_props: { pathname: string }) {
  const [catalog, setCatalog] = useState<RuntimeSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部技能");
  const [status, setStatus] = useState<"all" | "ready" | "unavailable">("all");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<RuntimeSkill | null>(null);
  const [runSkillId, setRunSkillId] = useState("");
  const [showAddInfo, setShowAddInfo] = useState(false);
  const workbenchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    apiPublicJSON<{ skills: RuntimeSkill[] }>("/skill-runtime", { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setCatalog(response.skills);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "无法读取后台技能目录。");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => { try { localStorage.setItem("designbuddy.skill-favorites.v1", JSON.stringify(favorites)); } catch { /* Local favorites are optional. */ } }, [favorites]);
  useEffect(() => { if (runSkillId) requestAnimationFrame(() => workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }, [runSkillId]);
  const ready = useMemo(() => catalog.filter(skill => skill.status === "ready"), [catalog]);
  const unavailable = useMemo(() => catalog.filter(skill => skill.status !== "ready"), [catalog]);
  const visibleSkills = useMemo(() => catalog.filter(skill => {
    if (category !== "全部技能" && skillArea(skill) !== category) return false;
    if (status === "ready" && skill.status !== "ready") return false;
    if (status === "unavailable" && skill.status === "ready") return false;
    if (favoritesOnly && !favorites.includes(skill.id)) return false;
    const text = `${skill.name} ${skill.description} ${skill.limits} ${skill.accepts.join(" ")} ${skill.outputs.join(" ")} ${skill.expertIds.map(id => expertCatalog.find(expert => expert.id === id)?.name || id).join(" ")}`.toLocaleLowerCase();
    return !query.trim() || text.includes(query.trim().toLocaleLowerCase());
  }), [catalog, category, status, favoritesOnly, favorites, query]);
  const groupedSkills = useMemo(() => areas.map(area => ({ area, skills: visibleSkills.filter(skill => skillArea(skill) === area) })).filter(group => group.skills.length), [visibleSkills]);
  const selectedExecutor = runSkillId ? catalog.find(skill => skill.id === runSkillId && skill.status === "ready") : undefined;
  function toggleFavorite(id: string) { setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  return <div className="workbuddy-app skill-library-workspace">
    <WorkBuddySidebar active="skills" projectCount={listProjects().length} go={navigateTo} setNotice={setNotice} />
    <main className="skills-main" aria-label="技能工作区">
      <header className="skills-topbar"><MarketNavigation active="skills" className="skills-main-nav" /><button className="skill-add-button" type="button" onClick={() => setShowAddInfo(true)}><HomeIcon name="plus" />添加技能</button></header>
      <div className="skills-content">
        {notice && <div className="skills-message" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="skills-message is-error" role="alert"><span>{error}</span><button aria-label="重试加载技能" onClick={() => window.location.reload()}>重试</button></div>}
        <section className="skill-library-hero">
          <div><span className="skill-eyebrow">后台注册 · 实际交付</span><h1>让每项技能，都对应真实交付</h1><p>{loading ? "正在读取服务端技能注册表…" : `${catalog.length} 项服务端注册技能：${ready.length} 项可执行，${unavailable.length} 项尚未接入。`}卡片中的输入格式、交付物和执行边界均来自实际技能定义。</p></div>
          <aside className="skill-auto-note"><HomeIcon name="bolt" size={22} /><div><b>从任务开始，系统也能帮你挑技能</b><p>描述目标和材料，首页可推荐已接入的实际执行器。</p><button type="button" onClick={() => navigateTo("/")}>回到首页描述任务 <span aria-hidden="true">↗</span></button></div></aside>
        </section>
        <section className="skill-directory" aria-label="技能目录">
          <div className="skill-directory-toolbar">
            <div className="skill-category-track" role="group" aria-label="技能分类">
              {["全部技能", ...areas].map(item => <button key={item} className={category === item ? "is-active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <div className="skill-tools">
              <label className="skills-search"><HomeIcon name="search" /><input type="search" aria-label="搜索技能" placeholder="按名称、用途或交付搜索" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <button className={`skill-favorites-toggle${favoritesOnly ? " is-active" : ""}`} type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><HomeIcon name="check" size={15} />已收藏（{favorites.length}）</button>
            </div>
          </div>
          <div className="skill-filter-row" role="group" aria-label="技能执行状态">
            <button className={status === "all" ? "is-active" : ""} aria-pressed={status === "all"} onClick={() => setStatus("all")}>全部（{catalog.length}）</button>
            <button className={status === "ready" ? "is-active" : ""} aria-pressed={status === "ready"} onClick={() => setStatus("ready")}>可执行（{ready.length}）</button>
            <button className={status === "unavailable" ? "is-active is-unavailable" : ""} aria-pressed={status === "unavailable"} onClick={() => setStatus("unavailable")}>未接入（{unavailable.length}）</button>
          </div>
          <p className="skill-result-count" role="status">{favoritesOnly ? `已收藏 ${visibleSkills.length} 项技能` : searchCountLabel(query, visibleSkills.length)}<span>点击“用于当前任务”进入真实执行台；未接入能力不会提供运行入口</span></p>
          {loading ? <div className="skill-loading" role="status">正在读取真实技能目录…</div> : error ? null : groupedSkills.map(({ area, skills }) => <section className="skill-area" key={area} aria-label={`${area}技能`}>
            <div className="skill-area-heading"><h2>{area}<span>{skills.length} 项</span></h2><p>{areaCopy[area]}</p></div>
            <div className="skill-card-grid">{skills.map(skill => <SkillCard key={skill.id} skill={skill} favorite={favorites.includes(skill.id)} onFavorite={() => toggleFavorite(skill.id)} onOpen={() => setSelectedSkill(skill)} onRun={() => { setRunSkillId(skill.id); setSelectedSkill(null); }} />)}</div>
          </section>)}
          {!loading && !error && !visibleSkills.length && <div className="skill-empty"><HomeIcon name="tools" size={32} /><h2>{favoritesOnly ? "还没有收藏匹配的技能" : "没有找到匹配技能"}</h2><p>试试其他关键词，或切换技能分类和执行状态。</p><button type="button" onClick={() => { setQuery(""); setCategory("全部技能"); setStatus("all"); setFavoritesOnly(false); }}>重置筛选</button></div>}
        </section>
        {selectedExecutor && <section ref={workbenchRef} className="skills-execution-panel" aria-label="技能执行工作台"><div className="skills-execution-heading"><div><span>真实后台执行器</span><h2>运行：{selectedExecutor.name}</h2><p>目录信息来自服务端技能注册表；文件选择、参数、同意和真实运行记录由执行工作台处理。</p></div><button type="button" onClick={() => setRunSkillId("")}>收起</button></div><SkillWorkbench key={`skill-run-${selectedExecutor.id}`} expertId={selectedExecutor.expertIds[0]} allowedSkillIds={[selectedExecutor.id]} initialSkillId={selectedExecutor.id} /></section>}
      </div>
    </main>
    {selectedSkill && <div className="skill-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedSkill(null); }}><section className="skill-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title"><button className="skill-detail-close" type="button" aria-label="关闭技能详情" onClick={() => setSelectedSkill(null)}>×</button><div className="skill-detail-kicker">{selectedSkill.status === "ready" ? "真实后台执行器" : selectedSkill.executorState === "connected" ? "执行器已接入 · 缺服务端凭据" : "尚未接入"}</div><h2 id="skill-detail-title">{selectedSkill.name}</h2><p className="skill-detail-description">{selectedSkill.description}</p><div className="skill-detail-meta"><div><small>输入格式</small><strong>{selectedSkill.accepts.length ? selectedSkill.accepts.join("、") : "暂无可执行输入"}</strong></div><div><small>真实交付</small><strong>{selectedSkill.outputs.length ? selectedSkill.outputs.join("、") : "尚未接通"}</strong></div><div><small>执行专家</small><strong>{selectedSkill.expertIds.map(id => expertCatalog.find(expert => expert.id === id)?.name || id).join("、")}</strong></div></div><details className="skill-detail-limits" open><summary>执行边界</summary><p>{selectedSkill.limits}</p></details><section className="skill-detail-permissions" aria-label="所需权限"><h3>所需权限</h3><ul>{(selectedSkill.permissions ?? []).map(permission => <li key={permission} data-permission={permission}>{skillPermissionLabels[permission] || permission}</li>)}</ul><p>这些是服务端按执行器真实行为登记的权限；标注"第三方"的需要你在执行时单次授权，未授权不会外发任何内容。</p></section>{selectedSkill.requires?.length ? <section className="skill-detail-requires" aria-label="需要你提供"><h3>需要你提供</h3><ul>{selectedSkill.requires.map(item => <li key={`${item.kind}-${item.label}`}><b>{item.label}</b><i>{requirementKindLabel[item.kind] || item.kind}</i><span>{item.detail}</span></li>)}</ul><p>这些材料与凭据无法由平台自行获取；补齐后该能力才能真正接通，不会用模拟结果代替。</p></section> : null}{selectedSkill.status === "ready" ? <button className="skill-detail-run" type="button" onClick={() => { setRunSkillId(selectedSkill.id); setSelectedSkill(null); }}>打开执行工作台</button> : <p className="skill-detail-unavailable">{selectedSkill.executorState === "connected" ? "执行器已经接入，但服务端还没配置它需要的凭据或环境，因此暂不提供运行入口；补齐后即可真实执行，不会用模拟结果代替。" : "此能力尚未接入后台执行器，因此不提供运行入口。"}</p>}</section></div>}
    {showAddInfo && <div className="skill-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAddInfo(false); }}><section className="skill-add-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-add-title"><button className="skill-detail-close" type="button" aria-label="关闭添加技能说明" onClick={() => setShowAddInfo(false)}>×</button><h2 id="skill-add-title">添加真实技能</h2><p>技能必须先在服务端注册实际执行器、输入与输出格式、权限边界和测试。此目录不会把提示词、未验证脚本或外部模板伪装成可执行技能。</p><p>接入完成并通过测试后，刷新目录即可发现新技能。当前页面没有客户端安装外部技能包的功能。</p><button type="button" className="skill-add-close" onClick={() => setShowAddInfo(false)}>知道了</button></section></div>}
  </div>;
}
function searchCountLabel(query: string, count: number) { return query.trim() ? `匹配到 ${count} 项技能` : `共 ${count} 项真实技能`; }
