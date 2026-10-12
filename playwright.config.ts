import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:5173/webapp_poc/'

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/warm-up.ts',
  // All tests share one emulator, so run them one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // The emulators are slow on their first requests after starting.
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // SIGINT lets the Firebase CLI stop its emulator processes.
    gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
  },
})
