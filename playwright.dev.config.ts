import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/dev',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium-dev', use: { ...devices['Desktop Chrome'] } },
  ],
});
