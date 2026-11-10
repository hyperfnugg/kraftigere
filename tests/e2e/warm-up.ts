import { chromium } from '@playwright/test'
import { OUTSIDER, completeGooglePopup } from './helpers'
import { STACKS, stack } from './stacks.mjs'

// The first popup sign-in after the emulators start sometimes never reaches the page.
// Do one throwaway sign-in on each stack so the tests start warm.
export default async function warmUp() {
  const browser = await chromium.launch()
  await Promise.all(
    Array.from({ length: STACKS }, async (_, i) => {
      const page = await browser.newPage({ baseURL: stack(i).baseURL })
      await completeGooglePopup(page, OUTSIDER)
      await page.getByText('Ingen tilgang').waitFor({ timeout: 15_000 }).catch(() => {})
    }),
  )
  await browser.close()
}
