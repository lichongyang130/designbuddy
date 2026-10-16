import { MorrowCover } from "./samples/morrow/MorrowCover";
import { TideCover } from "./samples/tide/TideCover";
import { DaylightCover } from "./samples/daylight/DaylightCover";
import { RootsCover } from "./samples/roots/RootsCover";
import { AtelierCover } from "./samples/atelier/AtelierCover";
import { TemplateCloudProvider } from "./TemplateCloud";
import { ServerLibrary } from "./ServerLibrary";
import { FormeCover } from "./samples/forme/FormeCover";
import {
  MediaCover,
  mediaIds,
  HyperFrames,
  Film,
  Sound,
  LiveArtifact,
  WebGLWork,
} from "./samples/MediaExamples";
import { lazy, Suspense, useState } from "react";
import { WorkBuddySidebar } from "../components/WorkBuddySidebar";
import { HomeIcon, type HomeIconName } from "../components/HomeIcon";
import { listProjects } from "../../../../frontend/workspace/projectStore";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import TravelPrototype, { TravelCover } from "./samples/TravelPrototype";
import SlideDeck, { SlideCanvas, CityDeck } from "./samples/SlideDeck";
import ResearchReport, {
  ReportPaper,
  TravelHandbook,
} from "./samples/ResearchReport";
import BrandGallery, {
  BrandArtwork,
  NatureGallery,
} from "./samples/BrandGallery";
import { drafts, samples, type SampleId } from "./samples/shared";
import MuseumPrototype, { MuseumCover } from "./samples/MuseumPrototype";
import { HandbookPaper } from "./samples/HandbookPaper";
import { NatureArtwork } from "./samples/NatureArtwork";
import "./samples/samples.css";
import "./samples/expansion.css";
const MorrowPrototype = lazy(() => import("./samples/morrow/MorrowPrototype"));
const TidePrototype = lazy(() => import("./samples/tide/TidePrototype"));
const DaylightPrototype = lazy(
  () => import("./samples/daylight/DaylightPrototype"),
);
const RootsPrototype = lazy(() => import("./samples/roots/RootsPrototype"));
const AtelierPrototype = lazy(
  () => import("./samples/atelier/AtelierPrototype"),
);
const FormePrototype = lazy(() => import("./samples/forme/FormePrototype"));
const workCategories: { label: string; icon?: HomeIconName }[] = [
  { label: "全部" },
  { label: "原型", icon: "grid" },
  { label: "幻灯片", icon: "slides" },
  { label: "文档", icon: "document" },
  { label: "图片", icon: "palette" },
  { label: "HyperFrames", icon: "copy" },
  { label: "视频", icon: "slides" },
  { label: "音频", icon: "speaker" },
  { label: "实时产物", icon: "bolt" },
  { label: "WebGL", icon: "code" },
];

