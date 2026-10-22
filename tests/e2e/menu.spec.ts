import { expect, test } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('make a Menu, edit Tuesday, instruct the AI, accept it', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Lag meny' }).click()

  const tuesday = page.getByRole('textbox', { name: 'Tirsdag', exact: true })
  await expect(tuesday).toHaveValue('Taco')
  await expect(page.getByRole('textbox', { name: 'Lørdag' })).toHaveValue('Lammestek\nSjokolademousse')
  await expect(page.getByRole('textbox', { name: 'Torsdag' })).toHaveValue('')

  await tuesday.fill('Fiskegrateng\nEplekake')
  await tuesday.blur()

  // The stub puts the instruction on Thursday and keeps the rest, including the hand edit.
  await page.getByRole('textbox', { name: 'Endring i menyen' }).fill('Suppe på torsdag')
  await page.getByRole('button', { name: 'Endre' }).click()
  await expect(page.getByRole('textbox', { name: 'Torsdag' })).toHaveValue('Stub: Suppe på torsdag')
  await expect(tuesday).toHaveValue('Fiskegrateng\nEplekake')

  await page.getByRole('button', { name: 'Godta meny' }).click()
  await expect(page.getByRole('button', { name: 'Godta meny' })).toHaveCount(0)

  await page.reload()
  await openTab(page, 'Uke')
  await expect(tuesday).toHaveValue('Fiskegrateng\nEplekake')
})
