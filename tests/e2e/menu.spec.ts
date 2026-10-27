import { expect, test, type Page } from '@playwright/test'
import { dishes, openMiddag, openTab, reset, seed } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const dish = (page: Page, name: string) => page.getByRole('group', { name: `Oppskrift ${name}`, exact: true })
// A dish's name is a button once it has a Recipe.
const withRecipe = (page: Page) => dishes(page).getByRole('button')

test("Middag makes this and next week's dish names, and Lag oppskrifter a Recipe for each, once", async ({
  page,
}) => {
  await openMiddag(page)
  await expect(dishes(page)).toHaveText(['Fiskesuppe', 'Taco', 'Pasta med kjøttsaus', 'Pizza', 'Lammestek', 'Pannekaker'])
  await expect(page.getByText('Ingen middag')).toHaveCount(1)
  await expect(withRecipe(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeDisabled()

  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(withRecipe(page)).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Lag oppskrifter' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Iverksett' })).toBeEnabled()

  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(dishes(page)).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Lag oppskrifter' })).toBeEnabled()
})

test('before Lag oppskrifter a day is edited by tapping it, and ↻ makes it a new dish', async ({ page }) => {
  await openMiddag(page)
  await page.getByRole('button', { name: 'Endre tirsdag' }).click()
  // The Note comes first and has focus.
  await expect(page.getByRole('textbox', { name: 'Notat' })).toBeFocused()
  const meal = page.getByRole('textbox', { name: 'Middag' })
  await expect(meal).toHaveValue('Taco')
  await meal.fill('Fiskegrateng')
  await meal.press('Enter')
  await expect(dish(page, 'Fiskegrateng')).toBeVisible()
  await expect(dish(page, 'Taco')).toHaveCount(0)

  // The stub puts the instruction on Thursday.
  await page.getByRole('button', { name: 'Ny middag torsdag' }).click()
  await expect(dish(page, 'Stub: Lag ny middag for torsdag ut fra notatet for dagen.')).toBeVisible()
  await expect(page.getByText('Ingen middag')).toHaveCount(0)

  await page.reload()
  await openTab(page, 'Middag')
  await expect(dish(page, 'Fiskegrateng')).toBeVisible()

  // After Lag oppskrifter, days aren't edited from the Menu.
  await page.getByRole('button', { name: 'Lag oppskrifter' }).click()
  await expect(withRecipe(page)).toHaveCount(7)
  await expect(page.getByRole('button', { name: /^Endre |^Ny middag / })).toHaveCount(0)
})

test('a Recipe opens full screen from its day, and hand edits stay', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await page.getByText('Tirsdag').click()
  const view = page.getByRole('dialog', { name: 'Taco' })
  await expect(view.getByRole('heading', { name: 'Taco' })).toBeVisible()
  await view.getByRole('button', { name: 'Rediger' }).click()
  await expect(view.getByRole('textbox', { name: 'Porsjoner' })).toHaveValue('4')
  await expect(view.getByRole('textbox', { name: 'Fremgangsmåte steg 1' })).toHaveValue('Lag taco.')
  const amount = view.getByRole('group', { name: 'Ingrediens løk' }).getByRole('textbox', { name: 'Gram' })
  await amount.fill('350')
  await amount.blur()
  await expect(amount).toHaveValue('350')

  // The stub puts the instruction in the steps.
  await view.getByRole('textbox', { name: 'Endring i oppskriften Taco' }).fill('Mindre salt')
  await view.getByRole('button', { name: 'Endre', exact: true }).click()
  await expect(view.getByRole('textbox', { name: 'Fremgangsmåte steg 1' })).toHaveValue('Stub: Mindre salt')

  await view.getByRole('button', { name: '‹ Meny' }).click()
  await expect(view).toHaveCount(0)

  await page.reload()
  await openTab(page, 'Middag')
  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  await view.getByRole('button', { name: 'Rediger' }).click()
  await expect(amount).toHaveValue('350')
})

test('a Recipe step is inserted in the middle with its own Ingredients, and a step is removed', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await page.getByText('Tirsdag').click()
  const view = page.getByRole('dialog', { name: 'Taco' })
  const step = (n: number) => view.getByRole('group', { name: `Steg ${n}`, exact: true })
  const text = (n: number) => view.getByRole('textbox', { name: `Fremgangsmåte steg ${n}` })
  await view.getByRole('button', { name: 'Rediger' }).click()
  await expect(view.getByRole('group', { name: /^Steg \d+$/ })).toHaveCount(2)

  await view.getByRole('button', { name: 'Nytt steg etter steg 1' }).click()
  await expect(view.getByRole('group', { name: /^Steg \d+$/ })).toHaveCount(3)
  await expect(text(2)).toHaveValue('')
  await expect(text(3)).toHaveValue('La det hvile.\nServer.')
  await text(2).fill('Hakk hvitløken.')
  await text(2).blur()

  await step(2).getByRole('button', { name: 'Legg til ingrediens' }).click()
  const ingredient = step(2).getByRole('group', { name: 'Ingrediens ny ingrediens' })
  await ingredient.getByRole('textbox', { name: 'Gram' }).fill('10')
  await ingredient.getByRole('textbox', { name: 'Mål' }).fill('2 fedd')
  await ingredient.getByRole('textbox', { name: 'Ingrediens' }).fill('hvitløk')
  await ingredient.getByRole('textbox', { name: 'Ingrediens' }).blur()
  const garlic = step(2).getByRole('group', { name: 'Ingrediens hvitløk' })
  await expect(garlic.getByRole('textbox', { name: 'Mål' })).toHaveValue('2 fedd')

  await view.getByRole('button', { name: 'Fjern steg 3' }).click()
  await expect(view.getByRole('group', { name: /^Steg \d+$/ })).toHaveCount(2)

  await page.reload()
  await openTab(page, 'Middag')
  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  await view.getByRole('button', { name: 'Rediger' }).click()
  await expect(text(2)).toHaveValue('Hakk hvitløken.')
  await expect(garlic.getByRole('textbox', { name: 'Gram' })).toHaveValue('10')
})
