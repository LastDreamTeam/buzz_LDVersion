import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReferenceCatalog,
  localTerminology,
  reference,
} from "./reference-catalog.mjs";
import { catalog } from "./catalog.mjs";
import { displayLiterals, localizeSource } from "./localize.mjs";

test("pinned reference has 4082 matching leaves; reviewed LD copy takes precedence", () => {
  assert.equal(reference.leafKeys, 4082);
  assert.ok(Object.keys(reference.catalog).length > 3000);
  const own = JSON.parse(
    readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8"),
  );
  for (const [key, value] of Object.entries(own))
    assert.equal(catalog[key], value, key);
  assert.equal(catalog["Return huddle to drawer"], "将语音会议收回侧栏");
});

test("reference key, value and interpolation mismatches fail closed", () => {
  assert.throws(
    () => buildReferenceCatalog({ a: "A" }, { b: "乙" }),
    /key parity/,
  );
  assert.throws(() => buildReferenceCatalog({ a: "A" }, { a: " " }), /Empty/);
  assert.throws(() => buildReferenceCatalog({ a: "A" }, { a: [] }), /Invalid/);
  assert.throws(
    () => buildReferenceCatalog({ a: "Hi {{name}}" }, { a: "你好 {{other}}" }),
    /placeholder parity/,
  );
});

test("ambiguous English copy is excluded rather than guessed globally", () => {
  const result = buildReferenceCatalog(
    { action: "Open", visibility: "Open", ok: "Save" },
    { action: "打开", visibility: "公开", ok: "保存" },
  );
  assert.deepEqual(result.ambiguous, ["Open"]);
  assert.equal(result.catalog.Open, undefined);
  assert.equal(result.catalog.Save, "保存");
});

test("only single-use ordered plain-text interpolation maps to source templates", () => {
  const result = buildReferenceCatalog(
    {
      ok: "Reply to {{name}} in {{channel}}",
      reordered: "{{a}} {{b}}",
      repeated: "{{a}} {{a}}",
      rich: "See <link>Help</link>",
    },
    {
      ok: "回复 {{name}}（{{channel}}）",
      reordered: "{{b}} {{a}}",
      repeated: "{{a}} {{a}}",
      rich: "查看 <link>帮助</link>",
    },
  );
  assert.equal(
    result.catalog["Reply to {{0}} in {{1}}"],
    "回复 {{0}}（{{1}}）",
  );
  assert.deepEqual(result.skipped, ["reordered", "repeated", "rich"]);
});

test("LD terminology follows feature meaning and preserves technical exceptions", () => {
  for (const [en, zh, expected] of [
    ["Thread", "线程", "话题"],
    ["CPU threads", "CPU 线程", "CPU 线程"],
    ["Canvas", "画布", "共享文档"],
    ["Drawing canvas", "绘图画布", "绘图画布"],
    ["Start huddle", "发起 Huddle", "发起 语音会议"],
    ["Harness", "运行框架", "运行器"],
    ["Runtime", "运行器", "运行环境"],
    ["Provider", "提供方", "服务商"],
    ["Direct messages", "私信", "私聊"],
    ["IP address", "IP 地址", "IP 地址"],
  ])
    assert.equal(localTerminology(en, zh), expected, en);
});

test("public-channel wording is scoped; stored private enum and channel names stay intact", () => {
  const source =
    'const summary=visibility === "private" ? "Private" : "Open"; const x=<b>{channel.name}</b>;';
  const output = localizeSource(
    source,
    "/src/features/sidebar/ui/CreateChannelFormFields.tsx",
  );
  assert.ok(output.includes('visibility === "private"'));
  assert.ok(output.includes('? "私密" : "公开"'));
  assert.ok(output.includes("{channel.name}"));
  assert.equal(
    localizeSource("<button>Open</button>", "/src/unrelated.tsx"),
    '<button>{"打开"}</button>',
  );
});

test("ordinary TypeScript generics are not miscounted as JSX copy", () => {
  assert.deepEqual(
    displayLiterals(
      "function value<T>(x:T):T { return x; }",
      "/src/example.ts",
    ),
    [],
  );
});
