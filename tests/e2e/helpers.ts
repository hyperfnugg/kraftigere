import { expect, type Page } from '@playwright/test'

import { FIRESTORE_HOST, MEMBERS, PROJECT } from '../../scripts/seed.mjs'

export { FIRESTORE_HOST, MEMBERS, OUTSIDER, reset, seed, setMembers } from '../../scripts/seed.mjs'

// Completes the Auth emulator's fake Google popup with a seeded account.
export async function completeGooglePopup(page: Page, email: string) {
  await page.goto('./')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Logg inn med Google' }).click()
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
  await expect(page.getByRole('button', { name: 'Logg ut' })).toBeVisible()
}

export async function addEntry(page: Page, text: string) {
  await page.getByPlaceholder('Hva trenger vi?').fill(text)
  await page.getByRole('button', { name: 'Legg til', exact: true }).click()
  await expect(entry(page, text)).toBeVisible()
}

export function entry(page: Page, text: string) {
  return page.getByRole('listitem').filter({ hasText: text })
}

// Reads a document straight from the emulator, bypassing rules. Returns its fields as REST values.
export async function readDoc(path: string) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  )
  if (!res.ok) throw new Error(`read failed: ${path} ${res.status}`)
  return (await res.json()).fields
}

// Lists a collection straight from the emulator, bypassing rules. Returns each document's
// fields as REST values.
export async function listDocs(path: string) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  )
  if (!res.ok) throw new Error(`list failed: ${path} ${res.status}`)
  return ((await res.json()).documents ?? []).map((d: { fields: object }) => d.fields)
}

// Writes a document straight to the emulator, bypassing rules. Takes its fields as REST values.
export async function writeDoc(path: string, fields: object) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { method: 'PATCH', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify({ fields }) },
  )
  if (!res.ok) throw new Error(`write failed: ${path} ${res.status}`)
}

type TabName = 'Hjem' | 'Middag' | 'Handle' | 'Odabestilling'
// Behind ⋮, which carries the open one's name.
const MORE: TabName[] = ['Middag', 'Odabestilling']

export async function openTab(page: Page, name: TabName) {
  if (MORE.includes(name)) {
    await page.getByRole('button', { name: 'Mer' }).click()
    await page.getByRole('menuitem', { name }).click()
  } else {
    await page.getByRole('button', { name, exact: true }).click()
  }
  await expectTab(page, name)
}

export async function expectTab(page: Page, name: TabName) {
  if (MORE.includes(name)) await expect(page.getByRole('button', { name: 'Mer' })).toHaveText(new RegExp(`^${name}`))
  else await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
}

// The fake Oda's Basket (tests/e2e/fake-oda.mjs), as quantities by product id.
const FAKE_ODA = 'http://127.0.0.1:8866'
export const fakeBasket = async (): Promise<Record<string, number>> => (await fetch(`${FAKE_ODA}/basket`)).json()
export const resetFakeBasket = () => fetch(`${FAKE_ODA}/reset`, { method: 'POST' })
// Makes manipulate_cart on the fake Oda fail, or work again. resetFakeBasket also makes it work.
export const failFakeOda = (failing: boolean) => fetch(`${FAKE_ODA}/fail`, { method: 'POST', body: JSON.stringify(failing) })
// Changes the fake Basket as a Family Member would on oda.com.
export const changeFakeBasket = (operations: { productId: number; quantity: number }[]) =>
  fetch(`${FAKE_ODA}/basket`, { method: 'POST', body: JSON.stringify(operations) })

// Links the fake Oda from Odabestilling, where the app comes back to.
export async function linkOda(page: Page) {
  await openTab(page, 'Odabestilling')
  await page.getByRole('button', { name: 'Koble til Oda' }).click()
  await expect(page.getByRole('link', { name: /^Oda: \d+ varer i handlekurven$/ })).toBeVisible()
}

// The week's dish names (the stub gives six days a dish, Thursday none).
export const dishes = (page: Page) => page.getByRole('group', { name: /^Oppskrift / })

// Signs in, opens Middag and waits for this week's dish names. With recipes, also makes
// the Recipes and waits until Iverksett is possible.
export async function openMiddag(page: Page, { recipes = false } = {}) {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Middag')
  await expect(dishes(page)).toHaveCount(6)
  if (!recipes) return
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
}
