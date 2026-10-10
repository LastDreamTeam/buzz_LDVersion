import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultCatalog = JSON.parse(
  readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8"),
);
const reviewedLabelFiles = JSON.parse(
  readFileSync(new URL("./reviewed-label-files.json", import.meta.url), "utf8"),
);
const reviewedLiterals = JSON.parse(
  readFileSync(new URL("./reviewed-literals.json", import.meta.url), "utf8"),
);
const displayAttributes = new Set([
  "title",
  "aria-label",
  "placeholder",
  "alt",
  "label",
  "description",
  "tooltip",
  "heading",
  "subheading",
  "emptyMessage",
  "buttonLabel",
]);

// OpenAI: only literal display positions; never translate arbitrary data or protocol values.
function isDisplayExpression(node) {
  const parent = node.parent;
  if (ts.isJsxExpression(parent)) {
    return (
      !ts.isJsxAttribute(parent.parent) ||
      displayAttributes.has(parent.parent.name.getText())
    );
  }
  if (ts.isParenthesizedExpression(parent)) return isDisplayExpression(parent);
  if (ts.isConditionalExpression(parent) && parent.condition !== node)
    return isDisplayExpression(parent);
  if (
    ts.isBinaryExpression(parent) &&
    parent.right === node &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return isDisplayExpression(parent);
  }
  return false;
}

function jsxText(text) {
  // OpenAI: React's JSX whitespace convention; preserve intentional inline separators.
  return text
    .split(/\r\n|\n|\r/)
    .map((line, index, lines) => {
      let value = line.replace(/\t/g, " ");
      if (index > 0) value = value.replace(/^ +/, "");
      if (index < lines.length - 1) value = value.replace(/ +$/, "");
      return value;
    })
    .filter(Boolean)
    .join(" ");
}

export function displayLiterals(source, filename) {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fileOverrides =
    Object.entries(reviewedLiterals).find(([file]) =>
      filename.replaceAll("\\", "/").endsWith(`/src/${file}`),
    )?.[1] ?? {};
  const entries = [];
  function walk(node) {
    let text;
    let context;
    let expressions;
    if (ts.isTemplateExpression(node)) {
      text = node.head.text;
      expressions = node.templateSpans.map((span, index) => {
        text += `{{${index}}}` + span.literal.text;
        return span.expression.getText(tree);
      });
      if (isDisplayExpression(node) || Object.hasOwn(fileOverrides, text))
        context = "template";
      else text = undefined;
    }
    if (ts.isJsxText(node)) {
      text = jsxText(node.text);
      context = "jsx-text";
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      if (Object.hasOwn(fileOverrides, node.text)) {
        text = node.text;
        context = "expression";
      } else if (
        ts.isJsxAttribute(node.parent) &&
        displayAttributes.has(node.parent.name.getText())
      ) {
        text = node.text;
        context = "attribute";
      } else if (isDisplayExpression(node)) {
        text = node.text;
        context = "expression";
      } else if (
        ts.isPropertyAssignment(node.parent) &&
        node.parent.name.getText() === "label" &&
        reviewedLabelFiles.some((file) =>
          filename.replaceAll("\\", "/").endsWith(`/src/${file}`),
        )
      ) {
        text = node.text;
        context = "expression";
      }
    }
    if (text && /[A-Za-z]/.test(text)) {
      const key = text.trim().replace(/\s+/g, " ");
      entries.push({
        key,
        text,
        context,
        expressions,
        override: fileOverrides[key],
        start: node.getStart(tree),
        end: node.end,
      });
      // OpenAI: whole templates own their span; don't apply overlapping inner replacements.
      if (context === "template") return;
    }
    ts.forEachChild(node, walk);
  }
  walk(tree);
  return entries;
}

