import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const UPSTREAM = "http://127.0.0.1:4010";

export const E2E_POLICY = { ttlSeconds: 4, maxStaleSeconds: 12 };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fake-upstream.mjs",
      url: `${UPSTREAM}/__health`,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        GITVIS_GITHUB_GRAPHQL_URL: `${UPSTREAM}/graphql`,
        GITVIS_GITLAB_ORIGIN: UPSTREAM,
        GITVIS_GITHUB_AVATAR_ORIGIN: `${UPSTREAM}/avatars`,
        GITHUB_TOKEN: "e2e-fake-token",
        GITVIS_DATA_TTL_SECONDS: String(E2E_POLICY.ttlSeconds),
        GITVIS_MAX_STALE_SECONDS: String(E2E_POLICY.maxStaleSeconds),
        SITE_URL: `http://localhost:${PORT}`,
      },
    },
  ],
});