function Preview({ id }: { id: SampleId }) {
  return (
    <div className={`sample-preview preview-${id}`} aria-hidden="true">
      {(mediaIds as readonly string[]).includes(id) ? (
        <MediaCover id={id as (typeof mediaIds)[number]} />
      ) : id === "morrow" ? (
        <MorrowCover />
      ) : id === "tide" ? (
        <TideCover />
      ) : id === "daylight" ? (
        <DaylightCover />
      ) : id === "roots" ? (
        <RootsCover />
      ) : id === "atelier" ? (
        <AtelierCover />
      ) : id === "forme" ? (
        <FormeCover />
      ) : id === "museum" ? (
        <MuseumCover />
      ) : id === "city" ? (
        <SlideCanvas variant="city" />
      ) : id === "handbook" ? (
        <HandbookPaper />
      ) : id === "nature" ? (
        <NatureArtwork />
      ) : id === "travel" ? (
        <TravelCover />
      ) : id === "luma" ? (
        <SlideCanvas />
      ) : id === "research" ? (
        <ReportPaper />
      ) : (
        <BrandArtwork />
      )}
    </div>
  );
}
export default function InspirationPage({ pathname }: { pathname: string }) {
  const [serverLibrary, setServerLibrary] = useState(false);
  const [category, choose] = useState("全部");
  const [query, search] = useState("");
  const [mine, showMine] = useState(false);
  const [notice, msg] = useState("");
  const parts = pathname.split("/").filter(Boolean);
  const sample = samples.find((x) => x.id === parts[1]);
  const draftId =
    parts[2] === "draft" && /^[a-zA-Z0-9-]{1,60}$/.test(parts[3] || "")
      ? parts[3]
      : undefined;
  const valid =
    sample &&
    (parts.length === 2 ||
      (parts.length === 4 &&
        draftId &&
        drafts().some((d) => d.id === draftId && d.sample === sample.id)));
  const viewers = {
    travel: TravelPrototype,
    luma: SlideDeck,
    research: ResearchReport,
    chishan: BrandGallery,
    museum: MuseumPrototype,
    city: CityDeck,
    handbook: TravelHandbook,
    nature: NatureGallery,
    hyperframes: HyperFrames,
    film: Film,
    sound: Sound,
    live: LiveArtifact,
    webgl: WebGLWork,
    forme: FormePrototype,
    atelier: AtelierPrototype,
    roots: RootsPrototype,
    daylight: DaylightPrototype,
    tide: TidePrototype,
    morrow: MorrowPrototype,
  };
  const Viewer = sample ? viewers[sample.id] : null;
  const visible = samples.filter(
    (x) =>
      (category === "全部" || category === x.category) &&
      `${x.title}${x.description}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const emptyCategory =
    category !== "全部" && !samples.some((s) => s.category === category);
  const copies = drafts().filter((d) => visible.some((x) => x.id === d.sample));
  return (
    <div className="workbuddy-app samples-workspace">
      {serverLibrary && (
        <ServerLibrary onClose={() => setServerLibrary(false)} />
      )}
      <WorkBuddySidebar
        active="templates"
        projectCount={listProjects().length}
        go={navigateTo}
        setNotice={msg}
      />
      {parts.length > 1 ? (
        valid && Viewer ? (
          <Suspense
            fallback={
              <main className="sample-unavailable" role="status">
                正在载入作品…
              </main>
            }
          >
            <TemplateCloudProvider
              key={`${sample.id}-${draftId || "sample"}`}
              sample={sample.id}
              draft={draftId}
            >
              <Viewer draftId={draftId} />
            </TemplateCloudProvider>
          </Suspense>
        ) : (
          <main className="sample-unavailable">
            <h1>这个旧案例已下架，或副本不存在</h1>
            <p>
              原来的通用工作台案例已撤下。新版社区提供九种作品类型的可体验样板。
            </p>
            <button onClick={() => navigateTo("/inspiration")}>
              返回新版社区
            </button>
          </main>
        )
      ) : (
        <main className="samples-community" aria-label="灵感模版社区">
          <header className="samples-heading">
            <div>
              <h1>社区</h1>
              <p>
                {samples.length}{" "}
                套可体验作品，从文档与图片，到声音、动效和实时三维。
              </p>
            </div>
            <button aria-pressed={mine} onClick={() => showMine(!mine)}>
              {mine ? "返回精选样板" : `我的副本（${drafts().length}）`}
            </button>
            <button onClick={() => setServerLibrary(true)}>服务器作品</button>
          </header>
          <div className="samples-filters">
            <div role="group" aria-label="作品类型">
              {workCategories.map(({ label, icon }) => (
                <button
                  key={label}
                  aria-pressed={category === label}
                  onClick={() => choose(label)}
                >
                  {icon && <HomeIcon name={icon} size={14} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <label className="samples-search">
              <HomeIcon name="search" />
              <input
                aria-label="搜索作品"
                placeholder="搜索作品"
                value={query}
                onChange={(e) => search(e.target.value)}
              />
            </label>
          </div>
          <div className="samples-grid">
            {mine
              ? copies.map((d) => {
                  const s = samples.find((x) => x.id === d.sample)!;
                  return (
                    <article className="sample-card" key={d.id}>
                      <button
                        aria-label={`打开副本：${d.title}`}
                        onClick={() =>
                          navigateTo(`/inspiration/${d.sample}/draft/${d.id}`)
                        }
                      >
                        <Preview id={d.sample} />
                        <h2>{d.title}</h2>
                        <p>
                          {s.format} ·{" "}
                          {new Date(d.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </button>
                    </article>
                  );
                })
              : visible.map((s) => (
                  <article
                    className="sample-card"
                    key={s.id}
                    data-sample={s.id}
                  >
                    <button
                      aria-label={`打开作品：${s.title}`}
                      onClick={() => navigateTo(`/inspiration/${s.id}`)}
                    >
                      <Preview id={s.id} />
                      <h2>{s.title}</h2>
                      <p>
                        <span className="sample-avatar">D</span>DesignBuddy ·{" "}
                        {s.category}
                      </p>
                    </button>
                    <div className="sample-card-detail">
                      <span>{s.description}</span>
                      <b>{s.format}</b>
                    </div>
                  </article>
                ))}
          </div>
          {(mine ? !copies.length : !visible.length) && (
            <div className="samples-empty" role="status">
              <h2>
                {mine
                  ? "还没有匹配的副本"
                  : emptyCategory
                    ? `暂无 ${category} 作品`
                    : "没有找到匹配的作品"}
              </h2>
              <p>
                {mine
                  ? "打开样板后点击“做同款”，会按原类型保存独立副本。"
                  : emptyCategory
                    ? "栏目已添加，目前暂无可预览的成品。可以先浏览其他类型的作品。"
                    : "换一个关键词或作品类型试试。"}
              </p>
              <button
                onClick={() => {
                  choose("全部");
                  search("");
                  showMine(false);
                }}
              >
                查看全部作品
              </button>
            </div>
          )}
          <section className="samples-standard">
            <span>{samples.length} WORKS. NINE FORMATS.</span>
            <h2>{samples.length} 套作品，不同形式，不同体验。</h2>
            <div>
              <p>
                <b>原型</b>旅行预订、展馆预约与家具采购，20–24 个业务页面。
              </p>
              <p>
                <b>幻灯片</b>产品发布、城市漫步，各20页可编辑PPTX。
              </p>
              <p>
                <b>文档</b>研究报告、出行手册，各20页可编辑A4文稿。
              </p>
              <p>
                <b>图片</b>咖啡品牌、自然摄影，各20张SVG / PNG画板。
              </p>
              <p>
                <b>HyperFrames</b>四段 HTML 动效分镜，编辑并离线播放。
              </p>
              <p>
                <b>视频与音频</b>真实 MP4 摄影剪辑、可调参数的原创 WAV 音序。
              </p>
              <p>
                <b>实时产物与 WebGL</b>本地报价计算器与原生三维材质场景。
              </p>
            </div>
            <small>
              原有八个样板使用各自的独立摄影素材；新增视频由 AI
              概念摄影剪辑，不是实地拍摄。音频为原创程序合成；HyperFrames 栏目为
              HTML
              动效样板，未集成第三方引擎。所有作品均不自动播放或调用外部服务。
            </small>
          </section>
        </main>
      )}
      {notice && (
        <div className="samples-toast" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => msg("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
