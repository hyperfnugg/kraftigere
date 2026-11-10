import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, changeFakeBasket, failFakeOda, fakeBasket, linkOda, readDoc, reset, resetFakeBasket, seed, signIn, writeDoc } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
  await resetFakeBasket()
})

// Against the fake Oda (tests/e2e/fake-oda.mjs), whose Basket starts as 3 × 430 and 1 × 7, and the
// Gemini stub, which reads a Pack Size from plain pack text.
const START = { 430: 3, 7: 1 }
const SOLD_OUT = { id: 24681, packText: '1 l' }
const OFF_SALE = { id: 61999, packText: '400 g' }

const str = (stringValue: string) => ({ stringValue })
const int = (n: number) => ({ integerValue: String(n) })

// A waiting Entry for a Ware with this Oda Product, and a dish needing these grams if any.
async function put(name: string, oda: { id: number; packText: string }, grams?: number) {
  await writeDoc(`wares/${name.toLowerCase()}`, {
    name: str(name),
    addCount: int(1),
    oda: { mapValue: { fields: { id: int(oda.id), name: str(`${name} fra Oda`), packText: str(oda.packText) } } },
  })
  await writeDoc(`entries/${name.toLowerCase()}`, {
    text: str(name),
    ware: str(name.toLowerCase()),
    checked: { booleanValue: false },
    createdAt: { timestampValue: '2026-11-04T08:00:00Z' },
    ...(grams && {
      dishes: {
        arrayValue: {
          values: [
            { mapValue: { fields: { week: str('2026-W45'), recipe: str('mon-0'), course: str('Middag'), grams: int(grams), pieces: { nullValue: null } } } },
          ],
        },
      },
    }),
  })
}

