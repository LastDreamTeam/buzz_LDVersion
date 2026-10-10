import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { displayLiterals } from "./localize.mjs";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const catalog = JSON.parse(
  readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8"),
);
const found = new Map();
let displaySites = 0;
let translatedSites = 0;
let reviewedSites = 0;
function visit(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else if (/\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file)) {
      for (const entry of displayLiterals(readFileSync(file, "utf8"), file)) {
        // OpenAI: include reviewed .ts copy and file overrides in coverage, not only global keys.
        displaySites++;
        const translated =
          typeof (entry.override ?? catalog[entry.key]) === "string";
        if (translated) translatedSites++;
        if (entry.override) reviewedSites++;
        const previous = found.get(entry.key) ?? {
          count: 0,
          translated: 0,
          files: [],
        };
        previous.count++;
        if (translated) previous.translated++;
        const relative = path.relative(root, file).replaceAll("\\", "/");
        if (!previous.files.includes(relative)) previous.files.push(relative);
        found.set(entry.key, previous);
      }
    }
  }
}
visit(root);
const covered = [...found.values()].filter(
  (entry) => entry.translated === entry.count,
);
console.error(
  JSON.stringify({
    displayKeys: found.size,
    covered: covered.length,
    displaySites,
    translatedSites,
    reviewedSites,
  }),
);
if (!process.argv.includes("--summary")) {
  for (const [key, entry] of [...found].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    if (entry.translated !== entry.count)
      console.log(JSON.stringify({ key, ...entry }));
  }
}
