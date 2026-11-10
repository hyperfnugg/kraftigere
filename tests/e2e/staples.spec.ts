import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, chip, entry, openTab, readDoc, reset, seed, signIn, writeDoc } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// A Ware as the REST API takes it, added by hand `count` times. 0 is one only Iverksett made.
const ware = (name: string, count: number) => ({ name: { stringValue: name }, addCount: { integerValue: String(count) } })

test('a Ware that is waiting, in any spelling, has no chip to add it again, and the filter finds it', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'Melk')
  await addEntry(page, 'Ost')

  await page.getByPlaceholder('Hva trenger vi?').fill(' melk. ')
  await expect(page.getByRole('option')).toHaveCount(0)
  await expect(page.getByRole('listitem')).toHaveText(['Melk'])

  await expect.poll(async () => (await readDoc('wares/melk')).addCount?.integerValue).toBe('1')
  expect((await readDoc('wares/melk')).name.stringValue).toBe('Melk')
})

test('adding a Ware that is checked off replaces its Entry with a new one', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await addEntry(page, 'Melk')
  await openTab(page, 'Handle')
  await entry(page, 'Melk').getByRole('checkbox').click()
  await expect(entry(page, 'Melk').getByRole('checkbox')).toBeChecked()

  await openTab(page, 'Hjem')
  await addEntry(page, 'melk')
  await openTab(page, 'Handle')
  await expect(entry(page, 'Melk')).toHaveCount(1)
  await expect(entry(page, 'Melk').getByRole('checkbox')).not.toBeChecked()
  await expect.poll(async () => (await readDoc('wares/melk')).addCount.integerValue).toBe('2')
})

test('typing suggests Staples starting with the text first, then by how often they are added', async ({ page }) => {
  for (const [id, count] of [
    ['nutmeg', 3],
    ['egg noodles', 1],
    ['eggs', 2],
    ['eggplant', 0],
  ] as const) {
    await writeDoc(`wares/${id}`, ware(id, count))
  }
  await signIn(page, MEMBERS[0])
  await page.getByPlaceholder('Hva trenger vi?').fill('eg')
  // eggplant came only from Iverksett, so it's no Staple.
  const suggestions = page.getByRole('option', { name: /^(eggs|egg noodles|nutmeg|eggplant)$/ })
  await expect(suggestions).toHaveText(['eggs', 'egg noodles', 'nutmeg'])
})

test('with the field empty, the most added Staples not already waiting show', async ({ page }) => {
  for (const [id, count] of [
    ['milk', 4],
    ['eggs', 2],
    ['bread', 1],
  ] as const) {
    await writeDoc(`wares/${id}`, ware(id, count))
  }
  await signIn(page, MEMBERS[0])
  const suggestions = page.getByRole('option', { name: /^(milk|eggs|bread)$/ })
  await expect(suggestions).toHaveText(['milk', 'eggs', 'bread'])

  // Tapping one puts it on the List, so it leaves the suggestions until checked off.
  // (eggs is then added 3 times, still behind milk's 4.)
  await chip(page, 'eggs').click()
  await expect(entry(page, 'eggs')).toBeVisible()
  await expect(suggestions).toHaveText(['milk', 'bread'])

  await openTab(page, 'Handle')
  await entry(page, 'eggs').getByRole('checkbox').click()
  await expect(entry(page, 'eggs').getByRole('checkbox')).toBeChecked()
  await openTab(page, 'Hjem')
  await expect(suggestions).toHaveText(['milk', 'eggs', 'bread'])
})
