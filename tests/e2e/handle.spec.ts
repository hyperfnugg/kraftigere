import { expect, test, type Page } from '@playwright/test'
import { MEMBERS, addEntry, entry, openTab, readDoc, reset, seed, signIn, writeDoc } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const rows = (page: Page) => page.getByRole('listitem')
const order = async (ware: string) => {
  const o = (await readDoc(`wares/${ware}`)).order
  return o && Number(o.integerValue ?? o.doubleValue)
}

// Drags a row by its ↕ handle onto another row, in steps, as a finger would.
async function drag(page: Page, from: string, onto: string) {
  const a = (await page.getByLabel(`Flytt ${from}`).boundingBox())!
  const b = (await entry(page, onto).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  const y = b.y + b.height / 2 + (b.y > a.y ? 4 : -4)
  for (let s = 1; s <= 10; s++) await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + ((y - a.y - a.height / 2) * s) / 10)
  await page.mouse.up()
}

test('dragging a row moves its Ware, writing only it, and the order holds after a reload', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['milk', 'eggs', 'bread']) await addEntry(page, text)
  await openTab(page, 'Handle')
  // New Wares come in the order they were first added.
  await expect(rows(page)).toHaveText(['milk', 'eggs', 'bread'])
  const [milk, eggs] = [await order('milk'), await order('eggs')]

  await drag(page, 'bread', 'eggs')
  await expect(rows(page)).toHaveText(['milk', 'bread', 'eggs'])
  await expect.poll(() => order('bread')).toBe((milk + eggs) / 2)
  expect([await order('milk'), await order('eggs')]).toEqual([milk, eggs])

  await page.reload()
  await openTab(page, 'Handle')
  await expect(rows(page)).toHaveText(['milk', 'bread', 'eggs'])
})

test('a Ware added again returns to its place, and a new one comes last', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['milk', 'eggs', 'bread']) await addEntry(page, text)
  await openTab(page, 'Handle')
  await drag(page, 'bread', 'milk')
  await expect(rows(page)).toHaveText(['bread', 'milk', 'eggs'])

  await openTab(page, 'Hjem')
  await entry(page, 'bread').getByText('bread').click()
  await entry(page, 'bread').getByRole('button', { name: 'Fjern' }).click()
  await expect(entry(page, 'bread')).toHaveCount(0)
  await addEntry(page, 'butter')
  await addEntry(page, 'bread')

  await openTab(page, 'Handle')
  await expect(rows(page)).toHaveText(['bread', 'milk', 'eggs', 'butter'])
})

test('Wares from before Store Order go by their Entries, and a drop between tied ones pushes on those in the way', async ({
  page,
}) => {
  // As one Iverksett before Store Order left them: Wares without an order, Entries added at
  // the same time. "off" has no Entry, and sits just after them.
  const at = { timestampValue: '2026-11-01T12:00:00Z' }
  for (const [id, name] of [
    ['e1', 'flour'],
    ['e2', 'salt'],
    ['e3', 'yeast'],
  ]) {
    await writeDoc(`wares/${name}`, { name: { stringValue: name }, addCount: { integerValue: '0' } })
    await writeDoc(`entries/${id}`, { text: { stringValue: name }, ware: { stringValue: name }, checked: { booleanValue: false }, createdAt: at })
  }
  const time = Date.parse(at.timestampValue)
  await writeDoc('wares/off', { name: { stringValue: 'off' }, addCount: { integerValue: '0' }, order: { integerValue: String(time + 1) } })

  await signIn(page, MEMBERS[0])
  await openTab(page, 'Handle')
  // Tied, by Entry id.
  await expect(rows(page)).toHaveText(['flour', 'salt', 'yeast'])
  await drag(page, 'yeast', 'salt')
  await expect(rows(page)).toHaveText(['flour', 'yeast', 'salt'])
  await expect.poll(() => order('yeast')).toBe(time + 1)
  expect(await order('salt')).toBe(time + 2)
  // Pushed on, so it stays after salt.
  expect(await order('off')).toBe(time + 3)
  expect(await order('flour')).toBeUndefined()

  await page.reload()
  await openTab(page, 'Handle')
  await expect(rows(page)).toHaveText(['flour', 'yeast', 'salt'])
})

test('Checked Entries have no handle', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  for (const text of ['milk', 'eggs']) await addEntry(page, text)
  await openTab(page, 'Handle')
  await expect(page.getByLabel(/^Flytt /)).toHaveCount(2)
  await entry(page, 'milk').getByRole('checkbox').click()
  await expect(page.getByLabel(/^Flytt /)).toHaveCount(1)
})
