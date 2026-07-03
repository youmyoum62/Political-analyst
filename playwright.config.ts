import { defineConfig, devices } from '@playwright/test';

// E2E スモークテスト。デプロイ済みサイト（既定）または PLAYWRIGHT_BASE_URL に対して実行する。
// Render 無料枠のコールドスタートを考慮し、ナビゲーション/アクションのタイムアウトは長めに取る。
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://political-analyst-s7s6.vercel.app';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
