import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, addEntry, entry, linkOda, openTab, readDoc, reset, resetFakeBasket, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
  await resetFakeBasket()
})

// Links the fake Oda (tests/e2e/fake-oda.mjs), and goes back to Home.
async function linkOdaHome(page: Page) {
  await linkOda(page)
  await openTab(page, 'Hjem')
}

// The Oda search's results, not Hjem's chips.
const results = (page: Page) => page.locator('[role=listbox]:not([aria-label="Forslag"])').getByRole('option')

test("a Family Member picks a Ware's Oda Product on Home", async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOdaHome(page)
  await addEntry(page, 'Melk')
  await entry(page, 'Melk').getByText('Melk').click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()

  // The search starts with the Ware's name and shows 5 of its 7 results, then the rest, and
  // "Aldri fra Oda" last.
  const search = page.getByRole('combobox', { name: 'Søk på Oda' })
  await expect(search).toHaveValue('Melk')
  await expect(results(page)).toHaveCount(7)
  await expect(results(page).nth(2)).toHaveText('Tine Laktosefri Helmelk · 1 l · 34,40 kr · ikke tilgjengelig')
  await results(page).filter({ hasText: 'Flere...' }).click()
  await expect(results(page)).toHaveCount(8)
  await expect(results(page).last()).toHaveText('Aldri fra Oda')

  await results(page).filter({ hasText: /^Tine Lettmelk 1% fett · 1% fett, 1 l ·/ }).click()
  const link = page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })
  await expect(link).toHaveAttribute('href', 'https://oda.com/no/products/430/')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect.poll(async () => (await readDoc('wares/melk')).oda?.mapValue.fields).toEqual({
    id: { integerValue: '430' },
    name: { stringValue: 'Tine Lettmelk 1% fett' },
    packText: { stringValue: '1% fett, 1 l' },
  })

  // Removing it lets the Family Member choose again.
  await page.getByRole('button', { name: 'Fjern Oda-produkt' }).click()
  await expect(link).toBeHidden()
  await expect.poll(async () => (await readDoc('wares/melk')).oda).toBeUndefined()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()

  // ↓ and Enter pick too.
  await expect(results(page)).toHaveCount(7)
  for (let i = 0; i < 4; i++) await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
})

test("a pasted link or a tap picks another Ware's Oda Product", async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOdaHome(page)
  await addEntry(page, 'Melk')
  await addEntry(page, 'Kaffe')
  await addEntry(page, 'Te')
  const search = page.getByRole('combobox', { name: 'Søk på Oda' })

  await entry(page, 'Melk').getByText('Melk').click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  await search.fill('https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/')
  await expect(page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()

  // By link, and the search itself says nothing about other Wares.
  await entry(page, 'Kaffe').getByText('Kaffe').click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  await expect(results(page).first()).toHaveText('Tine Lettmelk 1% fett · 1% fett, 1 l · 19,40 kr')
  await expect(results(page).first()).toHaveAttribute('aria-disabled', 'false')
  await search.fill('https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/')
  await expect(entry(page, 'Kaffe').getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()
  // The link shows from the local write, before the emulator has it.
  await expect.poll(async () => (await readDoc('wares/kaffe')).oda?.mapValue.fields.id).toEqual({ integerValue: '430' })

  // By tap.
  await entry(page, 'Te').getByText('Te', { exact: true }).click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  await results(page).first().click()
  await expect(entry(page, 'Te').getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()

  // A link to a product the search doesn't find.
  await page.getByRole('button', { name: 'Fjern Oda-produkt' }).click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  await search.fill('https://oda.com/no/products/999-ukjent/')
  await expect(page.getByText('Fant ikke produktet fra lenken')).toBeVisible()
})

test('a Ware set never from Oda on Home, and cleared again', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOdaHome(page)
  await addEntry(page, 'Sokker')
  await entry(page, 'Sokker').getByText('Sokker').click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  await results(page).filter({ hasText: 'Aldri fra Oda' }).click()

  await expect(page.getByRole('button', { name: 'Fjern Aldri fra Oda' })).toBeVisible()
  await expect.poll(async () => (await readDoc('wares/sokker')).neverOda).toEqual({ booleanValue: true })

  await page.getByRole('button', { name: 'Fjern Aldri fra Oda' }).click()
  await expect(page.getByRole('button', { name: 'Velg Oda-produkt' })).toBeVisible()
  await expect.poll(async () => (await readDoc('wares/sokker')).neverOda).toBeUndefined()
})

test("Esc in an open Ware's Oda search closes the search before the Ware", async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOdaHome(page)
  await addEntry(page, 'Melk')
  await entry(page, 'Melk').getByText('Melk').click()
  await page.getByRole('button', { name: 'Velg Oda-produkt' }).click()
  const search = page.getByRole('combobox', { name: 'Søk på Oda' })
  await expect(results(page)).toHaveCount(7)

  // The results first, then the search, then the Ware.
  await search.press('Escape')
  await expect(results(page)).toHaveCount(0)
  await search.press('Escape')
  await expect(search).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Notat' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'Notat' })).toHaveCount(0)
})
