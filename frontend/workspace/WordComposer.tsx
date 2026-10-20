import { useEffect, useRef, useState } from "react";
import {
  wordSections,
  wordExample,
  type WordType,
  type WordDocument,
  type WordBlock,
} from "../../shared/wordDocument";
import "./word-composer.css";
export default function WordComposer({
  disabled,
  initialFile,
  onInvalidate,
  onPrepare,
}: {
  disabled: boolean;
  initialFile?: File;
  onInvalidate: () => void;
  onPrepare: (file: File) => void;
}) {
  const [type, setType] = useState<WordType>("business-report"),
    [mode, setMode] = useState<"form" | "json">("form");
  const [title, setTitle] = useState(""),
    [subtitle, setSubtitle] = useState(""),
    [source, setSource] = useState(""),
    [locator, setLocator] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({}),
    [table, setTable] = useState(""),
    [scope, setScope] = useState(""),
    [calculation, setCalculation] = useState("无计算，按原文保留"),
    [caption, setCaption] = useState("");
  const [imported, setImported] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [jsonText, setJsonText] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    if (initialFile) change(() => { setMode("json"); setImported(initialFile); setJsonText(null); });
  }, [initialFile]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function change(fn: () => void) {
    generation.current++;
    onInvalidate();
    setMessage("");
    setError("");
    fn();
  }
  function example() {
    change(() => {
      const d = wordExample(type);
      setMode("json"); setJsonText(null);
      setImported(
        new File([JSON.stringify(d, null, 2)], "word-example.json", {
          type: "application/json",
        }),
      );
    });
  }
  async function prepare() {
    const version = ++generation.current;
    onInvalidate();
    setMessage("");
    setError("");
    try {
      let file: File;
      if (mode === "json") {
        if (jsonText === null && (!imported || !imported.size || imported.size > 2_000_000))
          throw Error("请选择≤2MB的Word结构化JSON稿。");
        const data = JSON.parse(jsonText !== null ? jsonText : await imported!.text());
        if (data.schemaVersion !== 1 || !Array.isArray(data.blocks))
          throw Error("文件不是Word V1结构化稿；完整校验在后台执行。");
        file = jsonText !== null ? new File([jsonText], "word-revised.json", { type: "application/json" }) : imported!;
      } else {
        if (!title.trim() || !source.trim() || !locator.trim())
          throw Error(
            "请填写标题、实际材料来源及定位。此处不自动读取未上传的原件。",
          );
        const blocks: WordBlock[] = [];
        let original = "";
        for (const section of wordSections[type]) {
          const text = drafts[`${type}:${section.role}`] || "";
          if (!text.trim())
            throw Error(
              `请填写“${section.title}”的实质内容；缺失事实请明确写待确认，不自动编造。`,
            );
          blocks.push({
            id: section.role,
            type: "heading",
            level: 1,
            role: section.role,
            text: section.title,
            refs: ["source-1"],
          });
          text
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .forEach((p, i) =>
              blocks.push({
                id: `${section.role}-${i}`,
                type: "paragraph",
                text: p,
                refs: ["source-1"],
              }),
            );
          original += section.title + "\n" + text + "\n\n";
        }
        if (table.trim()) {
          if (!caption.trim() || !scope.trim() || !calculation.trim())
            throw Error("添加表格需填写表题、字段/单位/范围口径和计算说明。");
          const [headers, ...rows] = table
            .replace(/\r\n/g, "\n")
            .split("\n")
            .filter((v) => v.trim())
            .map((v) => v.split("\t"));
          if (
            !headers ||
            headers.length < 2 ||
            headers.length > 8 ||
            !rows.length ||
            rows.length > 100 ||
            rows.some((r) => r.length !== headers.length)
          )
            throw Error(
              "表格须用制表符分列：首行2–8个表头，随后1–100行，列数一致。数字保持字符串，不计算公式。",
            );
          blocks.push({
            id: "user-table",
            type: "table",
            caption,
            headers,
            rows,
            scope,
            calculation,
            refs: ["source-1"],
          });
          original += [caption, table, scope, calculation].join("\n");
        }
        if (original.length > 20_000)
          throw Error(
            "本表单的来源原稿合计≤20000字；不会截断内容，请拆成独立文档或用多来源结构化稿。",
          );
        const d: WordDocument = {
          schemaVersion: 1,
          documentType: type,
          title,
          subtitle,
          sources: [{ id: "source-1", name: source, locator, text: original }],
          blocks,
        };
        file = new File([JSON.stringify(d)], "word-document.json", {
          type: "application/json",
        });
        if (file.size > 2_000_000)
          throw Error("请求超过2MB；请减少输入，不会静默截断。");
      }
      if (version !== generation.current) return;
      onPrepare(file);
      setMessage(
        `已在本地准备 ${file.name}，尚未上传。请另行勾选后台执行同意。`,
      );
    } catch (e) {
      if (version === generation.current)
        setError(e instanceof Error ? e.message : "准备失败。");
    }
  }
  return (
    <fieldset
      className="word-composer"
      disabled={disabled}
      aria-label="Word专业文稿准备"
    >
      <legend>Word专业文稿 · 原生排版与真实分页</legend>
      <p>
        本批不调用AI，不改写事实。两种类型有不同章节要求；真实页数由本地LibreOffice产生。草稿仅在当前页面，离开前请下载或执行保存。
      </p>
      <label>
        准备方式
        <select
          aria-label="准备方式"
          value={mode}
          onChange={(e) =>
            change(() => setMode(e.target.value as "form" | "json"))
          }
        >
          <option value="form">填写实际内容（不需要JSON）</option>
          <option value="json">载入结构化稿（保留表格、图片与来源）</option>
        </select>
      </label>
      <label>
        文档类型
        <select
          aria-label="文档类型"
          value={type}
          onChange={(e) => change(() => setType(e.target.value as WordType))}
        >
          <option value="business-report">商业报告 · 摘要/分析/建议</option>
          <option value="project-plan">
            项目方案 · 目标/范围/交付/风险/验收
          </option>
        </select>
      </label>
      {mode === "form" ? (
        <>
          <label>
            文档标题
            <input
              maxLength={100}
              value={title}
              onChange={(e) => change(() => setTitle(e.target.value))}
            />
          </label>
          <label>
            副标题（选填）
            <input
              maxLength={200}
              value={subtitle}
              onChange={(e) => change(() => setSubtitle(e.target.value))}
            />
          </label>
          <label>
            实际材料来源
            <input
              maxLength={120}
              placeholder="例如：自有项目纪要；不是未上传材料的已读声明"
              value={source}
              onChange={(e) => change(() => setSource(e.target.value))}
            />
          </label>
          <label>
            来源定位
            <input
              maxLength={240}
              placeholder="例如：2026年10月纪要第2–5段；或本人在此填写的原稿"
              value={locator}
              onChange={(e) => change(() => setLocator(e.target.value))}
            />
          </label>
          {wordSections[type].map((s) => (
            <label key={s.role}>
              {s.title}
              <textarea
                aria-label={s.title}
                maxLength={4000}
                rows={5}
                value={drafts[`${type}:${s.role}`] || ""}
                onChange={(e) =>
                  change(() =>
                    setDrafts((v) => ({
                      ...v,
                      [`${type}:${s.role}`]: e.target.value,
                    })),
                  )
                }
              />
            </label>
          ))}
          <details>
            <summary>添加原生表格（选填）</summary>
            <label>
              表题
              <input
                maxLength={120}
                value={caption}
                onChange={(e) => change(() => setCaption(e.target.value))}
              />
            </label>
            <label>
              表格内容（制表符分列，首行表头）
              <textarea
                rows={5}
                maxLength={8000}
                value={table}
                onChange={(e) => change(() => setTable(e.target.value))}
              />
            </label>
            <label>
              字段含义、单位和数据范围
              <textarea
                maxLength={500}
                value={scope}
                onChange={(e) => change(() => setScope(e.target.value))}
              />
            </label>
            <label>
              计算说明
              <input
                maxLength={500}
                value={calculation}
                onChange={(e) => change(() => setCalculation(e.target.value))}
              />
            </label>
          </details>
        </>
      ) : (
        <>
          <label>
            上传Word结构化JSON
            <input
              type="file"
              accept=".json"
              onChange={(e) =>
                change(() => { setImported(e.target.files?.[0] || null); setJsonText(null); })
              }
            />
          </label>
          {imported && jsonText === null && <button type="button" onClick={async () => {
            const version = ++generation.current;
            const raw = await imported.text();
            if (version === generation.current) change(() => setJsonText(raw));
          }}>编辑已载入的实际结构化稿</button>}
          {jsonText !== null && <label>实际Word结构化内容<textarea aria-label="实际Word结构化内容" rows={16} value={jsonText} onChange={e => change(() => setJsonText(e.target.value))} /></label>}
          <p>
            {imported
              ? `已选择 ${imported.name}；不覆盖导入文件内的文档类型和内容。`
              : "未选择文件。"}
          </p>
        </>
      )}
      <button type="button" onClick={example}>
        载入本类型原创示例（不上传、不执行）
      </button>
      <button type="button" onClick={() => void prepare()}>
        将Word文稿准备为输入
      </button>
      {imported && mode === "json" && (
        <button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(imported);
            const a = document.createElement("a");
            a.href = url;
            a.download = imported.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          下载当前结构化稿
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <small>
        修改后撤销已准备输入与执行同意。章节导航无自动目录页码；质量报告不代替人工/目标Word或WPS验收。含图片的高级稿可用结构化JSON载入，当前表单不提供旧Word导入或图片编辑器。
      </small>
    </fieldset>
  );
}
