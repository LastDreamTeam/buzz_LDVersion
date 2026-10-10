import { readFileSync } from "node:fs";
import { reference } from "./reference-catalog.mjs";

// OpenAI: reviewed LD wording wins; reference data only fills exact display-key gaps.
export const catalog = Object.assign(
  Object.create(null),
  reference.catalog,
  JSON.parse(readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8")),
);
