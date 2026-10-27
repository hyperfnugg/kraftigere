import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

// e2e runs its own emulators (firebase.test.json) and servers on their own ports, so
// `npm run dev` can keep running beside it. The app finds the emulators through .env.e2e,
// and seed.mjs and the tests through these.
const env = loadEnv('e2e', process.cwd())
process.env.FIRESTORE_EMULATOR_HOST = env.VITE_FIRESTORE_EMULATOR_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST = env.VITE_AUTH_EMULATOR_HOST

const baseURL = 'http://localhost:5273/'
// A production-style build against the emulators, for service worker and manifest tests.
export const previewURL = 'http://localhost:4273/'

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
      command:
        'firebase emulators:exec --config firebase.test.json --project demo-kraftigere --only auth,firestore ' +
        '"node scripts/seed.mjs && vite --mode e2e --port 5273 --strictPort"',
      url: baseURL,
      // e2e drives the AI stubs: mode e2e doesn't read .env.development.local, where a debug
      // token for real Gemini lives, and variables already set win over any other .env file.
      env: { VITE_APPCHECK_DEBUG_TOKEN: '' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // SIGINT lets the Firebase CLI stop its emulator processes.
      gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
    },
    {
      command:
        'vite build --mode e2e --outDir dist-e2e && vite preview --mode e2e --outDir dist-e2e --port 4273 --strictPort',
      url: previewURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
