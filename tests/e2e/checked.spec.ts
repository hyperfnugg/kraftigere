import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, entry, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('Remove checked removes only the Checked Entries', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')
  await addEntry(page, 'eggs')
  await entry(page, 'milk').getByRole('checkbox').click()
  await expect(entry(page, 'milk').getByRole('checkbox')).toBeChecked()

  await page.getByRole('button', { name: 'Remove checked' }).click()
  await expect(entry(page, 'milk')).toHaveCount(0)
  await expect(entry(page, 'eggs')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove checked' })).toHaveCount(0)
})

test('Checked Entries are removed 15 minutes after the most recent check-off', async ({ page }) => {
  // Only the page's clock is faked. Check-off times come from the emulator's real clock.
  await page.clock.install()
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'milk')
  await addEntry(page, 'eggs')
  await entry(page, 'milk').getByRole('checkbox').click()
  await expect(entry(page, 'milk').getByRole('checkbox')).toBeChecked()

  await page.clock.fastForward('14:00')
  // Give a would-be removal time to happen, then check it didn't.
  await page.waitForTimeout(1_000)
  await expect(entry(page, 'milk')).toBeVisible()

  await page.clock.fastForward('02:00')
  await expect(entry(page, 'milk')).toHaveCount(0)
  await expect(entry(page, 'eggs')).toBeVisible()
})
