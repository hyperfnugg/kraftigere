import { expect, test } from '@playwright/test'
import { MEMBERS, openMiddag, openTab, readDoc, reset, seed, signIn, writeDoc } from './helpers'
import { addWeeks, isoWeekId, weekLabel } from '../../src/dates'

test.beforeEach(async () => {
  await reset()
  await seed()
})

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

test('Middag opens on this week, › goes to next week only, and ‹ only to earlier weeks with a Menu', async ({
  page,
}) => {
  const thisWeek = isoWeekId(new Date())
  const twoAgo = addWeeks(thisWeek, -2)
  // Last week has no Menu, so ‹ skips it.
  await writeDoc(`weeks/${twoAgo}`, {
    menu: {
      mapValue: {
        fields: Object.fromEntries(
          DAYS.map((d) => [d, { arrayValue: d === 'mon' ? { values: [{ stringValue: 'Gammel suppe' }] } : {} }]),
        ),
      },
    },
  })

  await signIn(page, MEMBERS[0])
  await openTab(page, 'Middag')
  const next = page.getByRole('button', { name: 'Neste uke' })
  const previous = page.getByRole('button', { name: 'Forrige uke' })
  await expect(page.getByRole('heading', { name: weekLabel(thisWeek) })).toBeVisible()
  await next.click()
  await expect(page.getByRole('heading', { name: weekLabel(addWeeks(thisWeek, 1)) })).toBeVisible()
  await expect(next).toBeDisabled()

  await previous.click()
  await previous.click()
  await expect(page.getByRole('heading', { name: weekLabel(twoAgo) })).toBeVisible()
  await expect(page.getByText('Gammel suppe')).toBeVisible()
  await expect(previous).toBeDisabled()
})

test('Day Notes and Føringer stay after a reload, and each week has its own Day Notes', async ({ page }) => {
  await openMiddag(page)
  const note = page.getByRole('textbox', { name: 'Notat' })

  // Enter saves and closes.
  await page.getByRole('button', { name: 'Endre mandag' }).click()
  await note.fill('Gjester.')
  await note.press('Enter')
  await expect(page.getByText('· Gjester.')).toBeVisible()
  await expect(note).toHaveCount(0)

  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()

  // Leaving the editor saves and closes too.
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(page.getByRole('group', { name: /^Oppskrift / })).toHaveCount(6)
  await page.getByRole('button', { name: 'Endre mandag' }).click()
  await expect(note).toHaveValue('')
  await note.fill('Peter er borte.')
  await page.getByRole('heading', { name: 'Meny' }).click()
  await expect(page.getByText('· Peter er borte.')).toBeVisible()
  await expect(note).toHaveCount(0)
  // Reloading at once can lose a write the app hasn't stored yet.
  const nextWeek = addWeeks(isoWeekId(new Date()), 1)
  await expect
    .poll(async () => (await readDoc(`weeks/${nextWeek}`))?.dayNotes?.mapValue.fields.mon?.stringValue)
    .toBe('Peter er borte.')

  await page.reload()
  await openTab(page, 'Middag')
  await expect(page.getByText('· Gjester.')).toBeVisible()
  await page.getByRole('button', { name: 'Føringer' }).click()
  await expect(guidelines).toHaveValue('Fredag er taco.')
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(page.getByText('· Peter er borte.')).toBeVisible()
})
