import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, entry, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('tapping an Entry on Home sets, changes and removes its amount', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'eggs')
  const amount = page.getByRole('textbox', { name: 'Amount' })

  await entry(page, 'eggs').getByText('eggs').click()
  await amount.fill('lots')
  await amount.press('Enter')
  await expect(entry(page, 'eggs')).toContainText('eggs · lots')

  await entry(page, 'eggs').getByText('eggs').click()
  await expect(amount).toHaveValue('lots')
  await amount.fill('12')
  await amount.blur()
  await expect(entry(page, 'eggs')).toContainText('eggs · 12')

  // Tapping again closes it, and once more opens it.
  await entry(page, 'eggs').getByText('eggs').click()
  await expect(amount).toHaveCount(0)
  await entry(page, 'eggs').getByText('eggs').click()
  await amount.fill('')
  await amount.press('Enter')
  await expect(entry(page, 'eggs')).not.toContainText('·')
})
