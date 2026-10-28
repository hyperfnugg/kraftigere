import { expect, test } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Against the fake Oda (tests/e2e/fake-oda.mjs), whose Basket holds 4 items.
test('a Family Member links Oda from Shop and sees the Basket', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Handle')
  await page.getByRole('button', { name: 'Koble til Oda' }).click()

  // Back from oda.com, on Shop, with the link gone from the URL.
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Handle', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).not.toHaveURL(/oda=/)

  // The link stays: Shop shows the Basket next time it opens.
  await page.reload()
  await openTab(page, 'Handle')
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()
})
