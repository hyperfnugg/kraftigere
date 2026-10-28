import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, addEntry, dishes, entry, listDocs, openMiddag, openTab, readDoc, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Each stub Recipe has 200 g (2 stk) løk and salt to taste, and the stub matches each wording to a
// Ware of its name.

const screen = (page: Page) => page.getByRole('dialog', { name: 'Iverksett' })
const line = (page: Page, name: string) => screen(page).getByRole('group', { name, exact: true })

// A REST number value, or null.
const num = (v: { integerValue?: string; doubleValue?: number }) =>
  v.integerValue !== undefined ? Number(v.integerValue) : (v.doubleValue ?? null)

// The Entries on Groceries, as plain values.
async function entries() {
  type Fields = Record<string, { stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number }>
  return (await listDocs('entries')).map((e: Fields & { dishes?: { arrayValue: { values: { mapValue: { fields: Fields } }[] } } }) => ({
    text: e.text.stringValue,
    ware: e.ware.stringValue,
    checked: e.checked.booleanValue,
    note: e.note?.stringValue,
    dishes: e.dishes?.arrayValue.values.map(({ mapValue: { fields: d } }) => ({
      week: d.week.stringValue,
      recipe: d.recipe.stringValue,
      course: d.course.stringValue,
      grams: num(d.grams),
      pieces: num(d.pieces),
    })),
  }))
}

// Signs in, adds to Groceries by hand, and makes this week's Recipes, ready for Iverksett.
async function addThenMakeRecipes(page: Page, add: (page: Page) => Promise<void>) {
  await signIn(page, MEMBERS[0])
  await add(page)
  await openTab(page, 'Middag')
  await expect(dishes(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
}

test('Iverksett sends one Entry per Ware with its dishes, leaving out what is at home', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  // Six Recipes with løk, one a day.
  await expect(line(page, 'løk')).toContainText('løk · 1200 g (12 stk) · man, tir, ons, fre, lør, søn')
  await expect(line(page, 'salt')).toContainText('salt · man, tir, ons, fre, lør, søn')

  await line(page, 'salt').getByRole('checkbox', { name: 'Kjøp salt' }).uncheck()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect(screen(page)).toHaveCount(0)
  await expect(page.getByText(/^Iverksatt · /)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toHaveCount(0)

  await expect.poll(async () => (await entries()).map((e) => e.text)).toEqual(['løk'])
  const [løk] = await entries()
  expect(løk.ware).toBe('løk')
  expect(løk.dishes).toHaveLength(6)
  expect(løk.dishes?.find((d) => d.recipe === 'mon-0')).toEqual({
    week: expect.stringMatching(/^\d{4}-W\d{2}$/),
    recipe: 'mon-0',
    course: 'Fiskesuppe',
    grams: 200,
    pieces: 2,
  })
  expect((await readDoc('wares/salt')).usuallyAtHome.booleanValue).toBe(true)
  expect((await readDoc('wares/løk')).addCount.integerValue).toBe('0')

  // Salt starts unticked next week. Løk is waiting on the List, so its line is left off.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'salt').getByRole('checkbox')).not.toBeChecked()
  await expect(line(page, 'løk')).toHaveCount(0)
})

test('a corrected match is used next week without the AI', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await line(page, 'løk').getByRole('button').click()
  await screen(page).getByRole('textbox', { name: 'Vare' }).fill('løk, rød')
  await screen(page).getByRole('button', { name: 'Lagre' }).click()
  await expect(line(page, 'løk, rød')).toContainText('fra løk')
  await expect(line(page, 'løk')).toHaveCount(0)
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()

  await expect.poll(async () => (await entries()).map((e) => [e.text, e.ware])).toContainEqual(['løk, rød', 'løk, rød'])

  // The stub would match løk to the Ware løk, so next week's løk going to the waiting
  // løk, rød shows the remembered match. Salt is waiting too, so no line is shown.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(screen(page).getByRole('button', { name: 'Iverksett', exact: true })).toBeVisible()
  await expect(screen(page).getByRole('group')).toHaveCount(0)
  await expect(line(page, 'løk, rød')).toHaveCount(0)
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect.poll(async () => (await entries()).find((e) => e.text === 'løk, rød')?.dishes?.length).toBe(12)
})

test('a Ware already waiting on the List is left off the screen, and gets the dishes', async ({ page }) => {
  await addThenMakeRecipes(page, async (page) => {
    await addEntry(page, 'løk')
    await entry(page, 'løk').getByText('løk').click()
    await page.getByRole('textbox', { name: 'Notat' }).fill('store')
    await page.getByRole('textbox', { name: 'Notat' }).press('Enter')
  })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'salt')).toBeVisible()
  await expect(line(page, 'løk')).toHaveCount(0)
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()

  await expect.poll(async () => (await entries()).find((e) => e.text === 'løk')?.dishes?.length).toBe(6)
  expect((await entries()).filter((e) => e.text === 'løk')).toMatchObject([{ checked: false, note: 'store' }])
  await openTab(page, 'Hjem')
  await expect(entry(page, 'løk')).toHaveText('løk · store · 1200 g (12 stk)')
})

