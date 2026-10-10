import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ldLocalization, localizeSource } from "./localize.mjs";

test("only display literals change; commands, stored values and user expressions remain intact", () => {
  const input = `const message = "Save"; const wire = {role:"Private"};
    const view = <button data-testid="Save" value="Save" className="Save" onClick={() => send("Save")}
       title="Save" aria-label={busy ? "Cancel" : "Save"}>{message}<b>Save</b></button>;`;
  const output = localizeSource(input, "example.tsx", { Save: "保存", Cancel: "取消", Private: "私密" });
  for (const unchanged of ['const message = "Save"', 'role:"Private"', 'data-testid="Save"',
      'value="Save"', 'className="Save"', 'send("Save")', '{message}']) assert.ok(output.includes(unchanged), unchanged);
  assert.ok(output.includes('title={"保存"}'));
  assert.ok(output.includes('busy ? "取消" : "保存"'));
  assert.ok(output.includes('<b>{"保存"}</b>'));
});

test("unknown copy falls back; comparison operands and dynamic data never translate", () => {
  const input = '<div>{state === "Save" ? "Cancel" : user.name}<span>Unknown</span></div>';
  const output = localizeSource(input, "a.tsx", { Save: "保存", Cancel: "取消" });
  assert.ok(output.includes('state === "Save"'));
  assert.ok(output.includes('"取消" : user.name'));
  assert.ok(output.includes('<span>Unknown</span>'));
});

test("English mode and source boundaries are reversible", () => {
  assert.equal(ldLocalization({ locale: "en" }).transform('<b>Save</b>', '/src/a.tsx'), null);
  assert.equal(ldLocalization().transform('<b>Save</b>', '/node_modules/a.tsx'), null);
  assert.equal(ldLocalization().transform('<b>Save</b>', '/src/a.test.tsx'), null);
  assert.throws(() => ldLocalization({ locale: "unknown" }));
});

test("dynamic display placeholders preserve expression text and evaluate once", () => {
  const input = '<p title={`Reply to ${user.name}`}>{`Message #${channel.name}`}</p>';
  const output = localizeSource(input, '/src/test.tsx', {'Reply to {{0}}': '回复 {{0}}', 'Message #{{0}}': '发送到 #{{0}}'});
  assert.equal(output, '<p title={`回复 ${user.name}`}>{`发送到 #${channel.name}`}</p>');
  assert.throws(() => localizeSource(input, '/src/test.tsx', {'Reply to {{0}}': '回复 {{1}}'}));
});

test("reviewed labels never modify system event discriminators or user values", () => {
  const source = 'const type="channel_archived"; const view={action:"archived this channel"};';
  const result = localizeSource(source, '/src/features/messages/ui/SystemMessageRow.tsx');
  assert.ok(result.includes('type="channel_archived"'));
  assert.ok(result.includes('action:"归档了此频道"'));
});

test("catalog and every transformed TSX file parse, without changing source files", () => {
  const catalog = JSON.parse(readFileSync(new URL('./zh-CN.json', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(catalog)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.trim(), key);
    assert.ok(!/[\u202a-\u202e\u2066-\u2069]/u.test(value), key);
  }
  let count = 0;
  function visit(dir) {
    for (const item of readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else if (file.endsWith('.tsx')) {
        const source = readFileSync(file, 'utf8');
        const translated = localizeSource(source, file);
        const parsed = ts.createSourceFile(file, translated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], file);
        count++;
      }
    }
  }
  visit(fileURLToPath(new URL('../src/', import.meta.url)));
  assert.ok(count > 500, `Unexpected source inventory: ${count}`);
});
