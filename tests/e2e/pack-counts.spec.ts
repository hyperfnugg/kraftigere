import { expect, test, type Page } from '@playwright/test'
import {
  MEMBERS,
  changeFakeBasket,
  failFakeOda,
  fakeBasket,
  linkOda,
  openTab,
  readDoc,
  reset,
  resetFakeBasket,
  seed,
  signIn,
  writeDoc,
} from './helpers'

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

type Oda = { id: number; packText: string; packGrams?: number }
type Line = { quantity: number; shared?: boolean }

const dishFields = (grams: number) => ({
  mapValue: { fields: { week: str('2026-W45'), recipe: str('mon-0'), course: str('Middag'), grams: int(grams), pieces: { nullValue: null } } },
})

// A Ware with this Oda Product, named after the Ware.
const putWare = (name: string, oda: Oda) =>
  writeDoc(`wares/${name.toLowerCase()}`, {
    name: str(name),
    addCount: int(1),
    oda: {
      mapValue: {
        fields: { id: int(oda.id), name: str(name), packText: str(oda.packText), ...(oda.packGrams && { packGrams: int(oda.packGrams) }) },
      },
    },
  })

// A waiting Entry for a Ware with this Oda Product, with dishes needing these grams. With a line,
// it's In Basket as just after filling: not yet counted, with its packs in the fake Basket.
async function put(name: string, oda: Oda, { dishes = [], note, line }: { dishes?: number[]; note?: string; line?: Line } = {}) {
  await putWare(name, oda)
  await putEntry(name, oda, { dishes, note, line })
  if (line && line.quantity > 0) await changeFakeBasket([{ productId: oda.id, quantity: line.quantity }])
}

const putEntry = (name: string, oda: Oda, { dishes = [], note, line }: { dishes?: number[]; note?: string; line?: Line & { packText?: string } }) =>
  writeDoc(`entries/${name.toLowerCase()}`, {
    text: str(name),
    ware: str(name.toLowerCase()),
    checked: { booleanValue: false },
    createdAt: { timestampValue: '2026-11-04T08:00:00Z' },
    ...(note && { note: str(note) }),
    ...(dishes.length > 0 && { dishes: { arrayValue: { values: dishes.map(dishFields) } } }),
    ...(line && {
      basket: {
        mapValue: {
          fields: {
            productId: int(oda.id),
            quantity: int(line.quantity),
            name: str(name),
            packText: str(line.packText ?? oda.packText),
            uncounted: { booleanValue: true },
            ...(line.shared && { shared: { booleanValue: true } }),
          },
        },
      },
    }),
  })

const product = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.getByRole('link', { name: new RegExp(`^${name} · `) }) })
const count = (page: Page, name: string) => product(page, name).getByLabel('Antall pakker')
const more = (page: Page, name: string) => product(page, name).getByLabel('Flere pakker')
const fewer = (page: Page, name: string) => product(page, name).getByLabel('Færre pakker')
const check = (page: Page, name: string) => product(page, name).getByText('Sjekk antall')
const fill = (page: Page) => page.getByRole('button', { name: 'Fyll handlekurven' })
// Shown once counting is over, as "Regner ut antall pakker …" takes its place until then.
const nextStep = (page: Page) => page.getByText('Neste steg er ditt: bestill i')
const uncounted = async (name: string) => (await readDoc(`entries/${name.toLowerCase()}`)).basket.mapValue.fields.uncounted?.booleanValue
const packGrams = async (name: string) => {
  const grams = (await readDoc(`wares/${name.toLowerCase()}`)).oda.mapValue.fields.packGrams
  return grams && Number(grams.integerValue ?? grams.doubleValue)
}

async function cancel(page: Page) {
  await page.getByRole('button', { name: 'Avbryt', exact: true }).click()
  await page.getByRole('button', { name: 'Avbryt odabestillingen' }).click()
  await expect(fill(page)).toBeVisible()
}

// Signed in, with the Oda Link, on Hjem, so an Oda Order put in place after it shows nothing yet.
async function start(page: Page) {
  await signIn(page, MEMBERS[0])
  await linkOda(page)
  await openTab(page, 'Hjem')
}

