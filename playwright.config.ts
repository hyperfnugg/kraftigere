import { defineConfig, devices } from '@playwright/test'
import { PREVIEW_URL, READY_URL, STACKS, stack } from './tests/e2e/stacks.mjs'

// e2e runs on STACKS workers, each against its own emulators and servers (tests/e2e/stacks.mjs),
// on other ports than `npm run dev`, so it can keep running beside it. Each worker loads this
// file with its own TEST_PARALLEL_INDEX, so these point seed.mjs and the tests at its stack;
// the runner itself gets stack 0.
const own = stack(Number(process.env.TEST_PARALLEL_INDEX ?? 0))
process.env.FIRESTORE_EMULATOR_HOST = own.firestoreHost
process.env.FIREBASE_AUTH_EMULATOR_HOST = own.authHost
process.env.FUNCTIONS_HOST = own.functionsHost
process.env.FAKE_ODA_HOST = `127.0.0.1:${own.fakeOdaPort}`

// A production-style build against stack 0's emulators, for service worker and manifest tests.
export const previewURL = PREVIEW_URL

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/warm-up.ts',
  // Tests share their worker's stack, so a worker runs one at a time.
  workers: STACKS,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // The emulators are slow on their first requests after starting.
  expect: { timeout: 10_000 },
  use: { baseURL: own.baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: /pwa\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'pwa', testMatch: /pwa\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: previewURL } },
  ],
  webServer: {
    command: 'node tests/e2e/stacks.mjs',
    url: READY_URL,
    env: { E2E_STACKS: String(STACKS) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // SIGINT lets the Firebase CLI stop its emulator processes.
    gracefulShutdown: { signal: 'SIGINT', timeout: 20_000 },
  },
})
