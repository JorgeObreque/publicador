import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT ?? 3001);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },
  expect: { timeout: 10000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'docker compose -f docker-compose.test.yml up -d --wait',
      url: 'http://127.0.0.1:5434',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @publicador/api run start`,
      url: `${API_URL}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        API_PORT: String(API_PORT),
        API_PREFIX: 'api/v1',
        BUSINESS_ID: 'test-business',
        DATABASE_URL: 'postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public',
      },
    },
    {
      command: `NEXT_PUBLIC_API_BASE_URL=${API_URL} pnpm --filter @publicador/web run start -- -p ${WEB_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: API_URL,
      },
    },
  ],
});
