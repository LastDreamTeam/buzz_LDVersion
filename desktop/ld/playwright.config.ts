import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../test-results/ld",
  use: {
    baseURL: "http://127.0.0.1:4288",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    launchOptions: process.env.LD_TEST_BROWSER ? { executablePath: process.env.LD_TEST_BROWSER } : {},
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4288 --strictPort",
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    port: 4288,
    reuseExistingServer: false,
  },
});
