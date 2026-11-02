import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: ".",
  testMatch: ["*.spec.ts"],
  workers: 3,
  reporter: [["list"]],
  outputDir:
    "/private/tmp/claude-501/-Users-nichakornrojroungwattana/0c59814a-0c7c-4845-8fb9-5e646e93ab08/scratchpad/review/results",
  use: { baseURL: "http://localhost:3200", timezoneId: "Asia/Bangkok", locale: "en-US" },
  projects: [
    {
      name: "iphone",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
