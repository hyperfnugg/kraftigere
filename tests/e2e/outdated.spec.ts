import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Opens Middag and waits for this week's Menu and its 7 Recipes (stub).
async function openMiddag(page: Page) {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Middag')
  await expect(page.getByRole('group', { name: /^Oppskrift / })).toHaveCount(7)
}

const outdatedMenu = (page: Page) => page.getByRole('button', { name: /^Utdatert/ })
const remake = (page: Page) => page.getByRole('button', { name: /^Lag på nytt · utdatert/ })
const recipe = (page: Page, course: string) => page.getByRole('group', { name: `Oppskrift ${course}`, exact: true })

test("changing a Day Note marks only that day's Recipes, and 🔄 remakes the Recipe but not the Meal", async ({
  page,
}) => {
  await openMiddag(page)
  await expect(remake(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Endre tirsdag' }).click()
  await page.getByRole('textbox', { name: 'Notat' }).fill('Gjester.')
  await page.getByRole('button', { name: 'Lagre' }).click()
  await expect(remake(page)).toHaveCount(1)
  await expect(remake(recipe(page, 'Taco'))).toBeVisible()
  await expect(outdatedMenu(page)).toHaveCount(0)

  // Cancelling the warning leaves it as it is.
  page.once('dialog', (d) => d.dismiss())
  await remake(recipe(page, 'Taco')).click()
  await expect(remake(page)).toHaveCount(1)

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Lag på nytt? Endringer du har gjort forsvinner.')
    d.accept()
  })
  await remake(recipe(page, 'Taco')).click()
  await expect(remake(page)).toHaveCount(0)
  await expect(recipe(page, 'Taco')).toBeVisible()
})

test('editing Føringer marks the Menu and every Recipe, and remaking the Menu clears its label', async ({
  page,
}) => {
  await openMiddag(page)
  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()
  await expect(outdatedMenu(page)).toHaveCount(1)
  await expect(remake(page)).toHaveCount(7)

  page.once('dialog', (d) => d.accept())
  await outdatedMenu(page).click()
  await expect(outdatedMenu(page)).toHaveCount(0)
  // The stub makes the same Menu, so the Recipes stay, still Outdated.
  await expect(remake(page)).toHaveCount(7)
})
