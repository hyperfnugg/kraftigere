import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, listDocs, openTab, readDoc, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Opens Middag and waits for this week's Menu and its 7 Recipes (stub). Each stub Recipe
// has 200 g løk and salt to taste, and the stub matches each wording to a Staple of its name.
async function openMiddag(page: Page) {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Middag')
  await expect(page.getByRole('group', { name: /^Oppskrift / })).toHaveCount(7)
}

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
  await openMiddag(page)
  await page.getByRole('button', { name: 'Iverksett' }).click()
  // Seven Recipes with løk on six days, Saturday twice.
  await expect(line(page, 'løk')).toContainText('løk 1400 g · man, tir, ons, fre, lør, søn')
  await expect(line(page, 'salt')).toContainText('salt · man, tir, ons, fre, lør, søn')

  await line(page, 'salt').getByRole('checkbox', { name: 'Kjøp salt' }).uncheck()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect(screen(page)).toHaveCount(0)
  await expect(page.getByText(/^Iverksatt · /)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toHaveCount(0)

  await expect
    .poll(menuEntries)
    .toEqual([{ text: 'løk', staple: 'løk', ware: undefined, amount: '1400 g', days: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'] }])
  expect((await readDoc('staples/salt')).usuallyAtHome.booleanValue).toBe(true)
  expect((await readDoc('staples/løk')).addCount.integerValue).toBe('0')

  // Salt starts unticked next week.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(page.getByRole('group', { name: /^Oppskrift / })).toHaveCount(7)
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'salt').getByRole('checkbox')).not.toBeChecked()
  await expect(line(page, 'løk').getByRole('checkbox')).toBeChecked()
})

test('a corrected match is used next week without the AI', async ({ page }) => {
  await openMiddag(page)
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
  await expect(page.getByRole('group', { name: /^Oppskrift / })).toHaveCount(7)
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'rødløk')).toBeVisible()
  await expect(line(page, 'løk')).toHaveCount(0)
})
