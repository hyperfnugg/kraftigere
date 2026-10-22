import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, entry, readDoc, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('adding the same Staple in different spellings counts one Staple', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'Melk')
  await addEntry(page, 'Melk')
  await page.getByPlaceholder('Add entry').fill('melk ')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(entry(page, 'Melk')).toHaveCount(3)

  await expect(async () => {
    const staple = await readDoc('staples/melk')
    expect(staple.name.stringValue).toBe('Melk')
    expect(staple.addCount.integerValue).toBe('3')
  }).toPass()
})

test('typing suggests Staples, and tapping one adds it', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'Melk')
  await page.getByPlaceholder('Add entry').fill('me')
  await page.getByRole('button', { name: 'Melk' }).click()
  await expect(entry(page, 'Melk')).toHaveCount(2)
  await expect(page.getByPlaceholder('Add entry')).toHaveValue('')
})

test('suggestions starting with the text come first, then by how often they are added', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  const input = page.getByPlaceholder('Add entry')
  for (const name of ['nutmeg', 'nutmeg', 'nutmeg', 'egg noodles', 'eggs', 'eggs']) {
    await input.fill(name)
    await input.press('Enter')
  }
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await input.fill('eg')
  const suggestions = page.getByRole('button').filter({ hasText: /eg/ })
  await expect(suggestions).toHaveText(['eggs', 'egg noodles', 'nutmeg'])
})
