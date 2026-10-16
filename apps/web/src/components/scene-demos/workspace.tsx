import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
export type SceneData = Record<string, any>;
export type SceneVersion = {
  id: string;
  name: string;
  at: string;
  data: SceneData;
};
type Snapshot = {
  data: SceneData;
  versions: SceneVersion[];
  status: string;
  error: string;
  canUndo: boolean;
  canRedo: boolean;
  conflict: boolean;
};
export const SCENE_PREFIX = "designbuddy.scene-workspace.v1.";
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export class SceneSession {
  private listeners = new Set<() => void>();
  private defaults: SceneData = {};
  private past: SceneData[] = [];
  private future: SceneData[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private lastKey = "";
  private groupOpen = false;
  private lastTime = 0;
  private diskValue: string | null = null;
  private disposed = false;
  private dirty = false;
  private blocked = false;
  private state: Snapshot = {
    data: {},
    versions: [],
    status: "示例 · 尚未修改",
    error: "",
    canUndo: false,
    canRedo: false,
    conflict: false,
  };
  readonly key: string;
  constructor(readonly sceneId: string) {
    this.key = SCENE_PREFIX + sceneId;
    try {
      this.diskValue = localStorage.getItem(this.key);
      if (this.diskValue) {
        const value = JSON.parse(this.diskValue);
        if (
          value.schema !== 1 ||
          !value.data ||
          typeof value.data !== "object" ||
          Array.isArray(value.data)
        )
          throw new Error();
        this.state = {
          ...this.state,
          data: value.data,
          versions: Array.isArray(value.versions)
            ? value.versions
                .filter(
                  (v: any) =>
                    typeof v?.id === "string" &&
                    typeof v.name === "string" &&
                    typeof v.at === "string" &&
                    v.data &&
                    typeof v.data === "object",
                )
                .slice(-10)
            : [],
          status: "已恢复本地作品",
        };
      }
    } catch {
      this.blocked = true;
      this.state.error =
        "保存内容无法读取，正在显示示例；原存储未覆盖。请先导出当前作品或检查浏览器存储。";
    }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: Partial<Snapshot>) {
    this.state = {
      ...this.state,
      ...next,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    this.listeners.forEach((listener) => listener());
  }
  ensure(key: string, initial: any) {
    if (!(key in this.defaults)) this.defaults[key] = copy(initial);
    if (!(key in this.state.data)) this.state.data[key] = copy(initial);
    const matches = (value: any, example: any): boolean => {
      if (example === null) return true;
      if (Array.isArray(example))
        return (
          Array.isArray(value) &&
          value.length <= 2000 &&
          (!example.length || value.every((v) => matches(v, example[0])))
        );
      if (typeof example === "object")
        return (
          !!value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(example).every((k) => matches(value[k], example[k]))
        );
      return (
        typeof value === typeof example &&
        (typeof value !== "number" || Number.isFinite(value))
      );
    };
    if (!matches(this.state.data[key], initial)) {
      this.state.data[key] = copy(initial);
      this.blocked = true;
      const error = `保存字段“${key}”格式不兼容，正在显示默认值，原存储未覆盖。请备份后重新开始。`;
      this.state.error = error;
      queueMicrotask(() => this.publish({ error, status: "存储格式不兼容" }));
    }
  }
  set(key: string, value: any) {
    const now = Date.now();
    if (JSON.stringify(this.state.data[key]) === JSON.stringify(value)) return;
    if (
      !this.groupOpen &&
      (this.lastKey !== key || now - this.lastTime > 650)
    ) {
      this.past.push(copy(this.state.data));
      this.past = this.past.slice(-60);
    }
    this.dirty = true;
    this.groupOpen = true;
    queueMicrotask(() => {
      this.groupOpen = false;
    });
    this.lastKey = key;
    this.lastTime = now;
    this.future = [];
    this.publish({
      data: { ...this.state.data, [key]: value },
      status: "正在保存…",
    });
    this.schedule();
  }
  transaction(values: SceneData) {
    this.dirty = true;
    this.past.push(copy(this.state.data));
    this.past = this.past.slice(-60);
    this.future = [];
    this.lastKey = "";
    this.publish({
      data: { ...this.state.data, ...values },
      status: "正在保存…",
    });
    this.schedule();
  }
  undo = () => {
    const data = this.past.pop();
    if (!data) return;
    this.dirty = true;
    this.future.push(copy(this.state.data));
    this.lastKey = "";
    this.publish({ data, status: "已撤销 · 正在保存…" });
    this.schedule();
  };
  redo = () => {
    const data = this.future.pop();
    if (!data) return;
    this.dirty = true;
    this.past.push(copy(this.state.data));
    this.lastKey = "";
    this.publish({ data, status: "已重做 · 正在保存…" });
    this.schedule();
  };
  reset = () => {
    this.transaction(copy(this.defaults));
  };
  private schedule() {
    clearTimeout(this.timer);
    if (!this.disposed) this.timer = setTimeout(() => this.save(), 450);
  }
  save = (): boolean => {
    clearTimeout(this.timer);
    if (this.blocked) {
      this.publish({
        status: "未保存",
        error: "原存储无法读取，已暂停覆盖。请下载原存储备份，再选择重新开始。",
      });
      return false;
    }
    try {
      if (localStorage.getItem(this.key) !== this.diskValue) {
        this.publish({
          error:
            "此作品已在另一标签页更新。为避免覆盖，已暂停保存。请导出当前草稿，再载入其他标签页的内容。",
          status: "保存冲突",
          conflict: true,
        });
        return false;
      }
      const serialized = JSON.stringify({
        schema: 1,
        sceneId: this.sceneId,
        at: new Date().toISOString(),
        data: this.state.data,
        versions: this.state.versions,
      });
      localStorage.setItem(this.key, serialized);
      this.diskValue = serialized;
      this.dirty = false;
      this.publish({ status: "已保存到此浏览器", error: "", conflict: false });
      return true;
    } catch {
      this.publish({
        error:
          "本地保存失败，可能是存储空间或权限不足。草稿仍在当前窗口中，可导出作品 JSON 后再关闭。",
        status: "未保存",
      });
      return false;
    }
  };
  checkpoint(name: string) {
    this.lastKey = "";
    this.groupOpen = false;
    const version = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 60) || "未命名版本",
      at: new Date().toISOString(),
      data: copy(this.state.data),
    };
    const old = this.state.versions;
    if (old.length >= 10) {
      this.publish({
        error: "最多保留 10 个命名版本，请先导出或删除不需要的版本。",
      });
      return false;
    }
    this.publish({ versions: [...old, version] });
    if (!this.save()) {
      this.publish({ versions: old });
      return false;
    }
    return true;
  }
  restore(version: SceneVersion) {
    this.transaction(copy(version.data));
  }
  removeVersion(id: string) {
    const old = this.state.versions;
    this.publish({ versions: old.filter((v) => v.id !== id) });
    if (!this.save()) this.publish({ versions: old });
  }
  reloadFromDisk() {
    clearTimeout(this.timer);
    this.lastKey = "";
    const fresh = new SceneSession(this.sceneId);
    if (fresh.state.error) {
      this.publish({ error: fresh.state.error });
      return;
    }
    this.past.push(copy(this.state.data));
    this.future = [];
    this.blocked = false;
    this.diskValue = fresh.diskValue;
    this.publish({
      ...fresh.state,
      data: { ...copy(this.defaults), ...fresh.state.data },
    });
  }
  recoverCorrupt() {
    this.blocked = false;
    try {
      this.diskValue = localStorage.getItem(this.key);
    } catch {
      /* save reports permissions */
    }
    this.reset();
  }
  isBlocked() {
    return this.blocked;
  }
  rawBackup() {
    return this.diskValue || "";
  }
  dispose() {
    if (this.dirty) this.save();
    clearTimeout(this.timer);
    this.disposed = true;
  }
  activate() {
    this.disposed = false;
  }
}
export const SceneSessionContext = createContext<SceneSession | null>(null);
const noopSubscribe = () => () => {};
const empty: SceneData = {};
export function useSceneState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const session = useContext(SceneSessionContext);
  const [local, setLocal] = useState<T>(initial);
  const initialRef = useRef(local);
  session?.ensure(key, initialRef.current);
  const data = useSyncExternalStore(
    session?.subscribe || noopSubscribe,
    session ? () => session.getSnapshot().data : () => empty,
  );
  const value = session ? (data[key] as T) : local;
  const set: Dispatch<SetStateAction<T>> = (next) => {
    if (!session) {
      setLocal(next);
      return;
    }
    const current = session.getSnapshot().data[key] as T;
    session.set(
      key,
      typeof next === "function" ? (next as (v: T) => T)(current) : next,
    );
  };
  return [value, set];
}
export function useSceneSession() {
  return useContext(SceneSessionContext);
}