test('a Ware checked off on the List gets a new Entry', async ({ page }) => {
  await addThenMakeRecipes(page, async (page) => {
    await addEntry(page, 'løk')
    await openTab(page, 'Handle')
    await entry(page, 'løk').getByRole('checkbox').click()
    await expect(entry(page, 'løk').getByRole('checkbox')).toBeChecked()
  })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await expect(line(page, 'løk')).toBeVisible()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()

  await expect
    .poll(async () => (await entries()).filter((e) => e.text === 'løk').map((e) => [e.checked, e.dishes?.length]))
    .toEqual([[false, 6]])
})

// Iverksetter this week as the screen proposes it.
async function confirmed(page: Page) {
  await openMiddag(page, { recipes: true })
  await page.getByRole('button', { name: 'Iverksett' }).click()
  await screen(page).getByRole('button', { name: 'Iverksett', exact: true }).click()
  await expect(page.getByText(/^Iverksatt · /)).toBeVisible()
  await expect.poll(async () => (await entries()).length).toBe(2)
}

test('after Iverksett only the Recipes are edited, by hand, and Groceries stays as it was', async ({ page }) => {
  await confirmed(page)
  await expect(page.getByRole('textbox', { name: 'Endring i menyen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  const view = page.getByRole('dialog', { name: 'Taco' })
  await expect(view.getByRole('textbox', { name: 'Endring i oppskriften Taco' })).toHaveCount(0)
  await view.getByRole('button', { name: 'Rediger' }).click()
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

  expect((await entries()).find((e) => e.text === 'løk')?.dishes?.map((d) => d.grams)).toEqual([200, 200, 200, 200, 200, 200])
})

test('an Iverksett Entry shows what its dishes need, lists them, takes a Note, and is Removed and checked off', async ({
  page,
}) => {
  await confirmed(page)
  await openTab(page, 'Hjem')
  await expect(entry(page, 'løk')).toHaveText('løk · 1200 g (12 stk)')

  // The chef's hat lists the dishes, each opening its Recipe.
  await entry(page, 'løk').getByRole('button', { name: 'Fra middag' }).click()
  const popup = page.getByRole('dialog', { name: 'løk fra middag' })
  await expect(popup.getByRole('button')).toHaveText(['✕', 'Fiskesuppe', 'Taco', 'Pasta med kjøttsaus', 'Pizza', 'Lammestek', 'Pannekaker'])
  await popup.getByRole('button', { name: 'Taco' }).click()
  await expect(page.getByRole('button', { name: 'Middag', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const recipe = page.getByRole('dialog', { name: 'Taco' })
  await expect(recipe.getByRole('cell', { name: 'løk' })).toBeVisible()
  await recipe.getByRole('button', { name: '‹ Meny' }).click()
  await expect(recipe).toHaveCount(0)

  await openTab(page, 'Hjem')
  await entry(page, 'løk').getByText('løk').click()
  await page.getByRole('textbox', { name: 'Notat' }).fill('store')
  await page.getByRole('textbox', { name: 'Notat' }).press('Enter')
  await expect(entry(page, 'løk')).toHaveText('løk · store · 1200 g (12 stk)')
  await entry(page, 'løk').getByText('løk').click()
  await entry(page, 'løk').getByRole('button', { name: 'Fjern' }).click()
  await expect(entry(page, 'løk')).toHaveCount(0)

  // On Handle, the chef's hat lists the dishes without checking the Entry off.
  await openTab(page, 'Handle')
  await entry(page, 'salt').getByRole('button', { name: 'Fra middag' }).click()
  await page.getByRole('dialog', { name: 'salt fra middag' }).getByRole('button', { name: 'Lukk' }).click()
  await expect(entry(page, 'salt').getByRole('checkbox')).not.toBeChecked()
  // The checkbox flips after the write, not on click.
  await entry(page, 'salt').getByRole('checkbox').click()
  await expect(entry(page, 'salt').getByRole('checkbox')).toBeChecked()
})
