import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT ?? 3001);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

const dockerUp = 'docker compose -f docker-compose.test.yml up -d postgres-test';
const dockerDown = 'docker compose -f docker-compose.test.yml down -v';
const migrate = `pnpm --filter @publicador/database exec prisma migrate deploy`;

const apiStart = `pnpm --filter @publicador/api run start`;
const webStart = `pnpm --filter @publicador/web run start -- -p ${WEB_PORT}`;

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  expect: { timeout: 10_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: [
    {
      command: dockerUp,
      cwd: process.cwd(),
      timeout: 30_000,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: apiStart,
      cwd: process.cwd(),
      url: `${API_URL}/health/live`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        API_PORT: String(API_PORT),
        API_PREFIX: 'api/v1',
        BUSINESS_ID: 'test-business',
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public',
      },
    },
    {
      command: webStart,
      cwd: process.cwd(),
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NEXT_PUBLIC_API_BASE_URL: API_URL,
      },
    },
  ],
});

export const e2eConstants = {
  dockerUp,
  dockerDown,
  migrate,
  apiStart,
  webStart,
  apiUrl: API_URL,
  baseUrl: BASE_URL,
};
