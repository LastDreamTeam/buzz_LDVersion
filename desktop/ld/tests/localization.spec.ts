import { expect, test } from "@playwright/test";
import {
  installMockBridge,
  openChannelBrowser,
} from "../../tests/helpers/bridge";
import { openSettings } from "../../tests/helpers/settings";
import { waitForAnimations } from "../../tests/helpers/animations";

test.beforeEach(async ({ page }) => {
  await installMockBridge(page);
  await page.route(
    "https://api.github.com/repos/LastDreamTeam/buzz_LDVersion/releases/latest",
    (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"message":"Not Found"}',
      }),
  );
});

test("workflow fixed labels are Chinese while YAML keeps native event identifiers", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByTestId("open-workflows-view").click();
  await page.getByRole("button", { name: "创建工作流", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "创建工作流", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("选择频道");
  await expect(dialog).toContainText("收到消息");
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("workflow-zh-CN.png") });
  await dialog.getByRole("tab", { name: "YAML", exact: true }).click();
  const editor = dialog.getByRole("textbox", { name: /YAML/ });
  await expect(editor).toHaveValue(/message_posted/);
});

test("project tabs and agent library stay localized", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByTestId("open-projects-view").click();
  for (const [id, text] of [
    ["all", "动态"],
    ["repositories", "代码仓库"],
    ["prs", "代码评审"],
    ["issues", "任务"],
  ])
    await expect(page.getByTestId(`projects-section-${id}`)).toContainText(
      text,
    );
  await page.getByTestId("projects-section-repositories").click();
  await waitForAnimations(page);
  await page.screenshot({
    path: testInfo.outputPath("repositories-zh-CN.png"),
  });
});

test("fork update check shows only an LD manual download and correct platform copy", async ({
  page,
}, testInfo) => {
  await page.route(
    "https://api.github.com/repos/LastDreamTeam/buzz_LDVersion/releases/latest",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tag_name: "desktop-v0.5.29-ld.9",
          html_url:
            "https://github.com/LastDreamTeam/buzz_LDVersion/releases/tag/desktop-v0.5.29-ld.9",
          assets: [
            "Buzz_0.5.29-ld.9_x64-setup.exe",
            "SOURCE_COMMIT",
            "SHA256SUMS",
          ].map((name) => ({ name, state: "uploaded", size: 100 })),
        }),
      }),
  );
  await page.goto("/");
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await page.evaluate(() => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const original = internals.invoke.bind(internals);
    internals.invoke = async (...args: unknown[]) =>
      args[0] === "plugin:app|version" ? "0.5.29-ld.3" : original(...args);
  });
  await openSettings(page, "updates");
  await page.getByRole("button", { name: /重新检查|检查更新/ }).click();
  await expect(page.getByTestId("settings-updates")).toContainText(
    "此 LD 版本采用手动更新，请从我们仓库的发布页下载已校验安装包。",
  );
  await expect(page.getByText(/Switch to the AppImage/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "下载更新", exact: true }),
  ).toBeVisible();
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("ld-update-channel.png") });
});

test("Chinese navigation and input preserve actual message data", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await expect(page.getByTestId("app-sidebar")).toContainText("智能体");
  await page.getByTestId("channel-general").click();
  const body = "Save Cancel Archive channel 原样保留 🐝";
  await page.getByTestId("message-input").fill(body);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("message-timeline")).toContainText(body);
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("chat-zh-CN.png") });
});

test("native channel browser and settings remain usable in Chinese", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await openChannelBrowser(page);
  await expect(page.getByTestId("channel-browser-dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "浏览频道", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("browse-channel-general")).toBeVisible();
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("channels-zh-CN.png") });
  await page.keyboard.press("Escape");
  await openSettings(page, "profile");
  await expect(page.getByTestId("settings-nav-profile")).toContainText(
    "个人资料",
  );
  await expect(page.getByText("身份详情", { exact: true })).toBeVisible();
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("profile-zh-CN.png") });
});

test("language setting can cancel and switch both ways without clearing identity", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await openSettings(page, "appearance");
  await expect(page.getByTestId("ld-language-card")).toContainText("界面语言");
  const identityBefore = await page.evaluate(() =>
    localStorage.getItem("buzz-active-community-id"),
  );
  await page.getByTestId("ld-language-en").click();
  await expect(page.getByTestId("ld-language-confirm")).toContainText(
    "未保存的编辑可能丢失",
  );
  await page.getByTestId("ld-language-cancel").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(
    await page.evaluate(() => localStorage.getItem("ld.buzz.uiLocale")),
  ).toBeNull();
  await page.getByTestId("ld-language-en").click();
  await page.getByTestId("ld-language-apply").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("settings-nav-agents")).toContainText("Agents");
  await expect(page.getByTestId("ld-language-card")).toContainText(
    "Interface language",
  );
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("language-en.png") });
  await page.getByTestId("ld-language-zh-CN").click();
  await expect(page.getByTestId("ld-language-confirm")).toContainText(
    "unsaved edits may be lost",
  );
  await page.getByTestId("ld-language-apply").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("ld-language-card")).toContainText("界面语言");
  expect(
    await page.evaluate(() => localStorage.getItem("buzz-active-community-id")),
  ).toBe(identityBefore);
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("language-zh-CN.png") });
});

test("failed language persistence keeps the dialog open without reloading", async ({
  page,
}) => {
  await page.goto("/");
  await openSettings(page, "appearance");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "ld.buzz.uiLocale")
        throw new DOMException("Blocked in test", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.getByTestId("ld-language-en").click();
  await page.getByTestId("ld-language-apply").click();
  await expect(page.getByRole("alert")).toContainText("尚未重新载入");
  await expect(page.getByTestId("ld-language-confirm")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByTestId("ld-language-cancel").click();
  await expect(page.getByTestId("ld-language-confirm")).not.toBeVisible();
});
