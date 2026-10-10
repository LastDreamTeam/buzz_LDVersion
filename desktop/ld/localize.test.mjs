import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  displayLiterals,
  injectLanguageSetting,
  ldLocalization,
  localizeSource,
} from "./localize.mjs";
import { LOCALE_KEY, readLocale, saveLocale } from "./locale-runtime.mjs";

test("only display literals change; commands, stored values and user expressions remain intact", () => {
  const input = `const message = "Save"; const wire = {role:"Private"};
    const view = <button data-testid="Save" value="Save" className="Save" onClick={() => send("Save")}
       title="Save" aria-label={busy ? "Cancel" : "Save"}>{message}<b>Save</b></button>;`;
  const output = localizeSource(input, "example.tsx", {
    Save: "保存",
    Cancel: "取消",
    Private: "私密",
  });
  for (const unchanged of [
    'const message = "Save"',
    'role:"Private"',
    'data-testid="Save"',
    'value="Save"',
    'className="Save"',
    'send("Save")',
    "{message}",
  ])
    assert.ok(output.includes(unchanged), unchanged);
  assert.ok(output.includes('title={"保存"}'));
  assert.ok(output.includes('busy ? "取消" : "保存"'));
  assert.ok(output.includes('<b>{"保存"}</b>'));
});

test("unknown copy falls back; comparison operands and dynamic data never translate", () => {
  const input =
    '<div>{state === "Save" ? "Cancel" : user.name}<span>Unknown</span></div>';
  const output = localizeSource(input, "a.tsx", {
    Save: "保存",
    Cancel: "取消",
  });
  assert.ok(output.includes('state === "Save"'));
  assert.ok(output.includes('"取消" : user.name'));
  assert.ok(output.includes("<span>Unknown</span>"));
});

test("English mode and source boundaries are reversible", () => {
  assert.equal(
    ldLocalization({ locale: "en" }).transform("<b>Save</b>", "/src/a.tsx"),
    null,
  );
  assert.equal(
    ldLocalization().transform("<b>Save</b>", "/node_modules/a.tsx"),
    null,
  );
  assert.equal(
    ldLocalization().transform("<b>Save</b>", "/src/a.test.tsx"),
    null,
  );
  assert.throws(() => ldLocalization({ locale: "unknown" }));
});

test("runtime branch preserves both languages and evaluates a placeholder once", () => {
  const input =
    "let calls=0; const next=()=>++calls; const x=<p>{`Reply to ${next()}`}</p>;";
  const result = localizeSource(
    input,
    "/src/test.tsx",
    { "Reply to {{0}}": "回复 {{0}}" },
    true,
  );
  assert.ok(
    result.includes(
      "(__ldBuzzIsChinese ? `回复 ${next()}` : `Reply to ${next()}`)",
    ),
  );
  const expression = result.slice(
    result.indexOf("(__ldBuzzIsChinese"),
    result.lastIndexOf("}</p>"),
  );
  for (const [chinese, expected] of [
    [true, "回复 1"],
    [false, "Reply to 1"],
  ]) {
    const evaluate = new Function(
      "__ldBuzzIsChinese",
      `let calls=0; const next=()=>++calls; const value=${expression}; return [value,calls];`,
    );
    assert.deepEqual(evaluate(chinese), [expected, 1]);
  }
});

test("locale persistence changes only an LD key and rejects unsupported/blocked storage", () => {
  const values = new Map([["identity", "unchanged"]]);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readLocale(storage), "zh-CN");
  saveLocale("en", storage);
  assert.equal(readLocale(storage), "en");
  assert.equal(values.get("identity"), "unchanged");
  assert.deepEqual([...values.keys()], ["identity", LOCALE_KEY]);
  assert.throws(() => saveLocale("unknown", storage));
  assert.throws(() =>
    saveLocale("en", {
      getItem: () => null,
      setItem: () => {
        throw Error("blocked");
      },
    }),
  );
  assert.equal(
    readLocale({
      getItem: () => {
        throw Error("blocked");
      },
    }),
    "zh-CN",
  );
});

