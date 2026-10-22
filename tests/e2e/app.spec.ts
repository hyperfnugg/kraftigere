import { expect, test } from '@playwright/test'
import {
  MEMBERS,
  OUTSIDER,
  addEntry,
  completeGooglePopup,
  entry,
  openTab,
  reset,
  seed,
  setMembers,
  signIn,
} from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('a Family Member signs in and sees the List', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await expect(page.getByPlaceholder('Add entry')).toBeVisible()
})

test('a non-member sees the not-authorized screen', async ({ page }) => {
  await completeGooglePopup(page, OUTSIDER)
  await expect(page.getByText('Not authorized')).toBeVisible()
  await expect(page.getByPlaceholder('Add entry')).toHaveCount(0)
})

test('a Family Member removed by the Admin ends on Not authorized, despite the cached List', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')
  await setMembers([MEMBERS[1]])
  await page.reload()
  await expect(page.getByText('Not authorized')).toBeVisible()
  await expect(entry(page, 'milk')).toHaveCount(0)
})

test('add on Home, check off and uncheck in Shop, remove on Home', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')

  await openTab(page, 'Shop')
  const checkbox = entry(page, 'milk').getByRole('checkbox')
  // The checkbox is controlled by Firestore, so it flips after the write, not on click.
  await checkbox.click()
  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()

  await openTab(page, 'Home')
  await entry(page, 'milk').getByText('milk').click()
  await entry(page, 'milk').getByRole('button', { name: 'Remove' }).click()
  await expect(entry(page, 'milk')).toHaveCount(0)
})

test('Home removes in two taps and never checks off', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')
  await expect(entry(page, 'milk').getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await expect(entry(page, 'milk').getByRole('checkbox')).toHaveCount(0)

  await entry(page, 'milk').getByText('milk').click()
  await expect(entry(page, 'milk').getByRole('button', { name: /check/i })).toHaveCount(0)
  await entry(page, 'milk').getByRole('button', { name: 'Remove' }).click()
  await expect(entry(page, 'milk')).toHaveCount(0)
})

test('Shop shows unchecked Entries first', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['milk', 'eggs', 'bread']) await addEntry(page, text)
  await openTab(page, 'Shop')
  await entry(page, 'milk').getByRole('checkbox').click()
  await expect(page.getByRole('listitem')).toHaveText(['eggs', 'bread', 'milk'])
})

test('an Entry added in one browser appears in another', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  await signIn(alice, MEMBERS[0])
  await signIn(bob, MEMBERS[1])

  await addEntry(alice, 'bread')
  await expect(entry(bob, 'bread')).toBeVisible()
})

test('fun fact shows only on the newest unchecked Entry', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')
  await addEntry(page, 'eggs')
  const funFact = (text: string) => entry(page, text).getByRole('button', { name: 'Fun fact' })

  await expect(funFact('eggs')).toBeVisible()
  await expect(funFact('milk')).toHaveCount(0)

  await funFact('eggs').click()
  await expect(entry(page, 'eggs')).toContainText('Stub fun fact (dev).')

  // Checking it off in Shop moves the button down and clears the fact.
  await openTab(page, 'Shop')
  await entry(page, 'eggs').getByRole('checkbox').click()
  await expect(entry(page, 'eggs').getByRole('checkbox')).toBeChecked()
  await openTab(page, 'Home')
  await expect(funFact('milk')).toBeVisible()
  await expect(page.getByText('Stub fun fact (dev).')).toHaveCount(0)
})