test('starting counts reach the Basket, can be changed both ways, and Avbryt takes them all out', async ({ page }) => {
  await put('Pasta', { id: 501, packText: '500 g' }, { dishes: [600, 600] })
  await put('Melk', { id: 502, packText: '1 l' }, { note: 'mye' })
  await start(page)
  await openTab(page, 'Odabestilling')
  await fill(page).click()

  await expect(nextStep(page)).toBeVisible()
  // A Note doesn't change the count, and neither does a Ware with no amounts.
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(count(page, 'Melk')).toHaveText('1')
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 1 })

  // The Pack Size read for Pasta is saved, and none is read for what has no amounts.
  expect(await packGrams('Pasta')).toBe(500)
  expect(await packGrams('Melk')).toBeUndefined()

  await more(page, 'Melk').click()
  await expect(count(page, 'Melk')).toHaveText('2')
  await expect(more(page, 'Melk')).toBeEnabled()
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 2 })
  await fewer(page, 'Pasta').click()
  await expect(count(page, 'Pasta')).toHaveText('2')
  await expect(fewer(page, 'Pasta')).toBeEnabled()
  expect(await fakeBasket()).toEqual({ ...START, 501: 2, 502: 2 })

  await cancel(page)
  expect(await fakeBasket()).toEqual(START)
})

test('Entries on one Oda Product go in as one pack, and their dishes are added up', async ({ page }) => {
  await put('Pasta', { id: 501, packText: '1 kg' }, { dishes: [300] })
  await put('Pastasalat', { id: 501, packText: '1 kg' }, { dishes: [400] })
  await put('Melk', { id: 502, packText: '1 l' })
  await put('Kefir', { id: 502, packText: '1 l' })
  await start(page)
  await openTab(page, 'Odabestilling')
  await fill(page).click()

  // 300 g and 400 g in packs of 1 kg is one pack. Without amounts each Entry adds one.
  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('1')
  await expect(count(page, 'Kefir')).toHaveText('2')
  expect(await fakeBasket()).toEqual({ ...START, 501: 1, 502: 2 })

  // They can be one carton.
  await fewer(page, 'Kefir').click()
  await expect(count(page, 'Kefir')).toHaveText('1')
  await expect(fewer(page, 'Kefir')).toBeDisabled()
  await expect(more(page, 'Kefir')).toBeEnabled()
  expect(await fakeBasket()).toEqual({ ...START, 501: 1, 502: 1 })

  // Bestilt checks off every Entry, whichever holds the packs.
  await page.getByRole('button', { name: 'Bestilt' }).click()
  await expect(fill(page)).toBeVisible()
  for (const name of ['pasta', 'pastasalat', 'melk', 'kefir'])
    await expect.poll(async () => (await readDoc(`entries/${name}`)).checked.booleanValue).toBe(true)
})

test('counts left after filling land when the Order Summary is next opened', async ({ page }) => {
  await start(page)
  // As if the app was closed right after filling.
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [1200], line: { quantity: 1 } })
  await put('Ris', { id: 502, packText: '1 kg' }, { dishes: [1500], line: { quantity: 1 } })
  await openTab(page, 'Odabestilling')

  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(count(page, 'Ris')).toHaveText('2')
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 2 })
  expect(await uncounted('Pasta')).toBeUndefined()
  expect(await packGrams('Ris')).toBe(1000)
})

test('a Substitute meeting a product already in the Oda Order is counted together with it', async ({ page }) => {
  await start(page)
  await put('Smør', { id: 125, packText: '250 g' }, { line: { quantity: 1 } })
  // Its own is unavailable, and the step after filling put TINE Ekte smør in its place.
  await putWare('Ost', { id: 24681, packText: '1 l' })
  await putEntry('Ost', { id: 125, packText: '250 g' }, { dishes: [1200], line: { quantity: 1 } })
  await changeFakeBasket([{ productId: 125, quantity: 1 }])
  await openTab(page, 'Odabestilling')

  // 1200 g is 5 packs, and Smør, with no amounts, adds one.
  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Ost')).toHaveText('6')
  await expect(page.getByRole('listitem')).toHaveCount(1)
  expect(await fakeBasket()).toEqual({ ...START, 125: 6 })
  // Saved on the Ware whose own it is, not on the one it substitutes for.
  expect(await packGrams('Smør')).toBe(250)
  expect(await packGrams('Ost')).toBeUndefined()

  await cancel(page)
  expect(await fakeBasket()).toEqual(START)
})

test('two devices counting at once count once', async ({ page, browser }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [1200], line: { quantity: 1 } })
  await put('Ris', { id: 502, packText: '1 kg' }, { dishes: [1500], line: { quantity: 1 } })
  const other = await (await browser.newContext()).newPage()
  await signIn(other, MEMBERS[1])

  await Promise.all([openTab(page, 'Odabestilling'), openTab(other, 'Odabestilling')])
  for (const p of [page, other]) {
    // Both count at once, and the emulator's transactions then sometimes take over 10 s.
    await expect(nextStep(p)).toBeVisible({ timeout: 25_000 })
    await expect(count(p, 'Pasta')).toHaveText('3')
    await expect(count(p, 'Ris')).toHaveText('2')
  }
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 2 })

  // A count set on one shows on the other.
  await more(page, 'Ris').click()
  await expect(count(other, 'Ris')).toHaveText('3')
  expect(await fakeBasket()).toEqual({ ...START, 501: 3, 502: 3 })
})

