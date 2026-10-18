/** Locales exposed by the General > Language setting. */
export const LOCALE_OPTIONS = [
  { value: "en", label: "English · en" },
  { value: "id", label: "Bahasa Indonesia · id" },
  { value: "de", label: "Deutsch · de" },
  { value: "zh-CN", label: "简体中文 · zh-CN" },
  { value: "zh-TW", label: "繁體中文 · zh-TW" },
  { value: "pt-BR", label: "Português (Brasil) · pt-BR" },
  { value: "es-ES", label: "Español (España) · es-ES" },
  { value: "ru", label: "Русский · ru" },
  { value: "fa", label: "فارسی · fa" },
  { value: "ar", label: "العربية · ar" },
  { value: "ja", label: "日本語 · ja" },
  { value: "ko", label: "한국어 · ko" },
  { value: "pl", label: "Polski · pl" },
  { value: "hu", label: "Magyar · hu" },
  { value: "fr", label: "Français · fr" },
  { value: "uk", label: "Українська · uk" },
  { value: "tr", label: "Türkçe · tr" },
  { value: "th", label: "ภาษาไทย · th" },
  { value: "it", label: "Italiano · it" },
] as const;

export type Locale = (typeof LOCALE_OPTIONS)[number]["value"];

const localeCodes = new Set<string>(LOCALE_OPTIONS.map(({ value }) => value));

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && localeCodes.has(value);
}
