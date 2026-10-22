import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, entry, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('tapping an Entry on Home sets, changes and removes its Note', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'eggs')
  const note = page.getByRole('textbox', { name: 'Notat' })

  await entry(page, 'eggs').getByText('eggs').click()
  await note.fill('lots')
  await note.press('Enter')
  await expect(entry(page, 'eggs')).toContainText('eggs · lots')

  await entry(page, 'eggs').getByText('eggs').click()
  await expect(note).toHaveValue('lots')
  await note.fill('the big pack')
  await note.blur()
  await expect(entry(page, 'eggs')).toContainText('eggs · the big pack')

  // Tapping again closes it, and once more opens it.
  await entry(page, 'eggs').getByText('eggs').click()
  await expect(note).toHaveCount(0)
  await entry(page, 'eggs').getByText('eggs').click()
  await note.fill('')
  await note.press('Enter')
  await expect(entry(page, 'eggs')).not.toContainText('·')
})
