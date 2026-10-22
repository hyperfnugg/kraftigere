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

test('accepting the Menu writes a Recipe for each course, and hand edits stay', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Lag meny' }).click()
  await page.getByRole('button', { name: 'Godta meny' }).click()

  const recipeButtons = page.getByRole('button', { name: /^Oppskrift: / })
  await expect(recipeButtons).toHaveText([
    'Oppskrift: Fiskesuppe',
    'Oppskrift: Taco',
    'Oppskrift: Pasta med kjøttsaus',
    'Oppskrift: Pizza',
    'Oppskrift: Lammestek',
    'Oppskrift: Sjokolademousse',
    'Oppskrift: Pannekaker',
  ])

  await page.getByRole('button', { name: 'Oppskrift: Taco' }).click()
  const taco = page.getByRole('group', { name: 'Oppskrift Taco' })
  await expect(taco.getByRole('textbox', { name: 'Porsjoner' })).toHaveValue('4')
  await expect(taco.getByRole('textbox', { name: 'Fremgangsmåte' })).toHaveValue('1. Lag taco.')
  const onion = taco.getByRole('group', { name: 'Ingrediens løk' })
  await onion.getByRole('textbox', { name: 'Mengde' }).fill('350')
  await onion.getByRole('textbox', { name: 'Mengde' }).blur()
  await expect(onion.getByRole('textbox', { name: 'Mengde' })).toHaveValue('350')

  // The stub puts the instruction in the steps.
  await taco.getByRole('textbox', { name: 'Endring i oppskriften Taco' }).fill('Mindre salt')
  await taco.getByRole('button', { name: 'Endre' }).click()
  await expect(taco.getByRole('textbox', { name: 'Fremgangsmåte' })).toHaveValue('Stub: Mindre salt')

  await page.reload()
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Oppskrift: Taco' }).click()
  await expect(onion.getByRole('textbox', { name: 'Mengde' })).toHaveValue('350')
})

test('a course added after accepting gets its Recipe on request', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  await page.getByRole('button', { name: 'Lag meny' }).click()
  await page.getByRole('button', { name: 'Godta meny' }).click()
  await expect(page.getByRole('button', { name: 'Oppskrift: Taco' })).toBeVisible()

  const thursday = page.getByRole('textbox', { name: 'Torsdag' })
  await thursday.fill('Kjøttkaker')
  await thursday.blur()
  await page.getByRole('button', { name: 'Lag oppskrift: Kjøttkaker' }).click()
  await expect(page.getByRole('button', { name: 'Oppskrift: Kjøttkaker' })).toBeVisible()
})
