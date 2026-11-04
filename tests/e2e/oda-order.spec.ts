import { expect, test, type Page } from '@playwright/test'
import {
  MEMBERS,
  addEntry,
  changeFakeBasket,
  entry,
  fakeBasket,
  linkOda,
  listDocs,
  openTab,
  readDoc,
  reset,
  resetFakeBasket,
  seed,
  signIn,
} from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
  await resetFakeBasket()
})

// Against the fake Oda (tests/e2e/fake-oda.mjs): its Basket starts as 3 × 430 and 1 × 7, and its
// search finds the same 7 products for every name but "ukjent".
const tick = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true })
const results = (page: Page) => page.getByRole('option')
const nextStep = (page: Page) => page.getByText('Neste steg er ditt: bestill i')

// Adds the Entries on Home, giving Smør its Oda Product there, then links Oda.
async function start(page: Page, names: string[]) {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
  await openTab(page, 'Hjem')
  for (const name of names) await addEntry(page, name)
  if (names.includes('Smør')) {
    await entry(page, 'Smør').getByText('Smør').click()
    await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
    await results(page).filter({ hasText: /^TINE Ekte smør · 250 g/ }).click()
    await expect(page.getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
  }
  await openTab(page, 'Odabestilling')
}

// Fills the Basket with Melk, suggested, and Smør, bought before.
async function fill(page: Page) {
  await start(page, ['Melk', 'Smør'])
  await expect(page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()
  await tick(page, 'Melk').check()
  await page.getByRole('button', { name: 'Fyll handlekurven' }).click()
  await expect(nextStep(page)).toBeVisible()
}

test('a Family Member chooses Entries and fills the Basket', async ({ page }) => {
  await start(page, ['Melk', 'Smør', 'Sokker', 'Ukjent'])
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()

  // Wares without an Oda Product come first, each with the first free search hit suggested,
  // unticked. Smør, bought before, is ticked.
  const fresh = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nye varer' }) })
  const known = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tidligere kjøpte varer' }) })
  const melk = page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })
  await expect(fresh.getByRole('checkbox')).toHaveCount(3)
  await expect(melk).toHaveAttribute('href', 'https://oda.com/no/products/430/')
  await expect(fresh.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1,75 l' })).toBeVisible()
  await expect(fresh.getByRole('button', { name: 'Velg Oda-produkt' })).toBeVisible()
  await expect(tick(page, 'Melk')).not.toBeChecked()
  await expect(known.getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
  await expect(tick(page, 'Smør')).toBeChecked()

  // Sokker is never from Oda: it folds away at the bottom, saved at once.
  await page.getByRole('listitem').filter({ has: tick(page, 'Sokker') }).getByRole('button', { name: 'Bytt Oda-produkt' }).click()
  await expect(page.getByRole('combobox', { name: 'Søk på Oda' })).toHaveValue('Sokker')
  await results(page).filter({ hasText: 'Aldri fra Oda' }).click()
  await expect(page.getByRole('button', { name: '▸ Utenfor Oda (1)' })).toBeVisible()
  await expect(tick(page, 'Sokker')).toBeHidden()
  expect((await readDoc('wares/sokker')).neverOda).toEqual({ booleanValue: true })

  // Every ticked Entry needs an Oda Product.
  await tick(page, 'Melk').check()
  await tick(page, 'Ukjent').check()
  await page.getByRole('button', { name: 'Fyll handlekurven' }).click()
  await expect(page.getByText('Alle varer må ha et Oda-produkt')).toBeVisible()
  expect(await fakeBasket()).toEqual({ 430: 3, 7: 1 })

  // One pack each goes in beside what was there, and the suggestion is saved on Melk.
  await tick(page, 'Ukjent').uncheck()
  await page.getByRole('button', { name: 'Fyll handlekurven' }).click()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ 430: 4, 7: 1, 125: 1 })
  expect((await readDoc('wares/melk')).oda.mapValue.fields.id).toEqual({ integerValue: '430' })
  expect((await readDoc('wares/ukjent')).oda).toBeUndefined()

  // Only the In Basket Entries show, with their Oda Products and nothing to change.
  await expect(page.getByRole('listitem')).toHaveCount(2)
  await expect(melk).toBeVisible()
  await expect(page.getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Fjern|Bytt) / })).toHaveCount(0)
})

test('Groceries is locked on every device until Bestilt checks the Entries off', async ({ page, browser }) => {
  await fill(page)

  const other = await (await browser.newContext()).newPage()
  await signIn(other, MEMBERS[1])
  await expect(other.getByText('Odabestilling pågår')).toBeVisible()
  await expect(other.getByPlaceholder('Hva trenger vi?')).toBeHidden()
  await openTab(other, 'Handle')
  await expect(other.getByText('Odabestilling pågår')).toBeVisible()
  await expect(tick(other, 'Melk')).toBeDisabled()
  await expect(other.getByRole('button', { name: 'Fjern avkryssede' })).toBeHidden()

  await page.getByRole('button', { name: 'Bestilt' }).click()
  await expect(tick(other, 'Melk')).toBeChecked()
  await expect(tick(other, 'Smør')).toBeChecked()
  await expect(other.getByText('Odabestilling pågår')).toBeHidden()
  for (const e of await listDocs('entries')) expect(e.basket).toBeUndefined()
  // Bestilt leaves the Basket to Oda.
  expect(await fakeBasket()).toEqual({ 430: 4, 7: 1, 125: 1 })
})

test('Avbryt asks, then takes out only the packs Kraft put in', async ({ page }) => {
  await fill(page)
  // Meanwhile the Family Member adds another Smør on oda.com.
  await changeFakeBasket([{ productId: 125, quantity: 1 }])

  await page.getByRole('button', { name: 'Avbryt' }).click()
  await expect(page.getByText('Ta ut varene Kraft la i handlekurven?')).toBeVisible()
  await page.getByRole('button', { name: 'Tilbake' }).click()
  expect(await fakeBasket()).toEqual({ 430: 4, 7: 1, 125: 2 })

  await page.getByRole('button', { name: 'Avbryt' }).click()
  await page.getByRole('button', { name: 'Avbryt odabestillingen' }).click()
  await expect(page.getByRole('button', { name: 'Fyll handlekurven' })).toBeVisible()
  expect(await fakeBasket()).toEqual({ 430: 3, 7: 1, 125: 1 })
  for (const e of await listDocs('entries')) {
    expect(e.basket).toBeUndefined()
    expect(e.checked).toEqual({ booleanValue: false })
  }
})
