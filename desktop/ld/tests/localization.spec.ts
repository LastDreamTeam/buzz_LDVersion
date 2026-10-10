import { expect, test } from "@playwright/test";
import { installMockBridge, openChannelBrowser } from "../../tests/helpers/bridge";
import { openSettings } from "../../tests/helpers/settings";
import { waitForAnimations } from "../../tests/helpers/animations";

test.beforeEach(async ({ page }) => {
  await installMockBridge(page);
});

test("Chinese navigation and input preserve actual message data", async ({ page }, testInfo) => {
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

test("native channel browser and settings remain usable in Chinese", async ({ page }, testInfo) => {
  await page.goto("/");
  await openChannelBrowser(page);
  await expect(page.getByTestId("channel-browser-dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "浏览频道", exact: true })).toBeVisible();
  await expect(page.getByTestId("browse-channel-general")).toBeVisible();
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("channels-zh-CN.png") });
  await page.keyboard.press("Escape");
  await openSettings(page, "profile");
  await expect(page.getByTestId("settings-nav-profile")).toContainText("个人资料");
  await expect(page.getByText("身份详情", { exact: true })).toBeVisible();
  await waitForAnimations(page);
  await page.screenshot({ path: testInfo.outputPath("profile-zh-CN.png") });
});
