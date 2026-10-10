export type Locale = "zh-CN" | "en";
export const LOCALE_KEY: string;
export const locale: Locale;
export const isChinese: boolean;
export function readLocale(storage?: Pick<Storage, "getItem">): Locale;
export function saveLocale(
  locale: Locale,
  storage?: Pick<Storage, "getItem" | "setItem">,
): void;