test("language setting injection fails loudly if the native appearance anchor disappears", () => {
  const file = "/src/features/settings/ui/SettingsPanels.tsx";
  const input =
    'const x=<div><SettingsOptionGroup data-testid="appearance-theme-card">Original</SettingsOptionGroup></div>';
  const output = injectLanguageSetting(input, file);
  assert.ok(output.includes("<__LdLanguageSetting />"));
  assert.ok(output.includes(">Original</SettingsOptionGroup>"));
  assert.throws(() => injectLanguageSetting("const x=<div />", file));
});

test("dynamic display placeholders preserve expression text and evaluate once", () => {
  const input =
    "<p title={`Reply to ${user.name}`}>{`Message #${channel.name}`}</p>";
  const output = localizeSource(input, "/src/test.tsx", {
    "Reply to {{0}}": "回复 {{0}}",
    "Message #{{0}}": "发送到 #{{0}}",
  });
  assert.equal(
    output,
    "<p title={`回复 ${user.name}`}>{`发送到 #${channel.name}`}</p>",
  );
  assert.throws(() =>
    localizeSource(input, "/src/test.tsx", { "Reply to {{0}}": "回复 {{1}}" }),
  );
});

test("reviewed labels never modify system event discriminators or user values", () => {
  const source =
    'const type="channel_archived"; const view={action:"archived this channel"};';
  const result = localizeSource(
    source,
    "/src/features/messages/ui/SystemMessageRow.tsx",
  );
  assert.ok(result.includes('type="channel_archived"'));
  assert.ok(result.includes('action:"归档了此频道"'));
});

test("reviewed upstream anchors still exist after merges and transformed .ts remains valid", () => {
  const overrides = JSON.parse(
    readFileSync(new URL("./reviewed-literals.json", import.meta.url), "utf8"),
  );
  const labelFiles = JSON.parse(
    readFileSync(
      new URL("./reviewed-label-files.json", import.meta.url),
      "utf8",
    ),
  );
  for (const file of new Set([...Object.keys(overrides), ...labelFiles])) {
    const filename = fileURLToPath(new URL(`../src/${file}`, import.meta.url));
    const source = readFileSync(filename, "utf8");
    const keys = new Set(
      displayLiterals(source, filename).map((entry) => entry.key),
    );
    assert.ok(keys.size, `Reviewed display anchors disappeared: ${file}`);
    for (const key of Object.keys(overrides[file] ?? {})) {
      assert.ok(
        keys.has(key),
        `Upstream copy changed; review the LD override: ${file}: ${key}`,
      );
    }
    const parsed = ts.createSourceFile(
      filename,
      localizeSource(source, filename),
      ts.ScriptTarget.Latest,
      true,
      filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    assert.deepEqual(
      parsed.parseDiagnostics.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      ),
      [],
      file,
    );
  }
});

test("catalog and every transformed TSX file parse, without changing source files", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("./zh-CN.json", import.meta.url), "utf8"),
  );
  for (const [key, value] of Object.entries(catalog)) {
    assert.equal(typeof value, "string", key);
    assert.ok(value.trim(), key);
    assert.ok(!/[\u202a-\u202e\u2066-\u2069]/u.test(value), key);
  }
  let count = 0;
  function visit(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else if (file.endsWith(".tsx")) {
        const source = readFileSync(file, "utf8");
        const translated = localizeSource(source, file, undefined, true);
        const parsed = ts.createSourceFile(
          file,
          translated,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        assert.deepEqual(
          parsed.parseDiagnostics.map((d) =>
            ts.flattenDiagnosticMessageText(d.messageText, "\n"),
          ),
          [],
          file,
        );
        count++;
      }
    }
  }
  visit(fileURLToPath(new URL("../src/", import.meta.url)));
  assert.ok(count > 500, `Unexpected source inventory: ${count}`);
});
