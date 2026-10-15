import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: [
    ...(process.env.RUN_SEEDED_DASHBOARD_TEST === "true" ||
    process.env.RUN_LIVE_AI_DASHBOARD_TEST === "true"
      ? [
          {
            command: "pnpm --filter @sprint-intelligence/api start",
            url: "http://127.0.0.1:3000/health",
            reuseExistingServer: false,
            timeout: 30_000,
          },
        ]
      : []),
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
