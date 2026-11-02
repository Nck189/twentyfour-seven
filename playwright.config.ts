import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * QA_QC §2 test matrix. WebKit is primary (Minnie uses Safari on iPhone/iPad/Mac).
 * BASE_URL set → run against that (qc:prod). Otherwise build+start locally against Supabase local.
 */
const BASE_URL = process.env.BASE_URL;
const PORT = 3100;

const common = { timezoneId: "Asia/Bangkok", locale: "en-US" } as const;

export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "visual/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  snapshotPathTemplate: "tests/visual/__snapshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...common,
  },
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
        ...common,
      },
    },
    {
      name: "iphone-small",
      use: {
        ...devices["iPhone SE"],
        browserName: "webkit",
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
        ...common,
      },
    },
    {
      name: "ipad-portrait",
      use: {
        browserName: "webkit",
        viewport: { width: 1024, height: 1366 },
        hasTouch: true,
        isMobile: true,
        ...common,
      },
    },
    {
      name: "ipad-landscape",
      use: {
        browserName: "webkit",
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
        isMobile: true,
        ...common,
      },
    },
    { name: "mac", use: { browserName: "webkit", viewport: { width: 1440, height: 900 }, ...common } },
    {
      name: "chrome-desktop",
      testIgnore: ["visual/**"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...common },
    },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
