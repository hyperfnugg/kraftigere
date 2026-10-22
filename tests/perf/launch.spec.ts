import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'
import { MEMBERS, addEntry, reset, seed, signIn } from '../e2e/helpers'

// Lighthouse's mobile profile: slow 4G (150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up)
// and a CPU 4x slower than this machine's.
async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  return cdp
}

// Like Chrome's hard reload: skip the HTTP cache and the service worker. Storage
// (sign-in, Firestore's offline cache) is kept.
async function hardReloadMode(cdp: CDPSession) {
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.setBypassServiceWorker', { bypass: true })
}

// Milliseconds from starting the load until `ready` is visible, and the bytes the page
// downloaded meanwhile (compressed; the service worker's own fetches aren't counted).
async function time(cdp: CDPSession, load: () => Promise<unknown>, ready: Locator) {
  let bytes = 0
  const onFinished = (e: { encodedDataLength: number }) => (bytes += e.encodedDataLength)
  cdp.on('Network.loadingFinished', onFinished)
  const start = Date.now()
  await load()
  await ready.waitFor({ timeout: 60_000 })
  const ms = Date.now() - start
  cdp.off('Network.loadingFinished', onFinished)
  return { ms, kb: Math.round(bytes / 1024) }
}

const RUNS = 3

async function report(name: string, run: () => Promise<{ ms: number; kb: number }>) {
  const results = []
  for (let i = 0; i < RUNS; i++) results.push(await run())
  const median = [...results].sort((a, b) => a.ms - b.ms)[Math.floor(RUNS / 2)]
  const line = `${name}: median ${median.ms} ms, ${median.kb} KB (runs: ${results.map((r) => r.ms).join(', ')} ms)`
  console.log(line)
  test.info().annotations.push({ type: 'timing', description: line })
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test.describe('local build against the emulators, signed in, until the List shows', () => {
  test.beforeEach(async ({ page }) => {
    await reset()
    await seed()
    await signIn(page, MEMBERS[0])
    for (const text of ['milk', 'eggs', 'bread']) await addEntry(page, text)
    await waitForServiceWorker(page)
  })

  test('installed app (service worker cache)', async ({ page }) => {
    const cdp = await throttle(page)
    await report('local, cached', () => time(cdp, () => page.reload(), page.getByText('bread')))
  })

  test('hard reload', async ({ page }) => {
    const cdp = await throttle(page)
    await hardReloadMode(cdp)
    await report('local, hard reload', () => time(cdp, () => page.reload(), page.getByText('bread')))
  })
})

// Real Google sign-in can't be automated, so the live site is measured signed out. It
// includes what the emulator build leaves out: App Check and reCAPTCHA.
test.describe('live site, signed out, until the sign-in button shows', () => {
  const live = 'https://kraftigere.web.app/'

  test('installed app (service worker cache)', async ({ page }) => {
    await page.goto(live)
    await waitForServiceWorker(page)
    const cdp = await throttle(page)
    await report('live, cached', () =>
      time(cdp, () => page.reload(), page.getByRole('button', { name: 'Logg inn med Google' })),
    )
  })

  test('hard reload', async ({ page }) => {
    await page.goto(live)
    const cdp = await throttle(page)
    await hardReloadMode(cdp)
    await report('live, hard reload', () =>
      time(cdp, () => page.reload(), page.getByRole('button', { name: 'Logg inn med Google' })),
    )
  })
})
