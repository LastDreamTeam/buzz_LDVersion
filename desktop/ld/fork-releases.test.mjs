import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkForkRelease, releaseResult } from "./fork-releases.mjs";
import {
  forkUpdaterOverlay,
  injectWorkflowDisplay,
  injectProfileLabel,
  localizeSource,
  forkReleaseCopy,
} from "./localize.mjs";
import { profileLabel } from "./profile-labels.mjs";
import { workflowDisplay } from "./workflow-display.mjs";

function fixture(version = "0.5.29-ld.4") {
  return {
    tag_name: `desktop-v${version}`,
    html_url: `https://github.com/LastDreamTeam/buzz_LDVersion/releases/tag/desktop-v${version}`,
    assets: [
      `Buzz_${version}_x64-setup.exe`,
      "SHA256SUMS",
      "SOURCE_COMMIT",
    ].map((name) => ({ name, state: "uploaded", size: 100 })),
  };
}
test("fork releases compare LD numbers and never downgrade", () => {
  assert.equal(
    releaseResult(fixture("0.5.29-ld.10"), "0.5.29-ld.9").state,
    "manual-required",
  );
  assert.equal(releaseResult(fixture(), "0.5.29-ld.4").state, "up-to-date");
  assert.equal(releaseResult(fixture(), "0.5.30-ld.1").state, "up-to-date");
  assert.throws(() => releaseResult(fixture("0.5.29"), "0.5.29-ld.3"));
});
test("incomplete, redirected and preview releases fail closed", () => {
  for (const patch of [
    { assets: [] },
    { html_url: "https://github.com/block/buzz/releases/latest" },
    { draft: true },
    { prerelease: true },
  ])
    assert.throws(() =>
      releaseResult({ ...fixture(), ...patch }, "0.5.29-ld.3"),
    );
});
test("release check is credential-free and does not hide HTTP errors as up-to-date", async () => {
  const result = await checkForkRelease("0.5.29-ld.3", async (url, init) => {
    assert.match(url, /LastDreamTeam\/buzz_LDVersion\/releases\/latest$/);
    assert.equal(init.credentials, "omit");
    assert.ok(!init.headers.Authorization);
    return { ok: true, json: async () => fixture() };
  });
  assert.equal(result.state, "manual-required");
  await assert.rejects(
    checkForkRelease("0.5.29-ld.3", async () => ({ ok: false, status: 403 })),
    /HTTP 403/,
  );
});
test("updater override guards the original contract and never falls back to official updates", () => {
  const file = fileURLToPath(
    new URL("../src/features/settings/hooks/use-updater.ts", import.meta.url),
  );
  const source = readFileSync(file, "utf8");
  assert.match(forkUpdaterOverlay(source, file).code, /use-fork-updater/);
  assert.throws(() => forkUpdaterOverlay(source + "// changed", file));
  assert.equal(forkUpdaterOverlay(source, "/src/unrelated.ts"), null);
});
test("workflow translation is render-only and does not parse or change user condition text", () => {
  assert.equal(workflowDisplay("Message posted", true), "收到消息");
  assert.equal(workflowDisplay("Message posted", false), "Message posted");
  assert.equal(
    workflowDisplay("Message contains “Message posted”", true),
    "Message contains “Message posted”",
  );
  const file = fileURLToPath(
    new URL(
      "../src/features/workflows/ui/WorkflowRichTriggerDescription.tsx",
      import.meta.url,
    ),
  );
  const source = readFileSync(file, "utf8");
  const result = injectWorkflowDisplay(source, file);
  assert.ok(
    result.includes("splitWorkflowAuthorDescription(description, label)"),
  );
  assert.ok(result.includes("{label}"));
  assert.throws(() => injectWorkflowDisplay("", file));
});
test("workflow and project localization preserves protocol identifiers", () => {
  const source =
    'const choices={message_posted:"Message Posted", send_dm:"Send DM"}; const mode="message_posted";';
  const translated = localizeSource(
    source,
    "/src/features/workflows/ui/workflowFormTypes.ts",
  );
  assert.match(translated, /message_posted:"收到消息"/);
  assert.match(translated, /mode="message_posted"/);
  assert.match(translated, /send_dm:"发送私聊"/);
});
test("profile field labels change only at render, never grouping/comparison identifiers", () => {
  const file = fileURLToPath(
    new URL(
      "../src/features/profile/ui/UserProfilePanelFields.tsx",
      import.meta.url,
    ),
  );
  const source = readFileSync(file, "utf8");
  const result = injectProfileLabel(source, file);
  assert.equal(profileLabel("Managed by", true), "管理者");
  assert.equal(profileLabel("Managed by", false), "Managed by");
  assert.ok(result.includes('field.label === "Status"'));
  assert.ok(result.includes('"Managed by",'));
  assert.ok(result.includes("key={field.testId ?? field.label}"));
  assert.ok(result.includes("{field.displayNode ?? field.displayValue}"));
});
test("manual update UI names the LD channel in both languages, not Linux AppImage", () => {
  const patches = JSON.parse(
    readFileSync(new URL("./release-copy.json", import.meta.url), "utf8"),
  );
  for (const file of Object.keys(patches)) {
    const filename = fileURLToPath(new URL(`../src/${file}`, import.meta.url));
    const source = readFileSync(filename, "utf8");
    const result = forkReleaseCopy(source, filename);
    assert.notEqual(result, source);
    assert.ok(
      !result.includes("Switch to AppImage") &&
        !result.includes("this Linux package"),
    );
    assert.throws(() => forkReleaseCopy("", filename));
  }
});
