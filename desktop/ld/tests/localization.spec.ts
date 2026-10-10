import { expect, test } from "@playwright/test";
import {
  installMockBridge,
  openChannelBrowser,
} from "../../tests/helpers/bridge";
import { openSettings } from "../../tests/helpers/settings";
import { waitForAnimations } from "../../tests/helpers/animations";

test.beforeEach(async ({ page }) => {
  await installMockBridge(page);
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
