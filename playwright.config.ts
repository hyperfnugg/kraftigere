import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:5173/'
// A production-style build against the emulators, for service worker and manifest tests.
const previewURL = 'http://localhost:4173/'

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
  projects: [
    { name: 'chromium', testIgnore: /pwa\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'pwa', testMatch: /pwa\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: previewURL } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: baseURL,
      // e2e drives the AI stubs, even with a debug token in .env.development.local for real Gemini.
      // Variables already set win over .env files.
      env: { VITE_APPCHECK_DEBUG_TOKEN: '' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // SIGINT lets the Firebase CLI stop its emulator processes.
      gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
    },
    {
      command:
        'vite build --mode e2e --outDir dist-e2e && vite preview --mode e2e --outDir dist-e2e --port 4173 --strictPort',
      url: previewURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
