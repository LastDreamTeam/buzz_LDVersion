import { readFileSync } from "node:fs";

export function flattenCatalog(value, prefix = "", result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result.set(path, child);
    else if (child && typeof child === "object" && !Array.isArray(child))
      flattenCatalog(child, path, result);
    else throw new Error(`Invalid translation leaf: ${path}`);
  }
  return result;
}

function variables(text) {
  return [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(
    (match) => match[1],
  );
}

// OpenAI: adapt display terminology, never source values or protocol fields.
export function localTerminology(english, chinese) {
  let value = chinese;
  if (
    /\bthreads?\b/i.test(english) &&
    !/\b(cpu|hardware|worker|process)\b/i.test(english)
  ) {
    value = value.replaceAll("讨论串", "话题").replaceAll("线程", "话题");
  }
  if (/\bhuddles?\b/i.test(english))
    value = value
      .replaceAll("小聚", "语音会议")
      .replaceAll("语音聚会", "语音会议")
      .replace(/\bHuddles?\b/gi, "语音会议");
  if (/\bharness(?:es)?\b/i.test(english))
    value = value.replaceAll("运行框架", "运行器");
  if (/\bruntimes?\b/i.test(english))
    value = value
      .replaceAll("运行器", "运行环境")
      .replaceAll("运行时", "运行环境");
  if (/\bproviders?\b/i.test(english))
    value = value.replaceAll("提供方", "服务商");
  if (/\bdirect messages?\b/i.test(english))
    value = value.replaceAll("私信", "私聊");
  // Canvas here is a Markdown document; drawing/annotation canvases retain their name.
  if (
    /\bcanvas(?:es)?\b/i.test(english) &&
    !/\b(draw|drawing|annotation|annotate|paint|painting)\b/i.test(english)
  ) {
    value = value.replaceAll("画布", "共享文档");
  }
  return value;
}

export function buildReferenceCatalog(en, zh) {
  const english = flattenCatalog(en);
  const chinese = flattenCatalog(zh);
  if (
    english.size !== chinese.size ||
    [...english.keys()].some((key) => !chinese.has(key))
  ) {
    throw new Error("Reference locale key parity failed");
  }
  const candidates = new Map();
  const skipped = [];
  for (const [key, original] of english) {
    const translated = chinese.get(key);
    if (!translated.trim())
      throw new Error(`Empty reference translation: ${key}`);
    const names = variables(original);
    const translatedNames = variables(translated);
    if (
      JSON.stringify([...names].sort()) !==
      JSON.stringify([...translatedNames].sort())
    ) {
      throw new Error(`Reference placeholder parity failed: ${key}`);
    }
    // OpenAI: no fuzzy matches, parameter reordering, repeated interpolation or markup inference.
    if (
      new Set(names).size !== names.length ||
      JSON.stringify(names) !== JSON.stringify(translatedNames) ||
      /<[A-Za-z/][^>]*>/.test(original + translated)
    ) {
      skipped.push(key);
      continue;
    }
    const normalize = (text) => text.trim().replace(/\s+/g, " ");
    const numberVariables = (text) =>
      text.replace(
        /\{\{\s*([\w.-]+)\s*\}\}/g,
        (_, name) => `{{${names.indexOf(name)}}}`,
      );
    const lookup = normalize(numberVariables(original));
    const localized = numberVariables(localTerminology(original, translated));
    const entries = candidates.get(lookup) ?? new Set();
    entries.add(localized);
    candidates.set(lookup, entries);
  }
  const catalog = Object.create(null);
  const ambiguous = [];
  for (const [key, values] of candidates) {
    if (values.size !== 1) {
      ambiguous.push(key);
      continue;
    }
    const [value] = values;
    if (value !== key) catalog[key] = value;
  }
  return { catalog, leafKeys: english.size, ambiguous, skipped };
}

// These are licensed, pinned data files; no code from the reference PR is executed.
export const reference = buildReferenceCatalog(
  JSON.parse(
    readFileSync(
      new URL("./vendor/asterracy/en.json", import.meta.url),
      "utf8",
    ),
  ),
  JSON.parse(
    readFileSync(
      new URL("./vendor/asterracy/zh-Hans.json", import.meta.url),
      "utf8",
    ),
  ),
);
