import { defineConfig, devices } from '@playwright/test'
import base, { previewURL } from './playwright.config'

// Launch timings, run by hand with `npm run perf`. Not part of `npm run test:e2e` or CI.
export default defineConfig({
  ...base,
  testDir: 'tests/perf',
  retries: 0,
  timeout: 180_000,
  reporter: 'list',
  projects: [{ name: 'perf', use: { ...devices['Desktop Chrome'], baseURL: previewURL } }],
})
