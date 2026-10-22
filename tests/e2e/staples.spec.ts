import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, entry, openTab, readDoc, reset, seed, signIn } from './helpers'

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

test('with the field empty, the most added Staples not already waiting show', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  const input = page.getByPlaceholder('Add entry')
  for (const name of ['milk', 'milk', 'milk', 'milk', 'eggs', 'eggs', 'bread']) {
    await input.fill(name)
    await input.press('Enter')
  }
  await expect(page.getByRole('listitem')).toHaveCount(7)
  await openTab(page, 'Shop')
  // Shop moves each Entry down as it's checked, so always take the first unchecked one.
  const unchecked = page.getByRole('checkbox', { checked: false })
  for (let left = 7; left > 0; left--) {
    await expect(unchecked).toHaveCount(left)
    await unchecked.first().click()
  }
  await expect(unchecked).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove checked' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(0)
  await openTab(page, 'Home')

  const suggestions = page.getByRole('button', { name: /^(milk|eggs|bread)$/ })
  await expect(suggestions).toHaveText(['milk', 'eggs', 'bread'])

  // Tapping one puts it on the List, so it leaves the suggestions until checked off.
  // (eggs is then added 3 times, still behind milk's 4.)
  await page.getByRole('button', { name: 'eggs', exact: true }).click()
  await expect(entry(page, 'eggs')).toBeVisible()
  await expect(suggestions).toHaveText(['milk', 'bread'])

  await openTab(page, 'Shop')
  await entry(page, 'eggs').getByRole('checkbox').click()
  await expect(entry(page, 'eggs').getByRole('checkbox')).toBeChecked()
  await openTab(page, 'Home')
  await expect(suggestions).toHaveText(['milk', 'eggs', 'bread'])
})