export function localizeSource(
  source,
  filename,
  catalog = defaultCatalog,
  runtime = false,
) {
  let output = source;
  const entries = displayLiterals(source, filename);
  for (const entry of [...entries].reverse()) {
    const translated = entry.override ?? catalog[entry.key];
    if (typeof translated !== "string" || !translated) continue;
    const padded =
      (entry.text.startsWith(" ") ? " " : "") +
      translated +
      (entry.text.endsWith(" ") ? " " : "");
    const literal = JSON.stringify(padded);
    let replacement = entry.context === "expression" ? literal : `{${literal}}`;
    if (entry.context === "template") {
      const markers = [...translated.matchAll(/\{\{(\d+)\}\}/g)].map((match) =>
        Number(match[1]),
      );
      if (
        JSON.stringify(markers) !==
        JSON.stringify(entry.expressions.map((_, index) => index))
      ) {
        throw new Error(
          `LD translation changed placeholder order/count: ${entry.key}`,
        );
      }
      const escaped = translated
        .replaceAll("\\", "\\\\")
        .replaceAll("`", "\\`")
        .replaceAll("${", "\\${");
      replacement =
        "`" +
        escaped.replace(
          /\{\{(\d+)\}\}/g,
          (_, index) => "${" + entry.expressions[Number(index)] + "}",
        ) +
        "`";
    }
    if (runtime) {
      // OpenAI: select one branch, so dynamic expressions are never evaluated twice.
      const original = source.slice(entry.start, entry.end);
      const english =
        entry.context === "jsx-text" ? `<>${original}</>` : original;
      if (
        entry.context === "attribute" &&
        /&(?:#\d+|#x[\da-f]+|\w+);/i.test(entry.text)
      )
        continue;
      const chinese = entry.context === "template" ? replacement : literal;
      replacement = `(__ldBuzzIsChinese ? ${chinese} : ${english})`;
      if (["jsx-text", "attribute"].includes(entry.context))
        replacement = `{${replacement}}`;
    }
    output =
      output.slice(0, entry.start) + replacement + output.slice(entry.end);
  }
  return output;
}

function importFrom(id, relativeFile) {
  let relative = path
    .relative(
      path.dirname(id),
      fileURLToPath(new URL(relativeFile, import.meta.url)),
    )
    .replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return JSON.stringify(relative);
}

// OpenAI: inject one isolated setting at a verified JSX anchor; never rewrite upstream files.
export function injectLanguageSetting(source, filename) {
  if (
    !filename
      .replaceAll("\\", "/")
      .endsWith("/src/features/settings/ui/SettingsPanels.tsx")
  )
    return source;
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const anchors = [];
  function walk(node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(tree) === "SettingsOptionGroup" &&
      node.openingElement.attributes.properties.some(
        (attr) =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText(tree) === "data-testid" &&
          attr.initializer &&
          ts.isStringLiteral(attr.initializer) &&
          attr.initializer.text === "appearance-theme-card",
      )
    )
      anchors.push(node.getStart(tree));
    ts.forEachChild(node, walk);
  }
  walk(tree);
  if (anchors.length !== 1)
    throw new Error(
      "LD language setting anchor changed; review upstream Appearance settings",
    );
  const offset = anchors[0];
  return (
    `import { LanguageSetting as __LdLanguageSetting } from ${importFrom(filename, "./LanguageSetting.tsx")};\n` +
    source.slice(0, offset) +
    "<__LdLanguageSetting />\n" +
    source.slice(offset)
  );
}

/** OpenAI: build-only display overlay, isolated from upstream source and user content. */
export function ldLocalization({
  locale = process.env.LD_BUZZ_LOCALE ?? "zh-CN",
} = {}) {
  if (!["zh-CN", "en"].includes(locale))
    throw new Error(`Unsupported LD locale: ${locale}`);
  return {
    name: "ld-buzz-localization",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replaceAll("\\", "/");
      const reviewed = Object.keys(reviewedLiterals).some((file) =>
        normalized.endsWith(`/src/${file}`),
      );
      if (
        locale !== "zh-CN" ||
        !normalized.includes("/src/") ||
        (!normalized.endsWith(".tsx") && !reviewed) ||
        /\.(test|spec)\./.test(normalized)
      )
        return null;
      if (
        source.includes("__ldBuzzIsChinese") ||
        source.includes("__LdLanguageSetting")
      )
        throw new Error("LD localization identifier collision");
      let code = localizeSource(source, normalized, defaultCatalog, true);
      if (code !== source)
        code =
          `import { isChinese as __ldBuzzIsChinese } from ${importFrom(normalized, "./locale-runtime.mjs")};\n` +
          code;
      code = injectLanguageSetting(code, normalized);
      return code === source ? null : { code, map: null };
    },
    transformIndexHtml(html) {
      return html.replace(/<html\s+lang="[^"]*"/, `<html lang="${locale}"`);
    },
  };
}
