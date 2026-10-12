import { expect, type Page } from '@playwright/test'

export { MEMBERS, OUTSIDER, reset, seed } from '../../scripts/seed.mjs'

// Completes the Auth emulator's fake Google popup.
export async function completeGooglePopup(page: Page, email: string) {
  await page.goto('./')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  const popup = await popupPromise
  // Clicks before the popup's script is ready are dropped, so retry until the form shows.
  await expect(async () => {
    await popup.getByRole('button', { name: /Add new account/ }).click()
    await expect(popup.locator('#email-input')).toBeVisible({ timeout: 1_000 })
  }).toPass()
  await popup.locator('#email-input').fill(email)
  await popup.locator('#sign-in').click()
}

export async function signIn(page: Page, email: string) {
  await completeGooglePopup(page, email)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

export async function addEntry(page: Page, text: string) {
  await page.getByPlaceholder('Add item').fill(text)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(entry(page, text)).toBeVisible()
}

export function entry(page: Page, text: string) {
  return page.getByRole('listitem').filter({ hasText: text })
}