const odaOf = async (name: string) => (await readDoc(`wares/${name.toLowerCase()}`)).oda?.mapValue.fields
const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}`) })
const fill = (page: Page) => page.getByRole('button', { name: 'Fyll handlekurven' })
// Shown once counting is over.
const nextStep = (page: Page) => page.getByText('Neste steg er ditt: bestill i')
const count = (page: Page, name: string) => row(page, name).getByLabel('Antall pakker')
const add = (page: Page) => page.getByRole('button', { name: 'Legg i handlekurven' })
const skip = (page: Page) => page.getByRole('button', { name: 'Hopp over' })
const leftOut = (page: Page) => page.getByRole('heading', { name: 'Ikke tilgjengelig' })

async function fillBasket(page: Page) {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
  await expect(fill(page)).toBeEnabled()
  await fill(page).click()
}

async function cancel(page: Page) {
  await page.getByRole('button', { name: 'Avbryt', exact: true }).click()
  await page.getByRole('button', { name: 'Avbryt odabestillingen' }).click()
  await expect(fill(page)).toBeVisible()
}

test('with everything available there is no step', async ({ page }) => {
  await put('Melk', { id: 501, packText: '1 l' })
  await fillBasket(page)
  await expect(nextStep(page)).toBeVisible()
  await expect(skip(page)).toBeHidden()
  expect(await fakeBasket()).toEqual({ ...START, 501: 1 })
})

test('a Substitute goes in the Basket for this Oda Order, and the Ware keeps its own', async ({ page }) => {
  await put('Ost', SOLD_OUT, 1200)
  await put('Smør', { id: 125, packText: '250 g' })
  // The Family's own pack of the unavailable product stays through all of it.
  await changeFakeBasket([{ productId: SOLD_OUT.id, quantity: 1 }])
  await fillBasket(page)

  await expect(row(page, 'Ost').getByText('Ost fra Oda · 1 l · ikke tilgjengelig')).toBeVisible()
  await expect(nextStep(page)).toBeHidden()
  expect(await fakeBasket()).toEqual({ ...START, [SOLD_OUT.id]: 1, 125: 1 })
  await expect(add(page)).toBeDisabled()

  // What's unavailable can't be picked, and another Ware's Oda Product can.
  await row(page, 'Ost').getByRole('button', { name: 'Velg erstatning' }).click()
  await expect(page.getByRole('option').filter({ hasText: 'ikke tilgjengelig' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('option', { name: 'Aldri fra Oda' })).toHaveCount(0)
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()

  // No counts here, and × takes the pick away.
  await expect(page.getByLabel('Antall pakker')).toHaveCount(0)
  await row(page, 'Ost').getByRole('button', { name: 'Fjern erstatning' }).click()
  await row(page, 'Ost').getByRole('button', { name: 'Velg erstatning' }).click()
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()

  await add(page).click()
  await expect(nextStep(page)).toBeVisible()
  // 1200 g in packs of 250 g, counted together with Smør, which has the same Oda Product.
  await expect(count(page, 'TINE Ekte smør')).toHaveText('6')
  await expect(leftOut(page)).toBeHidden()
  expect(await fakeBasket()).toEqual({ ...START, [SOLD_OUT.id]: 1, 125: 6 })
  // The Ware keeps its own, with no Pack Size from the Substitute.
  expect((await odaOf('Ost')).id.integerValue).toBe(String(SOLD_OUT.id))
  expect((await odaOf('Ost')).packGrams).toBeUndefined()

  // Avbryt takes out the Substitute too, and only what Kraft added.
  await cancel(page)
  expect(await fakeBasket()).toEqual({ ...START, [SOLD_OUT.id]: 1 })
})

// Two Entries on one unavailable Oda Product, which both reach the step, sharing one pack of a
// Substitute.
async function sharePack(page: Page) {
  await put('Melk', SOLD_OUT)
  await put('Kefir', SOLD_OUT)
  await fillBasket(page)
  await expect(page.getByRole('button', { name: 'Velg erstatning' })).toHaveCount(1)
  await expect(page.getByRole('listitem').getByText('Kefir', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').getByText('Melk', { exact: true })).toBeVisible()
  expect(await fakeBasket()).toEqual(START)
  await page.getByRole('button', { name: 'Velg erstatning' }).click()
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()
  await add(page).click()
  await expect(nextStep(page)).toBeVisible()
  // With no amounts each adds one, and they can share one.
  await expect(count(page, 'TINE Ekte smør')).toHaveText('2')
  await row(page, 'TINE Ekte smør').getByLabel('Færre pakker').click()
  await expect(count(page, 'TINE Ekte smør')).toHaveText('1')
  await expect(row(page, 'TINE Ekte smør').getByLabel('Flere pakker')).toBeEnabled()
  await expect(page.getByRole('listitem').getByText('Kefir', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').getByText('Melk', { exact: true })).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 125: 1 })
}

test('Entries on one unavailable product share one Substitute, and Bestilt checks off both', async ({ page }) => {
  await sharePack(page)
  await page.getByRole('button', { name: 'Bestilt' }).click()
  await expect.poll(async () => (await readDoc('entries/kefir')).checked.booleanValue).toBe(true)
  await expect.poll(async () => (await readDoc('entries/melk')).checked.booleanValue).toBe(true)
})

test('Entries sharing one pack of a Substitute are cancelled together', async ({ page }) => {
  await sharePack(page)
  await cancel(page)
  expect(await fakeBasket()).toEqual(START)
  await expect.poll(async () => (await readDoc('entries/kefir')).basket).toBeUndefined()
})

test('skipping leaves an Entry out, unchecked after Bestilt, and its Ware tries again next time', async ({ page }) => {
  await put('Ost', SOLD_OUT)
  await put('Smør', { id: 125, packText: '250 g' })
  await fillBasket(page)

  await skip(page).click()
  await expect(nextStep(page)).toBeVisible()
  await expect(leftOut(page)).toBeVisible()
  await expect(row(page, 'Ost').getByRole('button')).toHaveCount(0)
  await expect(row(page, 'Ost').getByRole('link')).toHaveCount(0)
  await expect(count(page, 'Smør fra Oda')).toHaveText('1')
  expect(await fakeBasket()).toEqual({ ...START, 125: 1 })

  await page.getByRole('button', { name: 'Bestilt' }).click()
  await expect(fill(page)).toBeVisible()
  await expect.poll(async () => (await readDoc('entries/smør')).checked.booleanValue).toBe(true)
  const ost = await readDoc('entries/ost')
  expect(ost.checked.booleanValue).toBe(false)
  expect(ost.basket).toBeUndefined()

  // Its Oda Product is still its own, ticked, and goes through the step again.
  await expect(page.getByRole('checkbox', { name: /^Ost/ })).toBeChecked()
  await fill(page).click()
  await expect(skip(page)).toBeVisible()
})

test('with everything unavailable the Oda Order still starts, and a reload returns to the step', async ({ page }) => {
  await put('Ost', SOLD_OUT)
  await fillBasket(page)
  await expect(skip(page)).toBeVisible()
  expect(await fakeBasket()).toEqual(START)

  // Picks are lost, and the warning leads back.
  await row(page, 'Ost').getByRole('button', { name: 'Velg erstatning' }).click()
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()
  await expect(row(page, 'Ost').getByRole('button', { name: 'Fjern erstatning' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Odabestilling pågår' }).click()
  await expect(skip(page)).toBeVisible()
  await expect(row(page, 'Ost').getByRole('button', { name: 'Velg erstatning' })).toBeVisible()

  await skip(page).click()
  await expect(nextStep(page)).toBeVisible()
  await expect(leftOut(page)).toBeVisible()
  await cancel(page)
  expect(await fakeBasket()).toEqual(START)
  await expect.poll(async () => (await readDoc('entries/ost')).basket).toBeUndefined()
})

test('what replaces an Off Sale product becomes the Ware\'s own', async ({ page }) => {
  await put('Brokkoli', OFF_SALE, 500)
  await put('Melk', { id: 430, packText: '1 l' })
  await fillBasket(page)

  await expect(row(page, 'Brokkoli').getByText('Brokkoli fra Oda · 400 g · ikke lenger tilgjengelig')).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 430: 4 })
  await expect.poll(() => odaOf('Brokkoli')).toBeUndefined()

  // Another Ware's Oda Product can become its own too.
  await row(page, 'Brokkoli').getByRole('button', { name: 'Velg nytt Oda-produkt' }).click()
  await expect(page.getByRole('option').filter({ hasText: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toHaveAttribute('aria-disabled', 'false')
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()

  await add(page).click()
  await expect(nextStep(page)).toBeVisible()
  // 500 g in packs of 250 g, read on the Order Summary and saved, as it's the Ware's own now.
  await expect(count(page, 'TINE Ekte smør')).toHaveText('2')
  expect(await fakeBasket()).toEqual({ ...START, 430: 4, 125: 2 })
  const oda = await odaOf('Brokkoli')
  expect(oda.id.integerValue).toBe('125')
  expect(Number(oda.packGrams.integerValue ?? oda.packGrams.doubleValue)).toBe(250)
})

test('an Off Sale Ware skipped waits in Nye varer with a suggestion', async ({ page }) => {
  await put('Brokkoli', OFF_SALE)
  await fillBasket(page)
  await skip(page).click()
  await expect(leftOut(page)).toBeVisible()
  await page.getByRole('button', { name: 'Bestilt' }).click()

  await expect(page.getByRole('heading', { name: 'Nye varer' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^Brokkoli/ })).not.toBeChecked()
  await expect(row(page, 'Brokkoli').getByRole('link', { name: 'Tine Lettmelk 1% fett · 1% fett, 1 l' })).toBeVisible()
  expect((await readDoc('entries/brokkoli')).checked.booleanValue).toBe(false)
})

test('Oda failing while adding Substitutes keeps the step, its picks and the error', async ({ page }) => {
  await put('Ost', SOLD_OUT)
  await fillBasket(page)
  await row(page, 'Ost').getByRole('button', { name: 'Velg erstatning' }).click()
  await page.getByRole('option').filter({ hasText: 'TINE Ekte smør' }).click()

  await failFakeOda(true)
  await add(page).click()
  await expect(page.getByText('Oda svarer ikke')).toBeVisible()
  await expect(row(page, 'Ost').getByRole('link', { name: 'TINE Ekte smør · 250 g' })).toBeVisible()
  expect(await fakeBasket()).toEqual(START)
  expect(Number((await readDoc('entries/ost')).basket.mapValue.fields.quantity.integerValue)).toBe(0)

  await failFakeOda(false)
  await add(page).click()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 125: 1 })
})
