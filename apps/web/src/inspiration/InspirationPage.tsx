import {
  benchmarkTemplates,
  isNewBenchmark,
} from "../../../../shared/commercialTemplates";
import { BenchmarkCover } from "./commercial/BenchmarkCover";
import TemplateReadiness from "./commercial/TemplateReadiness";
import WelcomeTemplate from "./samples/WelcomeTemplate";
import {
  isWelcomeSample,
  welcomeTemplates,
  welcomeBase,
} from "./welcomeTemplates";
import { MorrowCover } from "./samples/morrow/MorrowCover";
import { TideCover } from "./samples/tide/TideCover";
import { DaylightCover } from "./samples/daylight/DaylightCover";
import { RootsCover } from "./samples/roots/RootsCover";
import { AtelierCover } from "./samples/atelier/AtelierCover";
import { TemplateCloudProvider } from "./TemplateCloud";
import { ServerLibrary } from "./ServerLibrary";
import { FormeCover } from "./samples/forme/FormeCover";
import { kitCover, kitViewer } from "./samples/kit/KitSet";
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
import GenericTemplate from "./samples/GenericTemplate";
import {
  drafts,
  samples,
  type SampleId,
  type DraftRecord,
} from "./samples/shared";
import MuseumPrototype, { MuseumCover } from "./samples/MuseumPrototype";
import { HandbookPaper } from "./samples/HandbookPaper";
import { AICover, aiCoverIds } from "./samples/aiCovers";
import { NatureArtwork } from "./samples/NatureArtwork";
import "./samples/samples.css";
import "./samples/expansion.css";
const CommercialBenchmark = lazy(
  () => import("./commercial/CommercialBenchmark"),
);
const WordProReport = lazy(() => import("./samples/WordProReport"));
const ContentDirectorReport = lazy(
  () => import("./samples/ContentDirectorReport"),
);
const PresentationVisualGallery = lazy(
  () => import("./samples/PresentationVisualGallery"),
);
const LeaderDecisionReport = lazy(
  () => import("./samples/LeaderDecisionReport"),
);
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
const HFTour = lazy(() =>
  import("./samples/hyperframes/HyperFramesSet").then((m) => ({
    default: m.HFTour,
  })),
);
const HFStory = lazy(() =>
  import("./samples/hyperframes/HyperFramesSet").then((m) => ({
    default: m.HFStory,
  })),
);
const HFQuest = lazy(() =>
  import("./samples/hyperframes/HyperFramesPlay").then((m) => ({
    default: m.HFQuest,
  })),
);
const HFLesson = lazy(() =>
  import("./samples/hyperframes/HyperFramesPlay").then((m) => ({
    default: m.HFLesson,
  })),
);
const LiveBoard = lazy(() =>
  import("./samples/live/LiveSet").then((m) => ({ default: m.LiveBoard })),
);
const LiveEvent = lazy(() =>
  import("./samples/live/LiveSet").then((m) => ({ default: m.LiveEvent })),
);
const LiveForm = lazy(() =>
  import("./samples/live/LiveTools").then((m) => ({ default: m.LiveForm })),
);
const LiveStatus = lazy(() =>
  import("./samples/live/LiveTools").then((m) => ({ default: m.LiveStatus })),
);

