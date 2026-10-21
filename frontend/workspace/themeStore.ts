import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import catalog from "../../themes/catalog.json";
import {
  DEFAULT_DECK_THEME,
  cloneTheme,
  newThemeId,
  validateDeckTheme,
  type DeckTheme,
  type ThemeWarning,
} from "../../shared/deckTheme";

/**
 * Deck themes available to this browser.
 *
 * Presets ship with the app and are read-only. Custom themes live in
 * localStorage today; the API contract for syncing them is in
 * docs/theme-system/主题方案.md (§8). Nothing here touches a deck until the
 * caller explicitly applies it.
 */

export const PRESET_THEMES = catalog as unknown as DeckTheme[];

const validation = PRESET_THEMES.map((theme) => validateDeckTheme(theme));
if (validation.some((result) => !result.ok)) {
  // A malformed preset is a build error, not something to paper over at runtime:
  // the gallery would silently show a theme the editor cannot reproduce.
  console.error("[themes] preset catalog failed validation", validation.filter((result) => !result.ok));
}
if (import.meta.env?.DEV) {
  const warnings = validation.flatMap((result, index) =>
    result.ok ? result.warnings.map((warning) => `${PRESET_THEMES[index].id}: ${warning.message}`) : [],
  );
  if (warnings.length) console.warn("[themes] accessibility warnings", warnings);
}

type ThemeState = {
  custom: DeckTheme[];
  defaultThemeId: string | null;
  saveCustom(theme: DeckTheme): { ok: true; theme: DeckTheme; warnings: ThemeWarning[] } | { ok: false; errors: string[] };
  removeCustom(id: string): void;
  setDefault(id: string | null): void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      custom: [],
      defaultThemeId: null,
      saveCustom(input) {
        const result = validateDeckTheme(input);
        if (!result.ok) return result;
        const theme = { ...result.theme, kind: "custom" as const };
        const existing = get().custom;
        const index = existing.findIndex((item) => item.id === theme.id);
        const next = index >= 0 ? existing.map((item, i) => (i === index ? theme : item)) : [...existing, theme];
        set({ custom: next });
        return { ok: true, theme, warnings: result.warnings };
      },
      removeCustom(id) {
        set((state) => ({
          custom: state.custom.filter((theme) => theme.id !== id),
          defaultThemeId: state.defaultThemeId === id ? null : state.defaultThemeId,
        }));
      },
      setDefault(id) {
        set({ defaultThemeId: id });
      },
    }),
    {
      name: "designbuddy.themes.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ custom: state.custom, defaultThemeId: state.defaultThemeId }),
      // A theme saved by an older build may not match today's schema.
      merge: (persisted, current) => {
        const saved = persisted as Partial<ThemeState> | undefined;
        const custom = Array.isArray(saved?.custom)
          ? saved.custom
              .map((theme) => validateDeckTheme(theme))
              .filter((result): result is { ok: true; theme: DeckTheme; warnings: ThemeWarning[] } => result.ok)
              .map((result) => result.theme)
          : [];
        return { ...current, custom, defaultThemeId: saved?.defaultThemeId ?? null };
      },
    },
  ),
);

export function allThemes(): DeckTheme[] {
  return [...PRESET_THEMES, ...useThemeStore.getState().custom];
}

export function findTheme(id: string | undefined | null): DeckTheme | undefined {
  if (!id) return undefined;
  return allThemes().find((theme) => theme.id === id);
}

/**
 * The theme a deck should render with.
 *
 * Decks created before themes existed have no `themeId`; they were drawn with
 * exactly the colours of the default theme, so they fall back to it and look
 * unchanged. The narrative framework's own palette is only ever shown in the
 * outline picker — it never coloured a deck — so it is deliberately not used
 * here.
 */
export function resolveDeckTheme(themeId: string | undefined): DeckTheme {
  return (
    findTheme(themeId) ??
    findTheme(useThemeStore.getState().defaultThemeId) ??
    PRESET_THEMES[0] ??
    DEFAULT_DECK_THEME
  );
}

export function duplicateTheme(theme: DeckTheme, name = `${theme.name} 副本`): DeckTheme {
  return cloneTheme(theme, {
    id: newThemeId(),
    name,
    kind: "custom",
    tags: [...theme.tags.slice(0, 4), "自定义"],
  });
}

/** A blank custom theme based on the current default, for "新建主题". */
export function blankTheme(name = "我的主题"): DeckTheme {
  const base = findTheme(useThemeStore.getState().defaultThemeId) ?? PRESET_THEMES[0] ?? DEFAULT_DECK_THEME;
  return cloneTheme(base, { id: newThemeId(), name, kind: "custom", tags: ["自定义"] });
}
