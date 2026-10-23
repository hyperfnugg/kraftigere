import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const recipes = (page: Page) => page.getByRole('group', { name: /^Oppskrift / })
const recipe = (page: Page, course: string) => page.getByRole('group', { name: `Oppskrift ${course}`, exact: true })

// Opens Middag and waits for this week's Menu and its 7 Recipes (stub).
async function openMiddag(page: Page) {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Middag')
  await expect(recipes(page)).toHaveCount(7)
}

test("Middag makes this and next week's Menu, and a Recipe for every course", async ({ page }) => {
  await openMiddag(page)
  await expect(recipes(page).getByRole('button')).toHaveText([
    'Fiskesuppe',
    'Taco',
    'Pasta med kjøttsaus',
    'Pizza',
    'Lammestek',
    'Sjokolademousse',
    'Pannekaker',
  ])
  await expect(page.getByText('Ingen middag')).toHaveCount(1)
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(recipes(page)).toHaveCount(7)
})

test('editing a day saves its Meal, and changed courses get new Recipes', async ({ page }) => {
  await openMiddag(page)
  await page.getByRole('button', { name: 'Endre tirsdag' }).click()
  const meal = page.getByRole('textbox', { name: 'Middag' })
  await expect(meal).toHaveValue('Taco')
  await meal.fill('Fiskegrateng\nEplekake')
  await page.getByRole('button', { name: 'Lagre' }).click()

  await expect(recipe(page, 'Fiskegrateng')).toBeVisible()
  await expect(recipe(page, 'Eplekake')).toBeVisible()
  await expect(recipe(page, 'Taco')).toHaveCount(0)
  await expect(recipes(page)).toHaveCount(8)

  await page.reload()
  await openTab(page, 'Middag')
  await expect(recipe(page, 'Eplekake')).toBeVisible()
})

test('🔄 in the editor suggests a Meal, kept only on Lagre', async ({ page }) => {
  await openMiddag(page)
  const meal = page.getByRole('textbox', { name: 'Middag' })
  // The stub puts the instruction on Thursday.
  const suggestion = 'Stub: Lag ny middag for torsdag ut fra notatet for dagen.'

  await page.getByRole('button', { name: 'Endre torsdag' }).click()
  await page.getByRole('button', { name: 'Foreslå ny middag' }).click()
  await expect(meal).toHaveValue(suggestion)
  await page.getByRole('button', { name: 'Avbryt' }).click()
  await expect(page.getByText('Ingen middag')).toHaveCount(1)

  await page.getByRole('button', { name: 'Endre torsdag' }).click()
  await page.getByRole('button', { name: 'Foreslå ny middag' }).click()
  await expect(meal).toHaveValue(suggestion)
  await page.getByRole('button', { name: 'Lagre' }).click()
  await expect(recipe(page, suggestion)).toBeVisible()
  await expect(page.getByText('Ingen middag')).toHaveCount(0)
})

test('instructing the AI remakes the Menu', async ({ page }) => {
  await openMiddag(page)
  await page.getByRole('textbox', { name: 'Endring i menyen' }).fill('Suppe på torsdag')
  await page.getByRole('button', { name: 'Endre', exact: true }).click()
  await expect(recipe(page, 'Stub: Suppe på torsdag')).toBeVisible()
  await expect(recipe(page, 'Taco')).toBeVisible()
})

test('a Recipe opens full screen, and hand edits stay', async ({ page }) => {
  await openMiddag(page)
  await page.getByRole('button', { name: 'Taco', exact: true }).click()
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
