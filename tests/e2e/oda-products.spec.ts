import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, addEntry, entry, openTab, readDoc, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// Links the fake Oda (tests/e2e/fake-oda.mjs) from Shop, and goes back to Home.
async function linkOda(page: Page) {
  await openTab(page, 'Handle')
  await page.getByRole('button', { name: 'Koble til Oda' }).click()
  await expect(page.getByRole('link', { name: 'Oda: 4 varer i handlekurven' })).toBeVisible()
  await openTab(page, 'Hjem')
}

const results = (page: Page) => page.getByRole('option')

test("a Family Member picks a Ware's Oda Product on Home", async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
  await addEntry(page, 'Melk')
  await entry(page, 'Melk').getByText('Melk').click()
  await page.getByRole('button', { name: 'Velg Oda-vare' }).click()

  // The search starts with the Ware's name and shows 5 of its 7 results, then the rest.
  const search = page.getByRole('combobox', { name: 'Søk på Oda' })
  await expect(search).toHaveValue('Melk')
  await expect(results(page)).toHaveCount(6)
  await expect(results(page).nth(2)).toHaveText('Tine Laktosefri Helmelk · 1 l · 34,40 kr · ikke tilgjengelig')
  await results(page).filter({ hasText: 'Flere...' }).click()
  await expect(results(page)).toHaveCount(7)

  await results(page).filter({ hasText: /^Tine Lettmelk 1% fett · 1% fett, 1 l ·/ }).click()
  const link = page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })
  await expect(link).toHaveAttribute('href', 'https://oda.com/no/products/430/')
  await expect(link).toHaveAttribute('target', '_blank')
  const melk = await readDoc('wares/melk')
  expect(melk.oda.mapValue.fields).toEqual({
    id: { integerValue: '430' },
    name: { stringValue: 'Tine Lettmelk 1% fett' },
    packText: { stringValue: '1% fett, 1 l' },
  })

  // Removing it lets the Family Member choose again.
  await page.getByRole('button', { name: 'Fjern Oda-vare' }).click()
  await expect(link).toBeHidden()
  expect((await readDoc('wares/melk')).oda).toBeUndefined()
  await page.getByRole('button', { name: 'Velg Oda-vare' }).click()

  // ↓ and Enter pick too.
  await expect(results(page)).toHaveCount(6)
  for (let i = 0; i < 4; i++) await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
})

test('a pasted link picks its Oda Product, unless another Ware has it', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
  await addEntry(page, 'Melk')
  await addEntry(page, 'Kaffe')
  const search = page.getByRole('combobox', { name: 'Søk på Oda' })

  await entry(page, 'Melk').getByText('Melk').click()
  await page.getByRole('button', { name: 'Velg Oda-vare' }).click()
  await search.fill('https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/')
  await expect(page.getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()

  // An Oda Product belongs to at most one Ware.
  await entry(page, 'Kaffe').getByText('Kaffe').click()
  await page.getByRole('button', { name: 'Velg Oda-vare' }).click()
  await expect(results(page).first()).toHaveText(/brukt av «Melk»$/)
  await expect(results(page).first()).toHaveAttribute('aria-disabled', 'true')
  await search.fill('https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/')
  await expect(page.getByText('Brukt av «Melk»', { exact: true })).toBeVisible()
  expect((await readDoc('wares/kaffe')).oda).toBeUndefined()

  // A link to a product the search doesn't find.
  await search.fill('https://oda.com/no/products/999-ukjent/')
  await expect(page.getByText('Fant ikke produktet fra lenken')).toBeVisible()
})
