import { expect, test, type Page } from '@playwright/test'
import { dishes, openMiddag, reset, seed } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const outdatedMenu = (page: Page) => page.getByRole('button', { name: /^Utdatert/ })
const outdatedRecipes = (page: Page) => dishes(page).getByText('utdatert')

async function editGuidelines(page: Page) {
  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()
}

test('editing Føringer marks the Menu and every Recipe, and ↻ on a Recipe remakes it', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await expect(outdatedRecipes(page)).toHaveCount(0)
  await editGuidelines(page)
  await expect(outdatedMenu(page)).toHaveCount(1)
  await expect(outdatedRecipes(page)).toHaveCount(6)

  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  const remake = page.getByRole('button', { name: /^Lag oppskriften på nytt · utdatert/ })
  // Cancelling the warning leaves it as it is.
  page.once('dialog', (d) => d.dismiss())
  await remake.click()
  await expect(remake).toBeVisible()

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Lag på nytt? Endringer du har gjort forsvinner.')
    d.accept()
  })
  await remake.click()
  await expect(page.getByRole('button', { name: 'Lag oppskriften på nytt', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '‹ Meny' }).click()
  await expect(outdatedRecipes(page)).toHaveCount(5)
})

test('remaking an Utdatert Menu clears its label', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  await editGuidelines(page)
  page.once('dialog', (d) => d.accept())
  await outdatedMenu(page).click()
  await expect(outdatedMenu(page)).toHaveCount(0)
  // The stub makes the same Menu, so the Recipes stay, still Outdated.
  await expect(outdatedRecipes(page)).toHaveCount(6)
})
