import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { allPromptTasks, type PromptTask } from "../../../apps/web/src/components/promptLibrary";
import { expertCatalog, expertCategories, expertLegacyIds, customExpertCatalog, type CatalogExpert } from "../expertCatalog";
import { MarketNavigation } from "../MarketNavigation";
import { listProjects } from "../projectStore";
import { useWorkspaceStore } from "../store";
import { navigateTo, resolveWorkspaceRoute, workspaceRoutes } from "../workspaceRoutes";
import "./experts.css";
import SkillWorkbench from "../SkillWorkbench";

const tasks = new Map(allPromptTasks.map(task => [task.id, task]));
const areaCopy: Record<string, string> = {
  "办公提效": "整理材料、核对数字、组织汇报，把工作向前推进。",
  "设计制作": "从视觉方向到信息表达，让每份物料都有清楚的制作依据。",
  "网页应用": "从需求到实现与验收，分清页面演示和真正可用的系统。",
  "我的专家": "你定义的专业角色，仅保存在当前浏览器。",
};
function Badge({ expert }: { expert: CatalogExpert }) {
  return <span className={`expert-role-icon tone-${expert.mode || "custom"}${expert.avatar ? " has-avatar" : ""}`} aria-hidden="true">{expert.avatar ? <img src={expert.avatar} alt="" width={64} height={64} decoding="async" /> : <HomeIcon name={expert.icon} size={24} />}</span>;
}
function InfoList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return <section className="expert-info-block"><h2>{title}</h2><List>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</List></section>;
}
export default function ExpertsPage({ pathname }: { pathname: string }) {
  const route = resolveWorkspaceRoute(pathname);
  const mine = route.page === "mine";
  const listing = route.page === "marketplace" || mine;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部专家");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const experts = useWorkspaceStore(state => state.experts);
  const upsertExpert = useWorkspaceStore(state => state.upsertExpert);
  useEffect(() => {
    setNotice(""); setError(""); setSearch("");
    if (route.page === "create") { setName(""); setDescription(""); }
  }, [pathname, route.page]);
  const customExperts = useMemo(() => experts.map(customExpertCatalog), [experts]);
  const allExperts = useMemo(() => [...expertCatalog, ...customExperts], [customExperts]);
  const activeCategory = mine ? "我的专家" : category;
  const visibleExperts = allExperts.filter(expert => (activeCategory === "全部专家" || expert.category === activeCategory)
    && [expert.name, expert.description, expert.category, ...expert.tags, ...expert.deliverables].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  // Custom IDs are checked first; legacy links never mutate stored experts or past tasks.
  const selectedExpert = customExperts.find(e => e.id === route.id) || expertCatalog.find(e => e.id === route.id || e.id === expertLegacyIds[route.id || ""]);
  const groups = ["办公提效", "设计制作", "网页应用", "我的专家"].map(area => ({ area, experts: visibleExperts.filter(e => e.category === area) })).filter(g => g.experts.length);
  function chooseCategory(value: string) {
    setSearch("");
    if (value === "我的专家") navigateTo(workspaceRoutes.myExperts);
    else if (mine) { setCategory(value); navigateTo(workspaceRoutes.experts); }
    else setCategory(value);
  }
  function launch(expert: CatalogExpert, task?: PromptTask) {
    try {
      sessionStorage.setItem("designbuddy.launch-context.v1", JSON.stringify({ expert: expert.name, ...(task ? { prompt: task.prompt, mode: task.mode } : {}) }));
      navigateTo("/");
    } catch { setError("无法带入首页，请检查浏览器会话存储权限；现有任务未修改。"); }
  }
  function saveExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("请先填写专家名称。"); return; }
    if (experts.some(e => e.name === name.trim()) || expertCatalog.some(e => e.name === name.trim())) { setError("该名称已存在，请使用可区分的专家名称。"); return; }
    try {
      const id = crypto.randomUUID();
      upsertExpert({ id, name: name.trim(), description: description.trim(), skills: [], capabilities: [], status: "draft", createdAt: new Date().toISOString() });
      navigateTo(workspaceRoutes.expertDetail(id));
    } catch { setError("保存失败，请检查浏览器本地存储权限。"); }
  }
  return <div className="workbuddy-app expert-workspace">
    <WorkBuddySidebar active="experts" projectCount={listProjects().length} go={navigateTo} setNotice={setNotice} />
    <main className="experts-main" aria-label="专家工作区">
      <header className="experts-topbar"><MarketNavigation active="experts" className="experts-main-nav" /><button className="expert-create-button" onClick={() => navigateTo(workspaceRoutes.createExpert)}><HomeIcon name="plus" />创建专家</button></header>
      <div className="experts-content">
        {notice && <div className="experts-message" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="experts-message is-error" role="alert">{error}<button aria-label="关闭错误" onClick={() => setError("")}>×</button></div>}
        {listing && <>
          <section className="expert-library-hero">
            <div><span className="expert-eyebrow">专业分工 · 实际交付</span><h1>{mine ? "我的专家" : "为你的工作，找到合适的专家"}</h1><p>{mine ? "保留你的专业经验，定义自己的工作方法。" : `${expertCatalog.length} 位内置专家，对应首页的办公、设计与网页任务。选专业方法，不选空泛头衔。`}</p></div>
            <div className="expert-auto-note"><HomeIcon name="experts" size={22} /><div><b>不知道选谁？从首页开始</b><p>描述任务后可开启自动匹配，一次推荐一位主专家。</p><button onClick={() => navigateTo("/")}>回到首页描述任务 <span aria-hidden="true">↗</span></button></div></div>
          </section>
          <section className="expert-directory" aria-label={mine ? "我的专家列表" : "专家目录"}>
            <div className="expert-directory-toolbar">
              <div className="expert-category-track" role="group" aria-label="专家分类">{expertCategories.map(item => <button key={item} className={activeCategory === item ? "is-active" : ""} aria-pressed={activeCategory === item} onClick={() => chooseCategory(item)}>{item}</button>)}</div>
              <label className="experts-search"><HomeIcon name="search" /><input type="search" aria-label="搜索专家" placeholder="按任务、能力搜索" value={search} onChange={event => setSearch(event.target.value)} /></label>
            </div>
            <p className="expert-result-count" role="status">{search.trim() ? `匹配到 ${visibleExperts.length} 位专家` : `共 ${visibleExperts.length} 位专家`}<span>文件处理工具见详情，高级能力以实际状态为准</span></p>
            {groups.map(({ area, experts: members }) => <section className="expert-area" key={area} aria-label={`${area}专家`}>
              <div className="expert-area-heading"><h2>{area}<span>{members.length} 位</span></h2><p>{areaCopy[area]}</p></div>
              <div className="expert-card-grid">{members.map(expert => <article className="expert-directory-card" key={expert.id} aria-label={expert.name}>
                <div className="expert-card-heading"><Badge expert={expert} /><div><h3>{expert.name}</h3><span>{expert.custom ? "自定义专家" : expert.category}</span></div></div>
                <p className="expert-card-description">{expert.description}</p>
                <div className="expert-card-tags" aria-label="适用任务">{expert.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}{expert.tags.length > 4 && <span>等 {expert.tags.length} 类任务</span>}</div>
                <dl><div><dt>工作方法</dt><dd>{expert.method[0]}</dd></div><div><dt>常见交付</dt><dd>{expert.deliverables.slice(0, 3).join(" · ")}</dd></div></dl>
                <footer><button className="expert-detail-link" aria-label={`查看${expert.name}`} onClick={() => navigateTo(workspaceRoutes.expertDetail(expert.id))}>查看详情 <span aria-hidden="true">↗</span></button><button className="expert-use-button" aria-label={`使用${expert.name}`} onClick={() => launch(expert)}>用于当前任务</button></footer>
              </article>)}</div>
            </section>)}
            {!visibleExperts.length && <div className="expert-empty"><HomeIcon name="experts" size={32} /><h2>{mine && !search ? "还没有自己的专家" : "没有找到匹配的专家"}</h2><p>{mine && !search ? "已有自建专家会保留在这里，不受内置目录调整影响。" : "试试任务名称，例如报销、海报、表单或汇报。"}</p>{mine && <button className="expert-primary" onClick={() => navigateTo(workspaceRoutes.createExpert)}>创建第一个专家</button>}</div>}
          </section>
        </>}
        {route.page === "create" && <form className="expert-detail-panel expert-create-form" onSubmit={saveExpert}>
          <button type="button" className="expert-back" onClick={() => navigateTo(workspaceRoutes.myExperts)}>← 返回我的专家</button>
          <h1>创建你的专家</h1><p>定义职责和交付要求，保存到当前浏览器。不会因此安装工具或接通外部服务。</p>
          <label>专家名称<input value={name} onChange={event => setName(event.target.value)} placeholder="例如：供应链分析专家" maxLength={80} required /></label>
          <label>职责描述<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="擅长的问题、所需材料、工作方法与交付标准" rows={6} maxLength={4000} /></label>
          <button className="expert-primary" type="submit">保存专家</button>
        </form>}
        {route.page === "detail" && <section className="expert-detail-panel">
          <button className="expert-back" onClick={() => navigateTo(selectedExpert?.custom ? workspaceRoutes.myExperts : workspaceRoutes.experts)}>← 返回专家列表</button>
          {selectedExpert ? <>
            <div className="expert-detail-hero"><Badge expert={selectedExpert} /><div><span className="expert-eyebrow">{selectedExpert.category} · 专业工作规范</span><h1>{selectedExpert.name}</h1><p>{selectedExpert.description}</p></div><button className="expert-primary" onClick={() => launch(selectedExpert)}>用于当前任务</button></div>
            <div className="expert-card-tags">{selectedExpert.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <div className="expert-detail-columns">
              <InfoList title="需要提供的材料" items={selectedExpert.materials} />
              <InfoList title="工作步骤" items={selectedExpert.method} ordered />
              <InfoList title="交付内容" items={selectedExpert.deliverables} />
              <InfoList title="检查与验收标准" items={selectedExpert.checks} />
            </div>
            {!selectedExpert.custom && <SkillWorkbench key={selectedExpert.id} expertId={selectedExpert.id} />}
            <aside className="expert-capability-note"><HomeIcon name="shield" size={20} /><div><h2>当前能力与限制</h2><p>{selectedExpert.limits}</p><p>回复依赖可用模型。这里只选择一位主专家，不会自动发送消息、部署网站或授权外部操作。</p></div></aside>
            {!!selectedExpert.taskIds.length && <section className="expert-task-examples" aria-label="任务示例"><div className="expert-area-heading"><h2>从一个具体任务开始</h2><p>复用首页任务库，填入完整提示词，不自动发送。</p></div>{selectedExpert.taskIds.map(id => tasks.get(id)).filter((t): t is PromptTask => !!t).map(task => <button key={task.id} onClick={() => launch(selectedExpert, task)} aria-label={`使用任务示例：${task.title}`}><span><b>{task.title}</b><small>{task.category} / {task.group}</small><span>{task.description}</span></span><HomeIcon name="chevron" size={16} /></button>)}</section>}
          </> : <div className="expert-empty"><h1>该专家已下架或不存在</h1><p>无关的内置角色已移出目录。历史任务和你创建的专家不会因此删除。</p><button className="expert-primary" onClick={() => navigateTo(workspaceRoutes.experts)}>浏览当前专家</button></div>}
        </section>}
      </div>
    </main>
  </div>;
}
