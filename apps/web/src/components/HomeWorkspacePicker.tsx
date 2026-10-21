import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HomeIcon } from "./HomeIcon";

export type SpaceOption = {
  /** The workspace name written onto the task. */
  value: string;
  label: string;
  /** Role badge, e.g. 「所有者」 for a team space. */
  meta?: string;
};

type Props = {
  /** The currently selected workspace name. */
  value: string;
  /** What the trigger shows — a placeholder until something is picked. */
  display: string;
  /** Where the task will really be saved. */
  storageHint: string;
  spaces: SpaceOption[];
  onSelect: (name: string) => void;
  onNewSpace: () => void;
  onOpenFolder: () => void;
};

/**
 * The workspace picker under the input.
 *
 * A native <select> could not show where the task is actually saved or offer
 * the two actions that belong next to it (create a space, work from a local
 * folder), so this is a small menu anchored above its trigger. It stays a
 * disclosure: one button, one list, Escape closes, arrows walk the list.
 */
export function HomeWorkspacePicker({ value, display, storageHint, spaces, onSelect, onNewSpace, onOpenFolder }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const actions = [
    { key: "new", label: "新建工作空间", icon: "plus" as const, run: onNewSpace },
    { key: "folder", label: "打开本地文件夹", icon: "folder" as const, run: onOpenFolder },
  ];
  const rows = [
    ...spaces.map((space) => ({
      key: `space:${space.value}`,
      label: space.label,
      meta: space.meta,
      icon: space.value === "个人空间" ? ("document" as const) : ("folder" as const),
      checked: space.value === value,
      run: () => onSelect(space.value),
    })),
    ...actions.map((action) => ({
      key: action.key,
      label: action.label,
      meta: undefined,
      icon: action.icon,
      checked: false,
      run: action.run,
    })),
  ];

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, rows.findIndex((row) => row.checked)));
    const onPointer = (event: MouseEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape works from anywhere, including while the trigger still has focus.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Open with the current workspace already focused, so the menu is usable
  // without reaching for the mouse.
  useLayoutEffect(() => {
    if (!open) return;
    const node =
      list.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]') ??
      list.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]');
    node?.focus({ preventScroll: true });
  }, [open]);

  const focusRow = (index: number) => {
    const nodes = list.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]');
    if (!nodes?.length) return;
    const next = (index + nodes.length) % nodes.length;
    setCursor(next);
    nodes[next].focus({ preventScroll: true });
  };

  return (
    <div className="workspace-picker" ref={host}>
      <button
        ref={trigger}
        type="button"
        className="workspace-trigger"
        aria-label="工作空间"
        aria-haspopup="menu"
        aria-expanded={open}
        title={storageHint}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <HomeIcon name="folder" size={14} />
        <span>{display}</span>
        <HomeIcon name="chevron" size={10} />
      </button>

      {open && (
        <div
          ref={list}
          className="workspace-menu"
          role="menu"
          aria-label="工作空间"
          onKeyDown={(event) => {
            const index = rows.findIndex((row) => row.key === (event.target as HTMLElement).dataset.row);
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              focusRow(index + 1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusRow(index - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusRow(0);
            } else if (event.key === "End") {
              event.preventDefault();
              focusRow(rows.length - 1);
            }
          }}
        >
          <p className="workspace-menu-title">任务保存到</p>
          {rows.map((row, index) => (
            <Fragment key={row.key}>
              {index === spaces.length && <div className="workspace-menu-sep" role="separator" />}
              <button
                type="button"
                role={index < spaces.length ? "menuitemradio" : "menuitem"}
                aria-checked={index < spaces.length ? row.checked : undefined}
                data-row={row.key}
                className={`workspace-menu-item${row.checked ? " is-checked" : ""}${index < spaces.length ? "" : " is-action"}`}
                onClick={() => {
                  close();
                  row.run();
                }}
              >
                <span className="workspace-menu-icon" aria-hidden="true">
                  <HomeIcon name={row.icon ?? "folder"} size={14} />
                </span>
                <span className="workspace-menu-text">
                  <strong>{row.label}</strong>
                  {row.meta && <small>{row.meta}</small>}
                </span>
                {row.checked && (
                  <span className="workspace-menu-check" aria-hidden="true">
                    <HomeIcon name="check" size={13} />
                  </span>
                )}
              </button>
            </Fragment>
          ))}

          <p className="workspace-menu-note">{storageHint}</p>
        </div>
      )}
    </div>
  );
}