const StudioNineCover = kitCover("studio-nine");
const WellspringCover = kitCover("wellspring");
const CircuitCover = kitCover("circuit");
const StudioNinePrototype = kitViewer("studio-nine");
const WellspringPrototype = kitViewer("wellspring");
const CircuitPrototype = kitViewer("circuit");
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
  if (isNewBenchmark(id)) return <BenchmarkCover id={id} />;
  const welcome = welcomeTemplates.find((t) => t.id === id);
  if (welcome)
    return (
      <div className="sample-preview" aria-hidden="true">
        <img
          src={`${welcomeBase}/thumb/${welcome.number}.webp?rev=2-final`}
          alt=""
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#eeeee7",
          }}
        />
      </div>
    );
  return (
    <div className={`sample-preview preview-${id}`} aria-hidden="true">
      {id === "word-pro" ? (
        <img
          src={`${import.meta.env.BASE_URL}word-examples/word-pro/business-report/pages/02.jpg`}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top",
          }}
          loading="lazy"
        />
      ) : id === "content-director" ? (
        <img
          src={`${import.meta.env.BASE_URL}presentation-examples/content-director/slides/07.jpg`}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      ) : id === "visual-directions" ? (
        <img
          src={`${import.meta.env.BASE_URL}presentation-examples/visual-directions/brand-editorial/cover.jpg`}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      ) : id === "leader-decision" ? (
        <img
          src={`${import.meta.env.BASE_URL}presentation-examples/leader-decision/adaptive/cover.jpg`}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      ) : (mediaIds as readonly string[]).includes(id) ? (
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
      ) : (aiCoverIds as readonly string[]).includes(id) ? (
        <AICover id={id} />
      ) : (
        <BrandArtwork />
      )}
    </div>
  );
}
export default function InspirationPage({ pathname }: { pathname: string }) {
  const [benchmarksOnly, setBenchmarksOnly] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
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
    "leader-decision": LeaderDecisionReport,
    "content-director": ContentDirectorReport,
    "word-pro": WordProReport,
    "visual-directions": PresentationVisualGallery,
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
    "hf-tour": HFTour,
    "hf-story": HFStory,
    "hf-quest": HFQuest,
    "hf-lesson": HFLesson,
    "live-board": LiveBoard,
    "live-event": LiveEvent,
    "live-form": LiveForm,
    "live-status": LiveStatus,
  };
  const Viewer = sample
    ? isNewBenchmark(sample.id)
      ? CommercialBenchmark
      : isWelcomeSample(sample.id)
        ? WelcomeTemplate
        : viewers[sample.id as keyof typeof viewers]
    : null;
  const visible = samples.filter(
    (x) =>
      (!benchmarksOnly || benchmarkTemplates.some((t) => t.id === x.id)) &&
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
              {sample && isNewBenchmark(sample.id) ? (
                <CommercialBenchmark id={sample.id} draftId={draftId} />
              ) : (
                <Viewer draftId={draftId} />
              )}
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
              <h1>模板</h1>
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
          <section className="benchmark-collection">
            <div>
              <small>COMMERCIAL TEMPLATE LAB / 第一批</small>
              <h2>先做好每一套，再扩展更多可能。</h2>
              <p>
                9 类标杆：8 套新作 + FORME
                采购原型。样例、本地计算与真实服务分别标识；不以目录数量替代验收。
              </p>
            </div>
            <div>
              <button
                aria-pressed={benchmarksOnly}
                onClick={() => setBenchmarksOnly(!benchmarksOnly)}
              >
                {benchmarksOnly ? "查看全部模板" : "查看本批 9 类标杆"}
              </button>
              <button
                aria-expanded={showReadiness}
                onClick={() => setShowReadiness(!showReadiness)}
              >
                能力与缺口清单
              </button>
            </div>
          </section>
          {showReadiness && <TemplateReadiness />}
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
                  setBenchmarksOnly(false);
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
                <b>幻灯片</b>产品发布、经营复盘与决策汇报；页数按表达任务确定。
              </p>
              <p>
                <b>文档</b>
                研究报告、出行手册与实施方案；各自说明编辑及导出范围。
              </p>
              <p>
                <b>图片</b>
                品牌传播、摄影海报与欢迎页参考；区分矢量画板与静态图。
              </p>
              <p>
                <b>HyperFrames</b>
                品牌分镜、分帧导览与互动教学，可编辑支持的内容并离线播放。
              </p>
              <p>
                <b>视频与音频</b>
                摄影剪辑、原创程序短片与合成音效；固定样片与可编辑参数分别标识。
              </p>
              <p>
                <b>实时产物与 WebGL</b>
                本地预算、模拟看板与三维选配；数据来源与服务边界逐套注明。
              </p>
            </div>
            <small>
              素材、模拟数据与编辑范围见各模板说明。本批新增内容不调用外部模型；既有摄影与新作程序图形分别标识。
              下载成功不等于业务验收通过，真实支付、邮件、预约或多端实时服务需另行配置与验收。
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
