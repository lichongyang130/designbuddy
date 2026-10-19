import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
/** Raster-only PDF.js preview. Does not run PDF JavaScript, open links or claim Office fidelity. */
export default function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [doc, setDoc] = useState<any>(null),
    [page, setPage] = useState(1),
    [count, setCount] = useState(0),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(true);
  useEffect(() => {
    let stopped = false,
      task: any;
    setDoc(null);
    setCount(0);
    setPage(1);
    setError("");
    setRendering(true);
    void (async () => {
      const pdf = await import("pdfjs-dist");
      if (stopped) return;
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      const res = await fetch(url);
      if (!res.ok) throw Error(`PDF读取失败：${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.length > 10_000_000) throw Error("PDF预览超过10MB。");
      task = pdf.getDocument({ data, enableXfa: false, useSystemFonts: false });
      const loaded = await task.promise;
      if (stopped) return;
      setDoc(loaded);
      setCount(loaded.numPages);
    })().catch((e) => {
      if (!stopped) {
        setError(e.message || "PDF预览失败，请下载后检查。");
        setRendering(false);
      }
    });
    return () => {
      stopped = true;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let stopped = false,
      renderTask: any;
    setRendering(true);
    setError("");
    void (async () => {
      const p = await doc.getPage(page);
      if (stopped) return;
      const viewport = p.getViewport({ scale: 1.25 }),
        el = canvas.current!;
      el.width = viewport.width;
      el.height = viewport.height;
      renderTask = p.render({
        canvasContext: el.getContext("2d")!,
        canvas: el,
        viewport,
      });
      await renderTask.promise;
      if (!stopped) setRendering(false);
    })().catch((e) => {
      if (!stopped) {
        setError(e.message);
        setRendering(false);
      }
    });
    return () => {
      stopped = true;
      renderTask?.cancel();
    };
  }, [doc, page]);
  return (
    <section className="pdf-real-preview" aria-label="实际PDF页面预览">
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          disabled={page <= 1 || rendering}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页PDF
        </button>
        <span role="status">
          {count ? `PDF 第 ${page} / ${count} 页` : "正在读取PDF…"}
          {rendering && count ? " · 渲染中" : ""}
        </span>
        <button
          type="button"
          disabled={page >= count || rendering}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页PDF
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={canvas}
        aria-label="PDF实际页面"
        style={{
          display: count ? "block" : "none",
          maxWidth: "100%",
          height: "auto",
          background: "white",
          margin: "0 auto",
        }}
      />
      <small>
        PDF.js显示实际PDF；不是目标Word/WPS客户端的版式验收。不执行PDF脚本或链接。
      </small>
    </section>
  );
}
