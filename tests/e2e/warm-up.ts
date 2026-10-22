import { chromium, type FullConfig } from '@playwright/test'
import { OUTSIDER, completeGooglePopup } from './helpers'

// The first popup sign-in after the emulators start sometimes never reaches the page.
// Do one throwaway sign-in so the tests start warm.
export default async function warmUp(config: FullConfig) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL: config.projects[0].use.baseURL })
  await completeGooglePopup(page, OUTSIDER)
  await page.getByText('Ingen tilgang').waitFor({ timeout: 15_000 }).catch(() => {})
  await browser.close()
}
