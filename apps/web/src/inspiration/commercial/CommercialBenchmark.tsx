import { useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";
import {
  benchmarkTemplates,
  benchmarkVersion,
  costBreakdown,
  initialBenchmark,
  pagesFor,
  reviewMetrics,
  type BenchmarkState,
  type NewBenchmarkId,
} from "../../../../../shared/commercialTemplates";
import {
  campaignNames,
  campaignSvg,
  configHtml,
  configurationGeometry,
  costHtml,
  cueDescriptions,
  cueNames,
  cuePCM,
  cueWav,
  guideHtml,
  offlineHtml,
  offlineSvg,
} from "../../../../../shared/commercialExports";
import { csvValue } from "../samples/media-utils";
import {
  copySample,
  download,
  dataUrl,
  Notice,
  SampleTop,
  useSampleState,
} from "../samples/shared";
import { BenchmarkCover } from "./BenchmarkCover";
import "./commercial.css";
import cjkFontUrl from "../../assets/fonts/noto-sans-sc-chinese-simplified-400-normal.woff2?url";
const base = `${import.meta.env.BASE_URL}template-benchmarks/`;
const money = (cents: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(
    cents / 100,
  );
function save(
  bytes: Uint8Array | string,
  name: string,
  type = "application/octet-stream",
) {
  download(
    new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], {
      type,
    }),
    name,
  );
}
function Range({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="bench-range">
      {label}
      <output>{value}</output>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export default function CommercialBenchmark({
  id = "pro-review",
  draftId,
}: {
  id?: NewBenchmarkId;
  draftId?: string;
}) {
  const t = benchmarkTemplates.find((t) => t.id === id)!;
  const [s, set, error] = useSampleState(id, draftId, initialBenchmark(id));
  const [font, setFont] = useState("");
  const [notice, notify] = useState("");
  const [busy, setBusy] = useState(false);
  const [art, selectArt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [renderedCount, setRenderedCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const context = useRef<AudioContext | null>(null),
    source = useRef<AudioBufferSourceNode | null>(null);
  useEffect(() => {
    if (!["pro-config", "pro-tour", "pro-cost", "pro-launch"].includes(id))
      return;
    let cancelled = false;
    dataUrl(cjkFontUrl)
      .then((data) => {
        if (!cancelled) setFont(data);
      })
      .catch(() => {
        if (!cancelled)
          notify("离线中文字体加载失败，请刷新后再导出网页或图片。");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const patch = (part: Partial<BenchmarkState>) =>
    set((previous) => ({ ...previous, ...part }));
  const channels = s.accent
    .slice(1)
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const onAccent = 1.05 / (luminance + 0.05) >= 4.5 ? "#ffffff" : "#000000";
  const pages = pagesFor(id),
    page = pages[s.page];
  const config = useMemo(
    () => offlineHtml(configHtml(s), font),
    [s.width, s.height, s.yaw, s.accent, s.title, font],
  );
  const guide = useMemo(
    () => offlineHtml(guideHtml(s), font),
    [s.title, s.subtitle, s.edits, font],
  );
  useEffect(
    () => () => {
      source.current?.stop();
      void context.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!showPreview || !["pro-review", "pro-project"].includes(id)) return;
    const abort = new AbortController();
    fetch(`${base}${id}/original-metadata.json`, { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("原始页图清单读取失败");
        return r.json();
      })
      .then((m) => {
        if (
          !Number.isInteger(m.pageCount) ||
          m.pageCount < 1 ||
          m.pageCount > 20
        )
          throw Error("原始页数无效");
        setRenderedCount(m.pageCount);
      })
      .catch((e) => {
        if (!abort.signal.aborted) notify(e.message);
      });
    return () => abort.abort();
  }, [id, showPreview]);
  const wave = useMemo(() => {
    const { pcm } = cuePCM(s.cue, s.volume);
    return Array.from({ length: 72 }, (_, i) =>
      Math.max(3, Math.abs(pcm[Math.floor((i * pcm.length) / 72)]) * 350),
    );
  }, [s.cue, s.volume]);
  const work = async (fn: () => Promise<void>) => {
    setBusy(true);
    notify("");
    try {
      await fn();
    } catch (e) {
      notify(`操作未完成：${e instanceof Error ? e.message : "请重试"}`);
    } finally {
      setBusy(false);
    }
  };
  const archive = (files: Record<string, Uint8Array>, filename: string) =>
    save(
      zipSync({
        ...files,
        "README.txt": strToU8(
          `${t.name}\n版本 ${benchmarkVersion}\n${t.boundary}\n原创文字/图形/合成音效 CC0-1.0；嵌入字体为 Noto Sans SC，适用 SIL OFL。许可文本见应用 template-benchmarks/CC0-1.0.txt 和 OFL.txt。无外部服务。\n`,
        ),
        "state.json": strToU8(JSON.stringify(s, null, 2)),
      }),
      filename,
      "application/zip",
    );
  const asset = async (filename: string) => {
    const r = await fetch(base + filename);
    if (!r.ok || r.headers.get("content-type")?.includes("text/html"))
      throw Error("样例文件不可用，未生成下载。");
    download(await r.blob(), filename.split("/").pop()!);
  };
  const play = async () =>
    work(async () => {
      if (playing) {
        source.current?.stop();
        setPlaying(false);
        return;
      }
      if (!context.current) context.current = new AudioContext();
      const audio = context.current;
      await audio.resume();
      const { rate, pcm } = cuePCM(s.cue, s.volume),
        buffer = audio.createBuffer(1, pcm.length, rate);
      buffer.copyToChannel(new Float32Array(pcm), 0);
      source.current = audio.createBufferSource();
      source.current.buffer = buffer;
      source.current.connect(audio.destination);
      source.current.onended = () => setPlaying(false);
      source.current.start();
      setPlaying(true);
    });
  const office = () =>
    work(async () => {
      const m = await import("../../../../../shared/commercialOffice");
      const bytes =
        id === "pro-review" ? await m.reviewPptx(s) : await m.projectDocx(s);
      save(
        bytes,
        id === "pro-review" ? "quarterly-review.pptx" : "project-plan.docx",
      );
      notify(
        "已生成当前标题与章节修改版本。请在目标办公软件中复核；原始 PDF 不包含这些修改。",
      );
    });
  const renderPng = () =>
    work(async () => {
      const blob = new Blob([offlineSvg(campaignSvg(s, art), font)], {
          type: "image/svg+xml",
        }),
        url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("浏览器无法建立画布");
        ctx.drawImage(image, 0, 0);
        const result = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(Error("PNG编码失败"))),
            "image/png",
          ),
        );
        download(result, `orbit-${art + 1}.png`);
      } finally {
        URL.revokeObjectURL(url);
      }
    });
  const csv = () => {
    const c = costBreakdown(s),
      rows = [
        ["类别", "数量/工时", "单价（元）", "金额（元）"],
        ...["策略", "设计", "交付"].map((v, i) => [
          v,
          s.hours[i],
          s.rates[i],
          s.hours[i] * s.rates[i],
        ]),
        ["外采", 1, s.external, s.external],
        [
          "预备金",
          `${s.reserve}%`,
          "按人工+外采计提",
          (c.reserve / 100).toFixed(2),
        ],
        ["税费", `${s.tax}%`, "按含预备金小计计税", (c.tax / 100).toFixed(2)],
        ["含税预算", "CNY", "本地草案", (c.total / 100).toFixed(2)],
      ];
    save(
      "\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n"),
      "project-estimate.csv",
      "text/csv;charset=utf-8",
    );
  };
  return (
    <div
      className={`commercial-workbench bench-${id}`}
      style={
        {
          "--bench-accent": s.accent,
          "--bench-on-accent": onAccent,
        } as React.CSSProperties
      }
    >
      <SampleTop
        type={`${t.category} / 第一批标杆`}
        title={t.name}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(id, s);
          } catch {
            notify("无法创建副本，请先导出当前配置备份。");
          }
        }}
      >
        <button
          onClick={() =>
            save(
              JSON.stringify(
                {
                  schemaVersion: 1,
                  template: id,
                  version: benchmarkVersion,
                  state: s,
                  content: pages,
                },
                null,
                2,
              ),
              `${id}-content.json`,
              "application/json",
            )
          }
        >
          导出内容与配置
        </button>
      </SampleTop>
      <Notice text={error || notice} />
      <section aria-label="模板编辑工作区" className="bench-main">
        <header className="bench-hero">
          <div>
            <small className="bench-eyebrow">{t.en} / VOL. 01</small>
            <h1>{t.name.split(" · ")[1]}</h1>
            <p>{t.summary}</p>
            <div className="bench-badges">
              <span>原创样例</span>
              <span>{id === "pro-cost" ? "本地计算" : "可编辑参数"}</span>
              <span>需业务与兼容性复核</span>
            </div>
          </div>
          <BenchmarkCover id={id} />
        </header>
        <p className="bench-boundary">{t.boundary}</p>
        <div className="bench-layout">
          <section aria-label="版本与参数编辑" className="bench-controls">
            <h2>调整你的版本</h2>
            <label>
              项目 / 品牌名称
              <input
                maxLength={40}
                value={s.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label>
              副标题
              <input
                maxLength={100}
                value={s.subtitle}
                onChange={(e) => patch({ subtitle: e.target.value })}
              />
            </label>
            <label className="bench-color">
              主题颜色
              <input
                type="color"
                value={s.accent}
                onChange={(e) => patch({ accent: e.target.value })}
              />
            </label>
            <p>
              修改保存在此浏览器的当前样例/副本；服务器保存与恢复使用上方版本控制。不同账号共用浏览器时请勿将敏感内容保存在本地样例。
            </p>
            <button
              onClick={() => {
                if (confirm("恢复原始内容？当前修改会被替换，请先导出备份。")) {
                  set(initialBenchmark(id));
                  notify("已恢复原始样例");
                }
              }}
            >
              恢复原始内容
            </button>
            <hr />
            <h3>交付边界</h3>
            <p>{t.format}</p>
            <p>不调用外部 AI，不自动发布，不请求支付、邮件或业务系统权限。</p>
          </section>
          <section className="bench-workspace" aria-label="模板工作区">
            {id === "pro-launch" ? (
              <>
                <div className="bench-toolbar">
                  <h2>传播资产 / 06</h2>
                  <select
                    aria-label="画板选择"
                    value={art}
                    onChange={(e) => selectArt(Number(e.target.value))}
                  >
                    {campaignNames.map((v, i) => (
                      <option key={v} value={i}>
                        {String(i + 1).padStart(2, "0")} · {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="bench-artboard"
                  dangerouslySetInnerHTML={{ __html: campaignSvg(s, art) }}
                />
                <div className="bench-actions">
                  <button
                    disabled={!font}
                    onClick={() =>
                      save(
                        offlineSvg(campaignSvg(s, art), font),
                        `orbit-${art + 1}.svg`,
                        "image/svg+xml",
                      )
                    }
                  >
                    当前画板 SVG
                  </button>
                  <button disabled={busy || !font} onClick={renderPng}>
                    当前画板 PNG
                  </button>
                  <button
                    disabled={!font}
                    onClick={() =>
                      archive(
                        Object.fromEntries(
                          campaignNames.map((_, i) => [
                            `orbit-${i + 1}.svg`,
                            strToU8(offlineSvg(campaignSvg(s, i), font)),
                          ]),
                        ),
                        "orbit-campaign.zip",
                      )
                    }
                  >
                    六张 SVG 打包
                  </button>
                </div>
                <p className="bench-caption">
                  1080 × 1440 · 纯矢量图形和文字 ·
                  屏幕视觉；未做印刷色彩/出血验证。使用长名称时请检查边界。
                </p>
              </>
            ) : null}
            {id === "pro-cost" ? (
              <>
                <h2>
                  预算工作表 <small>CNY / 不含税输入</small>
                </h2>
                <div className="bench-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>工种</th>
                        <th>工时 / 小时</th>
                        <th>时薪 / 元</th>
                        <th>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["策略", "设计", "交付"].map((name, i) => (
                        <tr key={name}>
                          <th>{name}</th>
                          <td>
                            <input
                              aria-label={`${name}工时`}
                              type="number"
                              min={0}
                              max={1000}
                              step={1}
                              value={s.hours[i]}
                              onChange={(e) =>
                                patch({
                                  hours: s.hours.map((v, j) =>
                                    i === j
                                      ? Math.round(
                                          Math.min(
                                            1000,
                                            Math.max(
                                              0,
                                              Number(e.target.value) || 0,
                                            ),
                                          ),
                                        )
                                      : v,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`${name}时薪`}
                              type="number"
                              min={0}
                              max={10000}
                              step={1}
                              value={s.rates[i]}
                              onChange={(e) =>
                                patch({
                                  rates: s.rates.map((v, j) =>
                                    i === j
                                      ? Math.round(
                                          Math.min(
                                            10000,
                                            Math.max(
                                              0,
                                              Number(e.target.value) || 0,
                                            ),
                                          ),
                                        )
                                      : v,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td>{money(s.hours[i] * s.rates[i] * 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="bench-inline">
                  外采 / 元
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={s.external}
                    onChange={(e) =>
                      patch({
                        external: Math.round(
                          Math.min(1000000, Math.max(0, +e.target.value || 0)),
                        ),
                      })
                    }
                  />
                </label>
                <Range
                  label="预备金率 / %"
                  min={0}
                  max={50}
                  value={s.reserve}
                  onChange={(reserve) => patch({ reserve })}
                />
                <Range
                  label="税率 / %"
                  min={0}
                  max={30}
                  value={s.tax}
                  onChange={(tax) => patch({ tax })}
                />
                <div className="bench-total" aria-live="polite">
                  <small>含税预算</small>
                  <strong>{money(costBreakdown(s).total)}</strong>
                  <span>
                    人工 {money(costBreakdown(s).labor)} · 外采{" "}
                    {money(costBreakdown(s).external)}
                    <br />
                    预备金 {money(costBreakdown(s).reserve)} · 税费{" "}
                    {money(costBreakdown(s).tax)}
                  </span>
                </div>
                <div className="bench-comparison">
                  <h3>情景对照：工时增加 20%</h3>
                  <p>
                    {money(costBreakdown(s, 1.2).total)}，较基线增加{" "}
                    {money(
                      costBreakdown(s, 1.2).total - costBreakdown(s).total,
                    )}
                  </p>
                  <p>
                    每项工时 × 1.2
                    后四舍五入至整小时，外采、单价、税率不变；不是交付承诺。
                  </p>
                </div>
                <div className="bench-actions">
                  <button onClick={csv}>预算明细 CSV</button>
                  <button
                    disabled={!font}
                    onClick={() =>
                      save(
                        offlineHtml(costHtml(s), font),
                        "project-estimate.html",
                        "text/html",
                      )
                    }
                  >
                    可独立运行 HTML
                  </button>
                </div>
                <p className="bench-caption">
                  金额以分计算，各步骤四舍五入；人工 + 外采 → 预备金 →
                  税费。仅支持非负整小时与整元输入，不包含退款/抵扣情景。
                </p>
              </>
            ) : null}
            {id === "pro-cues" ? (
              <>
                <h2>声音语义 / SOUND LIBRARY</h2>
                <div className="bench-cues">
                  {cueNames.map((name, i) => (
                    <button
                      key={name}
                      aria-pressed={s.cue === i}
                      onClick={() => {
                        source.current?.stop();
                        setPlaying(false);
                        patch({ cue: i });
                      }}
                    >
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      <strong>{name}</strong>
                      <span>{cueDescriptions[i]}</span>
                    </button>
                  ))}
                </div>
                <div className="bench-wave" aria-hidden="true">
                  {wave.map((height, i) => (
                    <i key={i} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <Range
                  label="试听 / 导出增益（%）"
                  min={0}
                  max={60}
                  value={s.volume}
                  onChange={(volume) => patch({ volume })}
                />
                <div className="bench-actions">
                  <button disabled={busy} onClick={play}>
                    {playing ? "停止试听" : "试听选中音效"}
                  </button>
                  <button
                    onClick={() =>
                      save(
                        cueWav(s.cue, s.volume),
                        `signal-${s.cue + 1}.wav`,
                        "audio/wav",
                      )
                    }
                  >
                    当前 WAV
                  </button>
                  <button
                    onClick={() =>
                      archive(
                        Object.fromEntries(
                          cueNames.map((_, i) => [
                            `signal-${i + 1}.wav`,
                            cueWav(i, s.volume),
                          ]),
                        ),
                        "signal-cues.zip",
                      )
                    }
                  >
                    五个音效 ZIP
                  </button>
                </div>
                <p className="bench-caption">
                  22,050 Hz / 单声道 / 16-bit PCM · 原创正弦合成 · 最大增益 60%
                  · 所有声音须配套视觉反馈。
                </p>
              </>
            ) : null}
            {id === "pro-config" ? (
              <>
                <h2>配置预演 / SIDE TABLE</h2>
                <iframe
                  title="参数化边几三维预览"
                  sandbox="allow-scripts"
                  srcDoc={config}
                  className="bench-frame"
                />
                <Range
                  label="台面宽 / cm"
                  min={40}
                  max={140}
                  value={s.width}
                  onChange={(width) => patch({ width })}
                />
                <Range
                  label="桌面高 / cm"
                  min={30}
                  max={100}
                  value={s.height}
                  onChange={(height) => patch({ height })}
                />
                <Range
                  label="初始视角 / °"
                  min={-180}
                  max={180}
                  value={s.yaw}
                  onChange={(yaw) => patch({ yaw })}
                />
                <p>
                  深度按宽度 × 0.7 计算：{Math.round(s.width * 0.7)}{" "}
                  cm。色彩与比例为视觉示意，不代表实物材料。
                </p>
                <div className="bench-actions">
                  <button
                    disabled={!font}
                    onClick={() =>
                      save(config, "object-configurator.html", "text/html")
                    }
                  >
                    独立 WebGL HTML
                  </button>
                  <button
                    onClick={() =>
                      save(
                        configurationGeometry(s.width, s.height).obj,
                        "object-side-table.obj",
                        "text/plain",
                      )
                    }
                  >
                    当前几何 OBJ
                  </button>
                </div>
                <p className="bench-caption">
                  OBJ 为原创网格，归一化 1 单位 = 80
                  cm；不含纹理、颜色或相机。完整表现请使用 HTML/JSON。
                </p>
              </>
            ) : null}
            {["pro-review", "pro-project", "pro-tour", "pro-film"].includes(
              id,
            ) ? (
              <>
                <div className="bench-toolbar">
                  <h2>
                    {id === "pro-review"
                      ? "逐页叙事"
                      : id === "pro-project"
                        ? "实施正文"
                        : id === "pro-tour"
                          ? "教学分帧"
                          : "分镜与样片"}
                  </h2>
                  <span>
                    {s.page + 1} / {pages.length}
                  </span>
                </div>
                <nav className="bench-page-tabs" aria-label="内容导航">
                  {pages.map((p, i) => (
                    <button
                      key={p.title}
                      aria-current={s.page === i ? "step" : undefined}
                      onClick={() => patch({ page: i })}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </button>
                  ))}
                </nav>
                <article
                  className={`bench-content-sheet ${id === "pro-review" ? "bench-slide" : ""}`}
                >
                  <small>
                    {id === "pro-project" ? "PROJECT PLAN" : "ORIGINAL SAMPLE"}{" "}
                    / {String(s.page + 1).padStart(2, "0")}
                  </small>
                  <h2>{s.edits[s.page]}</h2>
                  <p className="bench-lead">{page.lead}</p>
                  {page.points.map((p, i) => (
                    <div className="bench-content-point" key={p}>
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      <p>{p}</p>
                    </div>
                  ))}
                  {id === "pro-review" && s.page === 2 && (
                    <div className="bench-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>指标 / 单位</th>
                            <th>目标</th>
                            <th>实际</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewMetrics.map((m) => (
                            <tr key={m.label}>
                              <th>
                                {m.label} / {m.unit}
                              </th>
                              <td>{m.target}</td>
                              <td>{m.actual}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <footer>说明 / {page.note}</footer>
                </article>
                <label className="bench-heading-edit">
                  编辑当前页标题
                  <input
                    maxLength={48}
                    value={s.edits[s.page]}
                    onChange={(e) =>
                      patch({
                        edits: s.edits.map((v, i) =>
                          s.page === i ? e.target.value : v,
                        ),
                      })
                    }
                  />
                </label>
                <p className="bench-caption">
                  本批支持品牌/副标题/章节标题修改；正文与数值为有来源的固定样例，不宣称支持任意正文编辑。
                </p>
                {id === "pro-review" || id === "pro-project" ? (
                  <>
                    <div className="bench-actions">
                      <button disabled={busy} onClick={office}>
                        {busy
                          ? "正在生成…"
                          : `当前内容 ${id === "pro-review" ? "PPTX" : "DOCX"}`}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => work(() => asset(`${id}/original.pdf`))}
                      >
                        原始样例 PDF（不含修改）
                      </button>
                      <button onClick={() => setShowPreview(!showPreview)}>
                        {showPreview ? "收起" : "查看"}原始文件实际页图
                      </button>
                    </div>
                    {showPreview && (
                      <div className="bench-rendered-pages">
                        <p>固定原始样例的实际文件渲染，不随当前编辑变化。</p>
                        {Array.from({ length: renderedCount }, (_, i) => (
                          <img
                            loading="lazy"
                            key={i}
                            src={`${base}${id}/pages/${String(i + 1).padStart(2, "0")}.jpg`}
                            alt={`原始${id === "pro-review" ? "幻灯片" : "文档"}第 ${i + 1} 页`}
                            onError={() =>
                              notify(
                                "原始页图加载失败，请检查静态资源；未隐藏失败证据。",
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                    <p className="bench-caption">
                      PDF/页图来自原始固定版本的同一
                      PPTX/DOCX；当前修改版仅导出原生文件，请在目标软件重新渲染。字体
                      Noto Sans SC / OFL。
                    </p>
                  </>
                ) : null}
                {id === "pro-tour" ? (
                  <>
                    <iframe
                      title="离线五步导览预览"
                      sandbox="allow-scripts"
                      srcDoc={guide}
                      className="bench-frame"
                    />
                    <div className="bench-actions">
                      <button
                        disabled={!font}
                        onClick={() =>
                          save(guide, "wayfinder-guide.html", "text/html")
                        }
                      >
                        当前导览 HTML
                      </button>
                    </div>
                  </>
                ) : null}
                {id === "pro-film" ? (
                  <>
                    <video
                      className="bench-video"
                      controls
                      preload="metadata"
                      poster={`${base}pro-film/poster.jpg`}
                      src={`${base}pro-film/original.mp4`}
                      onError={() =>
                        notify(
                          "固定样片加载失败，请检查静态资源。分镜内容仍可导出。",
                        )
                      }
                    >
                      <track
                        kind="captions"
                        src={`${base}pro-film/captions.vtt`}
                        srcLang="zh-CN"
                        label="画面字幕（无音轨）"
                        default
                      />
                    </video>
                    <div className="bench-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          work(() => asset("pro-film/original.mp4"))
                        }
                      >
                        固定样片 MP4
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          work(() => asset("pro-film/captions.vtt"))
                        }
                      >
                        原始字幕 VTT
                      </button>
                      <button
                        onClick={() =>
                          save(
                            JSON.stringify(
                              {
                                title: s.title,
                                scenes: pages.map((p, i) => ({
                                  ...p,
                                  title: s.edits[i],
                                  from: i * 4,
                                  to: (i + 1) * 4,
                                })),
                                notice:
                                  "修改分镜未重编码样片；需要使用分镜重新制作。",
                              },
                              null,
                              2,
                            ),
                            "storyboard.json",
                            "application/json",
                          )
                        }
                      >
                        当前分镜 JSON
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
        <section className="bench-handoff">
          <p>
            <a
              href={`${base}README.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              来源、编辑范围与许可
            </a>{" "}
            ·{" "}
            <a href={`${base}OFL.txt`} download>
              字体 OFL
            </a>{" "}
            ·{" "}
            <a href={`${base}CC0-1.0.txt`} download>
              原创内容 CC0
            </a>
          </p>
          <small>BEFORE YOU DELIVER</small>
          <h2>让接收者能够继续工作。</h2>
          <div>
            <article>
              <h3>内容与来源</h3>
              <p>
                原创方法与合成数据，来源在内容
                JSON。没有虚构客户背书、市场指标或真实业务状态。
              </p>
            </article>
            <article>
              <h3>可复用与边界</h3>
              <p>
                当前模板 {benchmarkVersion}
                。正文/参数/静态产物的编辑范围分别标识；保留源文件与修改记录。
              </p>
            </article>
            <article>
              <h3>交付前复核</h3>
              <p>
                核对字体、目标软件、长标题、素材使用范围与业务事实。自动生成成功不代表商业验收通过。
              </p>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
