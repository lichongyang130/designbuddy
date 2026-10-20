import { useEffect, useRef, useState } from "react";
import {
  presentationLimits as L,
  type PresentationBrief,
  type PresentationRequest,
  type PresentationAssetInput,
} from "../../shared/presentation";
import { presentationVisualStyles } from "../../shared/presentationDesign";
import "./presentation-composer.css";
type AssetDraft = Omit<
  PresentationAssetInput,
  "base64" | "permissionConfirmed"
> & { file: File; permissionConfirmed: boolean };
async function encodeFile(f: File) {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
function AssetPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return <img src={url || undefined} alt="本地素材预览，尚未上传" />;
}

/** Local preparation only. The existing SkillWorkbench owns upload, consent, identity and task/run history. */
export default function PresentationComposer({
  disabled,
  initialGoal = "",
  initialBrief,
  initialFiles,
  initialRequestFile,
  onInvalidate,
  onPrepare,
}: {
  disabled: boolean;
  initialGoal?: string;
  initialBrief?: Partial<PresentationBrief>;
  initialFiles?: File[];
  initialRequestFile?: File;
  onInvalidate: () => void;
  onPrepare: (file: File) => void;
}) {
  const [brief, setBrief] = useState<PresentationBrief>({
    goal: initialGoal,
    audience: "管理层与决策者",
    scenario: "business-report",
    theme: "consulting",
    slideCount: 8,
    layoutStyle: "adaptive",
    ...initialBrief,
  });
  const [files, setFiles] = useState<File[]>([]),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState(false);
  const [assets, setAssets] = useState<AssetDraft[]>([]);
  const nextAsset = useRef(1);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!initialFiles?.length) return;
    invalidate(); setFiles(initialFiles);
  }, [initialFiles]);
  useEffect(() => {
    if (!initialRequestFile) return;
    invalidate(); const version = generation.current;
    void initialRequestFile.text().then(raw => {
      if (version !== generation.current) return;
      const request = JSON.parse(raw) as PresentationRequest;
      if (request.schemaVersion !== 1 || !request.brief || !Array.isArray(request.files) || request.files.length > 5) throw Error("原始演示输入格式不受支持。");
      const decode = (base64: string, name: string) => new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], name);
      setBrief({ ...request.brief, goal: initialGoal || request.brief.goal });
      setFiles(request.files.map(f => decode(f.base64, f.name)));
      setAssets((request.assets || []).map(({ base64, ...a }) => ({ ...a, file: decode(base64, a.name), permissionConfirmed: false })));
      setPrepared(false);
    }).catch(cause => { if (version === generation.current) setError(cause instanceof Error ? cause.message : "无法读取原始演示输入。"); });
  }, [initialRequestFile]);
  function invalidate() {
    generation.current++;
    setPrepared(false);
    setError("");
    onInvalidate();
  }
  function change<K extends keyof PresentationBrief>(
    key: K,
    value: PresentationBrief[K],
  ) {
    invalidate();
    setBrief((b) => ({
      ...b,
      [key]: value,
      ...(key === "layoutStyle" && value === "classic"
        ? {
            visualStyle: undefined,
            logoAssetId: undefined,
            narrativeMode: undefined,
          }
        : {}),
    }));
    if (key === "layoutStyle" && value === "classic") setAssets([]);
  }
  function updateAsset(id: string, patch: Partial<AssetDraft>) {
    invalidate();
    if (brief.logoAssetId === id && patch.role && patch.role !== "logo")
      setBrief((b) => ({ ...b, logoAssetId: undefined }));
    setAssets((all) => all.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  async function prepare() {
    const identity = ++generation.current;
    onInvalidate();
    setPrepared(false);
    setError("");
    setPreparing(true);
    try {
      if (
        !brief.goal.trim() ||
        brief.goal.length > 2000 ||
        !brief.audience.trim() ||
        brief.audience.length > 200 ||
        !Number.isInteger(brief.slideCount) ||
        brief.slideCount < 8 ||
        brief.slideCount > 25
      )
        throw Error("请填写目标、受众和8–25页的页数。");
      if (
        files.length < 1 ||
        files.length > L.files ||
        files.some(
          (f) =>
            !f.size ||
            f.size > L.fileBytes ||
            !/\.(txt|md|docx|xlsx|csv)$/i.test(f.name),
        ) ||
        files.reduce((n, f) => n + f.size, 0) > L.totalBytes
      )
        throw Error("请选1–5份非空TXT/MD/DOCX/XLSX/CSV，每份≤2MB、合计≤10MB。");
      if (
        new Set(files.map((f) => f.name.toLowerCase())).size !== files.length ||
        files.some((f) => f.name.length > 120)
      )
        throw Error("文件名须唯一且≤120字。");
      if (
        assets.length > 5 ||
        assets.some(
          (a) =>
            !a.file.size ||
            a.file.size > 2_000_000 ||
            !/\.(png|jpe?g|webp)$/i.test(a.name),
        )
      )
        throw Error("最多5份PNG/JPEG/WebP素材，每份非空且≤2MB。");
      if (assets.length && brief.layoutStyle !== "adaptive")
        throw Error("素材需要自适应输出。");
      if (
        new Set(assets.map((a) => a.name.toLowerCase())).size !==
          assets.length ||
        assets.some((a) => a.name.length > 120)
      )
        throw Error("素材名称须唯一且≤120字。");
      if (
        files.reduce((n, f) => n + f.size, 0) +
          assets.reduce((n, a) => n + a.file.size, 0) >
        L.totalBytes
      )
        throw Error("来源材料与图片素材合计≤10MB。");
      if (
        assets.some(
          (a) =>
            !a.alt.trim() ||
            !a.source.trim() ||
            !a.license.trim() ||
            !a.permissionConfirmed,
        )
      )
        throw Error(
          "请填写每份素材的说明、来源、许可，并明确确认本次使用权限。",
        );
      const encoded: PresentationRequest["files"] = [];
      for (const f of files) {
        encoded.push({ name: f.name, base64: await encodeFile(f) });
      }
      const encodedAssets: PresentationAssetInput[] = [];
      for (const a of assets) {
        const { file, permissionConfirmed: _, ...meta } = a;
        encodedAssets.push({
          ...meta,
          alt: a.alt.trim(),
          source: a.source.trim(),
          license: a.license.trim(),
          permissionConfirmed: true,
          base64: await encodeFile(file),
        });
      }
      if (identity !== generation.current) return;
      const value: PresentationRequest = {
        schemaVersion: 1,
        brief: {
          ...brief,
          goal: brief.goal.trim(),
          audience: brief.audience.trim(),
        },
        files: encoded,
        ...(encodedAssets.length ? { assets: encodedAssets } : {}),
      };
      const file = new File(
        [JSON.stringify(value)],
        "presentation-request.json",
        { type: "application/json" },
      );
      if (file.size > L.envelopeBytes)
        throw Error("准备后的演示请求超过13.6MB，请精简材料。");
      onPrepare(file);
      setPrepared(true);
    } catch (e) {
      if (identity === generation.current)
        setError(e instanceof Error ? e.message : "准备材料失败。");
    } finally {
      if (identity === generation.current) setPreparing(false);
    }
  }
  return (
    <fieldset
      className="presentation-composer"
      disabled={disabled || preparing}
      aria-label="商业演示需求与多份材料"
    >
      <legend>商业演示 · 需求与证据</legend>
      <p>
        先在浏览器准备需求与材料，再由下方两项明确授权启动后台。AI负责读材料与逐页规划，代码负责真实数据和可编辑对象；不是把聊天文字直接分页。
      </p>
      <label>
        演示目标
        <textarea
          rows={3}
          maxLength={2000}
          value={brief.goal}
          placeholder="例如：向经营委员会汇报本季度收入与风险，并请求批准下一阶段试点。不要替材料补造数据。"
          onChange={(e) => change("goal", e.target.value)}
        />
      </label>
      <label>
        受众与决策背景
        <input
          maxLength={200}
          value={brief.audience}
          onChange={(e) => change("audience", e.target.value)}
        />
      </label>
      <div className="presentation-brief-grid">
        <label>
          演示场景
          <select
            value={brief.scenario}
            onChange={(e) =>
              change(
                "scenario",
                e.target.value as PresentationBrief["scenario"],
              )
            }
          >
            <option value="business-report">商业汇报</option>
            <option value="pitch-deck">融资路演</option>
            <option value="data-analysis">数据分析</option>
          </select>
        </label>
        <label>
          输出排版
          <select
            value={brief.layoutStyle || "classic"}
            onChange={(e) =>
              change(
                "layoutStyle",
                e.target.value as PresentationBrief["layoutStyle"],
              )
            }
          >
            <option value="adaptive">自适应商务 V2 · 内容密度与原生版式</option>
            <option value="classic">经典 V1 · 兼容原版输出</option>
          </select>
        </label>
        <label>
          统一主题（未选艺术风格时）
          <select
            disabled={!!brief.visualStyle}
            value={brief.theme}
            onChange={(e) =>
              change("theme", e.target.value as PresentationBrief["theme"])
            }
          >
            <option value="consulting">咨询 · 米白墨绿</option>
            <option value="corporate">企业 · 蓝白</option>
            <option value="technology">科技 · 深色</option>
          </select>
        </label>
        <label>
          页数（8–25）
          <input
            type="number"
            min={8}
            max={25}
            value={brief.slideCount}
            onChange={(e) => change("slideCount", Number(e.target.value))}
          />
        </label>
      </div>
      {brief.layoutStyle === "adaptive" && (
        <label>
          视觉艺术方向
          <select
            value={brief.visualStyle || ""}
            onChange={(e) =>
              change(
                "visualStyle",
                (e.target.value ||
                  undefined) as PresentationBrief["visualStyle"],
              )
            }
          >
            <option value="">保留V2 · 不启用新视觉系统</option>
            {presentationVisualStyles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.composition}
              </option>
            ))}
          </select>
        </label>
      )}
      <small>
        艺术方向覆盖基础配色，并改变封面与图文页构图；无素材不会伪造图片。切换经典V1将移除视觉风格与素材，保留来源文档。
      </small>
      {brief.layoutStyle === "adaptive" && (
        <section
          className="presentation-director-choice"
          aria-label="内容导演设置"
        >
          <label>
            内容导演
            <select
              aria-label="内容导演"
              value={brief.narrativeMode || ""}
              onChange={(e) =>
                change(
                  "narrativeMode",
                  (e.target.value ||
                    undefined) as PresentationBrief["narrativeMode"],
                )
              }
            >
              <option value="">标准规划 · 保留V2/M2路径</option>
              <option value="directed">
                内容导演 · 先定任务、证据与节奏，再写稿
              </option>
            </select>
          </label>
          <small>
            启用后分两阶段调用已配置的模型：导演与写稿各最多一次校验重试，合计最多4次调用，可能增加用量。导演先锁定逐页结论与来源；原生结构/流程不等于因果已核实。不会自动发图给模型、生图或进行商业认证。切换经典V1会移除此设置。
          </small>
        </section>
      )}
      <label>
        选择多份来源材料
        <input
          type="file"
          multiple
          accept=".txt,.md,.docx,.xlsx,.csv"
          onChange={(e) => {
            invalidate();
            setFiles(Array.from(e.target.files || []));
          }}
        />
      </label>
      <small>
        自适应V2不靠缩字或删事实消除溢出；排不下会提示换布局或确认拆页。1–5份，每份≤2MB、合计≤10MB；提取后≤40000字。每张数据表≤500行/20列；不执行公式、不忽略隐藏表。扫描PDF、旧PPT和图片OCR尚未接入；下方图片作为独立视觉素材，不当作已读懂的正文。
      </small>
      {files.length > 0 && (
        <ul aria-label="演示来源清单">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>{f.name}</span>
              <small>{(f.size / 1000).toFixed(1)} KB</small>
            </li>
          ))}
        </ul>
      )}
      {brief.layoutStyle === "adaptive" && (
        <section
          className="presentation-assets"
          aria-label="视觉素材与使用权限"
        >
          <h3>视觉素材 · 不发送图片像素给文字规划模型</h3>
          <p>
            可添加Logo、截图、插画或照片。元数据会随本次授权参与规划；本机规范化、去除EXIF，截图/证据图完整显示。不会自动OCR，也不会自动调用生图服务。
          </p>
          <label>
            添加视觉素材
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                invalidate();
                const selected = Array.from(e.target.files || []);
                if (assets.length + selected.length > 5) {
                  setError("最多5份视觉素材。");
                  return;
                }
                setAssets((all) => [
                  ...all,
                  ...selected.map((file) => ({
                    id: `asset-${nextAsset.current++}`,
                    file,
                    name: file.name,
                    role: "illustration" as const,
                    usage: "decorative" as const,
                    alt: "",
                    source: "",
                    license: "",
                    permissionConfirmed: false,
                  })),
                ]);
                e.target.value = "";
              }}
            />
          </label>
          <small>
            每份≤2MB，≤800万像素；最多5份；与来源文档合计≤10MB。只接收实际PNG/JPEG/WebP，拒绝SVG、伪装格式及动画；不抓取外链。
          </small>
          {assets.map((a) => (
            <fieldset
              key={a.id}
              className="presentation-asset"
              aria-label={`素材 ${a.name}`}
            >
              <legend>{a.name}</legend>
              <AssetPreview file={a.file} />
              <label>
                素材角色
                <select
                  value={a.role}
                  onChange={(e) =>
                    updateAsset(a.id, {
                      role: e.target.value as AssetDraft["role"],
                      ...(e.target.value === "screenshot"
                        ? { usage: "evidence" as const }
                        : e.target.value === "logo"
                          ? { usage: "decorative" as const }
                          : {}),
                    })
                  }
                >
                  <option value="illustration">概念插画</option>
                  <option value="photo">照片</option>
                  <option value="screenshot">证据截图</option>
                  <option value="logo">品牌Logo</option>
                </select>
              </label>
              <label>
                素材用途
                <select
                  value={a.usage}
                  disabled={a.role === "screenshot" || a.role === "logo"}
                  onChange={(e) =>
                    updateAsset(a.id, {
                      usage: e.target.value as AssetDraft["usage"],
                    })
                  }
                >
                  <option value="decorative">装饰 · 不支持事实主张</option>
                  <option value="evidence">证据 · 完整显示且绑定来源</option>
                </select>
              </label>
              <label>
                图片说明 / 无障碍文字
                <input
                  maxLength={120}
                  value={a.alt}
                  onChange={(e) => updateAsset(a.id, { alt: e.target.value })}
                />
              </label>
              <label>
                素材来源（仅记录，不抓取）
                <input
                  maxLength={240}
                  value={a.source}
                  onChange={(e) =>
                    updateAsset(a.id, { source: e.target.value })
                  }
                />
              </label>
              <label>
                使用许可 / 授权范围
                <input
                  maxLength={200}
                  value={a.license}
                  placeholder="例如：自有素材，授权本次汇报；或AI生成概念配图"
                  onChange={(e) =>
                    updateAsset(a.id, { license: e.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={a.permissionConfirmed}
                  onChange={(e) =>
                    updateAsset(a.id, { permissionConfirmed: e.target.checked })
                  }
                />
                我确认有权将该素材用于本次生成与汇报；此声明不等于平台独立版权核验。
              </label>
              <button
                type="button"
                onClick={() => {
                  invalidate();
                  setAssets((all) => all.filter((x) => x.id !== a.id));
                  if (brief.logoAssetId === a.id)
                    setBrief((b) => ({ ...b, logoAssetId: undefined }));
                }}
              >
                移除 {a.name}
              </button>
            </fieldset>
          ))}
          <label>
            全页品牌Logo
            <select
              value={brief.logoAssetId || ""}
              onChange={(e) =>
                change("logoAssetId", e.target.value || undefined)
              }
            >
              <option value="">不添加Logo</option>
              {assets
                .filter((a) => a.role === "logo")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        </section>
      )}
      {error && (
        <p role="alert" className="skill-workbench-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void prepare()}
        disabled={disabled || preparing}
      >
        {preparing ? "正在浏览器内准备…" : "准备演示输入（尚不上传）"}
      </button>
      <p role="status" className={prepared ? "presentation-prepared" : ""}>
        {prepared
          ? "需求与材料已准备。请核对后在下方选择本次AI正文处理授权、同意后台上传，再执行。修改任何需求/材料会撤销准备、上传同意与本次AI授权。"
          : "尚未准备输入，未创建任务、未调用AI。"}
      </p>
      <aside>
        <b>交付的是可验收的草稿，不是自动商业认证</b>
        <span>
          PPTX、PDF、全页预览、来源/讲稿、数据绑定和质量报告关联同一次任务。模型未配置时不可执行；缺字、越界或渲染失败会阻止发布通过。请人工核对事实及目标软件中的编辑效果。
        </span>
      </aside>
    </fieldset>
  );
}
