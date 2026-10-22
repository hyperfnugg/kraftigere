import { expect, type Page } from '@playwright/test'

import { PROJECT } from '../../scripts/seed.mjs'

export { MEMBERS, OUTSIDER, reset, seed, setMembers } from '../../scripts/seed.mjs'

// Completes the Auth emulator's fake Google popup with a seeded account.
export async function completeGooglePopup(page: Page, email: string) {
  await page.goto('./')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  const popup = await popupPromise
  // The seeded accounts are listed in the popup. Clicks before its script is ready
  // are dropped, so retry until the popup closes.
  await expect(async () => {
    if (!popup.isClosed())
      await popup.getByRole('listitem').filter({ hasText: email }).click({ timeout: 1_000 })
    expect(popup.isClosed()).toBe(true)
  }).toPass({ intervals: [500, 1_000] })
}

export async function signIn(page: Page, email: string) {
  await completeGooglePopup(page, email)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

export async function addEntry(page: Page, text: string) {
  await page.getByPlaceholder('Add entry').fill(text)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(entry(page, text)).toBeVisible()
}

export function entry(page: Page, text: string) {
  return page.getByRole('listitem').filter({ hasText: text })
}

// Reads a document straight from the emulator, bypassing rules. Returns its fields as REST values.
export async function readDoc(path: string) {
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  )
  if (!res.ok) throw new Error(`read failed: ${path} ${res.status}`)
  return (await res.json()).fields
}
