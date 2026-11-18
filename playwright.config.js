// @ts-check
// End-to-end suite: API contract/RBAC tests (project "api") and browser journeys (project "chromium").
// Runs against an isolated stack — see e2e/env.js. Usage: `npm run test:e2e`, then `npm run test:e2e:report`.
const { defineConfig, devices } = require("@playwright/test");
const { E2E } = require("./e2e/env");

const apiPort = new URL(E2E.apiUrl).port;
const webPort = new URL(E2E.webUrl).port;

module.exports = defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/.results",
  globalSetup: require.resolve("./e2e/global-setup.js"),
  // Tests share one seeded database (grants, uploads, contributions), so run them one at a time.
  // Each test cleans up what it changes, but parallel workers could still observe each other mid-test.
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS || 1),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/report/html", open: "never" }],
    ["json", { outputFile: "e2e/report/results.json" }],
  ],
  use: {
    baseURL: E2E.webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "api", testMatch: /api\/.*\.spec\.js/, use: { baseURL: E2E.apiUrl } },
    { name: "chromium", testMatch: /ui\/.*\.spec\.js/, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: [
    {
      command: "node apps/api/src/local.js",
      url: `${E2E.apiUrl}/health`,
      env: { PORT: apiPort, MONGODB_URI: E2E.mongoUri, AUTH_MODE: "dev", DEMO_USERS_ENABLED: "true", JWT_SECRET: E2E.jwtSecret, WEB_ORIGIN: E2E.webUrl },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // A production build is faster and steadier under test than `next dev` (no on-demand compiles).
      command: `npm run build -w web && npm run start -w web -- -p ${webPort}`,
      url: `${E2E.webUrl}/login`,
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_URL: E2E.apiUrl, NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
