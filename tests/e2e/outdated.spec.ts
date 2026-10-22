import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

async function acceptedMenu(page: Page) {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Lag meny' }).click()
  await page.getByRole('button', { name: 'Godta meny' }).click()
  await expect(page.getByRole('button', { name: /^Oppskrift: / })).toHaveCount(7)
}

const outdated = (page: Page) => page.getByRole('button', { name: /^Utdatert/ })
const recipe = (page: Page, course: string) => page.getByRole('group', { name: `Oppskrift ${course}` })

test('editing Ukeplan after accepting marks the Menu and every Recipe Utdatert', async ({ page }) => {
  await acceptedMenu(page)
  await expect(outdated(page)).toHaveCount(0)

  const notes = page.getByRole('textbox', { name: 'Ukeplan' })
  await notes.fill('Gjester mandag.')
  await notes.blur()
  // The Menu and its 7 Recipes.
  await expect(outdated(page)).toHaveCount(8)
})

test('editing Føringer marks them too', async ({ page }) => {
  await acceptedMenu(page)
  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()
  await expect(outdated(page)).toHaveCount(8)
})

test("editing Tuesday's Meal marks only Tuesday's Recipes, and remaking clears it", async ({ page }) => {
  await acceptedMenu(page)
  const tuesday = page.getByRole('textbox', { name: 'Tirsdag', exact: true })
  await tuesday.fill('Taco med guacamole')
  await tuesday.blur()

  await expect(outdated(page)).toHaveCount(1)
  const taco = recipe(page, 'Taco med guacamole')
  await expect(outdated(taco)).toBeVisible()

  // Cancelling the warning leaves it as it is.
  page.once('dialog', (d) => d.dismiss())
  await outdated(taco).click()
  await expect(outdated(taco)).toBeVisible()

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Lag på nytt? Endringer du har gjort forsvinner.')
    d.accept()
  })
  await outdated(taco).click()
  await expect(outdated(page)).toHaveCount(0)
  await taco.getByRole('button', { name: 'Oppskrift: Taco med guacamole' }).click()
  await expect(taco.getByRole('textbox', { name: 'Fremgangsmåte' })).toHaveValue('1. Lag taco med guacamole.')
})

test('remaking an Utdatert Menu clears its label', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Lag meny' }).click()
  await expect(page.getByRole('textbox', { name: 'Tirsdag', exact: true })).toHaveValue('Taco')
  const notes = page.getByRole('textbox', { name: 'Ukeplan' })
  await notes.fill('Gjester mandag.')
  await notes.blur()
  await expect(outdated(page)).toHaveCount(1)

  page.once('dialog', (d) => d.accept())
  await outdated(page).click()
  await expect(outdated(page)).toHaveCount(0)
})
