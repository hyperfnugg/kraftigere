import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, fakeBasket, linkOda, readDoc, reset, resetFakeBasket, seed, signIn, writeDoc } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
  await resetFakeBasket()
})

// Against the fake Oda (tests/e2e/fake-oda.mjs), whose Basket starts as 3 × 430 and 1 × 7, and the
// Gemini stub, which reads a Pack Size from plain pack text and none from "pose".
const START = { 430: 3, 7: 1 }

const str = (stringValue: string) => ({ stringValue })
const int = (n: number) => ({ integerValue: String(n) })

const dishFields = (grams: number) => ({
  mapValue: { fields: { week: str('2026-W45'), recipe: str('mon-0'), course: str('Middag'), grams: int(grams), pieces: { nullValue: null } } },
})

const entryFields = (name: string, { dishes = [], note }: { dishes?: number[]; note?: string }) => ({
  text: str(name),
  ware: str(name.toLowerCase()),
  checked: { booleanValue: false },
  createdAt: { timestampValue: '2026-11-04T08:00:00Z' },
  ...(note && { note: str(note) }),
  ...(dishes.length > 0 && { dishes: { arrayValue: { values: dishes.map(dishFields) } } }),
})

// A waiting Entry for a Ware, which has the Oda Product if one is given.
async function put(
  name: string,
  oda?: { id: number; packText: string; packGrams?: number },
  entry: { dishes?: number[]; note?: string } = {},
) {
  await writeDoc(`wares/${name.toLowerCase()}`, {
    name: str(name),
    addCount: int(1),
    ...(oda && {
      oda: {
        mapValue: {
          fields: {
            id: int(oda.id),
            name: str(name),
            packText: str(oda.packText),
            ...(oda.packGrams && { packGrams: int(oda.packGrams) }),
          },
        },
      },
    }),
  })
  await writeDoc(`entries/${name.toLowerCase()}`, entryFields(name, entry))
}

const tick = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(`^${name}`) })
const row = (page: Page, name: string) => page.getByRole('listitem').filter({ has: tick(page, name) })
const count = (page: Page, name: string) => row(page, name).getByLabel('Antall pakker')
const failed = (page: Page, name: string) => row(page, name).getByText('Fikk ikke regnet ut antall pakker')
const fill = (page: Page) => page.getByRole('button', { name: 'Fyll handlekurven' })
const nextStep = (page: Page) => page.getByText('Neste steg er ditt: bestill i')

async function start(page: Page) {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
}

test('enough packs for the dishes reach the Basket, and Avbryt takes them all out', async ({ page }) => {
  await put('Pasta', { id: 501, packText: '500 g' }, { dishes: [600, 600] })
  await put('Melk', { id: 502, packText: '1 l' }, { note: 'mye' })
  await put('Salt', { id: 503, packText: '1 kg' })
  await start(page)

  // A Note doesn't change the count, and neither does a Ware with no amounts.
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(count(page, 'Melk')).toHaveText('1')
  await expect(count(page, 'Salt')).toHaveText('1')

  await fill(page).click()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 1, 503: 1 })
  await expect(page.getByRole('link', { name: '3 × Pasta · 500 g' })).toBeVisible()
  await expect(page.getByRole('link', { name: '1 × Melk · 1 l' })).toBeVisible()
  await expect(page.getByLabel('Flere pakker')).toHaveCount(0)

  // The Pack Size read for Pasta is saved, and none is read for what has no amounts.
  const pasta = (await readDoc('wares/pasta')).oda.mapValue.fields
  expect(Number(pasta.packGrams.integerValue ?? pasta.packGrams.doubleValue)).toBe(500)
  expect((await readDoc('wares/melk')).oda.mapValue.fields.packGrams).toBeUndefined()

  await page.getByRole('button', { name: 'Avbryt' }).click()
  await page.getByRole('button', { name: 'Avbryt odabestillingen' }).click()
  await expect(fill(page)).toBeVisible()
  expect(await fakeBasket()).toEqual(START)
})

test('a saved Pack Size is not read again', async ({ page }) => {
  // The stub can't read "pose", so asking it would show as failed.
  await put('Pasta', { id: 501, packText: 'pose', packGrams: 500 }, { dishes: [1200] })
  await start(page)

  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(failed(page, 'Pasta')).toBeHidden()
})

test('changing a count ticks the Entry, and changing the Oda Product works it out again', async ({ page }) => {
  await put('Melk')
  await start(page)

  // Suggested, so unticked, and one pack with nothing to count from.
  await expect(row(page, 'Melk').getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()
  await expect(tick(page, 'Melk')).not.toBeChecked()
  await expect(count(page, 'Melk')).toHaveText('1')
  await expect(row(page, 'Melk').getByLabel('Færre pakker')).toBeDisabled()

  await row(page, 'Melk').getByLabel('Flere pakker').click()
  await row(page, 'Melk').getByLabel('Flere pakker').click()
  await row(page, 'Melk').getByLabel('Færre pakker').click()
  await expect(count(page, 'Melk')).toHaveText('2')
  await expect(tick(page, 'Melk')).toBeChecked()

  await row(page, 'Melk').getByRole('button', { name: 'Bytt Oda-produkt' }).click()
  await page.getByRole('option').filter({ hasText: /1,75 l/ }).click()
  await expect(row(page, 'Melk').getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1,75 l' })).toBeVisible()
  await expect(count(page, 'Melk')).toHaveText('1')

  await row(page, 'Melk').getByLabel('Flere pakker').click()
  await fill(page).click()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 8143: 2 })
})

test('dishes arriving work the count out again, unless it was set by hand', async ({ page }) => {
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [400] })
  await put('Ris', { id: 502, packText: '500 g', packGrams: 500 }, { dishes: [400] })
  await start(page)
  await expect(count(page, 'Pasta')).toHaveText('1')
  await row(page, 'Ris').getByLabel('Flere pakker').click()
  await expect(count(page, 'Ris')).toHaveText('2')

  await writeDoc('entries/pasta', entryFields('Pasta', { dishes: [400, 800] }))
  await writeDoc('entries/ris', entryFields('Ris', { dishes: [400, 800] }))
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(count(page, 'Ris')).toHaveText('2')
})

test('a Pack Size the AI cannot read starts at one pack, marked, and can still be filled', async ({ page }) => {
  await put('Pasta', { id: 501, packText: 'pose' }, { dishes: [1200] })
  await start(page)

  await expect(failed(page, 'Pasta')).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('1')
  await expect(fill(page)).toBeEnabled()

  // Changing the count clears the mark.
  await row(page, 'Pasta').getByLabel('Flere pakker').click()
  await expect(failed(page, 'Pasta')).toBeHidden()
  await fill(page).click()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 501: 2 })
  expect((await readDoc('wares/pasta')).oda.mapValue.fields.packGrams).toBeUndefined()
})
