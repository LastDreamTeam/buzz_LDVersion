// OpenAI: an LD-only device preference; never changes identity or community data.
export const LOCALE_KEY = "ld.buzz.uiLocale";
export function readLocale(storage) {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem(LOCALE_KEY);
    return value === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
export function saveLocale(locale, storage) {
  if (!["zh-CN", "en"].includes(locale))
    throw new Error("Unsupported LD locale");
  const target = storage ?? globalThis.localStorage;
  target.setItem(LOCALE_KEY, locale);
  if (target.getItem(LOCALE_KEY) !== locale)
    throw new Error("Language preference was not saved");
}
export const locale = readLocale();
export const isChinese = locale === "zh-CN";
if (typeof document !== "undefined") document.documentElement.lang = locale;
