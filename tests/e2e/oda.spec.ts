import { expect, test } from '@playwright/test'
import { MEMBERS, expectTab, openTab, reset, resetFakeBasket, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
  await resetFakeBasket()
})

// Against the fake Oda (tests/e2e/fake-oda.mjs), whose Basket holds 4 items.
test('a Family Member links Oda from Odabestilling and sees the Basket', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Odabestilling')
  await page.getByRole('button', { name: 'Koble til Oda' }).click()

  // Back from oda.com, on Odabestilling, with the link gone from the URL.
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()
  await expectTab(page, 'Odabestilling')
  await expect(page).not.toHaveURL(/oda=/)

  // The link stays: Odabestilling shows the Basket next time it opens.
  await page.reload()
  await openTab(page, 'Odabestilling')
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()
})
