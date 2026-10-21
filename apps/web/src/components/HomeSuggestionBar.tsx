import { useMemo, useState } from "react";
import { HomeIcon } from "./HomeIcon";
import type { HomeMode, HomeShortcut } from "./homeScenes";
import { allPromptTasks, readPromptUsage, recommendPrompts, recordPromptUse } from "./promptLibrary";

/**
 * The three examples under the input, and the way back to recent work.
 *
 * This replaces the old 6-row recommendation list and the 9-row "更多场景"
 * disclosure: the same catalogue, three at a time, re-ranked as the draft
 * changes. Nothing is sent anywhere — ranking is local (`recommendPrompts`).
 */

type SuggestionProps = {
  mode: HomeMode;
  prompt: string;
  onSelect: (scene: Pick<HomeShortcut, "mode" | "prompt" | "title">) => boolean;
};

export function HomeSuggestionBar({ mode, prompt, onSelect }: SuggestionProps) {
  // Ids already shown in this session, so 「换一批」 never repeats itself.
  const [seen, setSeen] = useState<string[]>([]);
  const [round, setRound] = useState(1);

  const tasks = useMemo(() => allPromptTasks.filter((task) => task.mode === mode), [mode]);
  const batch = useMemo(
    () => recommendPrompts(tasks, prompt, readPromptUsage(), seen, [], 3),
    [tasks, prompt, seen],
  );

  if (batch.length === 0) return null;

  return (
    <section className="home-suggestion-bar" aria-label="示例任务">
      {batch.map((task) => (
        <button
          key={task.id}
          type="button"
          className="home-suggestion"
          aria-label={`使用提示词：${task.title}`}
          title={task.description}
          onClick={() => {
            if (onSelect({ mode: task.mode, prompt: task.prompt, title: task.title })) {
              recordPromptUse(task.id);
              setSeen((prev) => [...prev, task.id]);
            }
          }}
        >
          <HomeIcon name="bolt" size={13} />
          <span>{task.title}</span>
        </button>
      ))}
      <button
        type="button"
        className="home-suggestion-refresh"
        aria-label="换一批"
        title="换一批示例"
        onClick={() => {
          setSeen((prev) => [...prev, ...batch.map((task) => task.id)]);
          setRound((value) => value + 1);
        }}
      >
        <HomeIcon name="refresh" size={13} />
      </button>
      <span className="home-sr-only" role="status">
        第 {round} 批示例，共 {batch.length} 条。
      </span>
    </section>
  );
}

export type RecentItem = {
  id: string;
  title: string;
  kind: "project" | "deck";
  updatedAt: string;
};

/** Up to three recent items; renders nothing on a brand-new account. */
export function HomeRecent({ items, onOpen, onAll }: {
  items: RecentItem[];
  onOpen: (item: RecentItem) => void;
  onAll: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="home-recent" aria-label="最近">
      <header>
        <h2>最近</h2>
        <button type="button" onClick={onAll}>全部 <span aria-hidden="true">→</span></button>
      </header>
      <ul>
        {items.slice(0, 3).map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <button type="button" onClick={() => onOpen(item)}>
              <span className="home-recent-icon" aria-hidden="true">
                <HomeIcon name={item.kind === "deck" ? "slides" : "document"} size={14} />
              </span>
              <span className="home-recent-body">
                <strong>{item.title}</strong>
                <small>
                  {item.kind === "deck" ? "演示稿" : "任务"} · {relativeTime(item.updatedAt)}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "刚刚";
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(time).toLocaleDateString();
}