test('a failed read shows "Sjekk antall" and blocks nothing, and reopening reads again', async ({ page }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: 'pose' }, { dishes: [1200], line: { quantity: 1 } })
  await openTab(page, 'Odabestilling')

  await expect(check(page, 'Pasta')).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Bestilt' })).toBeEnabled()
  expect(await uncounted('Pasta')).toBe(true)

  // Oda now says something the AI can read.
  await putEntry('Pasta', { id: 501, packText: 'pose' }, { dishes: [1200], line: { quantity: 1, packText: '500 g' } })
  await openTab(page, 'Hjem')
  await openTab(page, 'Odabestilling')
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(check(page, 'Pasta')).toBeHidden()
  await expect(nextStep(page)).toBeVisible()
  expect(await fakeBasket()).toEqual({ ...START, 501: 3 })
})

test('a count set by hand is never changed by a later starting count', async ({ page, browser }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: 'pose' }, { dishes: [1200], line: { quantity: 1 } })
  await openTab(page, 'Odabestilling')
  await expect(check(page, 'Pasta')).toBeVisible()

  // Using the stepper clears the warning.
  await more(page, 'Pasta').click()
  await expect(count(page, 'Pasta')).toHaveText('2')
  await expect(check(page, 'Pasta')).toBeHidden()
  await expect.poll(() => uncounted('Pasta')).toBeUndefined()

  // Another device would now count 3, and leaves it alone.
  await putWare('Pasta', { id: 501, packText: 'pose', packGrams: 500 })
  const other = await (await browser.newContext()).newPage()
  await signIn(other, MEMBERS[1])
  await openTab(other, 'Odabestilling')
  await expect(nextStep(other)).toBeVisible()
  await expect(count(other, 'Pasta')).toHaveText('2')
  expect(await fakeBasket()).toEqual({ ...START, 501: 2 })
})

test('after a change, Avbryt takes out what Kraft holds and leaves what the Family added', async ({ page }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [1200], line: { quantity: 1 } })
  await openTab(page, 'Odabestilling')
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(nextStep(page)).toBeVisible()

  // Added on oda.com, which Kraft doesn't read back.
  await changeFakeBasket([{ productId: 501, quantity: 2 }])
  await fewer(page, 'Pasta').click()
  await expect(count(page, 'Pasta')).toHaveText('2')
  await expect(fewer(page, 'Pasta')).toBeEnabled()
  expect(await fakeBasket()).toEqual({ ...START, 501: 4 })

  await cancel(page)
  expect(await fakeBasket()).toEqual({ ...START, 501: 2 })
})

test('Oda failing while counts land leaves them not yet counted, and they land next time', async ({ page }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [1200], line: { quantity: 1 } })
  await failFakeOda(true)
  await openTab(page, 'Odabestilling')

  await expect(page.getByText('Oda svarer ikke')).toBeVisible()
  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Bestilt' })).toBeEnabled()
  expect(await uncounted('Pasta')).toBe(true)
  expect(await fakeBasket()).toEqual({ ...START, 501: 1 })

  await failFakeOda(false)
  await openTab(page, 'Hjem')
  await openTab(page, 'Odabestilling')
  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('3')
  await expect(page.getByText('Oda svarer ikke')).toBeHidden()
  expect(await fakeBasket()).toEqual({ ...START, 501: 3 })
})

test('Oda failing while a count changes puts it back and says so on its row', async ({ page }) => {
  await start(page)
  await put('Pasta', { id: 501, packText: '500 g', packGrams: 500 }, { dishes: [1200], line: { quantity: 1 } })
  await openTab(page, 'Odabestilling')
  await expect(nextStep(page)).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('3')

  await failFakeOda(true)
  await more(page, 'Pasta').click()
  await expect(product(page, 'Pasta').getByText('Oda svarer ikke')).toBeVisible()
  await expect(count(page, 'Pasta')).toHaveText('3')
  expect(await fakeBasket()).toEqual({ ...START, 501: 3 })
  expect(Number((await readDoc('entries/pasta')).basket.mapValue.fields.quantity.integerValue)).toBe(3)

  await failFakeOda(false)
  await more(page, 'Pasta').click()
  await expect(count(page, 'Pasta')).toHaveText('4')
  await expect(more(page, 'Pasta')).toBeEnabled()
  await expect(product(page, 'Pasta').getByText('Oda svarer ikke')).toBeHidden()
  expect(await fakeBasket()).toEqual({ ...START, 501: 4 })
})
