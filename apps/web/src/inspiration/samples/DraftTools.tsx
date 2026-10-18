import "./DraftTools.css";
import { useRef, useState } from "react";
import { useSampleState, type SampleId } from "./shared";
/** Shared persistence/history infrastructure only; each template owns its content, layout and validation. */
export function useDraftTools<S extends { page: number }>(
  id: SampleId,
  draft: string | undefined,
  initial: S,
  restore: (v: unknown) => S,
) {
  const [state, set, error] = useSampleState(id, draft, initial),
    [notice, msg] = useState(""),
    [name, setName] = useState("");
  const undo = useRef<S[]>([]),
    redo = useRef<S[]>([]),
    key = `designbuddy.${id}.versions.${draft || "sample"}`;
  const [versions, setVersions] = useState<{ name: string; state: S }[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > 500000) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v)
        ? v
            .filter((x) => x && typeof x.name === "string" && x.state)
            .slice(0, 6)
            .map((x) => ({
              name: x.name.slice(0, 40),
              state: restore(x.state),
            }))
        : [];
    } catch {
      return [];
    }
  });
  function patch(p: Partial<S>) {
    undo.current = [...undo.current, state].slice(-40);
    redo.current = [];
    set({ ...state, ...p });
    msg("");
  }
  const controls = (
    <div className="draft-history">
      <span>{error ? "本机保存失败" : "本机自动保存"}</span>
      <button
        disabled={!undo.current.length}
        onClick={() => {
          const p = undo.current.pop();
          if (p) {
            redo.current.push(state);
            set({ ...p, page: state.page });
          }
        }}
      >
        撤销
      </button>
      <button
        disabled={!redo.current.length}
        onClick={() => {
          const p = redo.current.pop();
          if (p) {
            undo.current.push(state);
            set({ ...p, page: state.page });
          }
        }}
      >
        重做
      </button>
      <input
        aria-label="版本名称"
        value={name}
        maxLength={40}
        placeholder="版本名称"
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => {
          if (!name.trim()) {
            msg("请填写版本名称。");
            return;
          }
          const next = [
            { name: name.trim(), state: structuredClone(state) },
            ...versions,
          ].slice(0, 6);
          try {
            localStorage.setItem(key, JSON.stringify(next));
            setVersions(next);
            setName("");
            msg("命名版本已保存到本机。");
          } catch {
            msg("版本保存失败，请导出项目备份。");
          }
        }}
      >
        保存版本
      </button>
      <select
        aria-label="恢复命名版本"
        value=""
        onChange={(e) => {
          const v = versions[+e.target.value];
          if (v && confirm("恢复版本将替换当前草稿，是否继续？"))
            patch(structuredClone(v.state));
        }}
      >
        <option value="">恢复版本（{versions.length}/6）</option>
        {versions.map((v, i) => (
          <option key={i} value={i}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
  return {
    state,
    patch,
    go: (page: number) => set({ ...state, page }),
    error,
    notice,
    msg,
    controls,
  };
}
