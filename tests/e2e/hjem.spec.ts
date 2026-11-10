import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, addEntry, chip, entry, readDoc, reset, seed, signIn, writeDoc } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const field = (page: Page) => page.getByPlaceholder('Hva trenger vi?')
const row = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

// A Ware as the REST API takes it, added by hand `count` times.
const ware = (name: string, count: number) => ({ name: { stringValue: name }, addCount: { integerValue: String(count) } })

test('the List is alphabetical, and what is typed filters it until Esc or × clears it', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['Ost', 'Melk', 'Brød']) await addEntry(page, text)
  await expect(page.getByRole('listitem')).toHaveText(['Brød', 'Melk', 'Ost'])

  await field(page).fill('me')
  await expect(page.getByRole('listitem')).toHaveText(['Melk'])
  await field(page).press('Escape')
  await expect(field(page)).toHaveValue('')
  await expect(page.getByRole('listitem')).toHaveCount(3)

  // Punctuation at the ends doesn't count.
  await field(page).fill('ost,')
  await expect(page.getByRole('listitem')).toHaveText(['Ost'])
  await page.getByRole('button', { name: 'Tøm' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(3)
  await expect(field(page)).toBeFocused()
})

test('Enter never adds by itself; the + chip adds what is typed, without stray punctuation', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await field(page).fill(' Ost. ')
  await field(page).press('Enter')
  await expect(page.getByRole('listitem')).toHaveCount(0)

  // Down highlights "+", first in the row, and Enter adds it.
  await expect(page.getByRole('option').first()).toHaveText('+ Ost')
  await field(page).press('ArrowDown')
  await field(page).press('Enter')
  await expect(page.getByRole('listitem')).toHaveText(['Ost'])
  await expect(field(page)).toHaveValue('')
  await expect.poll(async () => (await readDoc('wares/ost').catch(() => null))?.name.stringValue).toBe('Ost')

  // Tapping it works too.
  await field(page).fill('Brød')
  await page.getByRole('option', { name: '+ Brød' }).click()
  await expect(page.getByRole('listitem')).toHaveText(['Brød', 'Ost'])
})

test('with nothing typed, + picks several of the most added Staples, added on closing', async ({ page }) => {
  for (const [id, count] of [
    ['milk', 4],
    ['eggs', 2],
    ['bread', 1],
    ['eggplant', 0],
  ] as const) {
    await writeDoc(`wares/${id}`, ware(id, count))
  }
  await signIn(page, MEMBERS[0])
  await page.getByRole('option', { name: '+', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Legg til fra basisvarer' })
  await expect(picker.getByRole('checkbox')).toHaveCount(3)
  await expect(picker.getByRole('listitem')).toHaveText(['milk', 'eggs', 'bread'])
  await expect(picker.getByRole('button')).toHaveText('Lukk')

  await picker.getByRole('checkbox', { name: 'milk' }).check()
  await picker.getByRole('checkbox', { name: 'bread' }).check()
  await picker.getByRole('button', { name: 'Legg til 2' }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('listitem')).toHaveText(['bread', 'milk'])

  // Those waiting aren't offered again. Esc closes, adding what's ticked.
  await page.getByRole('option', { name: '+', exact: true }).click()
  await expect(picker.getByRole('listitem')).toHaveText(['eggs'])
  await picker.getByRole('checkbox', { name: 'eggs' }).check()
  await page.keyboard.press('Escape')
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('listitem')).toHaveText(['bread', 'eggs', 'milk'])
})

test('the List works from the keyboard', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['Ost', 'Melk', 'Brød']) await addEntry(page, text)

  // Enter in the field goes to the List, and the arrows move in it.
  await field(page).focus()
  await field(page).press('Enter')
  await expect(row(page, 'Brød')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(row(page, 'Melk')).toBeFocused()
  await page.keyboard.press('End')
  await expect(row(page, 'Ost')).toBeFocused()
  await page.keyboard.press('ArrowUp')

  // Enter opens the row at its Note, and Esc goes back to the row.
  await page.keyboard.press('Enter')
  const note = page.getByRole('textbox', { name: 'Notat' })
  await expect(note).toBeFocused()
  await note.fill('lett')
  await note.press('Escape')
  await expect(note).toHaveCount(0)
  await expect(row(page, 'Melk · lett')).toBeFocused()

  // The List is one Tab stop: in from the field, then out past it.
  await field(page).focus()
  await page.keyboard.press('Tab')
  await expect(row(page, 'Melk · lett')).toBeFocused()

  // Typing on a row goes back to the field.
  await page.keyboard.press('o')
  await expect(field(page)).toBeFocused()
  await expect(field(page)).toHaveValue('o')
  await expect(page.getByRole('listitem')).toHaveText(['Ost'])
})

test('an open Entry closes on a tap outside, keeping its Note, and a tap on another row opens that one', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['Ost', 'Brød']) await addEntry(page, text)
  const note = page.getByRole('textbox', { name: 'Notat' })

  await entry(page, 'Brød').getByText('Brød').click()
  await note.fill('grovt')
  await field(page).click()
  await expect(note).toHaveCount(0)
  await expect(entry(page, 'Brød')).toHaveText('Brød · grovt')

  // Closing the row above moves the one below, and the tap still lands on it.
  await entry(page, 'Brød').getByText('Brød').click()
  await entry(page, 'Ost').getByText('Ost').click()
  await expect(entry(page, 'Ost').getByRole('textbox', { name: 'Notat' })).toBeVisible()
  await expect(note).toHaveCount(1)

  // Fjern is on the open row's title line.
  await entry(page, 'Ost').getByRole('button', { name: 'Fjern' }).click()
  await expect(page.getByRole('listitem')).toHaveText(['Brød · grovt'])
})

test('chips that do not fit in one row are left out', async ({ page }) => {
  for (const name of ['aaaa aaaa aaaa', 'bbbb bbbb bbbb', 'cccc cccc cccc', 'dddd dddd dddd', 'eeee eeee eeee'])
    await writeDoc(`wares/${name}`, ware(name, 1))
  await page.setViewportSize({ width: 360, height: 700 })
  await signIn(page, MEMBERS[0])
  const shown = page.locator('[role=option]:not([aria-hidden])')
  await expect(shown.first()).toHaveText('+')
  // The Wares' chips come once they load.
  await expect.poll(() => shown.count()).toBeGreaterThan(1)
  expect(await shown.count()).toBeLessThan(6)
  const tops = await shown.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))
  expect(new Set(tops).size).toBe(1)

  // Down stops at the last chip shown.
  await field(page).focus()
  for (let i = 0; i < 6; i++) await field(page).press('ArrowDown')
  await expect(field(page)).toHaveAttribute('aria-activedescendant', (await shown.last().getAttribute('id'))!)
})

test('a staple chip added from the keyboard', async ({ page }) => {
  await writeDoc('wares/melk', ware('Melk', 3))
  await signIn(page, MEMBERS[0])
  await field(page).fill('me')
  await expect(chip(page, 'Melk')).toBeVisible()
  // "+ me" comes first, then Melk.
  await field(page).press('ArrowDown')
  await field(page).press('ArrowDown')
  await field(page).press('Enter')
  await expect(page.getByRole('listitem')).toHaveText(['Melk'])
})
