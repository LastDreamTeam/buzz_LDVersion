import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { displayLiterals } from "./localize.mjs";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const catalog = JSON.parse(readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8"));
const found = new Map();
function visit(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else if (file.endsWith(".tsx") && !/\.(test|spec)\./.test(file)) {
      for (const entry of displayLiterals(readFileSync(file, "utf8"), file)) {
        const previous = found.get(entry.key) ?? { count: 0, files: [] };
        previous.count++;
        const relative = path.relative(root, file).replaceAll("\\", "/");
        if (!previous.files.includes(relative)) previous.files.push(relative);
        found.set(entry.key, previous);
      }
    }
  }
}
visit(root);
const covered = [...found.keys()].filter(key => catalog[key]);
console.error(JSON.stringify({ displayKeys: found.size, covered: covered.length,
  displaySites: [...found.values()].reduce((n, e) => n + e.count, 0),
  translatedSites: covered.reduce((n, key) => n + found.get(key).count, 0) }));
for (const [key, entry] of [...found].sort((a, b) => b[1].count - a[1].count)) {
  if (!catalog[key]) console.log(JSON.stringify({ key, ...entry }));
}
