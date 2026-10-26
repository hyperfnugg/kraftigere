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
  await expect(view.getByRole('textbox', { name: 'Porsjoner' })).toHaveValue('4')
  await expect(view.getByRole('textbox', { name: 'Fremgangsmåte' })).toHaveValue('1. Lag taco.')
  const amount = view.getByRole('group', { name: 'Ingrediens løk' }).getByRole('textbox', { name: 'Mengde' })
  await amount.fill('350')
  await amount.blur()
  await expect(amount).toHaveValue('350')

  // The stub puts the instruction in the steps.
  await view.getByRole('textbox', { name: 'Endring i oppskriften Taco' }).fill('Mindre salt')
  await view.getByRole('button', { name: 'Endre', exact: true }).click()
  await expect(view.getByRole('textbox', { name: 'Fremgangsmåte' })).toHaveValue('Stub: Mindre salt')

  await view.getByRole('button', { name: '‹ Meny' }).click()
  await expect(view).toHaveCount(0)

  await page.reload()
  await openTab(page, 'Middag')
  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  await expect(amount).toHaveValue('350')
})
