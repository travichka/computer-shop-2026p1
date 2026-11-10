import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH, E2E_BASE_URL, E2E_PORT, e2eDatabaseUrl } from "./e2e/e2e-env";

// Browser test of the cart (Lab 10 extension). Runs the BUILT app (`npm run build` first) on its
// own port against its own database: npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx --no-install next start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/about`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...E2E_AUTH, DATABASE_URL: e2eDatabaseUrl(), NEXT_TELEMETRY_DISABLED: "1" },
  },
});
