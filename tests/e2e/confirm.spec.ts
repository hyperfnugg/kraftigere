import { expect, test, type Page } from '@playwright/test'
import { entry, listDocs, openMiddag, openTab, readDoc, reset, seed } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Each stub Recipe has 200 g (2 stk) løk and salt to taste, and the stub matches each wording to a
// Staple of its name.

const screen = (page: Page) => page.getByRole('dialog', { name: 'Iverksett' })
const line = (page: Page, name: string) => screen(page).getByRole('group', { name, exact: true })

// The Menu Entries on Groceries, as plain values.
async function menuEntries() {
  return (await listDocs('entries')).map((e) => ({
    text: e.text.stringValue,
    staple: e.staple?.stringValue,
    ware: e.ware?.stringValue,
    amount: e.amount.stringValue,
    days: e.days.arrayValue.values.map((v: { stringValue: string }) => v.stringValue),
  }))
}

test('Iverksett sends one Menu Entry per Staple with summed amounts and days, leaving out what is at home', async ({
  page,
}) => {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  // Six Recipes with løk, one a day.
  await expect(line(page, 'løk')).toContainText('løk 1200 g (12 stk) · man, tir, ons, fre, lør, søn')
  await expect(line(page, 'salt')).toContainText('salt · man, tir, ons, fre, lør, søn')

  await line(page, 'salt').getByRole('checkbox', { name: 'Kjøp salt' }).uncheck()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect(screen(page)).toHaveCount(0)
  await expect(page.getByText(/^Iverksatt · /)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toHaveCount(0)

  await expect
    .poll(menuEntries)
    .toEqual([{ text: 'løk', staple: 'løk', ware: undefined, amount: '1200 g (12 stk)', days: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'] }])
  expect((await readDoc('staples/salt')).usuallyAtHome.booleanValue).toBe(true)
  expect((await readDoc('staples/løk')).addCount.integerValue).toBe('0')

  // Salt starts unticked next week.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'salt').getByRole('checkbox')).not.toBeChecked()
  await expect(line(page, 'løk').getByRole('checkbox')).toBeChecked()
})

test('a corrected match is used next week without the AI', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await line(page, 'løk').getByRole('button').click()
  await screen(page).getByRole('combobox', { name: 'Type' }).selectOption('Vare')
  await screen(page).getByRole('textbox', { name: 'Navn' }).fill('rødløk')
  await screen(page).getByRole('button', { name: 'Lagre' }).click()
  await expect(line(page, 'rødløk')).toContainText('Vare · fra løk')
  await expect(line(page, 'løk')).toHaveCount(0)
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()

  await expect.poll(async () => (await menuEntries()).map((e) => [e.text, e.ware])).toContainEqual(['rødløk', 'rødløk'])

  // The stub would match løk to the Staple løk, so rødløk shows the remembered match.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'rødløk')).toBeVisible()
  await expect(line(page, 'løk')).toHaveCount(0)
})

// Iverksetter this week as the screen proposes it.
async function confirmed(page: Page) {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect(page.getByText(/^Iverksatt · /)).toBeVisible()
  await expect.poll(async () => (await menuEntries()).length).toBe(2)
}

test('after Iverksett only the Recipes are edited, by hand, and Groceries stays as it was', async ({ page }) => {
  await confirmed(page)
  await expect(page.getByRole('textbox', { name: 'Endring i menyen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  const view = page.getByRole('dialog', { name: 'Taco' })
  await expect(view.getByRole('textbox', { name: 'Endring i oppskriften Taco' })).toHaveCount(0)
  const amount = view.getByRole('group', { name: 'Ingrediens løk' }).getByRole('textbox', { name: 'Gram' })
  await amount.fill('999')
  await amount.blur()
  await expect(amount).toHaveValue('999')
  await view.getByRole('button', { name: '‹ Meny' }).click()

  // The Ingredients are bought, so the days can't be edited.
  await expect(page.getByRole('button', { name: /^Endre (mandag|tirsdag)/ })).toHaveCount(0)

  // Nothing is Outdated after Iverksett.
  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()
  await expect(page.getByRole('button', { name: /^Utdatert|^Lag på nytt/ })).toHaveCount(0)

  expect((await menuEntries()).find((e) => e.text === 'løk')?.amount).toBe('1200 g (12 stk)')
})

test('a Menu Entry shows its amount and days, is Removed on Hjem and checked off on Handle', async ({ page }) => {
  await confirmed(page)
  await openTab(page, 'Hjem')
  await expect(entry(page, 'løk')).toHaveText('løk 1200 g (12 stk) · man, tir, ons, fre, lør, søn')
  await entry(page, 'løk').getByText('løk').click()
  await expect(page.getByRole('textbox', { name: 'Notat' })).toHaveCount(0)
  await entry(page, 'løk').getByRole('button', { name: 'Fjern' }).click()
  await expect(entry(page, 'løk')).toHaveCount(0)

  await openTab(page, 'Handle')
  await expect(entry(page, 'salt')).toHaveText('salt · man, tir, ons, fre, lør, søn')
  // The checkbox flips after the write, not on click.
  await entry(page, 'salt').getByRole('checkbox').click()
  await expect(entry(page, 'salt').getByRole('checkbox')).toBeChecked()
})
