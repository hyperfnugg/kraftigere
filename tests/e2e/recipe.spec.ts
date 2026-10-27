import { expect, test, type Page } from '@playwright/test'
import { openMiddag, reset, seed } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Each stub Recipe has two steps: 200 g (2 stk) løk and salt to taste with "Lag <dish>.",
// then "La det hvile." and "Server." with no Ingredients.

async function openTaco(page: Page) {
  await page.getByRole('button', { name: 'Taco', exact: true }).click()
  return page.getByRole('dialog', { name: 'Taco' })
}

test('a Recipe reads as a table of steps with numbered instructions on a wide screen', async ({ page }) => {
  await openMiddag(page, { recipes: true })
  const view = await openTaco(page)
  const step = (n: number) => view.getByRole('rowgroup', { name: `Steg ${n}` })
  await expect(view.getByText('4 porsjoner')).toBeVisible()
  await expect(view.getByRole('columnheader')).toHaveText(['INGREDIENS', 'MENGDE', 'FREMGANGSMÅTE'])
  // Each row has an Ingredient and its quantity beside one instruction.
  const cells = (n: number, row: number) => step(n).getByRole('row').nth(row).getByRole('cell')
  await expect(step(1).getByRole('row')).toHaveCount(2)
  await expect(cells(1, 0)).toHaveText(['løk', '200 g (2 stk)', '1Lag taco.'])
  await expect(cells(1, 1)).toHaveText(['salt', 'etter smak', ''])
  // The numbers go on across steps, and a step can have more instructions than Ingredients.
  await expect(step(2).getByRole('row')).toHaveCount(2)
  await expect(cells(2, 0)).toHaveText(['', '', '2La det hvile.'])
  await expect(cells(2, 1)).toHaveText(['', '', '3Server.'])
  await expect(view.getByRole('textbox')).toHaveCount(1)

  await view.getByRole('button', { name: 'Rediger' }).click()
  await expect(view.getByRole('table')).toHaveCount(0)
  await expect(view.getByRole('textbox', { name: 'Gram' }).first()).toHaveValue('200')
  await view.getByRole('button', { name: 'Ferdig' }).click()
  await expect(step(1)).toBeVisible()
})

test('on a phone the steps are stacked, each Ingredient on its own line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openMiddag(page, { recipes: true })
  const view = await openTaco(page)
  await expect(view.getByRole('table')).toHaveCount(0)
  const step = view.getByRole('group', { name: 'Steg 1' })
  await expect(step).toContainText('løk200 g (2 stk)')
  await expect(step).toContainText('saltetter smak')
  await expect(step).toContainText('1Lag taco.')
  await expect(view.getByRole('group', { name: 'Steg 2' })).toContainText('2La det hvile.3Server.')
})
